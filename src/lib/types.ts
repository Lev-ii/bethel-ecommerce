/** Types metier partages entre la boutique et l'administration. */

/**
 * Identifiant d'URL d'une categorie ("eclairage"). Les categories sont gerees
 * depuis l'administration : ce n'est plus une liste fermee.
 */
export type CategorySlug = string;

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Phrase courte affichee sous le nom sur la page d'accueil. */
  tagline: string;
}

/** Une ligne de fiche technique : "Charge maximale" -> "3 kg". */
export interface Spec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  /** Argument principal, une ligne, affiche sous le nom dans la grille. */
  headline: string;
  description: string;
  /** Prix en unite entiere (FCFA). Pas de decimales. */
  price: number;
  /** Prix barre, si le produit est en promotion. */
  compareAtPrice?: number;
  stock: number;
  /** En dessous de ce seuil, le produit est signale "bientot epuise". */
  lowStockThreshold: number;
  specs: Spec[];
  /** Illustration SVG servie depuis /public/produits. */
  image: string;
  images?: string[];
  featured?: boolean;
  /** Occupe la fiche technique du hero. Un seul produit a la fois. */
  isHero?: boolean;
  published: boolean;
  /** Avis publies : moyenne sur 5 et nombre. Absent tant qu'aucun avis n'est publie. */
  rating?: { average: number; count: number };
  /** Date d'ajout au catalogue (ISO). Absente du catalogue de secours. */
  createdAt?: string;
  /** Badge « Nouveau » (voir lib/shop/novelty.ts). */
  isNew?: boolean;
}

export type StockState = "in" | "low" | "out";

export type OrderStatus =
  | "attente_paiement"
  | "recue"
  | "preparee"
  | "expediee"
  | "livree"
  | "annulee";

export type PaymentMethod =
  | "orange"
  | "mtn"
  | "moov"
  | "djamo"
  | "wave"
  | "especes-retrait"
  | "paiement-livraison";

export interface OrderLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  /** Renseigne si la commande a ete passee depuis un compte client. */
  userId?: string;
  /** Reference lisible communiquee au client : BTH-2607-0142. */
  reference: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryMode: "livraison" | "retrait";
  address?: string;
  city?: string;
  paymentMethod: PaymentMethod;
  /** ISO 8601. Renseigne quand le paiement en ligne est confirme par Jeko. */
  paidAt?: string;
  /** Aucun admin ne l'a encore ouverte (voir la pastille "Commandes"). */
  unseen?: boolean;
  /** Message technique du prestataire si la mise en relation a echoue. Debug admin uniquement. */
  paymentError?: string;
  lines: OrderLine[];
  total: number;
  status: OrderStatus;
  /** ISO 8601. */
  createdAt: string;
}

// ------------------------------------------------------------------ Comptes

export type UserRole = "ADMIN" | "CLIENT";

export interface User {
  id: string;
  email: string;
  name: string;
  /** Hachage scrypt, jamais le mot de passe en clair. */
  passwordHash: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
}

/** Ce que l'application manipule d'un utilisateur connecte. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
