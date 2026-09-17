import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { products } from "@/lib/data/catalog";

/**
 * Les images du catalogue de demonstration (et de secours, affiche si la base
 * ne repond pas) doivent exister dans public/ : une reference cassee donne
 * une fiche sans photo, sans aucune erreur visible ailleurs qu'en 404.
 */

describe("images du catalogue", () => {
  it.each(products.map((p) => [p.id, p.image] as const))("%s : %s existe", (_id, image) => {
    expect(fs.existsSync(path.join(process.cwd(), "public", image))).toBe(true);
  });

  it("l'image par défaut d'un produit sans photo existe", () => {
    expect(fs.existsSync(path.join(process.cwd(), "public", "produits", "sans-photo.svg"))).toBe(true);
  });
});
