import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Promotions datees contre un vrai PostgreSQL : le prix promo est affiche ET
 * facture pendant la promotion, le prix normal revient a l'echeance, et un
 * client ne paie jamais un prix qu'il n'a pas vu dans son panier.
 *
 * Produits promo-test-*, commandes du client « Promo test », effaces a la fin.
 */

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache:
    <A extends unknown[], T>(fn: (...args: A) => Promise<T>) =>
    (...args: A) =>
      fn(...args),
}));
vi.mock("@/lib/auth/current", () => ({ currentUser: vi.fn(async () => null) }));
vi.mock("@/lib/shop/notifications", () => ({ notifyCustomerLater: vi.fn() }));

const { sql } = await import("@/lib/db/client");
const { getProductBySlug, getTopPromoProduct, getProducts } = await import("@/lib/repository");
const { placeOrder } = await import("@/lib/shop/actions");

const host = new URL(process.env.DATABASE_URL ?? "postgresql://x").hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error(`Tests des promotions refusés sur une base non locale (${host}) : ils passent des commandes.`);
}

const ID = "promo-test-micro";
const CUSTOMER = "Promo test";

async function purge() {
  await sql`DELETE FROM orders WHERE customer_name = ${CUSTOMER}`;
  await sql`DELETE FROM products WHERE id LIKE 'promo-test-%'`;
}

async function product(promo: { price: number; starts: string | null; ends: string } | null, id = ID) {
  const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
  await sql`
    INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published,
                          promo_price, promo_starts_at, promo_ends_at)
    VALUES (${id}, ${id}, 'Micro promo test', 'Test', ${category.slug}, 'Accroche', 50000, 10, '/produits/trepied.jpg', TRUE,
            ${promo?.price ?? null},
            ${promo?.starts ? sql.unsafe(promo.starts) : null},
            ${promo ? sql.unsafe(promo.ends) : null})
  `;
}

function order(unitPrice?: number) {
  return placeOrder({
    customerName: CUSTOMER,
    customerPhone: "+225 07 00 00 00 02",
    deliveryMode: "retrait",
    paymentMethod: "especes-retrait",
    items: [{ productId: ID, quantity: 1, unitPrice }],
  });
}

beforeEach(purge);
afterAll(async () => {
  await purge();
  await sql.end();
});

describe("promotions datees", () => {
  it("en cours : prix promo affiche, prix normal barre, fin connue", async () => {
    await product({ price: 35000, starts: null, ends: "now() + interval '2 days'" });
    const p = (await getProductBySlug(ID))!;
    expect(p.price).toBe(35000);
    expect(p.compareAtPrice).toBe(50000);
    expect(p.promotion?.active).toBe(true);
    // Le formulaire d'administration garde le prix saisi.
    expect(p.regularPrice).toBe(50000);
  });

  it("programmee : pas encore appliquee", async () => {
    await product({ price: 35000, starts: "now() + interval '1 day'", ends: "now() + interval '3 days'" });
    const p = (await getProductBySlug(ID))!;
    expect(p.price).toBe(50000);
    expect(p.compareAtPrice).toBeUndefined();
    expect(p.promotion?.active).toBe(false);
  });

  it("terminee : le prix normal revient de lui-meme", async () => {
    await product({ price: 35000, starts: "now() - interval '3 days'", ends: "now() - interval '1 second'" });
    const p = (await getProductBySlug(ID))!;
    expect(p.price).toBe(50000);
    expect(p.promotion?.active).toBe(false);
  });

  it("la base refuse un prix promo superieur au prix de vente, ou une promotion sans fin", async () => {
    await expect(product({ price: 60000, starts: null, ends: "now() + interval '1 day'" })).rejects.toThrow(/products_promo_check/);
    const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
    await expect(sql`
      INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published, promo_price)
      VALUES ('promo-test-sans-fin', 'promo-test-sans-fin', 'X', 'T', ${category.slug}, 'Accroche', 50000, 1, '/x.jpg', TRUE, 30000)
    `).rejects.toThrow(/products_promo_check/);
  });

  it("le tri par prix et la promotion mise en avant suivent le prix promo", async () => {
    // 1 F : moins cher que tout le catalogue, quelle que soit la base locale.
    await product({ price: 1, starts: null, ends: "now() + interval '1 day'" });
    const cheapest = await getProducts({ sort: "prix-croissant" });
    expect(cheapest[0].id).toBe(ID);
    // Promotion datee en cours : mise en avant avant les prix barres permanents.
    expect((await getTopPromoProduct())?.id).toBe(ID);
  });

  it("facture le prix promo pendant la promotion", async () => {
    await product({ price: 35000, starts: null, ends: "now() + interval '1 day'" });
    const result = await order(35000);
    expect(result.error).toBeUndefined();
    expect(result.total).toBe(35000);
    const [line] = await sql<Array<{ unit_price: number }>>`
      SELECT l.unit_price FROM order_lines l JOIN orders o ON o.id = l.order_id WHERE o.reference = ${result.reference!}
    `;
    expect(line.unit_price).toBe(35000);
  });

  it("promotion terminee pendant que l'article etait au panier : commande refusee, prix corrige, stock intact", async () => {
    await product({ price: 35000, starts: "now() - interval '2 days'", ends: "now() - interval '1 minute'" });
    const result = await order(35000);
    expect(result.reference).toBeUndefined();
    expect(result.error).toContain("Le prix de Micro promo test est passé de");
    expect(result.priceChanges).toEqual([{ productId: ID, name: "Micro promo test", from: 35000, to: 50000 }]);
    const [{ stock }] = await sql<Array<{ stock: number }>>`SELECT stock FROM products WHERE id = ${ID}`;
    expect(stock).toBe(10);
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM orders WHERE customer_name = ${CUSTOMER}`;
    expect(n).toBe(0);

    // Panier corrige : la commande passe au prix normal.
    const retry = await order(50000);
    expect(retry.error).toBeUndefined();
    expect(retry.total).toBe(50000);
  });
});
