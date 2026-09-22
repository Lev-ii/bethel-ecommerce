import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_ADMIN, E2E_DATABASE_URL } from "./constantes";

/**
 * Incident du 22-09 : un cookie de session encore signe mais refuse en base
 * (mot de passe change, compte absent de la base locale) faisait tourner le
 * navigateur entre /admin et /connexion. Le middleware ne lit que la
 * signature ; la page, elle, revalide en base.
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

test("session révoquée : retour à la connexion avec un message, sans boucle, puis reconnexion", async ({ page, context }) => {
  await signIn(page);

  // Le mot de passe change ailleurs : les sessions ouvertes sont revoquees.
  await sql`UPDATE users SET session_version = session_version + 1 WHERE lower(email) = lower(${E2E_ADMIN.email})`;

  let adminLoads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/admin") adminLoads++;
  });

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/connexion\?erreur=session&suite=%2Fadmin$/);
  await expect(page.getByText("Votre session a expiré ou a été fermée. Reconnectez-vous.")).toBeVisible();

  // Plus de va-et-vient : la page de connexion reste affichee.
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/\/connexion/);
  expect(adminLoads).toBeLessThanOrEqual(1);
  expect((await context.cookies()).some((c) => c.name.includes("session") && c.value)).toBe(false);

  // La reconnexion fonctionne et ramene a l'administration.
  await page.getByLabel("Email", { exact: true }).fill(E2E_ADMIN.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/:3100\/admin$/);
});

test("la route d'effacement refuse une destination externe", async ({ page }) => {
  await page.goto("/session-expiree?suite=//exemple.com");
  await expect(page).toHaveURL(/:3100\/connexion\?erreur=session&suite=%2F$/);
});
