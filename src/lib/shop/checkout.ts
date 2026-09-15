import { quoteShipping } from "@/lib/shop/shipping";

/**
 * Regles de calcul du panier.
 *
 * Elles vivent a part de placeOrder pour deux raisons : un fichier "use server"
 * ne peut exporter que des fonctions asynchrones, et ce sont les regles qui
 * decident du montant facture — elles doivent etre testables directement.
 *
 * Rien ici ne fait confiance au client : une action serveur est un point
 * d'entree HTTP public, le panier qui y arrive peut avoir ete forge.
 */

/** Plafond par ligne : au-dela, c'est une erreur de saisie ou un abus. */
export const MAX_QUANTITY_PER_LINE = 50;

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

/** Message d'erreur si le panier est irrecevable, sinon null. */
export function cartProblem(items: CartItem[]): string | null {
  if (items.length === 0) return "Votre panier est vide.";

  for (const item of items) {
    // Une quantite negative passerait le controle de stock, rendrait le
    // sous-total negatif et augmenterait l'inventaire.
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_LINE) {
      return "Quantité invalide.";
    }
  }

  return null;
}

/** Frais de livraison, toujours recalcules ici, jamais pris du client. */
export function deliveryFeeFor(mode: "livraison" | "retrait", city?: string): number {
  return mode === "livraison" ? quoteShipping(city ?? "").fee : 0;
}

/** Total facture : lignes relues en base, plus les frais de livraison. */
export function orderTotal(lines: PricedLine[], deliveryFee: number): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) + deliveryFee;
}
