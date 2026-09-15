"use client";

import { useEffect } from "react";
import { CHECKOUT_DRAFT_KEY } from "@/components/cart/CheckoutForm";
import { useCart } from "@/store/cart";

/**
 * Vide le panier et le brouillon des coordonnees une fois que le client
 * atterrit reellement sur la page de confirmation. Pour un paiement en ligne,
 * c'est ici (et non avant la redirection vers le prestataire de paiement)
 * qu'on sait que la commande a ete menee a son terme plutot qu'annulee.
 */
export function ClearCartOnMount() {
  const clear = useCart((state) => state.clear);

  useEffect(() => {
    clear();
    try {
      localStorage.removeItem(CHECKOUT_DRAFT_KEY);
    } catch {
      // Stockage inaccessible : le brouillon se perimera de lui-meme.
    }
  }, [clear]);

  return null;
}
