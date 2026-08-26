"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/store/cart";
import type { Product } from "@/lib/types";

export function AddToCart({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (product.stock <= 0) {
    return (
      <div className="space-y-3">
        <button type="button" className="btn-outline w-full" disabled>
          Epuise
        </button>
        <p className="text-sm text-fg-2">
          Ce produit est en rupture. Appelez la boutique pour connaitre la date
          du prochain arrivage.
        </p>
      </div>
    );
  }

  const step = (delta: number) =>
    setQuantity((q) => Math.min(Math.max(q + delta, 1), product.stock));

  const handleAdd = () => {
    add(product, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div
          className="flex items-center rounded-card border border-line"
          role="group"
          aria-label="Quantite"
        >
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={quantity <= 1}
            className="flex h-12 w-12 items-center justify-center text-fg-2 disabled:opacity-30"
            aria-label="Retirer un article"
          >
            <Minus size={16} aria-hidden />
          </button>
          <span
            className="tabular w-9 text-center text-base font-semibold"
            aria-live="polite"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={quantity >= product.stock}
            className="flex h-12 w-12 items-center justify-center text-fg-2 disabled:opacity-30"
            aria-label="Ajouter un article"
          >
            <Plus size={16} aria-hidden />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="btn-accent h-12 min-w-0 flex-1"
        >
          {added ? (
            <>
              <Check size={17} aria-hidden className="shrink-0" />{" "}
              <span className="min-w-0 truncate">Ajoute au panier</span>
            </>
          ) : (
            <>
              <ShoppingBag size={17} aria-hidden className="shrink-0" />{" "}
              <span className="min-w-0 truncate">Ajouter au panier</span>
            </>
          )}
        </button>
      </div>

      {added ? (
        <Link
          href="/panier"
          className="inline-block text-sm font-medium underline underline-offset-4"
        >
          Voir le panier et commander
        </Link>
      ) : null}
    </div>
  );
}
