import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createFakeJeko } from "../support/fake-jeko";

/**
 * Montee en charge de placeOrder : 100, 500 puis 1 000 commandes lancees en
 * meme temps, contre un vrai PostgreSQL, avec un pool de 10 connexions comme
 * une instance Vercel en production (DB_POOL_MAX=10).
 *
 *   npm run test:charge
 *
 * Verifie, a chaque palier : aucune erreur inattendue, stock exact (jamais
 * negatif, jamais survendu), et temps de reponse releves (mediane, p95, max).
 * Jeko est simule (tests/support/fake-jeko.ts), avec 50 ms de latence.
 */

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/auth/current", () => ({ currentUser: vi.fn(async () => null) }));
vi.mock("@/lib/shop/notifications", () => ({ notifyCustomerLater: vi.fn() }));

const url = new URL(process.env.DATABASE_URL ?? "postgresql://x");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.includes("charge")) {
  throw new Error("Montée en charge : base locale bethel_charge attendue (npm run test:charge).");
}
process.env.DB_POOL_MAX = process.env.DB_POOL_MAX ?? "10";

const { sql } = await import("@/lib/db/client");
const { placeOrder } = await import("@/lib/shop/actions");

vi.setConfig({ testTimeout: 300_000 });

const CUSTOMER = "Charge test";
const jeko = createFakeJeko();
const report: string[] = [];

const STOCK_ERROR = /^Il ne reste que \d+ exemplaire/;

async function setStock(ids: string[], stock: number) {
  await sql`UPDATE products SET stock = ${stock} WHERE id = ANY(${ids})`;
}

async function stocks(ids: string[]) {
  const rows = await sql<Array<{ id: string; stock: number }>>`SELECT id, stock FROM products WHERE id = ANY(${ids})`;
  return Object.fromEntries(rows.map((r) => [r.id, r.stock]));
}

function percentile(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

type Cart = Array<{ productId: string; quantity: number }>;

/** Lance toutes les commandes au meme instant et mesure chacune. */
async function burst(label: string, carts: Cart[], online: (i: number) => boolean) {
  const durations: number[] = [];
  const errors: string[] = [];
  let ok = 0;
  const started = performance.now();

  await Promise.all(
    carts.map(async (items, i) => {
      const t = performance.now();
      const result = await placeOrder({
        customerName: CUSTOMER,
        customerPhone: "+225 07 00 00 00 01",
        deliveryMode: "retrait",
        paymentMethod: online(i) ? "orange" : "especes-retrait",
        items,
      });
      durations.push(performance.now() - t);
      if (result.error) errors.push(result.error);
      else ok += 1;
    })
  );

  const total = performance.now() - started;
  durations.sort((a, b) => a - b);
  report.push(
    `${label.padEnd(46)} ${String(ok).padStart(5)} ok ${String(errors.length).padStart(5)} refus  ` +
      `médiane ${percentile(durations, 50).toFixed(0).padStart(5)} ms  p95 ${percentile(durations, 95).toFixed(0).padStart(5)} ms  ` +
      `max ${durations.at(-1)!.toFixed(0).padStart(5)} ms  débit ${((carts.length / total) * 1000).toFixed(0).padStart(4)}/s`
  );
  return { ok, errors };
}

let products: string[] = [];

beforeAll(async () => {
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    await new Promise((r) => setTimeout(r, 50));
    return jeko.fetch(input, init);
  });
  Object.assign(process.env, { JEKO_API_KEY: "k", JEKO_API_KEY_ID: "i", JEKO_STORE_ID: "s" });
  vi.spyOn(console, "error").mockImplementation(() => {});

  await sql`DELETE FROM orders WHERE customer_name = ${CUSTOMER}`;
  const rows = await sql<Array<{ id: string }>>`SELECT id FROM products WHERE published ORDER BY id LIMIT 6`;
  products = rows.map((r) => r.id);
  expect(products).toHaveLength(6);
});

afterAll(async () => {
  console.log(`\nMontée en charge (pool ${process.env.DB_POOL_MAX} connexions, Jeko simulé à 50 ms)\n${report.join("\n")}`);
  await sql`DELETE FROM orders WHERE customer_name = ${CUSTOMER}`;
  await sql.end();
});

describe("commandes simultanées, stock suffisant", () => {
  it.each([100, 500, 1000])("%i commandes en même temps : toutes passent, stock exact", async (n) => {
    await setStock(products, 100_000);
    const carts: Cart[] = Array.from({ length: n }, (_, i) => [
      { productId: products[i % products.length], quantity: 1 + (i % 3) },
    ]);
    const expected = new Map<string, number>();
    for (const [line] of carts) expected.set(line.productId, (expected.get(line.productId) ?? 0) + line.quantity);

    // Une commande sur deux en paiement en ligne (appel a Jeko hors verrou).
    const { ok, errors } = await burst(`${n} commandes, stock suffisant`, carts, (i) => i % 2 === 0);

    expect(errors).toEqual([]);
    expect(ok).toBe(n);
    const after = await stocks(products);
    for (const id of products) expect(after[id]).toBe(100_000 - (expected.get(id) ?? 0));
  });
});

describe("vente flash", () => {
  it("1 000 clients pour 50 exemplaires : exactement 50 ventes, jamais de survente", async () => {
    const [flash] = products;
    await setStock([flash], 50);
    const carts: Cart[] = Array.from({ length: 1000 }, () => [{ productId: flash, quantity: 1 }]);

    const { ok, errors } = await burst("vente flash : 1 000 clients, 50 exemplaires", carts, () => false);

    expect(ok).toBe(50);
    expect(errors).toHaveLength(950);
    expect(errors.filter((e) => !STOCK_ERROR.test(e))).toEqual([]);
    expect((await stocks([flash]))[flash]).toBe(0);
    const [sold] = await sql<Array<{ n: number }>>`
      SELECT COALESCE(sum(l.quantity), 0)::int AS n FROM order_lines l JOIN orders o ON o.id = l.order_id
      WHERE o.customer_name = ${CUSTOMER} AND l.product_id = ${flash} AND o.status <> 'annulee'
        AND o.created_at > now() - interval '5 minutes'
    `;
    expect(sold.n).toBeGreaterThanOrEqual(50);
  });
});

describe("paniers croisés", () => {
  it("500 paniers avec les mêmes produits dans des ordres opposés : aucun interblocage", async () => {
    await setStock(products, 100_000);
    const [a, b, c] = products;
    const orders: Cart[] = [
      [{ productId: a, quantity: 1 }, { productId: b, quantity: 1 }, { productId: c, quantity: 1 }],
      [{ productId: c, quantity: 1 }, { productId: b, quantity: 1 }, { productId: a, quantity: 1 }],
      [{ productId: b, quantity: 1 }, { productId: a, quantity: 1 }, { productId: c, quantity: 1 }],
    ];
    const carts = Array.from({ length: 500 }, (_, i) => orders[i % orders.length]);

    const { ok, errors } = await burst("500 paniers croisés (3 produits, ordres opposés)", carts, (i) => i % 2 === 0);

    expect(errors).toEqual([]);
    expect(ok).toBe(500);
    const after = await stocks([a, b, c]);
    for (const id of [a, b, c]) expect(after[id]).toBe(100_000 - 500);
  });
});
