"use client";

import { stockState } from "@/lib/format";
import { useCart } from "@/store/cart";
import type { Product } from "@/lib/types";

export function AddToCartCard({ product }: { product: Product }) {
  const add = useCart((state) => state.add);
  const out = stockState(product) === "out";

  return (
    <button
      type="button"
      disabled={out}
      onClick={() => add(product)}
      className="btn-accent w-full px-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-sm"
      aria-label={out ? "Épuisé" : "Ajouter au panier"}
    >
      <span className="truncate">{out ? "Épuisé" : "Ajouter au panier"}</span>
    </button>
  );
}
