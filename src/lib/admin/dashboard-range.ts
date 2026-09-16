/**
 * Periode et vue du tableau de bord, lues depuis l'URL.
 *
 * Tout se calcule en jours civils UTC. Abidjan est a UTC+0 toute l'annee :
 * un jour UTC est un jour local.
 */

export type PeriodKey = "7j" | "30j" | "90j" | "12m";
export type DashboardView = "ensemble" | "ca" | "statuts" | "produits";
export type Bucket = "day" | "week" | "month";

interface PeriodDef {
  key: PeriodKey;
  label: string;
  /** Libelle de la periode precedente, pour les ecarts : "vs 30 j precedents". */
  previousLabel: string;
  bucket: Bucket;
}

export const PERIODS: readonly PeriodDef[] = [
  { key: "7j", label: "7 jours", previousLabel: "vs 7 j précédents", bucket: "day" },
  { key: "30j", label: "30 jours", previousLabel: "vs 30 j précédents", bucket: "day" },
  // 90 points journaliers donnent une courbe illisible : on regroupe par 7 jours.
  { key: "90j", label: "90 jours", previousLabel: "vs 90 j précédents", bucket: "week" },
  { key: "12m", label: "12 mois", previousLabel: "vs 12 mois précédents", bucket: "month" },
];

export const VIEWS: ReadonlyArray<{ key: DashboardView; label: string }> = [
  { key: "ensemble", label: "Vue d'ensemble" },
  { key: "ca", label: "Chiffre d'affaires" },
  { key: "statuts", label: "Commandes par statut" },
  { key: "produits", label: "Produits les plus vendus" },
];

export const DEFAULT_PERIOD: PeriodKey = "30j";
export const DEFAULT_VIEW: DashboardView = "ensemble";

export interface DashboardRange {
  period: PeriodKey;
  view: DashboardView;
  bucket: Bucket;
  /** Premier jour inclus, AAAA-MM-JJ. */
  from: string;
  /** Dernier jour inclus, AAAA-MM-JJ. */
  to: string;
  previousFrom: string;
  previousTo: string;
  /** Nombre de points de la courbe, identique pour les deux periodes. */
  bucketCount: number;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const DAY = 86_400_000;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(day: Date, n: number): Date {
  return new Date(day.getTime() + n * DAY);
}

function addMonths(day: Date, n: number): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + n, 1));
}

export function periodDef(key: PeriodKey): PeriodDef {
  return PERIODS.find((p) => p.key === key) ?? PERIODS[1];
}

/**
 * Bornes de la periode et de celle qui la precede, de meme longueur. `today`
 * est injecte pour que le calcul soit testable.
 */
export function parseDashboardParams(params: RawSearchParams, today: Date): DashboardRange {
  const rawPeriod = first(params.periode);
  const period = PERIODS.some((p) => p.key === rawPeriod) ? (rawPeriod as PeriodKey) : DEFAULT_PERIOD;
  const rawView = first(params.vue);
  const view = VIEWS.some((v) => v.key === rawView) ? (rawView as DashboardView) : DEFAULT_VIEW;
  const { bucket } = periodDef(period);
  const end = utcDay(today);

  if (period === "12m") {
    // Douze mois civils, le mois en cours compris, compares aux douze d'avant.
    const from = addMonths(end, -11);
    const previousFrom = addMonths(from, -12);
    return {
      period,
      view,
      bucket,
      from: iso(from),
      to: iso(end),
      previousFrom: iso(previousFrom),
      previousTo: iso(addDays(from, -1)),
      bucketCount: 12,
    };
  }

  const days = Number(period.replace("j", ""));
  const from = addDays(end, -(days - 1));
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(days - 1));
  return {
    period,
    view,
    bucket,
    from: iso(from),
    to: iso(end),
    previousFrom: iso(previousFrom),
    previousTo: iso(previousTo),
    bucketCount: bucket === "week" ? Math.ceil(days / 7) : days,
  };
}

/** Premier jour du point `index`, pour libeller l'axe et l'infobulle. */
export function bucketStart(range: Pick<DashboardRange, "bucket" | "from">, index: number): string {
  const from = new Date(`${range.from}T00:00:00Z`);
  if (range.bucket === "month") return iso(addMonths(from, index));
  return iso(addDays(from, range.bucket === "week" ? index * 7 : index));
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "2026-09-15" -> "15/09" par jour ou semaine, "sept. 26" par mois. */
export function bucketLabel(bucket: Bucket, day: string): string {
  const [y, m, d] = day.split("-");
  return bucket === "month" ? `${MONTHS[Number(m) - 1]} ${y.slice(2)}` : `${d}/${m}`;
}

export function dashboardHref(
  range: Pick<DashboardRange, "period" | "view">,
  change: Partial<Pick<DashboardRange, "period" | "view">>
): string {
  const next = { ...range, ...change };
  const params = new URLSearchParams();
  if (next.period !== DEFAULT_PERIOD) params.set("periode", next.period);
  if (next.view !== DEFAULT_VIEW) params.set("vue", next.view);
  const qs = params.toString();
  return qs ? `/admin?${qs}` : "/admin";
}
