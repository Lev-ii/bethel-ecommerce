import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_ADMIN, E2E_DATABASE_URL } from "./constantes";

/**
 * Chantier 6 : l'administration fixe une promotion datee ; la boutique
 * affiche le prix promo avec un compte a rebours ; si la promotion se termine
 * pendant que l'article est au panier, le client voit le nouveau prix avant
 * de payer.
 */

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const ID = "e2e-promo-datee";
const NAME = "Softbox E2E en promotion";
const CUSTOMER = "Client promo E2E";

test.beforeAll(async () => {
  const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
  await sql`
    INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published)
    VALUES (${ID}, ${ID}, ${NAME}, 'Test', ${category.slug}, 'Accroche', 50000, 20, '/produits/trepied.jpg', TRUE)
    ON CONFLICT (id) DO NOTHING
  `;
});

test.afterAll(async () => {
  await sql`DELETE FROM orders WHERE customer_name = ${CUSTOMER}`;
  await sql`DELETE FROM products WHERE id = ${ID}`;
  await sql.end();
});

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

async function signIn(page: Page, next: string) {
  await page.goto(`/connexion?suite=${next}`);
  await page.getByLabel("Email", { exact: true }).fill(E2E_ADMIN.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/** Date au format du champ datetime-local, a l'heure d'Abidjan (UTC). */
function inputDate(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 16);
}

test("l'admin fixe une promotion datée ; la fiche affiche le prix promo et le compte à rebours", async ({ page }) => {
  await signIn(page, `/admin/produits/${ID}`);
  await expect(page).toHaveURL(new RegExp(`/admin/produits/${ID}$`));

  // Saisie refusee : prix promo au-dessus du prix de vente.
  await page.getByLabel("Prix promo").fill("60000");
  await page.getByLabel("Fin de la promotion").fill(inputDate(2 * 86_400_000));
  await page.getByRole("button", { name: /Enregistrer/ }).click();
  await expect(page.getByText("Le prix promo doit être supérieur à zéro et inférieur au prix de vente.")).toBeVisible();

  await page.getByLabel("Prix promo").fill("35000");
  await page.getByLabel("Fin de la promotion").fill(inputDate(2 * 86_400_000 + 3_600_000));
  await page.getByRole("button", { name: /Enregistrer/ }).click();
  await expect(page).toHaveURL(/\/admin\/produits\?modifie=/);
  const [row] = await sql<Array<{ promo_price: number; price: number; slug: string }>>`
    SELECT promo_price, price, slug FROM products WHERE id = ${ID}
  `;
  expect(row).toMatchObject({ promo_price: 35000, price: 50000 });

  // L'enregistrement recalcule l'adresse a partir du nom.
  await page.goto(`/boutique/${row.slug}`);
  // formatPrice separe les milliers par une espace fine insecable.
  await expect(page.getByText(/^35\s000/).first()).toBeVisible();
  const timer = page.getByRole("timer").first();
  await expect(timer).toContainText(/Fin dans 2 j 0[01] h/);
  const before = await timer.innerText();
  await expect.poll(() => timer.innerText(), { timeout: 3000 }).not.toBe(before);
  await page.screenshot({ path: "test-results/promotion-fiche.png" });

  // Le formulaire garde le prix de vente saisi, pas le prix promo.
  await page.goto(`/admin/produits/${ID}`);
  await expect(page.getByLabel("Prix de vente")).toHaveValue("50000");
  await expect(page.getByText("En cours")).toBeVisible();

  // Journal : la promotion est tracee.
  await page.goto("/admin/journal");
  await expect(page.getByText("Promotion datée").first()).toBeVisible();
});

test("promotion terminée pendant que l'article est au panier : le client voit le nouveau prix avant de payer", async ({ page }) => {
  await sql`
    UPDATE products SET promo_price = 35000, promo_starts_at = NULL, promo_ends_at = now() + interval '1 day'
    WHERE id = ${ID}
  `;
  await expect(async () => {
    const [{ slug }] = await sql<Array<{ slug: string }>>`SELECT slug FROM products WHERE id = ${ID}`;
    await page.goto(`/boutique/${slug}`);
    await expect(page.getByRole("timer").first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 45_000 });
  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("bethel-panier") ?? "{}")?.state?.items?.[0]?.unitPrice))
    .toBe(35000);

  // La promotion se termine.
  await sql`UPDATE products SET promo_ends_at = now() - interval '1 second' WHERE id = ${ID}`;

  await page.goto("/commande");
  await page.getByRole("button", { name: /Retrait en boutique/ }).click();
  await page.getByLabel("Nom complet").fill(CUSTOMER);
  await page.getByLabel("Téléphone").fill("+225 07 07 07 07 08");
  await page.getByRole("button", { name: /Espèces au retrait/ }).click();
  await page.getByRole("button", { name: "Confirmer la commande" }).click();

  await expect(page.getByText(/Le prix de Softbox E2E en promotion est passé de 35.000.*à 50.000/)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("bethel-panier") ?? "{}")?.state?.items?.[0]?.unitPrice))
    .toBe(50000);
  const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM orders WHERE customer_name = ${CUSTOMER}`;
  expect(n).toBe(0);

  // Nouvelle validation, au prix affiche.
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page).toHaveURL(/\/commande\/confirmation/);
  const [order] = await sql<Array<{ total: number }>>`SELECT total FROM orders WHERE customer_name = ${CUSTOMER}`;
  expect(order.total).toBe(50000);
});
