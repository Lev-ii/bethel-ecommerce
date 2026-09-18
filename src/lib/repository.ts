import "server-only";

import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db/client";
import {
  getFallbackCategories,
  getFallbackFeaturedProducts,
  getFallbackHeroProduct,
  getFallbackProductById,
  getFallbackProductBySlug,
  getFallbackProducts,
  isDatabaseUnavailableError,
} from "@/lib/catalog-fallback";
import { toOrder, toProduct, toUser, type OrderRow, type ProductRow, type UserRow } from "@/lib/db/rows";
import { ORDER_PAGE_SIZE, escapeLike, type OrderFilters } from "@/lib/admin/order-filters";
import type { DashboardRange } from "@/lib/admin/dashboard-range";
import type { Category, CategorySlug, Order, OrderStatus, Product, User } from "@/lib/types";

/**
 * Point d'acces unique aux donnees.
 *
 * Toutes les pages passent par ici et rien d'autre. C'est le seul fichier de
 * lecture qui connaisse le SQL : changer de base ou d'ORM ne touche que lui.
 */

/**
 * Le catalogue (produits, categories) est mis en cache : sous forte charge,
 * des milliers de visites de la boutique dans la meme fenetre ne tapent plus
 * Postgres a chaque fois. La fraicheur reelle vient de revalidateTag(
 * "products"), appele des qu'un achat, un ajustement de stock ou une
 * modification admin change les donnees (voir shop/actions.ts, admin/
 * actions.ts, shop/reservations.ts) : la fenetre ci-dessous n'est qu'un
 * filet de securite si un appel de revalidation venait a manquer.
 *
 * Commandes et comptes ne passent jamais par ici : ce sont des donnees
 * privees, par utilisateur, qui doivent rester a jour a chaque lecture.
 */
const CATALOG_REVALIDATE_SECONDS = 30;

/** Colonnes du produit plus sa fiche technique, en une seule requete. */
const productColumns = sql`
  p.id, p.slug, p.name, p.brand, p.category, p.headline, p.description,
  p.price, p.compare_at_price, p.stock, p.low_stock_threshold,
  p.image, p.featured, p.is_hero, p.published,
  COALESCE(
    (SELECT json_agg(i.url ORDER BY i.position, i.id)
     FROM product_images i WHERE i.product_id = p.id),
    '[]'::json
  ) AS images,
  COALESCE(
    (SELECT json_agg(json_build_object('label', s.label, 'value', s.value)
                     ORDER BY s.position, s.id)
     FROM product_specs s WHERE s.product_id = p.id),
    '[]'::json
  ) AS specs,
  -- Avis publies : moyenne et nombre, pour les etoiles des cartes produit.
  (SELECT round(avg(r.rating)::numeric, 1)::float8 FROM reviews r
    WHERE r.product_id = p.id AND r.status = 'publie') AS review_average,
  (SELECT count(*)::int FROM reviews r
    WHERE r.product_id = p.id AND r.status = 'publie') AS review_count
`;

async function getCategoriesUncached(): Promise<Category[]> {
  try {
    const rows = await sql<Array<{ slug: string; name: string; tagline: string }>>`
      SELECT slug, name, tagline FROM categories ORDER BY position, name
    `;
    return rows.map((r) => ({
      slug: r.slug as CategorySlug,
      name: r.name,
      tagline: r.tagline,
    }));
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
    return getFallbackCategories();
  }
}
export const getCategories = unstable_cache(getCategoriesUncached, ["categories:list"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: ["categories"],
});

async function getCategoryUncached(slug: string): Promise<Category | undefined> {
  try {
    const [row] = await sql<Array<{ slug: string; name: string; tagline: string }>>`
      SELECT slug, name, tagline FROM categories WHERE slug = ${slug}
    `;
    return row
      ? { slug: row.slug as CategorySlug, name: row.name, tagline: row.tagline }
      : undefined;
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
    return getFallbackCategories().find((category) => category.slug === slug);
  }
}
export const getCategory = unstable_cache(getCategoryUncached, ["categories:one"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: ["categories"],
});

export interface ProductQuery {
  category?: CategorySlug;
  search?: string;
  sort?: "recent" | "prix-croissant" | "prix-decroissant";
  inStockOnly?: boolean;
}

async function getProductsUncached(query: ProductQuery = {}): Promise<Product[]> {
  const search = query.search?.trim();

  try {
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
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;

    const products = getFallbackProducts();
    const byCategory = query.category ? products.filter((product) => product.category === query.category) : products;
    const inStock = query.inStockOnly ? byCategory.filter((product) => product.stock > 0) : byCategory;
    const filteredBySearch = search
      ? inStock.filter((product) =>
          `${product.name} ${product.brand} ${product.headline}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      : inStock;

    if (query.sort === "prix-croissant") {
      return [...filteredBySearch].sort((a, b) => a.price - b.price);
    }
    if (query.sort === "prix-decroissant") {
      return [...filteredBySearch].sort((a, b) => b.price - a.price);
    }
    return filteredBySearch;
  }
}
export const getProducts = unstable_cache(getProductsUncached, ["products:list"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: ["products"],
});

/**
 * Produit occupant la fiche technique de l'accueil.
 *
 * L'administration en designe un explicitement. Si aucun ne l'est — ou si
 * celui qui l'etait a ete retire du catalogue — on retombe sur le premier
 * produit mis en avant, pour que l'accueil ne se retrouve jamais vide.
 */
async function getHeroProductUncached(): Promise<Product | undefined> {
  try {
    const rows = await sql<ProductRow[]>`
      SELECT ${productColumns}
      FROM products p
      WHERE p.published = TRUE
      ORDER BY p.is_hero DESC, p.featured DESC, p.created_at ASC
      LIMIT 1
    `;
    return rows[0] ? toProduct(rows[0]) : undefined;
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
    return getFallbackHeroProduct();
  }
}
export const getHeroProduct = unstable_cache(getHeroProductUncached, ["products:hero"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: ["products"],
});

async function getFeaturedProductsUncached(limit = 4): Promise<Product[]> {
  try {
    const rows = await sql<ProductRow[]>`
      SELECT ${productColumns}
      FROM products p
      WHERE p.published = TRUE
      ORDER BY p.featured DESC, p.created_at ASC
      LIMIT ${limit}
    `;
    return rows.map(toProduct);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
    return getFallbackFeaturedProducts(limit);
  }
}
export const getFeaturedProducts = unstable_cache(getFeaturedProductsUncached, ["products:featured"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: ["products"],
});

async function getProductBySlugUncached(slug: string): Promise<Product | undefined> {
  try {
    const [row] = await sql<ProductRow[]>`
      SELECT ${productColumns} FROM products p
      WHERE p.slug = ${slug} AND p.published = TRUE
    `;
    return row ? toProduct(row) : undefined;
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
    return getFallbackProductBySlug(slug);
  }
}
export const getProductBySlug = unstable_cache(getProductBySlugUncached, ["products:by-slug"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: ["products"],
});

async function getRelatedProductsUncached(
  category: CategorySlug,
  excludeId: string,
  limit: number
): Promise<Product[]> {
  try {
    const rows = await sql<ProductRow[]>`
      SELECT ${productColumns} FROM products p
      WHERE p.published = TRUE
        AND p.category = ${category}
        AND p.id <> ${excludeId}
      ORDER BY p.created_at ASC
      LIMIT ${limit}
    `;
    return rows.map(toProduct);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
    return getFallbackProducts()
      .filter((candidate) => candidate.category === category && candidate.id !== excludeId)
      .slice(0, limit);
  }
}
const getRelatedProductsCached = unstable_cache(getRelatedProductsUncached, ["products:related"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: ["products"],
});
export function getRelatedProducts(product: Product, limit = 3): Promise<Product[]> {
  return getRelatedProductsCached(product.category, product.id, limit);
}

/* ----------------------------------------------- Reserve a l'administration */

export async function getAllProducts(): Promise<Product[]> {
  try {
    const rows = await sql<ProductRow[]>`
      SELECT ${productColumns} FROM products p ORDER BY p.created_at DESC
    `;
    return rows.map(toProduct);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
    return getFallbackProducts();
  }
}

export async function getProductById(id: string): Promise<Product | undefined> {
  try {
    const [row] = await sql<ProductRow[]>`
      SELECT ${productColumns} FROM products p WHERE p.id = ${id}
    `;
    return row ? toProduct(row) : undefined;
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
    return getFallbackProductById(id);
  }
}

/** Colonnes de la commande plus ses lignes, en une seule requete. */
const orderColumns = sql`
  o.id, o.reference, o.user_id, o.customer_name, o.customer_phone,
  o.customer_email, o.delivery_mode, o.address, o.city,
  o.payment_method, o.payment_error, o.paid_at, o.admin_seen_at, o.total, o.status, o.created_at,
  COALESCE(
    (SELECT json_agg(json_build_object(
       'productId', l.product_id, 'name', l.name,
       'unitPrice', l.unit_price, 'quantity', l.quantity) ORDER BY l.id)
     FROM order_lines l WHERE l.order_id = o.id),
    '[]'::json
  ) AS lines
`;

/**
 * Commandes et comptes n'ont pas d'equivalent statique : contrairement au
 * catalogue, on ne peut pas se replier sur une copie plausible. Une panne de
 * base remonte donc telle quelle (throw), plutot que de se faire passer pour
 * "commande introuvable" ou "email/mot de passe incorrect".
 */
export async function getRecentOrders(limit: number): Promise<Order[]> {
  const rows = await sql<OrderRow[]>`
    SELECT ${orderColumns} FROM orders o ORDER BY o.created_at DESC LIMIT ${limit}
  `;
  return rows.map(toOrder);
}

/** File d'attente du moment : commandes recues ou preparees, toutes dates. */
export async function countOrdersToProcess(): Promise<number> {
  const [row] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS count FROM orders WHERE status IN ('recue', 'preparee')
  `;
  return row?.count ?? 0;
}

export interface DashboardPoint {
  revenue: number;
  orders: number;
}

export interface DashboardStats {
  /** Un point par intervalle, zeros compris : la courbe ne saute jamais un jour. */
  current: DashboardPoint[];
  previous: DashboardPoint[];
  totals: { current: DashboardPoint; previous: DashboardPoint };
  /** Tous les statuts, dans l'ordre du cycle de vie, zeros compris. */
  statuses: Array<{ status: OrderStatus; count: number }>;
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
  /** Visiteurs distincts par jour, cumules sur la periode. */
  topViewed: Array<{ productId: string; name: string; views: number }>;
}

const STATUS_ORDER: OrderStatus[] = [
  "attente_paiement",
  "recue",
  "preparee",
  "expediee",
  "livree",
  "annulee",
];

/**
 * Indicateurs du tableau de bord, agreges en base.
 *
 * Une commande annulee ou en attente de paiement en ligne n'est pas une vente :
 * elle ne compte ni dans le chiffre d'affaires, ni dans les produits vendus.
 * Elle apparait en revanche dans la repartition par statut.
 */
export async function getDashboardStats(range: DashboardRange): Promise<DashboardStats> {
  const utcDate = sql`(o.created_at AT TIME ZONE 'UTC')::date`;

  const indexFrom = (start: string) => {
    if (range.bucket === "month") {
      return sql`(
        (extract(year FROM o.created_at AT TIME ZONE 'UTC')::int * 12
          + extract(month FROM o.created_at AT TIME ZONE 'UTC')::int)
        - (extract(year FROM ${start}::date)::int * 12 + extract(month FROM ${start}::date)::int)
      )`;
    }
    return range.bucket === "week"
      ? sql`((${utcDate} - ${start}::date) / 7)`
      : sql`(${utcDate} - ${start}::date)`;
  };

  const series = await sql<Array<{ is_current: boolean; idx: number; revenue: number; orders: number }>>`
    SELECT
      (o.created_at >= ${range.from}::date) AS is_current,
      CASE WHEN o.created_at >= ${range.from}::date
        THEN ${indexFrom(range.from)}
        ELSE ${indexFrom(range.previousFrom)}
      END AS idx,
      sum(o.total)::float8 AS revenue,
      count(*)::int AS orders
    FROM orders o
    WHERE o.status NOT IN ('annulee', 'attente_paiement')
      AND o.created_at >= ${range.previousFrom}::date
      AND o.created_at < ${range.to}::date + 1
    GROUP BY 1, 2
  `;

  const empty = () =>
    Array.from({ length: range.bucketCount }, (): DashboardPoint => ({ revenue: 0, orders: 0 }));
  const current = empty();
  const previous = empty();
  for (const row of series) {
    const target = row.is_current ? current : previous;
    if (row.idx >= 0 && row.idx < target.length) {
      target[row.idx] = { revenue: row.revenue, orders: row.orders };
    }
  }
  const sum = (points: DashboardPoint[]) =>
    points.reduce((acc, p) => ({ revenue: acc.revenue + p.revenue, orders: acc.orders + p.orders }), {
      revenue: 0,
      orders: 0,
    });

  const statusRows = await sql<Array<{ status: OrderStatus; count: number }>>`
    SELECT o.status, count(*)::int AS count
    FROM orders o
    WHERE o.created_at >= ${range.from}::date AND o.created_at < ${range.to}::date + 1
    GROUP BY o.status
  `;
  const byStatus = new Map(statusRows.map((r) => [r.status, r.count]));

  // Totaux par produit d'abord, nom ensuite pour les huit retenus seulement,
  // lu par l'index order_lines_product_idx. Chercher le nom dans l'agregat
  // (array_agg ... ORDER BY) obligeait a trier toutes les lignes de la
  // periode, sur disque a fort volume. Un produit supprime garde ses ventes
  // sous product_id NULL : product_key le rend comparable par egalite.
  const topProducts = await sql<DashboardStats["topProducts"]>`
    WITH totals AS (
      SELECT COALESCE(l.product_id, '') AS product_key,
             min(l.product_id) AS product_id,
             sum(l.quantity)::int AS quantity,
             sum(l.quantity * l.unit_price)::float8 AS revenue
      FROM order_lines l
      JOIN orders o ON o.id = l.order_id
      WHERE o.status NOT IN ('annulee', 'attente_paiement')
        AND o.created_at >= ${range.from}::date
        AND o.created_at < ${range.to}::date + 1
      GROUP BY 1
      ORDER BY quantity DESC, revenue DESC, product_key
      LIMIT 8
    ),
    names AS (
      -- Nom tel qu'il figurait sur la vente la plus recente de la periode.
      SELECT DISTINCT ON (COALESCE(l.product_id, '')) COALESCE(l.product_id, '') AS product_key, l.name
      FROM order_lines l
      JOIN orders o ON o.id = l.order_id
      WHERE (
          l.product_id IN (SELECT product_id FROM totals WHERE product_id IS NOT NULL)
          OR (l.product_id IS NULL AND EXISTS (SELECT 1 FROM totals WHERE product_id IS NULL))
        )
        AND o.status NOT IN ('annulee', 'attente_paiement')
        AND o.created_at >= ${range.from}::date
        AND o.created_at < ${range.to}::date + 1
      ORDER BY COALESCE(l.product_id, ''), o.created_at DESC
    )
    SELECT t.product_id AS "productId", n.name, t.quantity, t.revenue
    FROM totals t
    JOIN names n ON n.product_key = t.product_key
    ORDER BY t.quantity DESC, t.revenue DESC, n.name
  `;

  // Regrouper avant de joindre : une ligne par produit a rattacher a son nom,
  // au lieu d'une par vue (pres d'un demi-million sur 12 mois a fort volume).
  const topViewed = await sql<DashboardStats["topViewed"]>`
    SELECT v.product_id AS "productId", p.name, v.views
    FROM (
      SELECT product_id, count(*)::int AS views
      FROM product_views
      WHERE day >= ${range.from}::date AND day <= ${range.to}::date
      GROUP BY product_id
    ) v
    JOIN products p ON p.id = v.product_id
    ORDER BY v.views DESC, p.name
    LIMIT 8
  `;

  return {
    current,
    previous,
    topViewed: [...topViewed],
    totals: { current: sum(current), previous: sum(previous) },
    statuses: STATUS_ORDER.map((status) => ({ status, count: byStatus.get(status) ?? 0 })),
    topProducts: [...topProducts],
  };
}

export interface OrderSearchResult {
  orders: Order[];
  /** Nombre de commandes correspondant a tous les filtres, statut compris. */
  total: number;
  /** Page effectivement servie : une page demandee au-dela de la derniere y est ramenee. */
  page: number;
  pageCount: number;
  /**
   * Repartition par statut sur la periode et la recherche en cours, sans tenir
   * compte du statut choisi : les pastilles de filtre affichent ainsi ce que
   * chaque statut donnerait.
   */
  countsByStatus: Partial<Record<OrderStatus, number>>;
}

/**
 * Historique des commandes, filtre et pagine en base.
 *
 * Remplace le chargement de toutes les commandes suivi d'un filtre en
 * JavaScript, qui grossissait avec chaque vente.
 *
 * Les bornes de periode sont des jours civils compares en UTC. Abidjan etant
 * a UTC+0 toute l'annee, sans heure d'ete, un jour UTC est un jour local.
 */
export async function searchOrders(filters: OrderFilters): Promise<OrderSearchResult> {
  const pattern = filters.query ? `%${escapeLike(filters.query)}%` : undefined;

  const scope = () => sql`
    ${filters.from ? sql`AND o.created_at >= ${filters.from}::date` : sql``}
    ${filters.to ? sql`AND o.created_at < ${filters.to}::date + 1` : sql``}
    ${
      pattern
        ? sql`AND (o.reference ILIKE ${pattern}
                   OR o.customer_name ILIKE ${pattern}
                   OR o.customer_phone ILIKE ${pattern})`
        : sql``
    }
  `;

  const counts = await sql<Array<{ status: OrderStatus; count: number }>>`
    SELECT o.status, count(*)::int AS count
    FROM orders o
    WHERE TRUE ${scope()}
    GROUP BY o.status
  `;

  const countsByStatus: Partial<Record<OrderStatus, number>> = {};
  for (const row of counts) countsByStatus[row.status] = row.count;

  const total = filters.status
    ? (countsByStatus[filters.status] ?? 0)
    : counts.reduce((sum, row) => sum + row.count, 0);
  const pageCount = Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  // La page est choisie sur les seuls identifiants, puis detaillee : avec
  // OFFSET, PostgreSQL calcule les colonnes de chaque ligne sautee, lignes de
  // commande comprises. Sur 200 000 commandes, la derniere page passait de
  // 1,6 s a quelques dizaines de millisecondes.
  const rows =
    total === 0
      ? []
      : await sql<OrderRow[]>`
          WITH page AS (
            SELECT o.id
            FROM orders o
            WHERE TRUE ${scope()}
              ${filters.status ? sql`AND o.status = ${filters.status}` : sql``}
            ORDER BY o.created_at DESC, o.id
            LIMIT ${ORDER_PAGE_SIZE} OFFSET ${(page - 1) * ORDER_PAGE_SIZE}
          )
          SELECT ${orderColumns}
          FROM page JOIN orders o ON o.id = page.id
          ORDER BY o.created_at DESC, o.id
        `;

  return { orders: rows.map(toOrder), total, page, pageCount, countsByStatus };
}

export interface UnseenOrders {
  count: number;
  latest: Array<{ id: string; reference: string; customerName: string; total: number }>;
}

/** Nouvelles commandes que personne n'a encore ouvertes en admin. */
export async function getUnseenOrders(): Promise<UnseenOrders> {
  const rows = await sql<
    Array<{ id: string; reference: string; customer_name: string; total: number; count: number }>
  >`
    SELECT id, reference, customer_name, total, count(*) OVER ()::int AS count
    FROM orders
    WHERE admin_seen_at IS NULL AND status = 'recue'
    ORDER BY created_at DESC
    LIMIT 5
  `;
  return {
    count: rows[0]?.count ?? 0,
    latest: rows.map((r) => ({ id: r.id, reference: r.reference, customerName: r.customer_name, total: r.total })),
  };
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
