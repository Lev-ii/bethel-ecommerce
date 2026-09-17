"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/Form";
import {
  deleteCategoriesAction,
  moveCategoryAction,
  updateCategoryAction,
} from "@/lib/admin/category-actions";
import { CATEGORY_NAME_MAX, CATEGORY_TAGLINE_MAX } from "@/lib/admin/categories";
import type { AdminCategory } from "@/lib/admin/category-store";
import { slugify } from "@/lib/slug";

/**
 * Liste des categories : modification, ordre du menu, suppression groupee.
 *
 * La selection est un etat client, mais chaque case est aussi un vrai champ
 * du formulaire de suppression (attribut form) : le serveur revalide tout, le
 * resume affiche ici n'est qu'une aide.
 */
export function CategoriesManager({ categories }: { categories: AdminCategory[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [destination, setDestination] = useState("");

  const chosen = categories.filter((c) => selected.includes(c.slug));
  const productsToMove = chosen.reduce((sum, c) => sum + c.productCount, 0);
  const destinations = categories.filter((c) => !selected.includes(c.slug));
  const deletesAll = selected.length > 0 && destinations.length === 0;
  const needsDestination = productsToMove > 0;
  const canDelete = selected.length > 0 && !deletesAll && (!needsDestination || destinations.some((c) => c.slug === destination));

  const toggle = (slug: string) =>
    setSelected((current) => (current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]));
  const allSelected = selected.length === categories.length && categories.length > 0;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg-2 px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? [] : categories.map((c) => c.slug))}
          />
          {categories.length} catégorie{categories.length > 1 ? "s" : ""}
        </label>
        {selected.length > 0 ? (
          <span className="text-sm text-fg-2">
            {selected.length} sélectionnée{selected.length > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      <ul className="divide-y divide-line">
        {categories.map((c, index) => (
          <CategoryRow
            key={c.slug}
            category={c}
            first={index === 0}
            last={index === categories.length - 1}
            checked={selected.includes(c.slug)}
            onToggle={() => toggle(c.slug)}
          />
        ))}
      </ul>

      {selected.length > 0 ? (
        <form id="suppression" action={deleteCategoriesAction} className="space-y-3 border-t border-danger/30 bg-danger/5 p-4">
          {selected.map((slug) => (
            <input key={slug} type="hidden" name="slug" value={slug} />
          ))}
          <p className="text-sm">
            <span className="font-semibold">
              Supprimer {chosen.map((c) => `« ${c.name} »`).join(", ")}
            </span>
            {needsDestination
              ? ` : ${productsToMove} produit${productsToMove > 1 ? "s y sont rangés" : " y est rangé"}.`
              : " : aucun produit n'y est rangé."}
          </p>

          {deletesAll ? (
            <p className="text-sm text-danger">Il doit rester au moins une catégorie.</p>
          ) : needsDestination ? (
            <div className="max-w-sm">
              <label htmlFor="destination" className="field-label">
                Déplacer ces produits vers
              </label>
              <select
                id="destination"
                name="destination"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="field"
              >
                <option value="" disabled>
                  Choisir une catégorie...
                </option>
                {destinations.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <SubmitButton
              disabled={!canDelete}
              pendingLabel="Suppression..."
              className={`btn ${canDelete ? "bg-danger text-bg hover:brightness-110" : "cursor-not-allowed bg-bg-3 text-fg-3"}`}
            >
              <Trash2 size={15} aria-hidden />
              {needsDestination ? "Déplacer et supprimer" : "Supprimer"}
            </SubmitButton>
            <button type="button" className="btn-outline" onClick={() => setSelected([])}>
              Annuler
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function CategoryRow({
  category,
  first,
  last,
  checked,
  onToggle,
}: {
  category: AdminCategory;
  first: boolean;
  last: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const [name, setName] = useState(category.name);
  const nextSlug = useMemo(() => slugify(name), [name]);
  const slugChanges = name.trim() !== category.name && nextSlug !== "" && nextSlug !== category.slug;

  return (
    <li className={`px-4 py-3 ${checked ? "bg-danger/5" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1.5 h-4 w-4 shrink-0 accent-brand"
          checked={checked}
          onChange={onToggle}
          aria-label={`Sélectionner ${category.name}`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-medium">{category.name}</span>
            <Link
              href={`/boutique?categorie=${category.slug}`}
              className="font-mono text-xs text-fg-3 underline-offset-4 hover:underline"
            >
              ?categorie={category.slug}
            </Link>
          </div>
          {category.tagline ? <p className="mt-0.5 text-sm text-fg-2">{category.tagline}</p> : null}
          <p className="mt-1 text-xs text-fg-3">
            {category.productCount} produit{category.productCount > 1 ? "s" : ""}
          </p>

          <details className="mt-2">
            <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium underline underline-offset-4">
              <Pencil size={13} aria-hidden /> Modifier
            </summary>
            <form action={updateCategoryAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
              <input type="hidden" name="slug" value={category.slug} />
              <div>
                <label htmlFor={`name-${category.slug}`} className="field-label">Nom</label>
                <input
                  id={`name-${category.slug}`}
                  name="name"
                  required
                  minLength={2}
                  maxLength={CATEGORY_NAME_MAX}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor={`tagline-${category.slug}`} className="field-label">Accroche</label>
                <input
                  id={`tagline-${category.slug}`}
                  name="tagline"
                  maxLength={CATEGORY_TAGLINE_MAX}
                  defaultValue={category.tagline}
                  className="field"
                />
              </div>
              <SubmitButton>Enregistrer</SubmitButton>
              {slugChanges ? (
                <p className="text-sm text-warn sm:col-span-3">
                  L&apos;adresse deviendra ?categorie={nextSlug} (ou une variante si elle est prise). Les anciens
                  liens mèneront à la boutique complète.
                </p>
              ) : null}
            </form>
          </details>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <MoveButton slug={category.slug} direction="up" disabled={first} />
          <MoveButton slug={category.slug} direction="down" disabled={last} />
        </div>
      </div>
    </li>
  );
}

function MoveButton({ slug, direction, disabled }: { slug: string; direction: "up" | "down"; disabled: boolean }) {
  const label = direction === "up" ? "Monter dans le menu" : "Descendre dans le menu";
  return (
    <form action={moveCategoryAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        title={label}
        className="rounded-card border border-line p-1.5 text-fg-2 hover:border-fg-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
      >
        {direction === "up" ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />}
      </button>
    </form>
  );
}
