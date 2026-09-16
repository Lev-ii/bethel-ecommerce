"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/Primitives";
import { formatPrice } from "@/lib/format";
import { useCart, useCartTotal } from "@/store/cart";
import { GearImage } from "@/components/product/GearImage";

export function CartView() {
  const items = useCart((s) => s.items);
  const ready = useCart((s) => s.ready);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const total = useCartTotal();

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-card bg-bg-2" />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Votre panier est vide"
        description="Parcourez le catalogue et ajoutez le matériel dont vous avez besoin."
        actionLabel="Voir le matériel"
        actionHref="/boutique"
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <ul className="card divide-y divide-line">
        {items.map((item) => (
          <li key={item.productId} className="flex gap-4 p-4">
            <Link
              href={`/boutique/${item.slug}`}
              className="shrink-0 overflow-hidden rounded-card"
            >
              <GearImage
                src={item.image}
                alt={item.name}
                size={96}
                compact
                padding="p-[12%]"
                className="h-24 w-24"
              />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">{item.brand}</p>
                  <Link
                    href={`/boutique/${item.slug}`}
                    className="block truncate font-semibold hover:underline"
                  >
                    {item.name}
                  </Link>
                </div>
                <p className="tabular shrink-0 font-semibold">
                  {formatPrice(item.unitPrice * item.quantity)}
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex items-center rounded-card border border-line"
                  role="group"
                  aria-label={`Quantité pour ${item.name}`}
                >
                  <button
                    type="button"
                    onClick={() => setQuantity(item.productId, item.quantity - 1)}
                    className="flex h-10 w-10 items-center justify-center text-fg-2"
                    aria-label="Retirer un article"
                  >
                    <Minus size={15} aria-hidden />
                  </button>
                  <span className="tabular w-8 text-center text-sm font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.productId, item.quantity + 1)}
                    disabled={item.quantity >= item.maxQuantity}
                    className="flex h-10 w-10 items-center justify-center text-fg-2 disabled:opacity-30"
                    aria-label="Ajouter un article"
                  >
                    <Plus size={15} aria-hidden />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => remove(item.productId)}
                  className="inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-danger"
                  aria-label={`Retirer ${item.name}`}
                >
                  <Trash2 size={15} aria-hidden />
                  <span className="hidden sm:inline">Retirer</span>
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="card h-fit p-5 lg:sticky lg:top-24">
        <h2 className="text-lg">Recapitulatif</h2>

        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-fg-2">Sous-total</dt>
            <dd className="tabular font-medium">{formatPrice(total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-2">Livraison</dt>
            <dd className="text-fg-3">Calculée à l&apos;étape suivante</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-semibold">Total</span>
          <span className="tabular text-xl font-semibold">
            {formatPrice(total)}
          </span>
        </div>

        <Link href="/commande" className="btn-accent mt-5 w-full">
          Passer la commande
        </Link>
        <Link
          href="/boutique"
          className="mt-3 block text-center text-sm text-fg-2 underline underline-offset-4 hover:text-fg"
        >
          Continuer mes achats
        </Link>
      </aside>
    </div>
  );
}
