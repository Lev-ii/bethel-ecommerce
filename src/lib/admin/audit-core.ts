import { formatPrice, orderStatusLabel } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

/**
 * Vocabulaire du journal d'audit. La liste doit rester alignee sur la
 * contrainte CHECK de audit_logs.action (db/migrations/0002) : ajouter une
 * action demande une migration.
 */
export const AUDIT_ACTIONS = {
  "product.created": "Produit créé",
  "product.updated": "Produit modifié",
  "product.deleted": "Produit supprimé",
  "product.stock_adjusted": "Stock ajusté",
  "product.published": "Produit mis en ligne",
  "product.unpublished": "Produit retiré de la vente",
  "product.image_deleted": "Photo supprimée",
  "product.category_moved": "Produit changé de catégorie",
  "category.created": "Catégorie créée",
  "category.updated": "Catégorie modifiée",
  "category.reordered": "Catégorie déplacée dans le menu",
  "category.deleted": "Catégorie supprimée",
  "review.published": "Avis publié",
  "review.rejected": "Avis refusé",
  "order.status_changed": "Statut de commande changé",
  "auth.admin_login": "Connexion administrateur",
  "auth.admin_login_failed": "Connexion administrateur refusée",
  "auth.password_reset": "Mot de passe réinitialisé",
  "demo.reset": "Démonstration réinitialisée",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const AUDIT_CATEGORIES = {
  produits: { label: "Produits", actions: ["product.created", "product.updated", "product.deleted", "product.stock_adjusted", "product.published", "product.unpublished", "product.image_deleted", "product.category_moved"] },
  categories: { label: "Catégories", actions: ["category.created", "category.updated", "category.reordered", "category.deleted"] },
  avis: { label: "Avis", actions: ["review.published", "review.rejected"] },
  commandes: { label: "Commandes", actions: ["order.status_changed"] },
  connexions: { label: "Connexions", actions: ["auth.admin_login", "auth.admin_login_failed", "auth.password_reset"] },
  systeme: { label: "Système", actions: ["demo.reset"] },
} as const satisfies Record<string, { label: string; actions: readonly AuditAction[] }>;

export type AuditCategory = keyof typeof AUDIT_CATEGORIES;

export interface FieldChange {
  from?: unknown;
  to?: unknown;
}

export type AuditChanges = Record<string, FieldChange>;

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  brand: "Marque",
  category: "Catégorie",
  headline: "Accroche",
  description: "Description",
  price: "Prix",
  compareAtPrice: "Prix barré",
  stock: "Stock",
  lowStockThreshold: "Seuil d'alerte",
  published: "En ligne",
  featured: "Mis en avant",
  isHero: "Produit vedette",
  imagesAdded: "Photos ajoutées",
  position: "Position de la photo",
  status: "Statut",
  paidAt: "Encaissement",
  tagline: "Accroche",
  slug: "Adresse",
  productsMoved: "Produits déplacés",
  correction: "Correction",
  promotion: "Promotion datée",
};

const MONEY = new Set(["price", "compareAtPrice"]);

function same(a: unknown, b: unknown): boolean {
  const empty = (v: unknown) => v === null || v === undefined || v === "";
  if (empty(a) && empty(b)) return true;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return a === b;
}

/** Ne garde que les champs dont la valeur a reellement change. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: ReadonlyArray<keyof T & string>
): AuditChanges {
  const changes: AuditChanges = {};
  for (const field of fields) {
    if (!same(before[field], after[field])) {
      changes[field] = { from: before[field] ?? null, to: after[field] ?? null };
    }
  }
  return changes;
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (MONEY.has(field) && typeof value === "number") return formatPrice(value);
  if (field === "status" && typeof value === "string" && value in orderStatusLabel) {
    return orderStatusLabel[value as OrderStatus];
  }
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

/** "Prix : 24 500 F CFA → 26 000 F CFA", "Stock : 12", "En ligne : oui → non". */
export function describeChange(field: string, change: FieldChange): string {
  const label = FIELD_LABELS[field] ?? field;
  const hasFrom = "from" in change;
  const hasTo = "to" in change;
  if (hasFrom && hasTo) return `${label} : ${formatValue(field, change.from)} → ${formatValue(field, change.to)}`;
  return `${label} : ${formatValue(field, hasTo ? change.to : change.from)}`;
}

export function actionsOf(category: AuditCategory | undefined): readonly AuditAction[] | undefined {
  return category ? AUDIT_CATEGORIES[category].actions : undefined;
}
