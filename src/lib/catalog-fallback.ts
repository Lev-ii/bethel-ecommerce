import { categories as defaultCategories, products as defaultProducts } from "@/lib/data/catalog";
import type { Category, Product } from "@/lib/types";

export function getFallbackCategories(): Category[] {
  return defaultCategories;
}

export function getFallbackProducts(): Product[] {
  return defaultProducts.filter((product) => product.published);
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
export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = (error as NodeJS.ErrnoException).code;
  const unavailable =
    (code != null && DB_UNAVAILABLE_CODES.has(code)) ||
    /\b(getaddrinfo|econnrefused|enotfound|econnreset|ehostunreach|connect_timeout|connection_ended|connection_closed)\b/i.test(
      `${error.name} ${error.message}`
    );

  if (unavailable) {
    console.error("[db] base injoignable, repli sur le catalogue statique :", error);
  }

  return unavailable;
}
