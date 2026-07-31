import Link from "next/link";
import { Price, StockBadge } from "@/components/ui/Primitives";
import { stockState } from "@/lib/format";
import type { Product } from "@/lib/types";
import { GearImage } from "@/components/product/GearImage";

export function ProductCard({ product }: { product: Product }) {
  const out = stockState(product) === "out";

  return (
    <Link
      href={`/boutique/${product.slug}`}
      className="group card flex flex-col overflow-hidden transition-colors hover:border-fg"
    >
      <div className="relative aspect-square overflow-hidden">
        <GearImage
          src={product.image}
          alt={product.name}
          dimmed={out}
          className="h-full w-full"
          imageClassName="transition-transform duration-300 group-hover:scale-[1.06]"
        />
        <div className="absolute left-3 top-3">
          <StockBadge product={product} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="eyebrow">{product.brand}</p>
        <h3 className="text-base font-semibold leading-snug">{product.name}</h3>
        <p className="line-clamp-2 flex-1 text-sm text-fg-2">
          {product.headline}
        </p>
        <div className="pt-1">
          <Price product={product} />
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
