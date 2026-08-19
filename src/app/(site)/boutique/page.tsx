import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductGrid } from "@/components/product/ProductCard";
import { CatalogFilters } from "@/components/product/CatalogFilters";
import { EmptyState, Eyebrow } from "@/components/ui/Primitives";
import { getCategory, getProducts } from "@/lib/repository";
import type { CategorySlug } from "@/lib/types";

export const metadata: Metadata = {
  title: "Le matériel",
  description:
    "Trépieds, microphones, éclairage et accessoires en stock chez Bethel.",
};

type SearchParams = Promise<{
  categorie?: string;
  q?: string;
  tri?: string;
  dispo?: string;
}>;

export default async function BoutiquePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const category = sp.categorie
    ? await getCategory(sp.categorie)
    : undefined;

  const products = await getProducts({
    category: category?.slug as CategorySlug | undefined,
    search: sp.q,
    sort: sp.tri as "prix-croissant" | "prix-decroissant" | undefined,
    inStockOnly: sp.dispo === "1",
  });

  return (
    <div className="shell py-10 lg:py-14">
      <header className="mb-8">
        <Eyebrow>Catalogue</Eyebrow>
        <h1 className="mt-2 text-3xl sm:text-4xl">
          {category ? category.name : "Tout le matériel"}
        </h1>
        <p className="mt-2 max-w-xl text-fg-2">
          {category
            ? category.tagline
            : "Ce qui est affiché est ce qui est en boutique. Le stock se met à jour à chaque vente."}
        </p>
      </header>

      <div className="mb-8">
        <Suspense
          fallback={<div className="h-32" aria-hidden />}
        >
          <CatalogFilters resultCount={products.length} />
        </Suspense>
      </div>

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState
          title="Aucun produit ne correspond"
          description="Essayez un autre mot, une autre catégorie, ou retirez le filtre de disponibilité."
          actionLabel="Voir tout le matériel"
          actionHref="/boutique"
        />
      )}
    </div>
  );
}
