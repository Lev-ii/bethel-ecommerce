import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_DATABASE_URL } from "./constantes";

/**
 * Chantier 5 : a l'arrivee sur le site, une carte animee presente la derniere
 * nouveaute et la meilleure promotion. Une fois par session, jamais pendant
 * l'achat, fermee par Echap ou la croix.
 */

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const NEW_ID = "e2e-arrivee-nouveau";
const NEW_NAME = "Lumière LED E2E arrivée ce matin";
const PROMO_ID = "e2e-arrivee-promo";
const PROMO_NAME = "Perche E2E à prix cassé";

test.beforeAll(async () => {
  const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
  await sql`
    INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published, created_at)
    VALUES (${NEW_ID}, ${NEW_ID}, ${NEW_NAME}, 'Test', ${category.slug}, 'Accroche', 40000, 5, '/produits/trepied.jpg', TRUE,
            GREATEST(now(), (SELECT min(created_at) FROM products) + interval '2 hours') + interval '1 minute')
    ON CONFLICT (id) DO NOTHING
  `;
  // -90 % : la plus forte reduction du catalogue de test.
  await sql`
    INSERT INTO products (id, slug, name, brand, category, headline, price, compare_at_price, stock, image, published)
    VALUES (${PROMO_ID}, ${PROMO_ID}, ${PROMO_NAME}, 'Test', ${category.slug}, 'Accroche', 10000, 100000, 5, '/produits/trepied.jpg', TRUE)
    ON CONFLICT (id) DO NOTHING
  `;
});

test.afterAll(async () => {
  await sql`DELETE FROM products WHERE id IN (${NEW_ID}, ${PROMO_ID})`;
  await sql.end();
});

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

const card = (page: Page) => page.getByRole("complementary", { name: "À ne pas manquer" });

/** Le catalogue est en cache jusqu'a 30 s : on attend que la carte montre les produits de test. */
async function openWithTestProducts(page: Page, path = "/") {
  await expect(async () => {
    await page.evaluate(() => sessionStorage.clear()).catch(() => {});
    await page.goto(path);
    await expect(card(page).getByText(NEW_NAME)).toBeVisible({ timeout: 3000 });
    await expect(card(page).getByText(PROMO_NAME)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 60_000 });
}

test("la carte présente la nouveauté et la promotion, puis ne revient pas dans la session", async ({ page }) => {
  await openWithTestProducts(page);
  await expect(card(page).getByText("Nouveau", { exact: true })).toBeVisible();
  await expect(card(page).getByText("Promo -90%")).toBeVisible();
  await page.waitForTimeout(1500); // fin de l'animation
  await page.screenshot({ path: "test-results/carte-arrivee-1280.png" });

  await page.keyboard.press("Escape");
  await expect(card(page)).toHaveCount(0);

  // Meme session : plus de carte, ni sur cette page ni sur une autre.
  await page.reload();
  await page.waitForTimeout(2000);
  await expect(card(page)).toHaveCount(0);
  await page.goto("/boutique");
  await page.waitForTimeout(2000);
  await expect(card(page)).toHaveCount(0);
});

test("la croix ferme la carte ; un clic sur un produit ouvre sa fiche", async ({ page }) => {
  await openWithTestProducts(page);
  await card(page).getByRole("link", { name: new RegExp(PROMO_NAME) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(PROMO_NAME);
  await expect(card(page)).toHaveCount(0);

  await openWithTestProducts(page);
  await card(page).getByRole("button", { name: "Fermer" }).click();
  await expect(card(page)).toHaveCount(0);
});

test("jamais pendant l'achat : ni au panier, ni au suivi", async ({ page }) => {
  await openWithTestProducts(page); // attend que le cache montre les produits
  for (const path of ["/panier", "/suivi"]) {
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(path);
    await page.waitForTimeout(2000);
    await expect(card(page), `carte affichée sur ${path}`).toHaveCount(0);
  }
});

test("sur téléphone, la carte tient dans l'écran", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await openWithTestProducts(page);
  const box = await card(page).boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
  await page.waitForTimeout(1500); // fin de l'animation
  await page.screenshot({ path: "test-results/carte-arrivee-375.png" });
});

test("mouvement réduit : la carte apparaît sans glisser", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWithTestProducts(page);
  expect(await card(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});
