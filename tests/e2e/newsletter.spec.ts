import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { E2E_ADMIN, E2E_AUTH_SECRET, E2E_DATABASE_URL } from "./constantes";

/**
 * Newsletter : inscription depuis le pied de page, desinscription par le lien
 * signe (confirmee par un bouton), export CSV reserve a l'administration.
 */

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const EMAIL = "abonne@parcours.test";

test.beforeAll(async () => {
  await sql`DELETE FROM newsletter_subscribers WHERE email LIKE '%@parcours.test'`;
});
test.afterAll(async () => {
  await sql`DELETE FROM newsletter_subscribers WHERE email LIKE '%@parcours.test'`;
  await sql.end();
});
test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

/** Telecharge l'export depuis la page, avec la session du navigateur (cookie securise). */
async function downloadExport(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/admin/newsletter/export");
    return { status: response.status, type: response.headers.get("content-type") ?? "", body: await response.text() };
  });
}

function unsubscribeUrl(email: string) {
  const t = createHmac("sha256", E2E_AUTH_SECRET).update(`newsletter:${email}`).digest("hex").slice(0, 32);
  return `/newsletter/desinscription?email=${encodeURIComponent(email)}&t=${t}`;
}

test("inscription au pied de page, export admin, puis désinscription par le lien", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.getByLabel("Votre adresse email").fill(EMAIL);
  await footer.getByRole("checkbox").check();
  await footer.getByRole("button", { name: "S'inscrire" }).click();
  await expect(footer.getByRole("status")).toHaveText("Merci ! Vous recevrez nos nouveautés et promotions.");
  const [row] = await sql<Array<{ unsubscribed_at: Date | null }>>`SELECT unsubscribed_at FROM newsletter_subscribers WHERE email = ${EMAIL}`;
  expect(row.unsubscribed_at).toBeNull();

  // Export : refuse sans session, inclut l'abonne pour l'administration.
  expect((await page.request.get("/api/admin/newsletter/export")).status()).toBe(401);
  await page.goto("/connexion?suite=/admin/newsletter");
  await page.getByLabel("Email", { exact: true }).fill(E2E_ADMIN.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/:3100\/admin\/newsletter$/);
  await expect(page.getByText(EMAIL)).toBeVisible();
  const csv = await downloadExport(page);
  expect(csv.status).toBe(200);
  expect(csv.type).toContain("text/csv");
  expect(csv.body).toContain(`${EMAIL};pied-de-page;`);

  // Ouvrir le lien ne desinscrit pas (logiciels d'analyse des emails) : il faut confirmer.
  await page.goto(unsubscribeUrl(EMAIL));
  const [still] = await sql<Array<{ unsubscribed_at: Date | null }>>`SELECT unsubscribed_at FROM newsletter_subscribers WHERE email = ${EMAIL}`;
  expect(still.unsubscribed_at).toBeNull();
  await page.getByRole("button", { name: "Me désinscrire" }).click();
  await expect(page.getByRole("heading", { name: "C'est fait." })).toBeVisible();
  const [after] = await sql<Array<{ unsubscribed_at: Date | null }>>`SELECT unsubscribed_at FROM newsletter_subscribers WHERE email = ${EMAIL}`;
  expect(after.unsubscribed_at).not.toBeNull();
  expect((await downloadExport(page)).body).not.toContain(EMAIL);

  // Lien falsifie : refuse.
  await page.goto(`/newsletter/desinscription?email=${encodeURIComponent("autre@parcours.test")}&t=${"0".repeat(32)}`);
  await page.getByRole("button", { name: "Me désinscrire" }).click();
  await expect(page.getByRole("heading", { name: "Lien non valide" })).toBeVisible();
});
