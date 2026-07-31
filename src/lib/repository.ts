import "server-only";

import { sql } from "@/lib/db/client";
import { toOrder, toProduct, toUser, type OrderRow, type ProductRow, type UserRow } from "@/lib/db/rows";
import type { Category, CategorySlug, Order, Product, User } from "@/lib/types";

/**
 * Point d'acces unique aux donnees.
 *
 * Toutes les pages passent par ici et rien d'autre. C'est le seul fichier de
 * lecture qui connaisse le SQL : changer de base ou d'ORM ne touche que lui.
 */

/** Colonnes du produit plus sa fiche technique, en une seule requete. */
const productColumns = sql`
  p.id, p.slug, p.name, p.brand, p.category, p.headline, p.description,
  p.price, p.compare_at_price, p.stock, p.low_stock_threshold,
  p.image, p.featured, p.published,
  COALESCE(
    (SELECT json_agg(json_build_object('label', s.label, 'value', s.value)
                     ORDER BY s.position, s.id)
     FROM product_specs s WHERE s.product_id = p.id),
    '[]'::json
  ) AS specs
`;

export async function getCategories(): Promise<Category[]> {
  const rows = await sql<Array<{ slug: string; name: string; tagline: string }>>`
    SELECT slug, name, tagline FROM categories ORDER BY position, name
  `;
  return rows.map((r) => ({
    slug: r.slug as CategorySlug,
    name: r.name,
    tagline: r.tagline,
  }));
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  const [row] = await sql<Array<{ slug: string; name: string; tagline: string }>>`
    SELECT slug, name, tagline FROM categories WHERE slug = ${slug}
  `;
  return row
    ? { slug: row.slug as CategorySlug, name: row.name, tagline: row.tagline }
    : undefined;
}

export interface ProductQuery {
  category?: CategorySlug;
  search?: string;
  sort?: "recent" | "prix-croissant" | "prix-decroissant";
  inStockOnly?: boolean;
}

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const search = query.search?.trim();

  const rows = await sql<ProductRow[]>`
    SELECT ${productColumns}
    FROM products p
    WHERE p.published = TRUE
      ${query.category ? sql`AND p.category = ${query.category}` : sql``}
      ${query.inStockOnly ? sql`AND p.stock > 0` : sql``}
      ${
        search
          ? sql`AND (p.name || ' ' || p.brand || ' ' || p.headline) ILIKE ${"%" + search + "%"}`
          : sql``
      }
    ORDER BY
      ${query.sort === "prix-croissant" ? sql`p.price ASC` : sql``}
      ${query.sort === "prix-decroissant" ? sql`p.price DESC` : sql``}
      ${
        query.sort === "prix-croissant" || query.sort === "prix-decroissant"
          ? sql``
          : sql`p.created_at ASC`
      }
  `;
  return rows.map(toProduct);
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const rows = await sql<ProductRow[]>`
    SELECT ${productColumns}
    FROM products p
    WHERE p.published = TRUE
    ORDER BY p.featured DESC, p.created_at ASC
    LIMIT ${limit}
  `;
  return rows.map(toProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const [row] = await sql<ProductRow[]>`
    SELECT ${productColumns} FROM products p
    WHERE p.slug = ${slug} AND p.published = TRUE
  `;
  return row ? toProduct(row) : undefined;
}

export async function getRelatedProducts(
  product: Product,
  limit = 3
): Promise<Product[]> {
  const rows = await sql<ProductRow[]>`
    SELECT ${productColumns} FROM products p
    WHERE p.published = TRUE
      AND p.category = ${product.category}
      AND p.id <> ${product.id}
    ORDER BY p.created_at ASC
    LIMIT ${limit}
  `;
  return rows.map(toProduct);
}

/* ----------------------------------------------- Reserve a l'administration */

export async function getAllProducts(): Promise<Product[]> {
  const rows = await sql<ProductRow[]>`
    SELECT ${productColumns} FROM products p ORDER BY p.created_at DESC
  `;
  return rows.map(toProduct);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const [row] = await sql<ProductRow[]>`
    SELECT ${productColumns} FROM products p WHERE p.id = ${id}
  `;
  return row ? toProduct(row) : undefined;
}

/** Colonnes de la commande plus ses lignes, en une seule requete. */
const orderColumns = sql`
  o.id, o.reference, o.user_id, o.customer_name, o.customer_phone,
  o.customer_email, o.delivery_mode, o.address, o.city,
  o.payment_method, o.total, o.status, o.created_at,
  COALESCE(
    (SELECT json_agg(json_build_object(
       'productId', l.product_id, 'name', l.name,
       'unitPrice', l.unit_price, 'quantity', l.quantity) ORDER BY l.id)
     FROM order_lines l WHERE l.order_id = o.id),
    '[]'::json
  ) AS lines
`;

export async function getOrders(): Promise<Order[]> {
  const rows = await sql<OrderRow[]>`
    SELECT ${orderColumns} FROM orders o ORDER BY o.created_at DESC
  `;
  return rows.map(toOrder);
}

export async function getOrderByReference(
  reference: string
): Promise<Order | undefined> {
  const [row] = await sql<OrderRow[]>`
    SELECT ${orderColumns} FROM orders o
    WHERE lower(o.reference) = lower(${reference.trim()})
  `;
  return row ? toOrder(row) : undefined;
}

/** Commandes d'un client, pour son espace personnel. */
export async function getOrdersForUser(userId: string): Promise<Order[]> {
  const rows = await sql<OrderRow[]>`
    SELECT ${orderColumns} FROM orders o
    WHERE o.user_id = ${userId}
    ORDER BY o.created_at DESC
  `;
  return rows.map(toOrder);
}

/* ------------------------------------------------------------- Utilisateurs */

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [row] = await sql<UserRow[]>`
    SELECT * FROM users WHERE email = ${email.trim().toLowerCase()}
  `;
  return row ? toUser(row) : undefined;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [row] = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${id}`;
  return row ? toUser(row) : undefined;
}
