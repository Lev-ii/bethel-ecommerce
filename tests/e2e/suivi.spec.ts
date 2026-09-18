import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { E2E_DATABASE_URL } from "./constantes";

/**
 * Suivi de commande en direct : le client garde /suivi ouvert, l'administration
 * fait avancer la commande, la page change seule, sans rechargement, avec un
 * son, puis remercie a la livraison.
 *
 * L'horloge du navigateur est pilotee (page.clock) : on avance de 10 s sans
 * les attendre. L'administration est simulee par une mise a jour en base,
 * exactement ce que fait son action serveur.
 */

const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
const REF = "BTH-2609-DIRECT";
const POLL_MS = 10_000;

test.beforeAll(async () => {
  await sql`DELETE FROM orders WHERE reference = ${REF}`;
  await sql`
    INSERT INTO orders (id, reference, customer_name, customer_phone, delivery_mode, address, city,
                        payment_method, total, status)
    VALUES ('e2e-direct', ${REF}, 'E2E Direct', '+225 07 00 00 00 09', 'livraison', 'Rue test', 'Abidjan',
            'paiement-livraison', 15000, 'recue')
  `;
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

async function setStatus(status: string) {
  await sql`UPDATE orders SET status = ${status} WHERE reference = ${REF}`;
}

test("l'avancement apparaît sans recharger la page, avec un son, puis un remerciement", async ({ page }) => {
  // Compte les notes jouees : preuve que le son part, sans haut-parleur.
  await page.addInitScript(() => {
    const w = window as unknown as { __notes: number };
    w.__notes = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.__notes += 1;
      return original.call(this);
    };
  });
  await page.clock.install();
  const statusCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/statut")) statusCalls.push(request.url());
  });

  await page.goto(`/suivi?ref=${REF}`);
  await expect(page.getByText("Suivi en direct : cette page se met à jour toute seule.")).toBeVisible();
  const loaded = page.url();

  // Le son se deverrouille par un geste. Chromium sans interface l'autorise
  // souvent d'emblee : le bouton n'apparait alors pas, « Son activé » si.
  const unlock = page.getByRole("button", { name: "Activer le son" });
  if (await unlock.isVisible()) await unlock.click();
  await expect(page.getByText("Son activé")).toBeVisible();

  // --- L'administration expedie
  await setStatus("expediee");
  await page.clock.fastForward(POLL_MS + 500);
  await expect(page.getByRole("status")).toHaveText("Votre commande est maintenant : Expédiée.");
  await expect(page.locator('[data-etape="expediee"]')).toContainText("En cours");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __notes: number }).__notes)).toBeGreaterThan(0);
  expect(page.url()).toBe(loaded);

  // --- Puis livre : remerciement, et plus aucune interrogation
  await setStatus("livree");
  await page.clock.fastForward(POLL_MS + 500);
  await expect(page.getByRole("status")).toHaveText("Votre commande a été livrée. Merci !");
  await expect(page.getByText("Merci pour votre confiance !")).toBeVisible();
  await expect(page.getByText("Suivi en direct")).toHaveCount(0);

  const callsAfterDelivery = statusCalls.length;
  await page.clock.fastForward(POLL_MS * 4);
  expect(statusCalls.length).toBe(callsAfterDelivery);
  expect(page.url()).toBe(loaded);
});

test("une commande déjà livrée remercie dès l'ouverture, sans interroger", async ({ page }) => {
  await setStatus("livree");
  const statusCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/statut")) statusCalls.push(request.url());
  });
  await page.clock.install();
  await page.goto(`/suivi?ref=${REF}`);
  await expect(page.getByText("Merci pour votre confiance !")).toBeVisible();
  await page.clock.fastForward(POLL_MS * 3);
  expect(statusCalls).toEqual([]);
});

test("l'adresse de statut ne renvoie que l'état, mis en cache quelques secondes", async ({ request }) => {
  await setStatus("preparee");
  const ok = await request.get(`/api/commande/${REF}/statut`);
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ status: "preparee", deliveryMode: "livraison" });
  expect(ok.headers()["cache-control"]).toContain("s-maxage=5");

  expect((await request.get("/api/commande/BTH-2609-INCONNU/statut")).status()).toBe(404);
  expect((await request.get(`/api/commande/${encodeURIComponent("' OR 1=1 --")}/statut`)).status()).toBe(400);
});
