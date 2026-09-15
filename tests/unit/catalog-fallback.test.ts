import { describe, expect, it } from "vitest";
import { getFallbackCategories, getFallbackProducts } from "@/lib/catalog-fallback";

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
