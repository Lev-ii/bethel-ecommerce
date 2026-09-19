import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { CONSENT_KEY, E2E_DATABASE_URL, E2E_PIXELS } from "./constantes";

/**
 * Pixels Meta et TikTok : rien avant l'accord du visiteur ; apres accord, les
 * scripts sont appeles et les evenements du parcours d'achat partent, avec le
 * montant relu en base pour l'achat.
 *
 * Les requetes externes sont coupees : on observe les tentatives d'appel, et
 * les files fbq.queue / ttq que les scripts officiels constituent.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
test.afterAll(async () => {
  await sql`DELETE FROM orders WHERE customer_name LIKE 'E2E pixels%'`;
  await sql.end();
});

function watchPixels(page: Page) {
  const calls: string[] = [];
  page.on("request", (r) => {
    const url = r.url();
    if (url.includes("connect.facebook.net") || url.includes("analytics.tiktok.com")) calls.push(url);
  });
  return calls;
}

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

/** Evenements recus par chaque pixel (files constituees par les scripts officiels). */
async function received(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { fbq?: { queue: unknown[][] }; ttq?: unknown[][] };
    return {
      facebook: (w.fbq?.queue ?? []).map((args) => Array.from(args as ArrayLike<unknown>)),
      tiktok: (w.ttq ?? []).filter(Array.isArray).map((args) => args as unknown[]),
    };
  });
}

test("refuser : aucun script publicitaire n'est appelé, et on peut changer d'avis", async ({ page }) => {
  const calls = watchPixels(page);
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Cookies publicitaires" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Refuser" }).click();
  await expect(banner).toBeHidden();
  await page.goto("/boutique");
  await expect(page.getByRole("region", { name: "Cookies publicitaires" })).toHaveCount(0);
  expect(calls).toEqual([]);
  expect(await page.evaluate((key) => localStorage.getItem(key), CONSENT_KEY)).toBe("refuse");

  await page.getByRole("contentinfo").getByRole("button", { name: "Cookies" }).click();
  await expect(page.getByRole("region", { name: "Cookies publicitaires" })).toBeVisible();
});

test("accepter : scripts appelés, puis vue, ajout au panier, commande et achat transmis", async ({ page }) => {
  const calls = watchPixels(page);
  await page.goto("/");
  expect(calls).toEqual([]);
  await page.getByRole("button", { name: "Accepter" }).click();
  await expect.poll(() => calls.length).toBeGreaterThanOrEqual(2);
  expect(calls.some((u) => u.includes("connect.facebook.net"))).toBe(true);
  expect(calls.some((u) => u.includes(`sdkid=${E2E_PIXELS.tiktok}`))).toBe(true);
  let events = await received(page);
  expect(events.facebook).toContainEqual(["init", E2E_PIXELS.facebook]);

  // Fiche produit puis ajout au panier.
  const [product] = await sql<Array<{ id: string; slug: string; price: number }>>`
    SELECT id, slug, price FROM products WHERE published AND stock >= 5 ORDER BY id LIMIT 1
  `;
  await page.goto(`/boutique/${product.slug}`);
  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  await expect.poll(async () => (await received(page)).facebook.map((e) => e[1])).toContain("AddToCart");
  events = await received(page);
  const view = events.facebook.find((e) => e[1] === "ViewContent");
  expect(view?.[2]).toMatchObject({ content_ids: [product.id], value: product.price, currency: "XOF" });
  expect(events.tiktok.some((e) => e[0] === "track" && e[1] === "AddToCart")).toBe(true);

  // Commande a la livraison, jusqu'a la confirmation.
  await page.goto("/commande");
  await expect.poll(async () => (await received(page)).facebook.map((e) => e[1])).toContain("InitiateCheckout");
  await page.getByRole("button", { name: /Retrait en boutique/ }).click();
  await page.getByLabel("Nom complet").fill(`E2E pixels ${Date.now()}`);
  await page.getByLabel("Téléphone").fill("+225 07 07 07 07 07");
  await page.getByRole("button", { name: /Espèces au retrait/ }).click();
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page).toHaveURL(/\/commande\/confirmation\?ref=BTH-/);
  const reference = new URL(page.url()).searchParams.get("ref")!;

  await expect.poll(async () => (await received(page)).facebook.map((e) => e[1])).toContain("Purchase");
  events = await received(page);
  const purchase = events.facebook.find((e) => e[1] === "Purchase")!;
  expect(purchase[2]).toMatchObject({ value: product.price, currency: "XOF", content_ids: [product.id] });
  expect(purchase[3]).toEqual({ eventID: reference });
  expect(events.tiktok.some((e) => e[1] === "CompletePayment")).toBe(true);

  // Recharger la confirmation ne compte pas l'achat deux fois.
  await page.reload();
  await page.waitForTimeout(500);
  events = await received(page);
  expect(events.facebook.filter((e) => e[1] === "Purchase")).toHaveLength(0);
});
