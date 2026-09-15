import { describe, expect, it } from "vitest";
import {
  buildOrderReference,
  canAdvanceOrder,
  discountPercent,
  stockState,
} from "@/lib/format";
import type { Order, Product } from "@/lib/types";

const product = (over: Partial<Product>): Product =>
  ({ stock: 10, lowStockThreshold: 5, price: 10000, compareAtPrice: undefined, ...over }) as Product;

const order = (over: Partial<Order>): Pick<Order, "status" | "paidAt" | "paymentMethod" | "deliveryMode"> =>
  ({
    status: "recue",
    paidAt: "2026-09-15T10:00:00.000Z",
    paymentMethod: "wave",
    deliveryMode: "livraison",
    ...over,
  }) as Order;

describe("buildOrderReference", () => {
  it("respecte le format BTH-AAMM-XXXXXX", () => {
    expect(buildOrderReference()).toMatch(/^BTH-\d{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it("n'emploie aucun caractere ambigu a l'oral (0 O 1 I L)", () => {
    const suffixes = Array.from({ length: 200 }, () => buildOrderReference().split("-")[2]);
    expect(suffixes.join("")).not.toMatch(/[01OIL]/);
  });

  it("ne se repete pas sur un tirage serre", () => {
    const references = new Set(Array.from({ length: 500 }, buildOrderReference));
    expect(references.size).toBe(500);
  });
});

describe("canAdvanceOrder", () => {
  it("laisse avancer une commande payee", () => {
    expect(canAdvanceOrder(order({}))).toBe(true);
  });

  it("bloque une commande annulee, meme payee", () => {
    expect(canAdvanceOrder(order({ status: "annulee" }))).toBe(false);
  });

  it("bloque une commande en ligne non payee", () => {
    expect(canAdvanceOrder(order({ paidAt: undefined, status: "attente_paiement" }))).toBe(false);
  });

  it.each(["paiement-livraison", "especes-retrait"] as const)(
    "laisse avancer une commande impayee reglee a la reception (%s)",
    (paymentMethod) => {
      expect(canAdvanceOrder(order({ paidAt: undefined, paymentMethod }))).toBe(true);
    }
  );

  it("laisse avancer un retrait en boutique non encore paye", () => {
    expect(canAdvanceOrder(order({ paidAt: undefined, deliveryMode: "retrait" }))).toBe(true);
  });
});

describe("stockState", () => {
  it("signale un produit epuise", () => {
    expect(stockState(product({ stock: 0 }))).toBe("out");
  });

  it("signale un stock faible au niveau du seuil", () => {
    expect(stockState(product({ stock: 5, lowStockThreshold: 5 }))).toBe("low");
  });

  it("signale un stock normal au-dessus du seuil", () => {
    expect(stockState(product({ stock: 6, lowStockThreshold: 5 }))).toBe("in");
  });
});

describe("discountPercent", () => {
  it("calcule la remise affichee", () => {
    expect(discountPercent(product({ price: 8000, compareAtPrice: 10000 }))).toBe(20);
  });

  it("ne renvoie rien sans prix barre", () => {
    expect(discountPercent(product({ price: 10000, compareAtPrice: undefined }))).toBeNull();
  });

  it("ne renvoie rien si le prix barre n'est pas superieur", () => {
    expect(discountPercent(product({ price: 10000, compareAtPrice: 9000 }))).toBeNull();
  });
});
