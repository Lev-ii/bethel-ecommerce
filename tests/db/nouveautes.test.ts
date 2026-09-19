import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Badge « Nouveau » et section Nouveautes contre un vrai PostgreSQL.
 *
 * Produits nouveau-test-*, effaces a la fin.
 */

// Hors de Next, le cache du catalogue lit la base a chaque appel.
vi.mock("next/cache", () => ({
  unstable_cache:
    <A extends unknown[], T>(fn: (...args: A) => Promise<T>) =>
    (...args: A) =>
      fn(...args),
}));

const { sql } = await import("@/lib/db/client");
const { getNewProducts, getProductBySlug, getProducts } = await import("@/lib/repository");

async function purge() {
  await sql`DELETE FROM products WHERE id LIKE 'nouveau-test-%'`;
}

async function insert(id: string, createdAt: string, published = true) {
  const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
  await sql`
    INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published, created_at)
    VALUES (${id}, ${id}, ${"Produit " + id}, 'Test', ${category.slug}, 'Accroche', 10000, 3,
            '/produits/trepied.jpg', ${published}, ${sql.unsafe(createdAt)})
  `;
}

beforeAll(purge);
afterAll(async () => {
  await purge();
  await sql.end();
});

describe("nouveautes", () => {
  it("l'import initial du catalogue ne porte pas le badge, même s'il date de moins de 14 jours", async () => {
    const [first] = await sql<Array<{ created_at: Date }>>`SELECT min(created_at) AS created_at FROM products`;
    // Meme situation que la production : catalogue importe il y a quelques jours.
    await insert("nouveau-test-import", `'${first.created_at.toISOString()}'::timestamptz + interval '10 minutes'`);
    expect((await getProductBySlug("nouveau-test-import"))?.isNew).toBe(false);
    await purge();
  });

  it("un produit ajouté aujourd'hui est nouveau, en tête de la section et du tri", async () => {
    // Import ancien, puis un produit de 15 jours et un d'aujourd'hui.
    await insert("nouveau-test-a-import", "now() - interval '30 days'");
    await insert("nouveau-test-b-15-jours", "now() - interval '15 days'");
    await insert("nouveau-test-c-aujourdhui", "now()");
    await insert("nouveau-test-d-brouillon", "now()", false);

    expect((await getProductBySlug("nouveau-test-c-aujourdhui"))?.isNew).toBe(true);
    expect((await getProductBySlug("nouveau-test-b-15-jours"))?.isNew).toBe(false);
    expect((await getProductBySlug("nouveau-test-a-import"))?.isNew).toBe(false);

    const arrivals = await getNewProducts(50);
    expect(arrivals[0].id).toBe("nouveau-test-c-aujourdhui");
    expect(arrivals.every((p) => p.isNew)).toBe(true);
    const ids = arrivals.map((p) => p.id);
    expect(ids).not.toContain("nouveau-test-b-15-jours");
    expect(ids).not.toContain("nouveau-test-d-brouillon");

    // Ordre relatif seulement : les dates des produits de demonstration
    // dependent de la base (en CI, certaines sont dans le futur).
    const sorted = (await getProducts({ sort: "nouveautes" })).map((p) => p.id);
    const rank = (id: string) => sorted.indexOf(id);
    expect(rank("nouveau-test-c-aujourdhui")).toBeLessThan(rank("nouveau-test-b-15-jours"));
    expect(rank("nouveau-test-b-15-jours")).toBeLessThan(rank("nouveau-test-a-import"));
  });

  it("limite la section au nombre demandé", async () => {
    expect((await getNewProducts(1)).length).toBeLessThanOrEqual(1);
  });
});
