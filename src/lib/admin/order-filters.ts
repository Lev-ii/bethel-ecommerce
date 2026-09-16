import type { OrderStatus } from "@/lib/types";

/**
 * Filtres de l'historique des commandes, lus depuis l'URL.
 *
 * L'URL porte l'etat de la liste : un lien filtre se partage, se met en favori
 * et survit a un rechargement. Tout ce qui en vient est donc a valider — un
 * parametre invalide est ignore, jamais transmis tel quel a la requete.
 */

export const ORDER_PAGE_SIZE = 25;

const STATUSES: readonly OrderStatus[] = [
  "attente_paiement",
  "recue",
  "preparee",
  "expediee",
  "livree",
  "annulee",
];

/** Au-dela, ce n'est plus une recherche mais un abus. */
const MAX_QUERY_LENGTH = 80;
const MAX_PAGE = 10_000;

export interface OrderFilters {
  status?: OrderStatus;
  /** Jour de debut inclus, AAAA-MM-JJ. */
  from?: string;
  /** Jour de fin inclus, AAAA-MM-JJ. */
  to?: string;
  /** Reference, nom ou telephone du client. */
  query?: string;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Une vraie date du calendrier : "2026-02-31" est refuse, pas reporte en mars. */
function calendarDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export function parseOrderFilters(params: RawSearchParams): OrderFilters {
  const etat = first(params.etat);
  const status = STATUSES.includes(etat as OrderStatus) ? (etat as OrderStatus) : undefined;

  let from = calendarDate(first(params.du));
  let to = calendarDate(first(params.au));
  // Une periode saisie a l'envers est une inversion, pas une demande vide.
  if (from && to && from > to) [from, to] = [to, from];

  const rawQuery = first(params.q)?.trim().slice(0, MAX_QUERY_LENGTH);
  const query = rawQuery ? rawQuery : undefined;

  const requested = Number(first(params.page));
  const page = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, MAX_PAGE) : 1;

  return { status, from, to, query, page };
}

/**
 * Lien vers la liste avec des filtres modifies. Changer un critere ramene a la
 * premiere page : la page 7 d'une ancienne recherche n'a plus de sens.
 */
export function ordersHref(filters: OrderFilters, change: Partial<OrderFilters> = {}): string {
  const next: OrderFilters = { ...filters, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.status) params.set("etat", next.status);
  if (next.from) params.set("du", next.from);
  if (next.to) params.set("au", next.to);
  if (next.query) params.set("q", next.query);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/admin/commandes?${qs}` : "/admin/commandes";
}

export function hasActiveFilters(filters: OrderFilters): boolean {
  return Boolean(filters.status || filters.from || filters.to || filters.query);
}

/**
 * Neutralise les jokers de LIKE. Sans cela, rechercher "%" renverrait toutes
 * les commandes, et "_" n'importe quel caractere. Le caractere d'echappement
 * par defaut de PostgreSQL est la barre oblique inverse.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
