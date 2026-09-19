import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_ADMIN, E2E_DATABASE_URL } from "./constantes";

/**
 * Mise en page de 375 px (telephone) a 2560 px (grand ecran), boutique et
 * administration, avec un produit au nom tres long :
 * - aucune page ne deborde horizontalement ;
 * - dans la liste des produits de l'administration, le nom est rogne et
 *   n'empiete pas sur les colonnes voisines.
 *
 * VISUEL=dossier enregistre aussi une capture de chaque page a chaque largeur.
 */

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const LONG_ID = "e2e-nom-tres-long";
const LONG_NAME =
  "Kit de tournage complet pour smartphone avec stabilisateur trois axes, micro-cravate sans fil double et panneau LED bicolore";

const WIDTHS = [375, 768, 1024, 1280, 1440, 1920, 2560, 3440];
const SHOP_PAGES = ["/", "/boutique", `/boutique/${LONG_ID}`, "/panier", "/suivi"];
const ADMIN_PAGES = ["/admin", "/admin/produits", "/admin/categories", "/admin/avis", "/admin/newsletter", "/admin/commandes", "/admin/journal"];

test.beforeAll(async () => {
  const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
  await sql`
    INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published)
    VALUES (${LONG_ID}, ${LONG_ID}, ${LONG_NAME}, 'Marque au nom lui aussi assez long', ${category.slug},
            'Accroche du produit au nom très long', 1250000, 7, '/produits/trepied.jpg', TRUE)
    ON CONFLICT (id) DO NOTHING
  `;
});

test.afterAll(async () => {
  await sql`DELETE FROM products WHERE id = ${LONG_ID}`;
  await sql.end();
});

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function capture(page: Page, name: string) {
  if (!process.env.VISUEL) return;
  await page.screenshot({ path: `${process.env.VISUEL}/${name}.png`, fullPage: false });
}

async function visit(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  // Pas "networkidle" : l'administration garde un flux ouvert (nouvelles commandes).
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await capture(page, `${width}${path.replace(/[/?=]/g, "_") || "_accueil"}`);
  expect.soft(await overflow(page), `${path} à ${width} px déborde horizontalement`).toBeLessThanOrEqual(0);
}

test("boutique : aucune page ne déborde, de 375 à 2560 px", async ({ page }) => {
  for (const width of WIDTHS) for (const path of SHOP_PAGES) await visit(page, path, width);
});

test("administration : aucune page ne déborde, de 375 à 2560 px", async ({ page }) => {
  await page.goto("/connexion?suite=/admin");
  await page.getByLabel("Email", { exact: true }).fill(E2E_ADMIN.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/:3100\/admin$/);

  for (const width of WIDTHS) for (const path of ADMIN_PAGES) await visit(page, path, width);
});

test("produits de l'administration : un nom très long est rogné sans écraser les autres colonnes", async ({ page }) => {
  await page.goto("/connexion?suite=/admin/produits");
  await page.getByLabel("Email", { exact: true }).fill(E2E_ADMIN.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/:3100\/admin\/produits$/);

  // Tableau a partir de 1280 px.
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    const row = page.locator("table tbody tr").filter({ hasText: LONG_NAME.slice(0, 30) });
    const name = row.getByRole("link", { name: LONG_NAME });
    // Rogne : le texte deborde de sa boite, cache par l'ellipse.
    expect.soft(await name.evaluate((el) => el.scrollWidth > el.clientWidth), `nom non rogné à ${width} px`).toBe(true);
    // Nombre de lignes du texte du prix, mesure sur le texte lui-meme (la
    // hauteur de la cellule depend de la photo de la ligne).
    const priceLines = await row.locator("td").nth(2).evaluate((cell) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      return new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size;
    });
    expect.soft(priceLines, `prix sur plusieurs lignes à ${width} px`).toBe(1);
    const modify = row.getByRole("link", { name: "Modifier" });
    const box = await modify.boundingBox();
    expect.soft(box && box.x + box.width <= width, `« Modifier » coupé à ${width} px`).toBe(true);
    // Sur ordinateur, l'action porte son nom en plus de l'icone.
    const retirer = row.getByRole("button", { name: "Retirer de la vente" });
    expect.soft(await retirer.innerText(), `texte « Retirer » absent à ${width} px`).toContain("Retirer");
  }

  // Cartes en dessous, pastille de stock masquee sur telephone.
  for (const width of [375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    expect.soft(await page.locator("table").isVisible(), `tableau affiché à ${width} px`).toBe(false);
    const card = page.locator("ul > li").filter({ hasText: LONG_NAME.slice(0, 30) });
    const name = card.getByRole("link", { name: LONG_NAME });
    expect.soft(await name.evaluate((el) => el.scrollWidth > el.clientWidth), `nom non rogné (carte) à ${width} px`).toBe(true);
    const modify = card.getByRole("link", { name: "Modifier" });
    const box = await modify.boundingBox();
    expect.soft(box && box.x + box.width <= width, `« Modifier » coupé (carte) à ${width} px`).toBe(true);
    expect.soft(await card.getByText("En stock", { exact: false }).isVisible(), `pastille visible à ${width} px`).toBe(width >= 640);
    // Telephone et tablette : icone seule (oeil barre), nom porte par aria-label.
    const retirer = card.getByRole("button", { name: "Retirer de la vente" });
    await expect.soft(retirer, `action « Retirer » absente à ${width} px`).toBeVisible();
    // innerText, et non textContent : le nom est present dans le HTML mais masque.
    expect.soft((await retirer.innerText()).trim(), `texte affiché à côté de l'icône à ${width} px`).toBe("");
    expect.soft(await retirer.evaluate((el) => getComputedStyle(el).color), `« Retirer » non rouge à ${width} px`).toBe(
      "rgb(163, 58, 44)"
    );
  }
});
