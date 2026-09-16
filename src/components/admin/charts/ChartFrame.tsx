"use client";

import { useId, useState, type ReactNode } from "react";

export interface ChartTable {
  columns: string[];
  rows: string[][];
}

/**
 * Cadre commun des graphiques : titre, legende, et bascule vers un tableau.
 *
 * Le tableau est le jumeau accessible du graphique : toute valeur visible au
 * survol y est aussi lisible sans souris, sans couleur, et au lecteur d'ecran.
 */
export function ChartFrame({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  table: ChartTable;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();

  return (
    <figure className="card min-w-0 p-5" aria-labelledby={titleId}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h3 id={titleId} className="text-base">
            {title}
          </h3>
          {subtitle ? <p className="mt-0.5 text-xs text-fg-3">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {legend}
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="rounded-card border border-line px-2.5 py-1 text-xs text-fg-2 transition-colors hover:border-fg-3 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          >
            {showTable ? "Voir le graphique" : "Voir le tableau"}
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-3">
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" className={`py-2 pr-4 font-medium ${i > 0 ? "text-right" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r} className="border-b border-line last:border-0">
                  {row.map((cell, i) => (
                    <td key={i} className={`py-2 pr-4 ${i > 0 ? "tabular text-right" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

/** Cle de legende : un trait pour une courbe, un carre pour une barre. */
export function LegendKey({ tone, shape, label }: { tone: "accent" | "context"; shape: "line" | "rect"; label: string }) {
  const color = tone === "accent" ? "bg-viz-accent" : "bg-viz-context";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-fg-2">
      <span aria-hidden className={shape === "line" ? `h-0.5 w-3.5 rounded-full ${color}` : `h-2.5 w-2.5 rounded-[2px] ${color}`} />
      {label}
    </span>
  );
}
