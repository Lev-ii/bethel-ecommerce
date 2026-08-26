"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/types";

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  image: string;
  unitPrice: number;
  quantity: number;
  /** Stock connu au moment de l'ajout, pour plafonner les quantites. */
  maxQuantity: number;
}

interface CartState {
  items: CartItem[];
  lastAdded: CartItem | null;
  drawerOpen: boolean;
  /** Passe a true apres rehydratation, pour eviter tout ecart serveur/client. */
  ready: boolean;
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  closeDrawer: () => void;
  markReady: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      lastAdded: null,
      drawerOpen: false,
      ready: false,

      add: (product, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === product.id);
          if (existing) {
            const updatedItems = state.items.map((i) =>
              i.productId === product.id
                ? {
                    ...i,
                    quantity: Math.min(i.quantity + quantity, i.maxQuantity),
                  }
                : i
            );
            return {
              items: updatedItems,
              lastAdded: updatedItems.find((i) => i.productId === product.id) ?? null,
              drawerOpen: true,
            };
          }
          const item = {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            brand: product.brand,
            image: product.image,
            unitPrice: product.price,
            quantity: Math.min(quantity, product.stock),
            maxQuantity: product.stock,
          };
          return {
            items: [
              ...state.items,
              item,
            ],
            lastAdded: item,
            drawerOpen: true,
          };
        }),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.productId === productId
                ? { ...i, quantity: Math.min(Math.max(quantity, 0), i.maxQuantity) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),

      remove: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),

      clear: () => set({ items: [], lastAdded: null, drawerOpen: false }),

      closeDrawer: () => set({ drawerOpen: false }),

      markReady: () => set({ ready: true }),
    }),
    {
      name: "bethel-panier",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.markReady();
      },
    }
  )
);

export function useCartCount(): number {
  return useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
}

export function useCartTotal(): number {
  return useCart((s) =>
    s.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  );
}
