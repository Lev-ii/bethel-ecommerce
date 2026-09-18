import { describe, expect, it } from "vitest";
import {
  getFallbackCategories,
  getFallbackProducts,
  getFallbackProductsFor,
  isFreshCatalogEntry,
} from "@/lib/catalog-fallback";

/**
 * Le repli sert quand la base est injoignable : la boutique doit rester
 * consultable plutot que renvoyer une erreur.
 */
describe("catalogue de repli", () => {
  it("propose des categories et des produits", () => {
    expect(getFallbackCategories().length).toBeGreaterThan(0);
    expect(getFallbackProducts().length).toBeGreaterThan(0);
  });

  it("ne presente que des produits publies", () => {
    expect(getFallbackProducts().every((p) => p.published)).toBe(true);
  });

  it("ouvre sur la categorie des trepieds", () => {
    expect(getFallbackCategories()[0].slug).toBe("trepieds");
  });

  it("donne a chaque produit une categorie qui existe", () => {
    const slugs = new Set(getFallbackCategories().map((c) => c.slug));
    for (const product of getFallbackProducts()) {
      expect(slugs).toContain(product.category);
    }
  });

  it("n'affiche aucun prix nul ou negatif", () => {
    expect(getFallbackProducts().every((p) => p.price > 0)).toBe(true);
  });
});

describe("liste de repli filtree comme la base", () => {
  it("filtre par categorie et trie par prix", () => {
    const category = getFallbackCategories()[0].slug;
    const list = getFallbackProductsFor({ category, sort: "prix-croissant" });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.category === category)).toBe(true);
    expect(list.map((p) => p.price)).toEqual([...list.map((p) => p.price)].sort((a, b) => a - b));
  });

  it("cherche sans tenir compte de la casse", () => {
    const [first] = getFallbackProducts();
    expect(getFallbackProductsFor({ search: first.name.toUpperCase() }).map((p) => p.id)).toContain(first.id);
  });
});

describe("fraicheur d'une entree du cache du catalogue", () => {
  const now = 1_000_000;
  it("est fraiche jusqu'a son age maximal, perimee au-dela", () => {
    expect(isFreshCatalogEntry(now - 30_000, 30_000, now)).toBe(true);
    expect(isFreshCatalogEntry(now - 30_001, 30_000, now)).toBe(false);
  });

  it("reste fraiche si l'horloge d'une autre instance avance un peu", () => {
    expect(isFreshCatalogEntry(now + 50, 30_000, now)).toBe(true);
  });

  it("est perimee si l'entree n'a pas de date (ancien format)", () => {
    expect(isFreshCatalogEntry(undefined, 30_000, now)).toBe(false);
  });
});
