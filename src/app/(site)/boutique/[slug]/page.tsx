import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, RotateCcw, Truck } from "lucide-react";
import { AddToCart } from "@/components/product/AddToCart";
import { GearImage } from "@/components/product/GearImage";
import { ProductCard } from "@/components/product/ProductCard";
import { Eyebrow, Price, StockBadge } from "@/components/ui/Primitives";
import {
  getCategory,
  getProductBySlug,
  getProducts,
  getRelatedProducts,
} from "@/lib/repository";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produit introuvable" };
  return {
    title: product.name,
    description: product.headline,
  };
}

export default async function ProduitPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [category, related] = await Promise.all([
    getCategory(product.category),
    getRelatedProducts(product),
  ]);

  return (
    <div className="shell py-8 lg:py-12">
      <nav aria-label="Fil d'Ariane" className="mb-8">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-fg-3">
          <li>
            <Link href="/boutique" className="hover:text-fg">
              Catalogue
            </Link>
          </li>
          <ChevronRight size={14} aria-hidden />
          <li>
            <Link
              href={`/boutique?categorie=${product.category}`}
              className="hover:text-fg"
            >
              {category?.name}
            </Link>
          </li>
          <ChevronRight size={14} aria-hidden />
          <li aria-current="page" className="text-fg">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="card overflow-hidden">
          <GearImage
            src={product.image}
            alt={product.name}
            size={800}
            priority
            padding="p-[12%]"
            className="aspect-square w-full"
          />
        </div>

        <div>
          <Eyebrow>{product.brand}</Eyebrow>
          <h1 className="mt-2 text-3xl sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-lg text-fg-2">{product.headline}</p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Price product={product} size="lg" />
            <StockBadge product={product} />
          </div>

          <div className="mt-7">
            <AddToCart product={product} />
          </div>

          <div className="mt-7 space-y-2 text-sm text-fg-2">
            <p className="flex items-center gap-2">
              <Truck size={16} aria-hidden className="text-fg-3" />
              Livraison en ville sous 48 h, ou retrait en boutique le jour meme.
            </p>
            <p className="flex items-center gap-2">
              <RotateCcw size={16} aria-hidden className="text-fg-3" />
              Echange sous 7 jours si le produit n&apos;a pas servi.
            </p>
          </div>

          <div className="mt-9">
            <h2 className="text-lg">Description</h2>
            <p className="mt-2 text-fg-2">{product.description}</p>
          </div>

          <div className="mt-9">
            <h2 className="text-lg">Fiche technique</h2>
            <dl className="mt-3">
              {product.specs.map((s) => (
                <div key={s.label} className="spec-row">
                  <dt className="text-sm text-fg-2">{s.label}</dt>
                  <dd className="tabular text-sm font-medium">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl">Dans la meme categorie</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
