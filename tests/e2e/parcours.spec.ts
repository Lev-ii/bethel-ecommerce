import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_CRON_SECRET, E2E_DATABASE_URL } from "./constantes";

/**
 * Parcours d'achat d'un client invite, dans un vrai navigateur, face au site
 * construit comme en production et a un faux Jeko (tests/e2e/faux-jeko.mjs).
 */

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });

test.afterAll(async () => {
  await sql.end();
});

// Rien ne sort de la machine : polices Google et autres ressources externes
// sont coupees, pour qu'un reseau lent ne bloque pas le chargement des pages.
test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

interface Product {
  id: string;
  slug: string;
  stock: number;
}

/**
 * Produit en ligne avec du stock, jamais commande par un parcours precedent :
 * chaque parcours verifie le stock d'un produit que personne d'autre ne touche.
 */
async function pickProduct(): Promise<Product> {
  const [product] = await sql<Product[]>`
    SELECT p.id, p.slug, p.stock FROM products p
    WHERE p.published AND p.stock >= 3
      AND NOT EXISTS (
        SELECT 1 FROM order_lines l JOIN orders o ON o.id = l.order_id
        WHERE l.product_id = p.id AND o.customer_name LIKE 'E2E %'
      )
    ORDER BY p.stock DESC, p.id
    LIMIT 1
  `;
  if (!product) throw new Error("Aucun produit disponible pour le parcours.");
  return product;
}

async function stockOf(id: string) {
  const [row] = await sql<Array<{ stock: number }>>`SELECT stock FROM products WHERE id = ${id}`;
  return row.stock;
}

async function lastOrderOf(customerName: string) {
  const [row] = await sql<Array<{ id: string; reference: string; status: string; paid_at: Date | null }>>`
    SELECT id, reference, status, paid_at FROM orders WHERE customer_name = ${customerName}
    ORDER BY created_at DESC LIMIT 1
  `;
  return row;
}

async function addToCart(page: Page, product: Product) {
  await page.goto(`/boutique/${product.slug}`);
  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("bethel-panier") ?? "{}")?.state?.items?.length ?? 0))
    .toBe(1);
}

async function fillCheckout(page: Page, customerName: string, operator = "Orange Money") {
  await page.goto("/commande");
  await page.getByRole("button", { name: /Retrait en boutique/ }).click();
  await page.getByLabel("Nom complet").fill(customerName);
  await page.getByLabel("Téléphone").fill("+225 07 07 07 07 07");
  await page.getByRole("button", { name: /Mobile money/ }).click();
  await page.getByRole("button", { name: operator, exact: true }).click();
}

async function payOnJeko(page: Page) {
  await page.getByRole("button", { name: "Valider et payer" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3101\/pay\/pr-e2e-/);
  await expect(page.getByRole("heading", { name: /Paiement BTH-/ })).toBeVisible();
}

test("client invité : commande, paiement mobile money, confirmation", async ({ page }) => {
  const product = await pickProduct();
  const customer = `E2E payé ${Date.now()}`;

  await addToCart(page, product);
  await fillCheckout(page, customer);
  await payOnJeko(page);

  // Stock reserve des la redirection vers Jeko, commande en attente.
  expect(await stockOf(product.id)).toBe(product.stock - 1);
  expect((await lastOrderOf(customer)).status).toBe("attente_paiement");

  await page.getByRole("button", { name: "Payer" }).click();

  await expect(page).toHaveURL(/\/commande\/confirmation\?ref=BTH-/);
  await expect(page.getByRole("heading", { name: "Commande enregistrée" })).toBeVisible();
  await expect(page.getByText("Paiement reçu")).toBeVisible();

  const order = await lastOrderOf(customer);
  expect(order.status).toBe("recue");
  expect(order.paid_at).not.toBeNull();
  await expect(page.getByText(order.reference)).toBeVisible();
  expect(await stockOf(product.id)).toBe(product.stock - 1);
  // Panier vide une fois le paiement confirme.
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("bethel-panier") ?? "{}")?.state?.items?.length ?? 0))
    .toBe(0);
});

test("paiement Wave : proposé avec les autres opérateurs et accepté jusqu'à la confirmation", async ({ page }) => {
  const product = await pickProduct();
  const customer = `E2E Wave ${Date.now()}`;

  await addToCart(page, product);
  await page.goto("/commande");
  await page.getByRole("button", { name: /Mobile money/ }).click();
  for (const operator of ["Wave", "Orange Money", "MTN Money", "Moov Money", "Djamo"]) {
    await expect(page.getByRole("button", { name: operator, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: "test-results/operateurs.png" });

  await fillCheckout(page, customer, "Wave");
  await expect(page.getByText("page de paiement sécurisée Wave")).toBeVisible();
  await payOnJeko(page);
  await page.getByRole("button", { name: "Payer" }).click();

  await expect(page.getByText("Paiement reçu")).toBeVisible();
  const [order] = await sql<Array<{ payment_method: string; status: string }>>`
    SELECT payment_method, status FROM orders WHERE customer_name = ${customer}
  `;
  expect(order).toEqual({ payment_method: "wave", status: "recue" });
});

test("retour arrière depuis Jeko : coordonnées et panier retrouvés", async ({ page }) => {
  const product = await pickProduct();
  const customer = `E2E retour ${Date.now()}`;

  await addToCart(page, product);
  await fillCheckout(page, customer);
  await payOnJeko(page);

  await page.goBack();

  await expect(page).toHaveURL(/\/commande$/);
  await expect(page.getByLabel("Nom complet")).toHaveValue(customer);
  await expect(page.getByLabel("Téléphone")).toHaveValue("+225 07 07 07 07 07");
  await expect(page.getByRole("button", { name: /Retrait en boutique/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Orange Money", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/1\s*×/)).toBeVisible();
});

test("paiement annulé sur Jeko : commande annulée, stock rendu, panier conservé", async ({ page }) => {
  const product = await pickProduct();
  const customer = `E2E annulé ${Date.now()}`;

  await addToCart(page, product);
  await fillCheckout(page, customer);
  await payOnJeko(page);
  await page.getByRole("button", { name: "Annuler" }).click();

  await expect(page).toHaveURL(/\/panier\?erreur=paiement/);
  await expect(page.getByRole("alert").filter({ hasText: "Le paiement n'a pas abouti" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Passer la commande" })).toBeVisible();

  expect((await lastOrderOf(customer)).status).toBe("annulee");
  expect(await stockOf(product.id)).toBe(product.stock);
});

test("client qui ferme la page en plein paiement : réservation libérée après 30 minutes", async ({ page, request }) => {
  const product = await pickProduct();
  const customer = `E2E abandon ${Date.now()}`;

  await addToCart(page, product);
  await fillCheckout(page, customer);
  await payOnJeko(page);
  await page.close();

  const order = await lastOrderOf(customer);
  expect(order.status).toBe("attente_paiement");
  expect(await stockOf(product.id)).toBe(product.stock - 1);

  // Trente et une minutes plus tard, la tache planifiee passe.
  await sql`UPDATE orders SET created_at = now() - interval '31 minutes' WHERE id = ${order.id}`;
  const denied = await request.get("/api/cron/release-expired-orders");
  expect(denied.status()).toBe(401);
  const response = await request.get("/api/cron/release-expired-orders", {
    headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, released: 1 });

  expect((await lastOrderOf(customer)).status).toBe("annulee");
  expect(await stockOf(product.id)).toBe(product.stock);
});
