"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { compactAmount, niceTicks } from "@/lib/admin/chart-scale";
import { formatPrice } from "@/lib/format";

export interface RevenuePoint {
  /** Libelle court de l'axe : "16/09", "sept. 26". */
  label: string;
  /** Date complete de la periode en cours, pour l'infobulle. */
  currentDate: string;
  /** Date correspondante de la periode precedente. */
  previousDate: string;
  current: number;
  previous: number;
}

const HEIGHT = 240;
const M = { top: 12, right: 12, bottom: 28, left: 52 };

function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Indices d'axe espaces regulierement, premier et dernier toujours inclus. */
function axisIndices(count: number, width: number): number[] {
  const slots = Math.max(2, Math.min(count, Math.floor(width / 90)));
  if (count <= slots) return Array.from({ length: count }, (_, i) => i);
  const picked = new Set<number>();
  for (let s = 0; s < slots; s += 1) picked.add(Math.round((s * (count - 1)) / (slots - 1)));
  return [...picked];
}

/**
 * Chiffre d'affaires dans le temps : la periode en cours en bleu, la precedente
 * en gris, sur un seul axe. Reticule qui s'aimante au point le plus proche,
 * au pointeur comme au clavier (fleches, Debut, Fin).
 */
export function RevenueChart({
  points,
  currentName,
  previousName,
}: {
  points: RevenuePoint[];
  currentName: string;
  previousName: string;
}) {
  const [ref, width] = useWidth(640);
  const [active, setActive] = useState<number | null>(null);

  const n = points.length;
  const plotW = Math.max(1, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const max = Math.max(0, ...points.map((p) => Math.max(p.current, p.previous)));
  const ticks = niceTicks(max);
  const yMax = ticks[ticks.length - 1];
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;

  const line = (key: "current" | "previous") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const area = `${line("current")}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const empty = max === 0;

  const nearest = (clientX: number, rect: DOMRect) => {
    const ratio = (clientX - rect.left - M.left) / plotW;
    return Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? n - 1;
    const next =
      e.key === "ArrowLeft" ? current - 1
      : e.key === "ArrowRight" ? current + 1
      : e.key === "Home" ? 0
      : e.key === "End" ? n - 1
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.min(n - 1, Math.max(0, next)));
  };

  const point = active !== null ? points[active] : null;
  const tooltipLeft = active !== null ? x(active) : 0;
  const flip = tooltipLeft > width * 0.6;

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={`${currentName} comparé aux ${previousName}. Flèches gauche et droite pour parcourir les points.`}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive((a) => a ?? n - 1)}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
      className="relative w-full min-w-0 touch-pan-y rounded-card outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg"
    >
      {/* Le SVG remplit son conteneur au lieu de le dimensionner : sinon la
          largeur mesuree serait celle du SVG lui-meme, et ne pourrait jamais
          retrecir sous sa valeur initiale. */}
      <svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block overflow-visible"
        aria-hidden
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-3 text-[11px] tabular">
              {compactAmount(t)}
            </text>
          </g>
        ))}

        {axisIndices(n, plotW).map((i) => (
          <text
            key={i}
            x={x(i)}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            className="fill-fg-3 text-[11px] tabular"
          >
            {points[i].label}
          </text>
        ))}

        <path d={line("previous")} fill="none" className="stroke-viz-context" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={area} className="fill-viz-accent/10" />
        <path d={line("current")} fill="none" className="stroke-viz-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {active === null ? (
          <circle cx={x(n - 1)} cy={y(points[n - 1].current)} r={4} className="fill-viz-accent stroke-bg" strokeWidth={2} />
        ) : (
          <g>
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} className="stroke-fg-3" strokeWidth={1} />
            <circle cx={x(active)} cy={y(points[active].previous)} r={4} className="fill-viz-context stroke-bg" strokeWidth={2} />
            <circle cx={x(active)} cy={y(points[active].current)} r={4} className="fill-viz-accent stroke-bg" strokeWidth={2} />
          </g>
        )}
      </svg>

      {empty ? (
        <p className="pointer-events-none absolute inset-x-0 top-[40%] text-center text-sm text-fg-3">
          Aucune vente sur cette période.
        </p>
      ) : null}

      {point ? (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-card border border-line bg-bg px-3 py-2 text-xs shadow-sm"
          style={flip ? { right: width - tooltipLeft + 12 } : { left: tooltipLeft + 12 }}
        >
          <TooltipRow tone="accent" value={formatPrice(point.current)} name={`${point.currentDate}`} />
          <TooltipRow tone="context" value={formatPrice(point.previous)} name={`${point.previousDate}`} />
        </div>
      ) : null}
    </div>
  );
}

function TooltipRow({ tone, value, name }: { tone: "accent" | "context"; value: string; name: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span aria-hidden className={`h-0.5 w-3 shrink-0 rounded-full ${tone === "accent" ? "bg-viz-accent" : "bg-viz-context"}`} />
      <span className="tabular font-semibold text-fg">{value}</span>
      <span className="text-fg-3">{name}</span>
    </div>
  );
}
