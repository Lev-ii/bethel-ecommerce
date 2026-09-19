/**
 * Promotions datees : regles partagees entre l'administration (saisie), la
 * boutique (compte a rebours) et les tests.
 *
 * Les dates saisies sont a l'heure d'Abidjan, qui est UTC+0 toute l'annee
 * (pas d'heure d'ete) : « 2026-09-25T18:00 » vaut 18:00 UTC.
 */
export const SHOP_TIME_ZONE = "Africa/Abidjan";

export type PromotionError = "promo-prix" | "promo-fin" | "promo-debut";

export interface PromotionInput {
  price: number;
  startsAt: string | null;
  endsAt: string;
}

/** Valeur d'un champ datetime-local (« 2026-09-25T18:00 ») vers une date ISO. */
export function parseShopDateTime(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}:00Z`);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Date ISO vers la valeur d'un champ datetime-local, a l'heure d'Abidjan. */
export function toShopDateTimeInput(iso: string | undefined): string | undefined {
  return iso ? new Date(iso).toISOString().slice(0, 16) : undefined;
}

/**
 * Lit les champs de promotion du formulaire. Tous vides : pas de promotion.
 * Renvoie un code d'erreur plutot que de lever, pour rester testable seul.
 */
export function parsePromotion(
  raw: { price: string; startsAt: string; endsAt: string },
  regularPrice: number,
  now = Date.now()
): { promotion: PromotionInput | null } | { error: PromotionError } {
  const priceText = raw.price.trim();
  const startsText = raw.startsAt.trim();
  const endsText = raw.endsAt.trim();
  if (!priceText && !startsText && !endsText) return { promotion: null };

  const price = Number(priceText);
  if (!priceText || !Number.isFinite(price) || price <= 0 || Math.round(price) >= regularPrice) {
    return { error: "promo-prix" };
  }
  const endsAt = parseShopDateTime(endsText);
  // Une promotion terminee n'est pas reproposee dans le formulaire : une fin
  // deja passee est donc toujours une erreur de saisie.
  if (!endsAt || Date.parse(endsAt) <= now) return { error: "promo-fin" };
  const startsAt = startsText ? parseShopDateTime(startsText) : null;
  if (startsText && (!startsAt || Date.parse(startsAt) >= Date.parse(endsAt))) return { error: "promo-debut" };

  return { promotion: { price: Math.round(price), startsAt, endsAt } };
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Temps restant jusqu'a la fin, decoupe pour l'affichage. null une fois termine. */
export function countdownTo(endsAt: string, now = Date.now()): Countdown | null {
  const left = Date.parse(endsAt) - now;
  if (!(left > 0)) return null;
  const total = Math.floor(left / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** « 2 j 03 h 12 min 05 s », « 03 h 12 min 05 s » sous un jour. */
export function formatCountdown(c: Countdown): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(c.hours)} h ${pad(c.minutes)} min ${pad(c.seconds)} s`;
  return c.days > 0 ? `${c.days} j ${time}` : time;
}

/** « jusqu'au 25/09 à 18:00 », a l'heure de la boutique. */
export function formatPromotionEnd(endsAt: string): string {
  const date = new Date(endsAt);
  const day = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: SHOP_TIME_ZONE });
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: SHOP_TIME_ZONE });
  return `jusqu'au ${day} à ${time}`;
}
