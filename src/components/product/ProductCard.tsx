import Link from "next/link";
import { Price } from "@/components/ui/Primitives";
import { stockState } from "@/lib/format";
import type { Product } from "@/lib/types";
import { GearImage } from "@/components/product/GearImage";
import { AddToCartCard } from "@/components/product/AddToCartCard";

export function ProductCard({ product }: { product: Product }) {
  const out = stockState(product) === "out";

  return (
    <div className="group card flex flex-col overflow-hidden transition-colors hover:border-fg">
      <Link href={`/boutique/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden">
          <GearImage
            src={product.image}
            alt={product.name}
            dimmed={out}
            className="h-full w-full"
            imageClassName="transition-transform duration-300 group-hover:scale-[1.06]"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="eyebrow">{product.brand}</p>
          <h3 className="text-base font-semibold leading-snug">{product.name}</h3>
          <p className="line-clamp-2 flex-1 text-sm text-fg-2">{product.headline}</p>
          <div className="pt-1">
            <Price product={product} />
          </div>
        </div>
      </Link>
      <div className="px-4 pb-4">
        <AddToCartCard product={product} />
      </div>
    </div>
  );
}

/**
 * Grille de produits. "catalogue" ajoute des colonnes sur grand ecran ;
 * "rangee" garde quatre colonnes, pour les selections de quatre produits de
 * la page d'accueil, qui laisseraient sinon des trous.
 */
export function ProductGrid({
  products,
  layout = "catalogue",
}: {
  products: Product[];
  layout?: "catalogue" | "rangee";
}) {
  const columns =
    layout === "catalogue"
      ? "grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 min-[1920px]:grid-cols-6"
      : "grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid gap-4 2xl:gap-5 ${columns}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
