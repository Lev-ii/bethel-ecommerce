import "server-only";

import { randomUUID } from "node:crypto";
import { recordAudit } from "@/lib/admin/audit";
import { sql } from "@/lib/db/client";
import { invoiceTokenIsValid } from "@/lib/shop/invoice";
import { ReviewError, parseReviewInput, type ReviewStatus } from "@/lib/shop/reviews";
import type { SessionUser } from "@/lib/types";

/**
 * Avis clients en base.
 *
 * Un avis ne peut venir que de l'acheteur (voir isBuyer) : la commande doit
 * etre livree et contenir le produit, un seul avis par produit et par
 * commande. L'avis attend ensuite la validation de l'administration.
 */

export interface ReviewableItem {
  productId: string;
  productSlug: string | null;
  name: string;
  review: { status: ReviewStatus; rating: number } | null;
}

export interface OrderForReview {
  id: string;
  reference: string;
  status: string;
  customerName: string;
  userId: string | null;
  items: ReviewableItem[];
}

export async function getOrderForReview(reference: string): Promise<OrderForReview | undefined> {
  const [order] = await sql<Array<{ id: string; reference: string; status: string; customer_name: string; user_id: string | null }>>`
    SELECT id, reference, status, customer_name, user_id FROM orders WHERE lower(reference) = lower(${reference.trim()})
  `;
  if (!order) return undefined;
  // Une ligne par produit encore au catalogue : un produit supprime ne se note plus.
  const items = await sql<Array<{ product_id: string; slug: string | null; name: string; status: ReviewStatus | null; rating: number | null }>>`
    SELECT DISTINCT ON (l.product_id) l.product_id, p.slug, l.name, r.status, r.rating
    FROM order_lines l
    JOIN products p ON p.id = l.product_id
    LEFT JOIN reviews r ON r.order_id = l.order_id AND r.product_id = l.product_id
    WHERE l.order_id = ${order.id}
    ORDER BY l.product_id, l.id
  `;
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    customerName: order.customer_name,
    userId: order.user_id,
    items: items.map((i) => ({
      productId: i.product_id,
      productSlug: i.slug,
      name: i.name,
      review: i.status ? { status: i.status, rating: Number(i.rating) } : null,
    })),
  };
}

/**
 * L'acheteur, et lui seul : lien de suivi a jeton, ou compte client
 * proprietaire de la commande. Pas l'administration, qui pourrait sinon
 * ecrire un avis a la place d'un client.
 */
export function isBuyer(
  order: { reference: string; userId: string | null },
  token: string | undefined,
  user: SessionUser | null
): boolean {
  if (invoiceTokenIsValid(order.reference, token ?? null)) return true;
  return Boolean(user && user.role !== "ADMIN" && order.userId && user.id === order.userId);
}

export async function submitReview(input: {
  reference: string;
  token?: string;
  user: SessionUser | null;
  productId: string;
  raw: { rating?: unknown; body?: unknown; authorName?: unknown };
}): Promise<{ productSlug: string | null }> {
  const order = await getOrderForReview(input.reference);
  if (!order || !isBuyer(order, input.token, input.user)) throw new ReviewError("acces");
  if (order.status !== "livree") throw new ReviewError("non-livree");
  const item = order.items.find((i) => i.productId === input.productId);
  if (!item) throw new ReviewError("produit");
  if (item.review) throw new ReviewError("deja");

  const review = parseReviewInput(input.raw);
  const inserted = await sql`
    INSERT INTO reviews (id, product_id, order_id, author_name, rating, body)
    VALUES (${randomUUID()}, ${item.productId}, ${order.id}, ${review.authorName}, ${review.rating}, ${review.body})
    ON CONFLICT (order_id, product_id) DO NOTHING
  `;
  // Deux envois simultanes : le second tombe sur la contrainte d'unicite.
  if (inserted.count === 0) throw new ReviewError("deja");
  return { productSlug: item.productSlug };
}

export interface PublishedReview {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
}

export async function getPublishedReviews(productId: string, limit = 20): Promise<{
  reviews: PublishedReview[];
  average: number | null;
  count: number;
}> {
  const [summary] = await sql<Array<{ average: number | null; count: number }>>`
    SELECT round(avg(rating)::numeric, 1)::float8 AS average, count(*)::int AS count
    FROM reviews WHERE product_id = ${productId} AND status = 'publie'
  `;
  const rows = await sql<Array<{ id: string; author_name: string; rating: number; body: string; created_at: Date }>>`
    SELECT id, author_name, rating, body, created_at FROM reviews
    WHERE product_id = ${productId} AND status = 'publie'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return {
    average: summary.average,
    count: summary.count,
    reviews: rows.map((r) => ({
      id: r.id,
      authorName: r.author_name,
      rating: Number(r.rating),
      body: r.body,
      createdAt: r.created_at.toISOString(),
    })),
  };
}

/* ------------------------------------------------------------ Administration */

export interface AdminReview {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  orderReference: string;
  authorName: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  createdAt: string;
}

export async function getReviewsForAdmin(status: ReviewStatus): Promise<AdminReview[]> {
  const rows = await sql<
    Array<{
      id: string;
      product_id: string;
      product_name: string;
      product_slug: string;
      reference: string;
      author_name: string;
      rating: number;
      body: string;
      status: ReviewStatus;
      created_at: Date;
    }>
  >`
    SELECT r.id, r.product_id, p.name AS product_name, p.slug AS product_slug, o.reference,
           r.author_name, r.rating, r.body, r.status, r.created_at
    FROM reviews r
    JOIN products p ON p.id = r.product_id
    JOIN orders o ON o.id = r.order_id
    WHERE r.status = ${status}
    ORDER BY r.created_at ${status === "en_attente" ? sql`ASC` : sql`DESC`}
    LIMIT 200
  `;
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    productSlug: r.product_slug,
    orderReference: r.reference,
    authorName: r.author_name,
    rating: Number(r.rating),
    body: r.body,
    status: r.status,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function countReviewsByStatus(): Promise<Record<ReviewStatus, number>> {
  const rows = await sql<Array<{ status: ReviewStatus; n: number }>>`
    SELECT status, count(*)::int AS n FROM reviews GROUP BY status
  `;
  const counts: Record<ReviewStatus, number> = { en_attente: 0, publie: 0, refuse: 0 };
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

/** Publie ou refuse un avis. Renvoie le slug du produit, pour rafraichir sa fiche. */
export async function moderateReview(
  actor: { id: string; email: string },
  id: string,
  decision: "publie" | "refuse"
): Promise<{ productSlug: string } | null> {
  return sql.begin(async (tx) => {
    const [review] = await tx<Array<{ status: ReviewStatus; product_slug: string; product_name: string; rating: number }>>`
      SELECT r.status, p.slug AS product_slug, p.name AS product_name, r.rating
      FROM reviews r JOIN products p ON p.id = r.product_id
      WHERE r.id = ${id} FOR UPDATE OF r
    `;
    if (!review || review.status === decision) return null;
    await tx`UPDATE reviews SET status = ${decision}, moderated_at = now() WHERE id = ${id}`;
    await recordAudit(tx as unknown as typeof sql, {
      action: decision === "publie" ? "review.published" : "review.rejected",
      actor,
      entityType: "review",
      entityId: id,
      entityLabel: `${review.product_name} · ${review.rating}★`,
      changes: { status: { from: review.status, to: decision } },
    });
    return { productSlug: review.product_slug };
  });
}
