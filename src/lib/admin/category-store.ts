import "server-only";

import type { TransactionSql } from "postgres";
import { recordAudit } from "@/lib/admin/audit";
import { CategoryError, checkDeletion, parseCategoryInput } from "@/lib/admin/categories";
import { sql } from "@/lib/db/client";
import { firstFreeSlug, slugify } from "@/lib/slug";

/**
 * Operations sur les categories. Chacune tient en une transaction avec son
 * entree au journal d'audit : soit tout est enregistre, soit rien.
 *
 * L'identifiant d'URL (slug) suit le nom : renommer "Eclairage" en "Lumiere"
 * donne ?categorie=lumiere. Les produits suivent grace a la cle etrangere
 * ON UPDATE CASCADE (migration 0007).
 */

type Actor = { id: string; email: string };
type Tx = TransactionSql<{}>;

export interface AdminCategory {
  slug: string;
  name: string;
  tagline: string;
  position: number;
  productCount: number;
}

export async function getCategoriesWithCounts(): Promise<AdminCategory[]> {
  return sql<AdminCategory[]>`
    SELECT c.slug, c.name, c.tagline, c.position,
           (SELECT count(*)::int FROM products p WHERE p.category = c.slug) AS "productCount"
    FROM categories c
    ORDER BY c.position, c.name
  `;
}

async function freeSlug(tx: Tx, name: string, ignore?: string): Promise<string> {
  const base = slugify(name);
  if (!base) throw new CategoryError("nom");
  const rows = await tx<Array<{ slug: string }>>`
    SELECT slug FROM categories
    WHERE (slug = ${base} OR slug LIKE ${base + "-%"})
      ${ignore ? tx`AND slug <> ${ignore}` : tx``}
  `;
  return firstFreeSlug(base, rows.map((r) => r.slug));
}

function audit(tx: Tx) {
  return tx as unknown as typeof sql;
}

export async function createCategory(actor: Actor, raw: { name?: unknown; tagline?: unknown }) {
  const input = parseCategoryInput(raw);
  return sql.begin(async (tx) => {
    // Verrou de table leger : deux creations simultanees du meme nom ne
    // peuvent pas calculer le meme identifiant libre.
    await tx`LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE`;
    const slug = await freeSlug(tx, input.name);
    const [{ next }] = await tx<Array<{ next: number }>>`
      SELECT COALESCE(max(position) + 1, 0)::int AS next FROM categories
    `;
    await tx`
      INSERT INTO categories (slug, name, tagline, position)
      VALUES (${slug}, ${input.name}, ${input.tagline}, ${next})
    `;
    await recordAudit(audit(tx), {
      action: "category.created",
      actor,
      entityType: "category",
      entityId: slug,
      entityLabel: input.name,
      changes: { name: { to: input.name }, tagline: { to: input.tagline }, slug: { to: slug } },
    });
    return { slug };
  });
}

export async function updateCategory(actor: Actor, slug: string, raw: { name?: unknown; tagline?: unknown }) {
  const input = parseCategoryInput(raw);
  return sql.begin(async (tx) => {
    await tx`LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE`;
    const [current] = await tx<Array<{ name: string; tagline: string }>>`
      SELECT name, tagline FROM categories WHERE slug = ${slug} FOR UPDATE
    `;
    if (!current) throw new CategoryError("introuvable");
    if (current.name === input.name && current.tagline === input.tagline) {
      return { slug, changed: false };
    }

    const nextSlug = current.name === input.name ? slug : await freeSlug(tx, input.name, slug);
    // ON UPDATE CASCADE : les produits de la categorie suivent le nouvel identifiant.
    await tx`
      UPDATE categories SET slug = ${nextSlug}, name = ${input.name}, tagline = ${input.tagline}
      WHERE slug = ${slug}
    `;

    const changes: Record<string, { from: string; to: string }> = {};
    if (current.name !== input.name) changes.name = { from: current.name, to: input.name };
    if (current.tagline !== input.tagline) changes.tagline = { from: current.tagline, to: input.tagline };
    if (nextSlug !== slug) changes.slug = { from: slug, to: nextSlug };
    await recordAudit(audit(tx), {
      action: "category.updated",
      actor,
      entityType: "category",
      entityId: nextSlug,
      entityLabel: input.name,
      changes,
    });
    return { slug: nextSlug, previousSlug: slug, changed: true };
  });
}

/** Monte ou descend une categorie d'un cran dans le menu. */
export async function moveCategory(actor: Actor, slug: string, direction: "up" | "down") {
  return sql.begin(async (tx) => {
    const rows = await tx<Array<{ slug: string; name: string }>>`
      SELECT slug, name FROM categories ORDER BY position, name FOR UPDATE
    `;
    const index = rows.findIndex((r) => r.slug === slug);
    if (index === -1) throw new CategoryError("introuvable");
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rows.length) return { moved: false };

    const order = rows.map((r) => r.slug);
    [order[index], order[target]] = [order[target], order[index]];
    // Positions renumerotees 0..n : corrige au passage d'eventuels ex aequo.
    for (const [position, s] of order.entries()) {
      await tx`UPDATE categories SET position = ${position} WHERE slug = ${s}`;
    }
    await recordAudit(audit(tx), {
      action: "category.reordered",
      actor,
      entityType: "category",
      entityId: slug,
      entityLabel: rows[index].name,
      changes: { position: { from: index + 1, to: target + 1 } },
    });
    return { moved: true };
  });
}

/**
 * Supprime une ou plusieurs categories. Leurs produits sont d'abord deplaces
 * vers la destination, dans la meme transaction.
 */
export async function deleteCategories(actor: Actor, selected: string[], destination?: string) {
  return sql.begin(async (tx) => {
    await tx`LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE`;
    const all = await tx<Array<{ slug: string; name: string }>>`SELECT slug, name FROM categories`;
    const slugs = [...new Set(selected)].filter((s) => all.some((c) => c.slug === s));
    // Produits verrouilles puis comptes : un produit ne peut pas etre range
    // dans une categorie supprimee pendant l'operation.
    const counts = await tx<Array<{ category: string; n: number }>>`
      SELECT category, count(*)::int AS n
      FROM (SELECT category FROM products WHERE category = ANY(${slugs}) FOR UPDATE) locked
      GROUP BY category
    `;
    const productCount = counts.reduce((sum, c) => sum + c.n, 0);
    checkDeletion({
      selected,
      existing: all.map((c) => c.slug),
      productCount,
      destination: destination || undefined,
    });

    const destinationName = all.find((c) => c.slug === destination)?.name;
    for (const slug of slugs) {
      const moved = counts.find((c) => c.category === slug)?.n ?? 0;
      if (moved > 0) {
        await tx`
          UPDATE products SET category = ${destination!}, updated_at = now()
          WHERE category = ${slug}
        `;
      }
      await tx`DELETE FROM categories WHERE slug = ${slug}`;
      await recordAudit(audit(tx), {
        action: "category.deleted",
        actor,
        entityType: "category",
        entityId: slug,
        entityLabel: all.find((c) => c.slug === slug)?.name,
        changes: moved > 0 ? { productsMoved: { to: `${moved} vers ${destinationName}` } } : {},
      });
    }
    return { deleted: slugs.length, productsMoved: productCount };
  });
}

/** Deplace un ou plusieurs produits vers une categorie. */
export async function moveProducts(actor: Actor, productIds: string[], category: string) {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (ids.length === 0 || !category) throw new CategoryError("produits");
  return sql.begin(async (tx) => {
    const [target] = await tx<Array<{ name: string }>>`SELECT name FROM categories WHERE slug = ${category} FOR SHARE`;
    if (!target) throw new CategoryError("introuvable");
    const products = await tx<Array<{ id: string; name: string; category: string }>>`
      SELECT id, name, category FROM products WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE
    `;
    let moved = 0;
    for (const p of products) {
      if (p.category === category) continue;
      await tx`UPDATE products SET category = ${category}, updated_at = now() WHERE id = ${p.id}`;
      await recordAudit(audit(tx), {
        action: "product.category_moved",
        actor,
        entityType: "product",
        entityId: p.id,
        entityLabel: p.name,
        changes: { category: { from: p.category, to: category } },
      });
      moved += 1;
    }
    return { moved };
  });
}
