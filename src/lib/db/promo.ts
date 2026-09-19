import "server-only";

import { sql } from "@/lib/db/client";

/**
 * Prix effectif d'un produit (alias SQL « p ») : prix promo pendant une
 * promotion datee, prix normal sinon. Seule source du prix, a l'affichage
 * comme a la facturation (voir shop/actions.ts), pour que les deux ne
 * divergent jamais.
 */
export const promoActiveSql = sql`(
  p.promo_price IS NOT NULL
  AND p.promo_ends_at > now()
  AND (p.promo_starts_at IS NULL OR p.promo_starts_at <= now())
)`;

export const effectivePriceSql = sql`(CASE WHEN ${promoActiveSql} THEN p.promo_price ELSE p.price END)`;

/** Prix barre affiche : le prix normal pendant la promotion, sinon le prix barre permanent. */
export const effectiveCompareAtSql = sql`(CASE WHEN ${promoActiveSql} THEN p.price ELSE p.compare_at_price END)`;
