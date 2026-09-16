import { describe, expect, it } from "vitest";
import { POPUP_MAX_ITEMS, accumulate, freshOrders, type OrderSummary } from "@/lib/admin/new-orders";

const order = (n: number): OrderSummary => ({ id: `o-${n}`, reference: `BTH-2609-${n}`, customerName: `Client ${n}`, total: 1000 * n });

describe("freshOrders", () => {
  it("ne retient que les commandes jamais vues", () => {
    expect(freshOrders([order(3), order(2), order(1)], new Set(["o-1", "o-2"]))).toEqual([order(3)]);
  });

  it("ne signale rien quand tout est deja connu", () => {
    expect(freshOrders([order(1)], new Set(["o-1"]))).toEqual([]);
  });
});

describe("accumulate", () => {
  const empty = { items: [], total: 0 };

  it("ouvre la fenetre avec les nouvelles commandes", () => {
    expect(accumulate(empty, [order(1)])).toEqual({ items: [order(1)], total: 1 });
  });

  // L'ancien encart remplacait la commande affichee : la precedente disparaissait.
  it("cumule au lieu de remplacer, la plus recente en tete", () => {
    const first = accumulate(empty, [order(1)]);
    expect(accumulate(first, [order(2)])).toEqual({ items: [order(2), order(1)], total: 2 });
  });

  it("ne compte jamais deux fois la meme commande", () => {
    const first = accumulate(empty, [order(1)]);
    expect(accumulate(first, [order(1)])).toEqual(first);
  });

  it("limite la liste mais garde le total exact", () => {
    let state: { items: OrderSummary[]; total: number } = empty;
    for (let n = 1; n <= 5; n += 1) state = accumulate(state, [order(n)]);
    expect(state.items).toHaveLength(POPUP_MAX_ITEMS);
    expect(state.items[0]).toEqual(order(5));
    expect(state.total).toBe(5);
  });
});
