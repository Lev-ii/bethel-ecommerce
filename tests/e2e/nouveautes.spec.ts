import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { E2E_DATABASE_URL } from "./constantes";

/**
 * Chantier 4 : un produit tout juste ajoute porte le badge « Nouveau » et
 * apparait dans la section Nouveautes de l'accueil ; le catalogue importe a
 * l'ouverture n'en porte pas.
 */

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const ID = "e2e-nouveaute";
const NAME = "Micro-cravate E2E tout juste arrivé";

test.beforeAll(async () => {
  const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
  // Une heure apres le premier produit au moins : hors de l'import initial.
  await sql`
    INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published, created_at)
    VALUES (${ID}, ${ID}, ${NAME}, 'Test', ${category.slug}, 'Accroche', 25000, 5, '/produits/trepied.jpg', TRUE,
            GREATEST(now(), (SELECT min(created_at) FROM products) + interval '2 hours'))
    ON CONFLICT (id) DO NOTHING
  `;
});

test.afterAll(async () => {
  await sql`DELETE FROM products WHERE id = ${ID}`;
  await sql.end();
});

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

test("le produit ajouté porte le badge et ouvre la section Nouveautés de l'accueil", async ({ page }) => {
  // Le catalogue est en cache jusqu'a 30 s : le produit, insere directement en
  // base, apparait au plus tard a l'expiration.
  await expect(async () => {
    await page.goto("/");
    const section = page.getByRole("region", { name: "Nouveautés" });
    await expect(section.getByRole("heading", { name: NAME })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 45_000 });

  const card = page.getByRole("region", { name: "Nouveautés" }).locator(".card").filter({ hasText: NAME });
  await expect(card.getByText("Nouveau", { exact: true })).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/nouveautes-accueil.png" });

  await card.getByRole("link").first().click();
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveText(NAME);
  await expect(title.locator("xpath=..").getByText("Nouveau", { exact: true })).toBeVisible();
});

test("le catalogue importé à l'ouverture ne porte pas le badge", async ({ page }) => {
  const [old] = await sql<Array<{ slug: string }>>`
    SELECT slug FROM products WHERE published AND created_at = (SELECT min(created_at) FROM products) LIMIT 1
  `;
  await page.goto(`/boutique/${old.slug}`);
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toBeVisible();
  // En-tete de la fiche seulement : les produits similaires, plus bas, peuvent
  // compter une nouveaute.
  await expect(title.locator("xpath=..").getByText("Nouveau", { exact: true })).toHaveCount(0);
});

test("le tri « Nouveautés d'abord » met le produit ajouté en tête", async ({ page }) => {
  await expect(async () => {
    await page.goto("/boutique?tri=nouveautes");
    await expect(page.locator(".card h3").first()).toHaveText(NAME, { timeout: 1000 });
  }).toPass({ timeout: 45_000 });
  await expect(page.getByLabel("Trier")).toHaveValue("nouveautes");
});
