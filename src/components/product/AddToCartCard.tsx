"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { stockState } from "@/lib/format";
import { useCart } from "@/store/cart";
import type { Product } from "@/lib/types";

export function AddToCartCard({ product }: { product: Product }) {
  const add = useCart((state) => state.add);
  const out = stockState(product) === "out";
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex gap-2">
      <div className="flex items-center rounded-card border border-line" role="group" aria-label={`Quantité de ${product.name}`}>
        <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={out || quantity <= 1} className="flex h-10 w-9 items-center justify-center text-fg-2 disabled:opacity-30" aria-label="Diminuer la quantité"><Minus size={14} aria-hidden /></button>
        <span className="tabular w-6 text-center text-sm font-semibold">{quantity}</span>
        <button type="button" onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} disabled={out || quantity >= product.stock} className="flex h-10 w-9 items-center justify-center text-fg-2 disabled:opacity-30" aria-label="Augmenter la quantité"><Plus size={14} aria-hidden /></button>
      </div>
      <button type="button" disabled={out} onClick={() => add(product, quantity)} className="btn-accent min-w-0 flex-1 px-2 disabled:cursor-not-allowed disabled:opacity-50">
        <ShoppingBag size={15} aria-hidden />
        <span className="truncate">{out ? "Épuisé" : "Ajouter au panier"}</span>
      </button>
    </div>
  );
}