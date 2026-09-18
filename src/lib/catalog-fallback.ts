import { categories as defaultCategories, products as defaultProducts } from "@/lib/data/catalog";
import type { Category, CategorySlug, Product } from "@/lib/types";

export function getFallbackCategories(): Category[] {
  return defaultCategories;
}

export function getFallbackProducts(): Product[] {
  return defaultProducts.filter((product) => product.published);
}

/** Meme filtre et meme tri que la liste lue en base (repository.getProducts). */
export function getFallbackProductsFor(
  query: { category?: CategorySlug; search?: string; sort?: string; inStockOnly?: boolean } = {}
): Product[] {
  const search = query.search?.trim().toLowerCase();
  const filtered = getFallbackProducts().filter(
    (product) =>
      (!query.category || product.category === query.category) &&
      (!query.inStockOnly || product.stock > 0) &&
      (!search || `${product.name} ${product.brand} ${product.headline}`.toLowerCase().includes(search))
  );
  if (query.sort === "prix-croissant") return filtered.sort((a, b) => a.price - b.price);
  if (query.sort === "prix-decroissant") return filtered.sort((a, b) => b.price - a.price);
  return filtered;
}

export function getFallbackFeaturedProducts(limit = 4): Product[] {
  return getFallbackProducts()
    .filter((product) => product.featured || product.isHero)
    .slice(0, limit);
}

export function getFallbackHeroProduct(): Product | undefined {
  return getFallbackProducts()
    .filter((product) => product.published)
    .sort((left, right) => Number(right.isHero) - Number(left.isHero) || Number(right.featured) - Number(left.featured))
    .at(0);
}

export function getFallbackProductBySlug(slug: string): Product | undefined {
  return getFallbackProducts().find((product) => product.slug === slug);
}

export function getFallbackProductById(id: string): Product | undefined {
  return getFallbackProducts().find((product) => product.id === id);
}

const DB_UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ETIMEDOUT",
  "CONNECT_TIMEOUT",
  "CONNECTION_ENDED",
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
]);

/**
 * Distingue une base injoignable d'une erreur applicative (requete invalide,
 * contrainte violee, timeout de requete sur une base pourtant en vie...).
 * Seule la premiere justifie un repli sur le catalogue statique : les autres
 * doivent remonter normalement, sinon un vrai bug se ferait passer pour une
 * panne d'infrastructure.
 */
/*
 * Lectures du catalogue bornees dans le temps, avec coupe-circuit.
 *
 * Face a une base injoignable, postgres.js ne rejette qu'une requete a chaque
 * tentative de reconnexion : les autres attendent, jusqu'a une minute
 * (mesure : 50 requetes simultanees rejetees entre 0 et 65 s). Une page qui
 * lit plusieurs fois le catalogue restait donc bloquee au lieu de basculer sur
 * le catalogue statique - le build des fiches produit depassait 60 s.
 *
 * - chaque lecture est abandonnee apres CATALOG_READ_TIMEOUT_MS ;
 * - apres un echec de connexion, les lectures suivantes passent directement au
 *   catalogue statique pendant BREAKER_MS, sans reessayer la base.
 *
 * Reserve aux lectures publiques du catalogue : commandes, paiements et
 * administration remontent leurs erreurs, sans repli.
 */
export const CATALOG_READ_TIMEOUT_MS = 8_000;
export const BREAKER_MS = 15_000;
let unavailableUntil = 0;

class CatalogUnavailableError extends Error {
  code = "CONNECT_TIMEOUT";
  constructor(message: string, public quiet = false) {
    super(message);
  }
}

export function markDatabaseUnavailable(now = Date.now()): void {
  unavailableUntil = now + BREAKER_MS;
}

/** Remet le coupe-circuit a zero (tests). */
export function resetDatabaseBreaker(): void {
  unavailableUntil = 0;
}

export async function catalogRead<T>(query: PromiseLike<T>, timeoutMs = CATALOG_READ_TIMEOUT_MS): Promise<T> {
  if (Date.now() < unavailableUntil) {
    throw new CatalogUnavailableError("base recemment injoignable : catalogue statique", true);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      query,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new CatalogUnavailableError(`catalogue : pas de reponse de la base en ${timeoutMs} ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Une entree du cache du catalogue est-elle encore bonne a servir ? `at` est
 * l'instant de sa lecture en base. Au-dela de maxAgeMs, on relit la base
 * plutot que de montrer un etat perime (voir catalogCache, repository.ts).
 */
export function isFreshCatalogEntry(at: unknown, maxAgeMs: number, now = Date.now()): boolean {
  // Une date legerement dans le futur vient d'une autre instance dont
  // l'horloge avance un peu : l'entree reste fraiche.
  return typeof at === "number" && now - at <= maxAgeMs;
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Deja signale au premier echec : pas de message a chaque page.
  if (error instanceof CatalogUnavailableError && error.quiet) return true;

  const code = (error as NodeJS.ErrnoException).code;
  const unavailable =
    (code != null && DB_UNAVAILABLE_CODES.has(code)) ||
    /\b(getaddrinfo|econnrefused|enotfound|econnreset|ehostunreach|connect_timeout|connection_ended|connection_closed)\b/i.test(
      `${error.name} ${error.message}`
    );

  if (unavailable) {
    markDatabaseUnavailable();
    console.error("[db] base injoignable, repli sur le catalogue statique :", error);
  }

  return unavailable;
}
