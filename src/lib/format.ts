import type { Order, OrderStatus, Product, StockState } from "@/lib/types";

/**
 * Devise de la boutique. Changer ces deux constantes suffit a passer
 * la boutique entiere dans une autre monnaie.
 */
export const CURRENCY_CODE = "XOF";
export const CURRENCY_LABEL = "F CFA";

const priceFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return `${priceFormatter.format(value)} ${CURRENCY_LABEL}`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function stockState(product: Product): StockState {
  if (product.stock <= 0) return "out";
  if (product.stock <= product.lowStockThreshold) return "low";
  return "in";
}

export function stockLabel(product: Product): string {
  const state = stockState(product);
  if (state === "out") return "Épuisé";
  if (state === "low") return `Plus que ${product.stock}`;
  return "En stock";
}

export const paymentMethodLabel: Record<string, string> = {
  orange: "Orange Money",
  mtn: "MTN Money",
  moov: "Moov Money",
  djamo: "Djamo",
  wave: "Wave",
  "mobile-money": "Mobile money",
  carte: "Carte bancaire",
  "especes-retrait": "Espèces au retrait",
  "paiement-livraison": "Paiement à la livraison",
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  attente_paiement: "Paiement en attente",
  recue: "Reçue",
  preparee: "Préparée",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
};

/**
 * Une commande annulee est figee. Sinon, on ne la prepare que si l'on sait
 * qu'elle sera reglee : paiement en ligne confirme, paiement prevu a la
 * reception (especes au retrait, paiement a la livraison), ou retrait en
 * boutique, ou le client peut regler sur place.
 */
export function canAdvanceOrder(
  order: Pick<Order, "status" | "paidAt" | "paymentMethod" | "deliveryMode">
): boolean {
  if (order.status === "annulee") return false;
  if (order.paidAt) return true;
  if (order.paymentMethod === "especes-retrait" || order.paymentMethod === "paiement-livraison") return true;
  return order.deliveryMode === "retrait";
}

/** Ordre du parcours d'une commande, utilise par le suivi client. */
export const orderStatusFlow: OrderStatus[] = [
  "recue",
  "preparee",
  "expediee",
  "livree",
];

export function discountPercent(product: Product): number | null {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) {
    return null;
  }
  return Math.round(
    ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
  );
}

/** Reference lisible du type BTH-2607-1043. */
// Sans 0/O ni 1/I/L : lisible au telephone sans ambiguite.
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * La reference sert de cle d'acces au suivi et a la facture : elle doit etre
 * impossible a deviner (31^6, pres d'un milliard par mois) et ne jamais
 * entrer en collision avec une autre.
 */
export function buildOrderReference(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const tail = Array.from(bytes, (b) => REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length]).join("");
  return `BTH-${yy}${mm}-${tail}`;
}
