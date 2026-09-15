import { describe, expect, it } from "vitest";
import {
  MAX_QUANTITY_PER_LINE,
  cartProblem,
  deliveryFeeFor,
  orderTotal,
} from "@/lib/shop/checkout";

const item = (quantity: number) => ({ productId: "p-001", quantity });

describe("cartProblem", () => {
  it("accepte un panier ordinaire", () => {
    expect(cartProblem([item(1), item(3)])).toBeNull();
  });

  it("accepte la quantite maximale", () => {
    expect(cartProblem([item(MAX_QUANTITY_PER_LINE)])).toBeNull();
  });

  it("refuse un panier vide", () => {
    expect(cartProblem([])).toBe("Votre panier est vide.");
  });

  // Une quantite negative passait le controle de stock, rendait le sous-total
  // negatif et augmentait l'inventaire.
  it.each([0, -1, -5])("refuse la quantite %i", (quantity) => {
    expect(cartProblem([item(quantity)])).toBe("Quantité invalide.");
  });

  it.each([1.5, 0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuse la quantite non entiere %s",
    (quantity) => {
      expect(cartProblem([item(quantity)])).toBe("Quantité invalide.");
    }
  );

  it("refuse au-dela du plafond par ligne", () => {
    expect(cartProblem([item(MAX_QUANTITY_PER_LINE + 1)])).toBe("Quantité invalide.");
  });

  it("refuse le panier entier des qu'une seule ligne est invalide", () => {
    expect(cartProblem([item(2), item(-3), item(1)])).toBe("Quantité invalide.");
  });
});

describe("deliveryFeeFor", () => {
  it("facture 2 000 FCFA sur Abidjan", () => {
    expect(deliveryFeeFor("livraison", "Abidjan")).toBe(2000);
  });

  it("facture 5 000 FCFA a l'interieur du pays", () => {
    expect(deliveryFeeFor("livraison", "Bouaké")).toBe(5000);
  });

  it("ne facture rien pour un retrait en boutique", () => {
    expect(deliveryFeeFor("retrait")).toBe(0);
  });

  it("ne facture rien pour un retrait, meme si une ville est transmise", () => {
    expect(deliveryFeeFor("retrait", "Bouaké")).toBe(0);
  });

  it("traite une ville absente comme l'interieur, jamais comme gratuit", () => {
    expect(deliveryFeeFor("livraison")).toBe(5000);
    expect(deliveryFeeFor("livraison", "")).toBe(5000);
  });

  it.each(["ABIDJAN", "  cocody  ", "Port-Bouet", "Adjamé", "yopougon"])(
    "reconnait la zone Abidjan malgre la casse, les espaces et les accents : %s",
    (city) => {
      expect(deliveryFeeFor("livraison", city)).toBe(2000);
    }
  );
});

describe("orderTotal", () => {
  it("additionne les lignes puis les frais de livraison", () => {
    const lines = [
      { unitPrice: 25000, quantity: 1 },
      { unitPrice: 7500, quantity: 2 },
    ];
    expect(orderTotal(lines, 2000)).toBe(42000);
  });

  it("vaut les seuls frais de livraison sans ligne", () => {
    expect(orderTotal([], 5000)).toBe(5000);
  });

  it("n'ajoute rien pour un retrait", () => {
    expect(orderTotal([{ unitPrice: 12000, quantity: 3 }], 0)).toBe(36000);
  });
});
