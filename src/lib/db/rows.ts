import "server-only";

import type { CategorySlug, Order, OrderStatus, Product, Spec, User } from "@/lib/types";

/**
 * Traduction entre les lignes de la base et les types de l'application.
 *
 * La base parle en snake_case, l'application en camelCase. Ce fichier est le
 * seul endroit ou les deux se rencontrent : aucune page ne voit jamais un
 * nom de colonne.
 */

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  headline: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  low_stock_threshold: number;
  image: string;
  featured: boolean;
  is_hero: boolean;
  published: boolean;
  specs?: Array<{ label: string; value: string }> | null;
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category as CategorySlug,
    headline: row.headline,
    description: row.description,
    price: row.price,
    compareAtPrice: row.compare_at_price ?? undefined,
    stock: row.stock,
    lowStockThreshold: row.low_stock_threshold,
    image: row.image,
    featured: row.featured,
    isHero: row.is_hero,
    published: row.published,
    // json_agg renvoie [null] quand la jointure ne trouve rien.
    specs: (row.specs ?? []).filter(Boolean) as Spec[],
  };
}

export interface OrderRow {
  id: string;
  reference: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_mode: string;
  address: string | null;
  city: string | null;
  payment_method: string;
  total: number;
  status: string;
  created_at: Date;
  lines?: Array<{
    productId: string | null;
    name: string;
    unitPrice: number;
    quantity: number;
  }> | null;
}

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id ?? undefined,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email ?? undefined,
    deliveryMode: row.delivery_mode as "livraison" | "retrait",
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    paymentMethod: row.payment_method as Order["paymentMethod"],
    total: row.total,
    status: row.status as OrderStatus,
    createdAt: row.created_at.toISOString(),
    lines: (row.lines ?? []).filter(Boolean).map((l) => ({
      productId: l.productId ?? "",
      name: l.name,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
    })),
  };
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  phone: string | null;
  created_at: Date;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role as User["role"],
    phone: row.phone ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}
