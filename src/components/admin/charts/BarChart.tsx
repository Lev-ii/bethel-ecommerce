"use client";

import { useState } from "react";

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** Valeur affichee en bout de barre. */
  valueText: string;
  /** Precision supplementaire montree au survol et au focus. */
  detail?: string;
}

/**
 * Barres horizontales, une seule serie donc une seule couleur. La valeur se lit
 * en bout de barre, jamais a l'interieur : elle ne peut pas etre rognee. Toute
 * la ligne est la zone de survol, pas seulement la barre.
 */
export function BarChart({ items, emptyMessage }: { items: BarItem[]; emptyMessage: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(0, ...items.map((i) => i.value));

  if (max === 0) {
    return <p className="py-10 text-center text-sm text-fg-3">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const ratio = item.value / max;
        const isActive = active === item.key;
        return (
          <li
            key={item.key}
            tabIndex={0}
            onPointerEnter={() => setActive(item.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(item.key)}
            onBlur={() => setActive(null)}
            aria-label={`${item.label} : ${item.valueText}${item.detail ? `, ${item.detail}` : ""}`}
            className={`relative grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 rounded-card px-2 py-1.5 outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg ${
              isActive ? "bg-bg-2" : ""
            }`}
          >
            <span className="break-words text-sm text-fg-2">{item.label}</span>
            <span className="flex min-w-0 items-center gap-2">
              {item.value > 0 ? (
                <span
                  aria-hidden
                  className="h-4 shrink-0 rounded-r-[4px] bg-viz-accent"
                  style={{ width: `calc((100% - 5.5rem) * ${ratio.toFixed(4)})` }}
                />
              ) : null}
              <span className="tabular shrink-0 text-sm text-fg">{item.valueText}</span>
            </span>

            {isActive && item.detail ? (
              <span
                role="status"
                className="pointer-events-none absolute right-2 top-full z-10 mt-1 rounded-card border border-line bg-bg px-3 py-1.5 text-xs text-fg-2 shadow-sm"
              >
                {item.detail}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
