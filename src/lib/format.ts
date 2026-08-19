import type { OrderStatus, Product, StockState } from "@/lib/types";

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

export const orderStatusLabel: Record<OrderStatus, string> = {
  recue: "Reçue",
  preparee: "Préparée",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
};

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
export function buildOrderReference(seed = Date.now()): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const tail = String(seed % 10000).padStart(4, "0");
  return `BTH-${yy}${mm}-${tail}`;
}
