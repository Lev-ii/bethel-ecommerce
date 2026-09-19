"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import type { Category } from "@/lib/types";

/**
 * Les filtres vivent dans l'URL : un lien vers une categorie ou une recherche
 * est partageable, et le retour navigateur fonctionne comme attendu.
 */
export function CatalogFilters({ resultCount, categories }: { resultCount: number; categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const activeCategory = params.get("categorie") ?? "";
  const sort = params.get("tri") ?? "recent";
  const inStockOnly = params.get("dispo") === "1";

  const push = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      startTransition(() => router.push(qs ? `/boutique?${qs}` : "/boutique"));
    },
    [router]
  );

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      push(next);
    },
    [params, push]
  );

  const hasFilters = Boolean(activeCategory || params.get("q") || inStockOnly);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3"
          />
          <label htmlFor="recherche" className="sr-only">
            Rechercher un produit
          </label>
          <input
            id="recherche"
            type="search"
            value={search}
            placeholder="Chercher un trépied, un micro, une marque..."
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") update("q", search || null);
            }}
            className="field pl-10"
          />
        </div>

        <div className="flex gap-3">
          <label htmlFor="tri" className="sr-only">
            Trier
          </label>
          <select
            id="tri"
            value={sort}
            onChange={(e) =>
              update("tri", e.target.value === "recent" ? null : e.target.value)
            }
            className="field sm:w-52"
          >
            <option value="recent">Trier : nos ajouts</option>
            <option value="nouveautes">Nouveautés d&apos;abord</option>
            <option value="prix-croissant">Prix croissant</option>
            <option value="prix-decroissant">Prix décroissant</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={!activeCategory}
          onClick={() => update("categorie", null)}
        >
          Tout
        </FilterChip>
        {categories.map((c) => (
          <FilterChip
            key={c.slug}
            active={activeCategory === c.slug}
            onClick={() => update("categorie", c.slug)}
          >
            {c.name}
          </FilterChip>
        ))}

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <FilterChip
          active={inStockOnly}
          onClick={() => update("dispo", inStockOnly ? null : "1")}
        >
          En stock seulement
        </FilterChip>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              startTransition(() => router.push("/boutique"));
            }}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-fg-3 underline underline-offset-4 hover:text-fg"
          >
            <X size={13} aria-hidden /> Effacer les filtres
          </button>
        ) : null}
      </div>

      <p
        className="tabular text-xs uppercase tracking-wide text-fg-3"
        aria-live="polite"
      >
        {pending
          ? "Mise à jour..."
          : `${resultCount} produit${resultCount > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-card border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-fg bg-fg text-bg"
          : "border-line text-fg-2 hover:border-fg-3 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
