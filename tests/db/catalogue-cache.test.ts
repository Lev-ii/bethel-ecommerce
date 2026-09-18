import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cache du catalogue contre un vrai PostgreSQL.
 *
 * Incident du 18-09 : apres un changement de photo, la fiche d'un produit en
 * vente a repondu 404. unstable_cache (Next 15) sert une derniere fois une
 * entree perimee, et celle de ce produit disait « introuvable ». Le cache de
 * Next est remplace ici par un double qui se comporte pareil : il renvoie
 * l'entree enregistree quel que soit son age.
 *
 * Produits cache-test-*, effaces a la fin.
 */

const store = new Map<string, unknown>();
vi.mock("next/cache", () => ({
  unstable_cache:
    <A extends unknown[], T>(fn: (...args: A) => Promise<T>, keyParts: string[]) =>
    async (...args: A): Promise<T> => {
      const key = `${keyParts.join("/")}:${JSON.stringify(args)}`;
      if (store.has(key)) return store.get(key) as T;
      const value = await fn(...args);
      // Comme Next : l'entree passe par JSON.
      store.set(key, JSON.parse(JSON.stringify(value)));
      return value;
    },
}));

const { sql } = await import("@/lib/db/client");
const { getProductBySlug, getProducts } = await import("@/lib/repository");
const { resetDatabaseBreaker } = await import("@/lib/catalog-fallback");

const ID = "cache-test-cle";
const SLUG = "cache-test-cle";

async function purge() {
  await sql`DELETE FROM products WHERE id LIKE 'cache-test-%'`;
}

async function insert(published: boolean) {
  const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
  await sql`
    INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published)
    VALUES (${ID}, ${SLUG}, 'Clé cache test', 'Test', ${category.slug}, 'Accroche', 10000, 3, '/produits/trepied.jpg', ${published})
  `;
}

beforeAll(purge);
afterAll(async () => {
  await purge();
  await sql.end();
});
beforeEach(() => {
  store.clear();
  resetDatabaseBreaker();
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
  return purge();
});

describe("cache du catalogue", () => {
  it("ne sert pas un « produit introuvable » perime : la fiche d'un produit en vente s'affiche", async () => {
    await insert(false);
    expect(await getProductBySlug(SLUG)).toBeUndefined();

    await sql`UPDATE products SET published = TRUE WHERE id = ${ID}`;
    vi.setSystemTime(Date.now() + 31_000);

    expect((await getProductBySlug(SLUG))?.id).toBe(ID);
  });

  it("montre un produit tout juste ajoute, meme si la liste en cache est ancienne", async () => {
    const before = await getProducts();
    expect(before.some((p) => p.id === ID)).toBe(false);

    await insert(true);
    vi.setSystemTime(Date.now() + 31_000);

    expect((await getProducts()).some((p) => p.id === ID)).toBe(true);
  });

  it("sert l'entree en cache tant qu'elle est recente", async () => {
    await insert(true);
    expect((await getProductBySlug(SLUG))?.name).toBe("Clé cache test");

    await sql`UPDATE products SET name = 'Nom modifié' WHERE id = ${ID}`;
    vi.setSystemTime(Date.now() + 5_000);

    // Le cache absorbe la charge : pas de relecture avant 30 s.
    expect((await getProductBySlug(SLUG))?.name).toBe("Clé cache test");
  });

  it("ne met jamais en cache le catalogue de secours d'une base injoignable", async () => {
    await insert(true);
    // Coupe-circuit ouvert : lecture refusee, repli sur le catalogue statique.
    const { markDatabaseUnavailable } = await import("@/lib/catalog-fallback");
    markDatabaseUnavailable();
    expect(await getProductBySlug(SLUG)).toBeUndefined();

    // La base revient : le produit reel s'affiche aussitot.
    resetDatabaseBreaker();
    expect((await getProductBySlug(SLUG))?.id).toBe(ID);
  });
});
