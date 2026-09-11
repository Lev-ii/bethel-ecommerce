import "server-only";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db/client";
import { categories, products } from "@/lib/data/catalog";
import { orders } from "@/lib/data/orders";
import { hashPassword } from "@/lib/auth/password";

/**
 * Mise en place de la base.
 *
 * Tout est idempotent : `applySchema` et `seedDemoData` peuvent etre relances
 * sans rien casser. C'est ce qui permet de rejouer la commande apres chaque
 * deploiement sans se demander dans quel etat se trouve la base.
 */

/** Compte administrateur cree au premier demarrage. */
export const SEED_ADMIN = {
  email: "admin@bethel.store",
  name: "Administrateur",
  password: "bethel2026",
};

export async function applySchema(): Promise<void> {
  const file = path.join(process.cwd(), "db", "schema.sql");
  await sql.unsafe(fs.readFileSync(file, "utf8"));
}

async function seedCategories(): Promise<void> {
  for (const [index, c] of categories.entries()) {
    await sql`
      INSERT INTO categories (slug, name, tagline, position)
      VALUES (${c.slug}, ${c.name}, ${c.tagline}, ${index})
      ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            tagline = EXCLUDED.tagline,
            position = EXCLUDED.position
    `;
  }
}

/**
 * Charge le catalogue et les commandes de demonstration.
 *
 * Sans `force`, la fonction ne fait rien si des produits existent deja : on ne
 * veut pas ecraser un vrai catalogue au redemarrage.
 */
export async function seedDemoData({ force = false } = {}): Promise<void> {
  await seedCategories();

  const [{ count }] = await sql<Array<{ count: string }>>`
    SELECT count(*)::text AS count FROM products
  `;
  if (Number(count) > 0 && !force) return;

  await sql.begin(async (tx) => {
    // Les lignes de commande et les fiches techniques partent en cascade.
    await tx`DELETE FROM orders`;
    await tx`DELETE FROM products`;

    for (const [index, p] of products.entries()) {
      await tx`
        INSERT INTO products (
          id, slug, name, brand, category, headline, description,
          price, compare_at_price, stock, low_stock_threshold,
          image, featured, is_hero, published, created_at
        ) VALUES (
          ${p.id}, ${p.slug}, ${p.name}, ${p.brand}, ${p.category},
          ${p.headline}, ${p.description}, ${p.price},
          ${p.compareAtPrice ?? null}, ${p.stock}, ${p.lowStockThreshold},
          ${p.image}, ${p.featured ?? false}, ${p.isHero ?? false}, ${p.published},
          now() + ${index + " seconds"}::interval
        )
      `;
      for (const [position, s] of p.specs.entries()) {
        await tx`
          INSERT INTO product_specs (product_id, label, value, position)
          VALUES (${p.id}, ${s.label}, ${s.value}, ${position})
        `;
      }
    }

    for (const o of orders) {
      await tx`
        INSERT INTO orders (
          id, reference, customer_name, customer_phone, customer_email,
          delivery_mode, address, city, payment_method, paid_at, total, status, created_at
        ) VALUES (
          ${o.id}, ${o.reference}, ${o.customerName}, ${o.customerPhone},
          ${o.customerEmail ?? null}, ${o.deliveryMode}, ${o.address ?? null},
          ${o.city ?? null}, ${o.paymentMethod}, ${o.paidAt ?? null}, ${o.total}, ${o.status},
          ${o.createdAt}
        )
      `;
      for (const l of o.lines) {
        await tx`
          INSERT INTO order_lines (order_id, product_id, name, unit_price, quantity)
          VALUES (${o.id}, ${l.productId}, ${l.name}, ${l.unitPrice}, ${l.quantity})
        `;
      }
    }
  });
}

/**
 * Cree le compte administrateur s'il n'en existe aucun.
 *
 * Sans lui, personne ne pourrait ouvrir l'administration d'une installation
 * neuve. Les identifiants sont rappeles dans le README et sur la page de
 * connexion : ils sont a changer avant toute mise en ligne.
 */
export async function ensureAdminAccount(): Promise<void> {
  const [{ count }] = await sql<Array<{ count: string }>>`
    SELECT count(*)::text AS count FROM users WHERE role = 'ADMIN'
  `;
  if (Number(count) > 0) return;

  const passwordHash = await hashPassword(SEED_ADMIN.password);
  await sql`
    INSERT INTO users (id, email, name, password_hash, role)
    VALUES (${randomUUID()}, ${SEED_ADMIN.email}, ${SEED_ADMIN.name},
            ${passwordHash}, 'ADMIN')
    ON CONFLICT (email) DO NOTHING
  `;
}
