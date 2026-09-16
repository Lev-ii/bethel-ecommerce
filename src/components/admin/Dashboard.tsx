import Link from "next/link";
import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { BarChart, type BarItem } from "@/components/admin/charts/BarChart";
import { ChartFrame, LegendKey } from "@/components/admin/charts/ChartFrame";
import { RevenueChart, type RevenuePoint } from "@/components/admin/charts/RevenueChart";
import { ResetDemoButton } from "@/components/admin/ResetDemoButton";
import { delta } from "@/lib/admin/chart-scale";
import { demoResetAllowed } from "@/lib/admin/demo-reset";
import {
  PERIODS,
  VIEWS,
  bucketLabel,
  bucketStart,
  dashboardHref,
  periodDef,
  type DashboardRange,
} from "@/lib/admin/dashboard-range";
import { formatDateTime, formatPrice, orderStatusLabel, stockState } from "@/lib/format";
import {
  countOrdersToProcess,
  getAllProducts,
  getDashboardStats,
  getRecentOrders,
  type DashboardStats,
} from "@/lib/repository";
import { releaseExpiredReservationsQuietly } from "@/lib/shop/reservations";

const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Date lisible dans l'infobulle, selon le decoupage de la courbe. */
function pointDate(range: DashboardRange, day: string): string {
  const [y, m, d] = day.split("-");
  if (range.bucket === "month") return `${MONTHS_LONG[Number(m) - 1]} ${y}`;
  return range.bucket === "week" ? `sem. du ${d}/${m}` : `${d}/${m}/${y}`;
}

function seriesNames(range: DashboardRange) {
  const [count, unit] = periodDef(range.period).label.split(" ");
  return { current: `${count} derniers ${unit}`, previous: `${count} ${unit} précédents` };
}

/**
 * Les requetes s'enchainent au lieu de partir en parallele : la page ne doit
 * jamais reserver plusieurs connexions du pool a la fois, qui est partage avec
 * le tunnel d'achat.
 */
export async function Dashboard({ range }: { range: DashboardRange }) {
  await releaseExpiredReservationsQuietly();
  const products = await getAllProducts();
  const toProcess = await countOrdersToProcess();
  const recent = await getRecentOrders(5);
  const stats = await getDashboardStats(range);

  const alerts = products.filter((p) => p.published && stockState(p) !== "in");
  const soldOut = alerts.filter((p) => p.stock === 0).length;
  const names = seriesNames(range);
  const comparison = periodDef(range.period).previousLabel;
  const { current, previous } = stats.totals;
  const basket = (t: { revenue: number; orders: number }) => (t.orders > 0 ? t.revenue / t.orders : 0);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Vue d&apos;ensemble</p>
          <h1 className="mt-2 text-3xl">Tableau de bord</h1>
        </div>
        {demoResetAllowed() ? <ResetDemoButton /> : null}
      </header>

      <section aria-labelledby="maintenant" className="space-y-3">
        <h2 id="maintenant" className="eyebrow">En ce moment</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Tile
            label="Commandes à traiter"
            value={String(toProcess)}
            tone={toProcess > 0 ? "brand" : undefined}
            detail={toProcess > 0 ? "Reçues ou préparées, à faire avancer" : "Rien en attente"}
            href={toProcess > 0 ? "/admin/commandes?etat=recue" : undefined}
          />
          <Tile
            label="Alertes stock"
            value={String(alerts.length)}
            // Rouge des qu'un produit en ligne est epuise : il ne se vend plus.
            // Ambre tant qu'il reste du stock, meme sous le seuil d'alerte.
            tone={soldOut > 0 ? "danger" : alerts.length > 0 ? "warn" : undefined}
            detail={
              alerts.length === 0
                ? "Tous les produits au-dessus du seuil"
                : [
                    soldOut > 0 ? `${soldOut} épuisé${soldOut > 1 ? "s" : ""}` : null,
                    alerts.length - soldOut > 0 ? `${alerts.length - soldOut} sous le seuil` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
        </div>
      </section>

      <section aria-labelledby="ventes" className="space-y-5">
        <div className="space-y-3">
          <h2 id="ventes" className="eyebrow">Ventes</h2>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Segmented
              label="Période"
              items={PERIODS.map((p) => ({ key: p.key, label: p.label, href: dashboardHref(range, { period: p.key }) }))}
              active={range.period}
            />
            <Segmented
              label="Affichage"
              items={VIEWS.map((v) => ({ key: v.key, label: v.label, href: dashboardHref(range, { view: v.key }) }))}
              active={range.view}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Tile
            label="Chiffre d'affaires"
            value={formatPrice(current.revenue)}
            trend={{ current: current.revenue, previous: previous.revenue, comparison }}
          />
          <Tile
            label="Commandes"
            value={String(current.orders)}
            trend={{ current: current.orders, previous: previous.orders, comparison }}
          />
          <Tile
            label="Panier moyen"
            value={current.orders > 0 ? formatPrice(Math.round(basket(current))) : "—"}
            trend={{ current: basket(current), previous: basket(previous), comparison }}
          />
        </div>

        {range.view === "ensemble" ? (
          <div className="space-y-4">
            <RevenueFigure range={range} stats={stats} names={names} />
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <StatusFigure stats={stats} names={names} />
              <ProductsFigure stats={stats} names={names} />
              <ViewsFigure stats={stats} names={names} />
            </div>
          </div>
        ) : null}
        {range.view === "ca" ? <RevenueFigure range={range} stats={stats} names={names} /> : null}
        {range.view === "statuts" ? <StatusFigure stats={stats} names={names} /> : null}
        {range.view === "produits" ? <ProductsFigure stats={stats} names={names} /> : null}
        {range.view === "vues" ? <ViewsFigure stats={stats} names={names} /> : null}
      </section>

      <section aria-labelledby="suivi" className="space-y-3">
        <h2 id="suivi" className="eyebrow">Suivi</h2>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
              {alerts.length > 0 ? <AlertTriangle size={16} aria-hidden className="text-warn" /> : null}
              <h3 className="text-base">Stock à réapprovisionner</h3>
            </div>
            {alerts.length > 0 ? (
              <ul className="divide-y divide-line">
                {alerts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <Link href={`/admin/produits/${p.id}`} className="min-w-0 break-words text-sm hover:underline">
                      {p.name}
                    </Link>
                    <span className={`tabular shrink-0 text-sm font-semibold ${p.stock === 0 ? "text-danger" : "text-warn"}`}>
                      {p.stock === 0 ? "Épuisé" : `${p.stock} restants`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-fg-2">Aucun produit sous son seuil d&apos;alerte.</p>
            )}
            <div className="border-t border-line px-5 py-3">
              <Link href="/admin/produits" className="inline-flex items-center gap-1.5 text-sm font-semibold">
                Gérer les stocks <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3.5">
              <h3 className="text-base">Dernières commandes</h3>
            </div>
            {recent.length > 0 ? (
              <ul className="divide-y divide-line">
                {recent.map((o) => (
                  <li key={o.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="tabular text-sm font-semibold">{o.reference}</span>
                      <span className="tabular text-sm">{formatPrice(o.total)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-fg-3">
                      <span className="break-words">{o.customerName}</span>
                      <span>
                        {orderStatusLabel[o.status]} &middot; {formatDateTime(o.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-fg-2">Aucune commande pour le moment.</p>
            )}
            <div className="border-t border-line px-5 py-3">
              <Link href="/admin/commandes" className="inline-flex items-center gap-1.5 text-sm font-semibold">
                Toutes les commandes <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

type Names = { current: string; previous: string };

function RevenueFigure({ range, stats, names }: { range: DashboardRange; stats: DashboardStats; names: Names }) {
  const points: RevenuePoint[] = stats.current.map((p, i) => {
    const currentDay = bucketStart(range, i);
    const previousDay = bucketStart({ bucket: range.bucket, from: range.previousFrom }, i);
    return {
      label: bucketLabel(range.bucket, currentDay),
      currentDate: pointDate(range, currentDay),
      previousDate: pointDate(range, previousDay),
      current: p.revenue,
      previous: stats.previous[i]?.revenue ?? 0,
    };
  });

  return (
    <ChartFrame
      title="Chiffre d'affaires"
      subtitle={`Par ${range.bucket === "day" ? "jour" : range.bucket === "week" ? "tranche de 7 jours" : "mois"}, hors commandes annulées ou non payées`}
      legend={
        <>
          <LegendKey tone="accent" shape="line" label={names.current} />
          <LegendKey tone="context" shape="line" label={names.previous} />
        </>
      }
      table={{
        columns: [names.current, "Chiffre d'affaires", names.previous, "Chiffre d'affaires"],
        rows: points.map((p) => [p.currentDate, formatPrice(p.current), p.previousDate, formatPrice(p.previous)]),
      }}
    >
      <RevenueChart points={points} currentName={names.current} previousName={names.previous} />
    </ChartFrame>
  );
}

function StatusFigure({ stats, names }: { stats: DashboardStats; names: Names }) {
  const items: BarItem[] = stats.statuses.map((s) => ({
    key: s.status,
    label: orderStatusLabel[s.status],
    value: s.count,
    valueText: String(s.count),
  }));
  return (
    <ChartFrame
      title="Commandes par statut"
      subtitle={`${names.current}, toutes commandes comprises`}
      table={{ columns: ["Statut", "Commandes"], rows: items.map((i) => [i.label, i.valueText]) }}
    >
      <BarChart items={items} emptyMessage="Aucune commande sur cette période." />
    </ChartFrame>
  );
}

function ProductsFigure({ stats, names }: { stats: DashboardStats; names: Names }) {
  const items: BarItem[] = stats.topProducts.map((p) => ({
    key: p.productId,
    label: p.name,
    value: p.quantity,
    valueText: `${p.quantity} vendu${p.quantity > 1 ? "s" : ""}`,
    detail: `${formatPrice(p.revenue)} de chiffre d'affaires`,
  }));
  return (
    <ChartFrame
      title="Produits les plus vendus"
      subtitle={`${names.current}, en quantité`}
      table={{
        columns: ["Produit", "Quantité", "Chiffre d'affaires"],
        rows: stats.topProducts.map((p) => [p.name, String(p.quantity), formatPrice(p.revenue)]),
      }}
    >
      <BarChart items={items} emptyMessage="Aucune vente sur cette période." />
    </ChartFrame>
  );
}

function ViewsFigure({ stats, names }: { stats: DashboardStats; names: Names }) {
  const items: BarItem[] = stats.topViewed.map((p) => ({
    key: p.productId,
    label: p.name,
    value: p.views,
    valueText: `${p.views} visiteur${p.views > 1 ? "s" : ""}`,
  }));
  return (
    <ChartFrame
      title="Produits les plus vus"
      subtitle={`${names.current}, visiteurs distincts par jour, robots et administrateurs exclus`}
      table={{
        columns: ["Produit", "Visiteurs"],
        rows: stats.topViewed.map((p) => [p.name, String(p.views)]),
      }}
    >
      <BarChart
        items={items}
        emptyMessage="Aucune vue enregistrée sur cette période. Le comptage démarre à sa mise en service."
      />
    </ChartFrame>
  );
}

function Segmented({
  label,
  items,
  active,
}: {
  label: string;
  items: Array<{ key: string; label: string; href: string }>;
  active: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const current = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            scroll={false}
            aria-current={current ? "page" : undefined}
            className={`rounded-card border px-3 py-1.5 text-sm transition-colors ${
              current ? "border-fg bg-fg text-bg" : "border-line bg-bg text-fg-2 hover:border-fg-3 hover:text-fg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

type TileTone = "brand" | "warn" | "danger";

/**
 * Tons des tuiles. Le jaune plein signale une action a faire. Ambre et rouge
 * sont des etats : ils passent par une bordure pleine et un chiffre colore,
 * car une teinte legere du fond se confond avec la page en mode jour. Un
 * libelle et une icone accompagnent toujours la couleur.
 */
const TILE_TONES: Record<TileTone, { card: string; value: string; label: string; detail: string }> = {
  brand: {
    card: "border-brand bg-brand text-brand-ink",
    value: "text-brand-ink",
    label: "text-brand-ink/70",
    detail: "text-brand-ink/80",
  },
  warn: { card: "border-warn bg-bg", value: "text-warn", label: "text-warn", detail: "text-fg-2" },
  danger: { card: "border-danger bg-bg", value: "text-danger", label: "text-danger", detail: "text-fg-2" },
};

function Tile({
  label,
  value,
  tone,
  detail,
  href,
  trend,
}: {
  label: string;
  value: string;
  tone?: TileTone;
  detail?: string;
  href?: string;
  trend?: { current: number; previous: number; comparison: string };
}) {
  const style = tone ? TILE_TONES[tone] : null;
  const Icon = tone === "danger" ? AlertOctagon : tone === "warn" ? AlertTriangle : null;
  const body = (
    <>
      <p className={`eyebrow flex items-center gap-1.5 ${style?.label ?? ""}`}>
        {Icon ? <Icon size={13} aria-hidden /> : null}
        {label}
      </p>
      {/* Chiffres proportionnels : tabular-nums ecarte les grands nombres. */}
      <p className={`mt-2 text-2xl font-semibold ${style?.value ?? ""}`}>{value}</p>
      {detail ? <p className={`mt-1 text-xs ${style?.detail ?? "text-fg-3"}`}>{detail}</p> : null}
      {trend ? <Trend {...trend} /> : null}
    </>
  );
  const className = `card block p-5 ${style?.card ?? ""}`;
  return href ? (
    <Link
      href={href}
      className={`${className} transition-[filter,border-color] hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Hausse en vert, baisse en rouge, toujours avec une fleche et un libelle : jamais la couleur seule. */
function Trend({ current, previous, comparison }: { current: number; previous: number; comparison: string }) {
  const d = delta(current, previous);
  if (d.percent === null) {
    return (
      <p className="mt-1.5 text-xs text-fg-3">
        {d.direction === "up" ? "Aucune donnée à comparer" : "—"} {comparison}
      </p>
    );
  }
  const Icon = d.direction === "up" ? ArrowUpRight : d.direction === "down" ? ArrowDownRight : Minus;
  const tone = d.direction === "up" ? "text-ok" : d.direction === "down" ? "text-danger" : "text-fg-3";
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${tone}`}>
        <Icon size={14} aria-hidden />
        {d.percent > 0 ? "+" : ""}
        {d.percent} %
      </span>
      <span className="text-fg-3">{comparison}</span>
    </p>
  );
}
