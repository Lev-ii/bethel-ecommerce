import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_ADMIN, E2E_DATABASE_URL } from "./constantes";

/**
 * Categories gerees par l'administrateur, dans un vrai navigateur : creer,
 * y ranger un produit, renommer (l'adresse suit le nom), supprimer en
 * deplacant les produits. Chaque etape est verifiee en base et en boutique.
 */

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });

test.afterAll(async () => {
  await sql.end();
});

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

async function signIn(page: Page) {
  await page.goto("/connexion?suite=/admin");
  await page.getByLabel("Email", { exact: true }).fill(E2E_ADMIN.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/:3100\/admin$/);
}

async function categoryOf(productId: string) {
  const [row] = await sql<Array<{ category: string }>>`SELECT category FROM products WHERE id = ${productId}`;
  return row.category;
}

test("l'administrateur crée, remplit, renomme puis supprime une catégorie", async ({ page }) => {
  const [product] = await sql<Array<{ id: string; name: string; category: string }>>`
    SELECT id, name, category FROM products WHERE published ORDER BY id LIMIT 1
  `;
  await signIn(page);

  // --- Creation
  await page.goto("/admin/categories");
  await page.getByLabel("Nom", { exact: true }).first().fill("Drones E2E");
  await page.getByLabel("Accroche (facultative)").fill("Filmer d'en haut");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByRole("status")).toContainText("La catégorie a été créée");
  await expect(page.getByRole("link", { name: "?categorie=drones-e2e" })).toBeVisible();
  await page.screenshot({ path: "test-results/categories-admin.png", fullPage: true });

  // Visible en boutique : pied de page de toutes les pages.
  await page.goto("/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Drones E2E" })).toBeVisible();

  // --- Deplacer un produit dans la nouvelle categorie
  await page.goto("/admin/produits");
  await page.getByRole("checkbox", { name: `Sélectionner ${product.name}` }).first().check();
  await page.getByLabel("Déplacer les produits cochés vers").selectOption({ label: "Drones E2E" });
  await page.getByRole("button", { name: "Déplacer" }).click();
  await expect(page.getByRole("status")).toContainText("1 produit déplacé");
  expect(await categoryOf(product.id)).toBe("drones-e2e");

  // --- Renommer : l'adresse suit le nom, le produit suit l'adresse
  await page.goto("/admin/categories");
  const row = page.getByRole("listitem").filter({ hasText: "?categorie=drones-e2e" });
  await row.getByText("Modifier").click();
  await row.getByLabel("Nom").fill("Drones Pro E2E");
  await expect(row.getByText("L'adresse deviendra ?categorie=drones-pro-e2e")).toBeVisible();
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status")).toContainText("La catégorie a été modifiée");
  expect(await categoryOf(product.id)).toBe("drones-pro-e2e");

  await page.goto("/boutique?categorie=drones-pro-e2e");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Drones Pro E2E");
  await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
  await page.goto("/boutique?categorie=drones-e2e");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tout le matériel");

  // --- Supprimer en deplacant le produit vers sa categorie d'origine
  const [origin] = await sql<Array<{ name: string }>>`SELECT name FROM categories WHERE slug = ${product.category}`;
  await page.goto("/admin/categories");
  await page.getByRole("checkbox", { name: "Sélectionner Drones Pro E2E" }).check();
  await expect(page.getByText("1 produit y est rangé")).toBeVisible();
  const confirm = page.getByRole("button", { name: "Déplacer et supprimer" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Déplacer ces produits vers").selectOption({ label: origin.name });
  await confirm.click();
  await expect(page.getByRole("status")).toContainText("Catégorie supprimée, 1 produit déplacé");
  expect(await categoryOf(product.id)).toBe(product.category);

  // --- Journal
  await page.goto("/admin/journal?categorie=categories");
  for (const label of ["Catégorie créée", "Catégorie modifiée", "Catégorie supprimée"]) {
    await expect(page.getByText(label).first()).toBeVisible();
  }
});
