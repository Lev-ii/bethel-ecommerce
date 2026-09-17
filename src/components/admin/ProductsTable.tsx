import Link from "next/link";
import { FolderInput, Pencil, Plus } from "lucide-react";
import { GearImage } from "@/components/product/GearImage";
import { StockBadge } from "@/components/ui/Primitives";
import { StockStepper, PublishToggle } from "@/components/admin/RowActions";
import { formatPrice } from "@/lib/format";
import { SubmitButton } from "@/components/ui/Form";
import { moveProductsAction } from "@/lib/admin/category-actions";
import { getAllProducts, getCategories } from "@/lib/repository";

/**
 * Liste du catalogue cote administration.
 *
 * Composant serveur : les donnees viennent directement du store, et chaque
 * action passe par un formulaire relie a une action serveur. Aucun etat client
 * a synchroniser, et la page reflete toujours ce qui est reellement enregistre.
 */
export async function ProductsTable({
  query,
  notice,
}: {
  query?: string;
  notice?: React.ReactNode;
}) {
  const [all, categories] = await Promise.all([getAllProducts(), getCategories()]);
  const needle = query?.toLowerCase().trim();
  const products = needle
    ? all.filter((p) =>
        [p.name, p.brand, p.category].join(" ").toLowerCase().includes(needle)
      )
    : all;

  const categoryName = (slug: string) =>
    categories.find((c) => c.slug === slug)?.name ?? slug;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-2 text-3xl">Produits</h1>
          <p className="mt-2 text-fg-2">
            {all.length} fiche{all.length > 1 ? "s" : ""} au total,{" "}
            {all.filter((p) => p.published).length} en ligne.
          </p>
        </div>
        <Link href="/admin/produits/nouveau" className="btn-accent">
          <Plus size={16} aria-hidden /> Ajouter du matériel
        </Link>
      </header>

      {notice}

      <form action="/admin/produits" method="get" className="max-w-md">
        <label htmlFor="q" className="sr-only">
          Rechercher un produit
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Nom, marque, catégorie..."
          className="field"
        />
      </form>

      {/* Deplacement groupe : les cases des lignes appartiennent a ce formulaire
          (attribut form), ce qui marche aussi sans JavaScript. */}
      {products.length > 0 ? (
        <form
          id="deplacer-produits"
          action={moveProductsAction}
          className="card flex flex-wrap items-end gap-3 p-4"
        >
          <div className="min-w-56">
            <label htmlFor="move-category" className="field-label">
              Déplacer les produits cochés vers
            </label>
            <select id="move-category" name="category" required defaultValue="" className="field">
              <option value="" disabled>
                Choisir une catégorie...
              </option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton pendingLabel="Déplacement..." className="btn-outline">
            <FolderInput size={15} aria-hidden /> Déplacer
          </SubmitButton>
        </form>
      ) : null}

      <div className="card overflow-hidden">
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b border-line bg-bg-2 text-left">
              <th scope="col" className="w-10 px-4 py-3">
                <span className="sr-only">Sélection</span>
              </th>
              <Th>Produit</Th>
              <Th>Prix</Th>
              <Th>Stock</Th>
              <Th>État</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id} className={p.published ? "" : "opacity-60"}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    name="id"
                    value={p.id}
                    form="deplacer-produits"
                    aria-label={`Sélectionner ${p.name}`}
                    className="h-4 w-4 accent-brand"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <GearImage
                      src={p.image}
                      alt=""
                      size={40}
                      compact
                      padding="p-[14%]"
                      className="h-10 w-10 shrink-0 rounded-card"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/produits/${p.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-fg-3">
                        {p.brand} &middot; {categoryName(p.category)}
                        {p.isHero ? (
                          <span className="ml-2 rounded-card bg-brand/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-brand-deep">
                            Vedette
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="tabular px-4 py-3">{formatPrice(p.price)}</td>
                <td className="px-4 py-3">
                  <StockStepper id={p.id} stock={p.stock} />
                </td>
                <td className="px-4 py-3">
                  <StockBadge product={p} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/produits/${p.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
                    >
                      <Pencil size={13} aria-hidden /> Modifier
                    </Link>
                    <PublishToggle id={p.id} published={p.published} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-line md:hidden">
          {products.map((p) => (
            <li key={p.id} className={`p-4 ${p.published ? "" : "opacity-60"}`}>
              <div className="flex gap-3">
                <input
                  type="checkbox"
                  name="id"
                  value={p.id}
                  form="deplacer-produits"
                  aria-label={`Sélectionner ${p.name}`}
                  className="mt-4 h-4 w-4 shrink-0 accent-brand"
                />
                <GearImage
                  src={p.image}
                  alt=""
                  size={48}
                  compact
                  padding="p-[14%]"
                  className="h-12 w-12 shrink-0 rounded-card"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/produits/${p.id}`}
                    className="block truncate font-medium"
                  >
                    {p.name}
                  </Link>
                  <p className="tabular text-sm text-fg-2">
                    {formatPrice(p.price)} &middot; {categoryName(p.category)}
                  </p>
                </div>
                <StockBadge product={p} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <StockStepper id={p.id} stock={p.stock} />
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/produits/${p.id}`}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    Modifier
                  </Link>
                  <PublishToggle id={p.id} published={p.published} />
                </div>
              </div>
            </li>
          ))}
        </ul>

        {products.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-fg-2">
              {needle
                ? "Aucun produit ne correspond à cette recherche."
                : "Le catalogue est vide."}
            </p>
            <Link href="/admin/produits/nouveau" className="btn-accent mt-4">
              <Plus size={16} aria-hidden /> Ajouter du matériel
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-fg-3 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}
