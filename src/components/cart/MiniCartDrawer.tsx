"use client";

import Link from "next/link";
import { ArrowRight, Minus, Plus, Trash2, X } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useCart, useCartTotal } from "@/store/cart";
import { GearImage } from "@/components/product/GearImage";

export function MiniCartDrawer() {
  const item = useCart((state) => state.lastAdded);
  const items = useCart((state) => state.items);
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  const open = useCart((state) => state.drawerOpen);
  const close = useCart((state) => state.closeDrawer);
  const total = useCartTotal();

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Panier">
      <button type="button" className="absolute inset-0 bg-fg/35" onClick={close} aria-label="Fermer le panier" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-bg p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <p className="eyebrow text-ok">Ajouté au panier</p>
            <h2 className="mt-1 text-xl">Votre panier</h2>
          </div>
          <button type="button" onClick={close} className="btn-ghost" aria-label="Fermer le panier">
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <ul className="space-y-4">
            {items.map((cartItem) => (
              <li key={cartItem.productId} className="flex gap-3 border-b border-line pb-4">
                <GearImage src={cartItem.image} alt={cartItem.name} size={80} compact padding="p-[12%]" className="h-20 w-20 shrink-0 rounded-card" />
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{cartItem.brand}</p>
                  <p className="mt-1 truncate font-semibold">{cartItem.name}</p>
                  <p className="tabular mt-1 font-semibold">{formatPrice(cartItem.unitPrice * cartItem.quantity)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-card border border-line" role="group" aria-label={`Quantité pour ${cartItem.name}`}>
                      <button type="button" onClick={() => setQuantity(cartItem.productId, cartItem.quantity - 1)} className="flex h-8 w-8 items-center justify-center text-fg-2" aria-label="Retirer un article"><Minus size={14} aria-hidden /></button>
                      <span className="tabular w-7 text-center text-sm font-semibold">{cartItem.quantity}</span>
                      <button type="button" onClick={() => setQuantity(cartItem.productId, cartItem.quantity + 1)} disabled={cartItem.quantity >= cartItem.maxQuantity} className="flex h-8 w-8 items-center justify-center text-fg-2 disabled:opacity-30" aria-label="Ajouter un article"><Plus size={14} aria-hidden /></button>
                    </div>
                    <button type="button" onClick={() => remove(cartItem.productId)} className="text-fg-3 hover:text-danger" aria-label={`Retirer ${cartItem.name}`}><Trash2 size={15} aria-hidden /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto border-t border-line pt-5">
          <div className="flex justify-between text-sm">
            <span className="text-fg-2">Sous-total</span>
            <span className="tabular font-semibold">{formatPrice(total)}</span>
          </div>
          <Link href="/panier" onClick={close} className="btn-outline mt-4 w-full">
            Afficher le panier
          </Link>
          <Link href="/commande" onClick={close} className="btn-accent mt-3 w-full">
            Passer à la caisse <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </aside>
    </div>
  );
}