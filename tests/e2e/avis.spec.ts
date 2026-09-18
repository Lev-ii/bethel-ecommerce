import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { E2E_ADMIN, E2E_AUTH_SECRET, E2E_DATABASE_URL } from "./constantes";

/**
 * Avis clients de bout en bout : l'acheteur d'une commande livree note un
 * article depuis son lien de suivi, l'avis attend la moderation, l'admin le
 * publie, il apparait sur la fiche et la carte du produit.
 */

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const REF = "BTH-2609-AVIS01";
const TEXT = "Très stable et facile à régler, parfait pour mes lives du soir.";

/** Meme calcul que lib/shop/invoice.ts : le lien envoye au client. */
function trackingUrl(reference: string) {
  const token = createHmac("sha256", E2E_AUTH_SECRET).update(reference.trim().toLowerCase()).digest("hex").slice(0, 32);
  return `/suivi?ref=${reference}&t=${token}`;
}

let product: { id: string; slug: string; name: string };

test.beforeAll(async () => {
  [product] = await sql<Array<{ id: string; slug: string; name: string }>>`
    SELECT id, slug, name FROM products WHERE published ORDER BY id DESC LIMIT 1
  `;
  await sql`DELETE FROM orders WHERE reference = ${REF}`;
  await sql`
    INSERT INTO orders (id, reference, customer_name, customer_phone, delivery_mode, payment_method, total, status)
    VALUES ('e2e-avis', ${REF}, 'Aminata Koné', '+225 07 00 00 00 08', 'retrait', 'especes-retrait', 1000, 'livree')
  `;
  await sql`INSERT INTO order_lines (order_id, product_id, name, unit_price, quantity) VALUES ('e2e-avis', ${product.id}, ${product.name}, 1000, 1)`;
});

test.afterAll(async () => {
  await sql`DELETE FROM orders WHERE reference = ${REF}`;
  await sql.end();
});

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

test("un acheteur note son article, l'admin publie, l'avis apparaît sur la boutique", async ({ page }) => {
  // Sans le lien a jeton, personne ne peut noter.
  await page.goto(`/suivi?ref=${REF}`);
  await expect(page.getByText("Merci pour votre confiance !")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notez vos articles" })).toHaveCount(0);

  // --- L'acheteur, depuis le lien recu
  await page.goto(trackingUrl(REF));
  await expect(page.getByRole("heading", { name: "Notez vos articles" })).toBeVisible();
  await expect(page.getByLabel("Nom affiché")).toHaveValue("Aminata K.");
  await page.getByText("4 étoiles : Très bien").click({ force: true });
  await page.getByLabel("Votre avis").fill(TEXT);
  await page.getByRole("button", { name: "Envoyer mon avis" }).click();
  await expect(page.getByText("Merci pour votre avis ! Il sera publié après validation.")).toBeVisible();
  await expect(page.getByText("En attente de validation")).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer mon avis" })).toHaveCount(0);

  // Pas encore sur la fiche.
  await page.goto(`/boutique/${product.slug}`);
  await expect(page.getByText(TEXT)).toHaveCount(0);

  // --- L'administration publie
  await page.goto("/connexion?suite=/admin/avis");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/:3100\/admin\/avis$/);
  const card = page.getByRole("listitem").filter({ hasText: TEXT });
  await expect(card).toContainText(REF);
  await card.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("status")).toContainText("Avis publié");

  // --- Visible sur la fiche, avec la mention « Achat vérifié », et sur la carte
  await page.goto(`/boutique/${product.slug}`);
  await expect(page.getByText(TEXT)).toBeVisible();
  await expect(page.getByText("Achat vérifié")).toBeVisible();
  await expect(page.getByText("4 / 5 · 1 avis")).toBeVisible();
  await page.goto("/boutique");
  await expect(page.locator(".card").filter({ hasText: product.name }).getByLabel("4 sur 5 étoiles")).toBeVisible();

  // --- Journal
  await page.goto("/admin/journal?categorie=avis");
  await expect(page.getByText("Avis publié").first()).toBeVisible();
});
