import { ProductViewBeacon } from "@/components/product/ProductViewBeacon";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, RotateCcw, Truck } from "lucide-react";
import { AddToCart } from "@/components/product/AddToCart";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductCard } from "@/components/product/ProductCard";
import { ReviewStars } from "@/components/product/ReviewStars";
import { Eyebrow, Price, StockBadge } from "@/components/ui/Primitives";
import {
  getCategory,
  getProductBySlug,
  getProducts,
  getRelatedProducts,
} from "@/lib/repository";
import { getProductReviews } from "@/lib/data/reviews";

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
  const productReviews = getProductReviews(product.slug);
  const galleryImages = product.images?.length ? product.images : [product.image];

  return (
    <div className="shell py-8 lg:py-12">
      <ProductViewBeacon productId={product.id} />
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
        <ProductGallery name={product.name} images={galleryImages} />

        <div>
          <Eyebrow>{product.brand}</Eyebrow>
          <h1 className="mt-2 text-3xl sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-lg text-fg-2">{product.headline}</p>
          {productReviews.length > 0 ? <div className="mt-4 flex items-center gap-2"><ReviewStars rating={productReviews[0].rating} /><span className="text-sm text-fg-2">{productReviews.length} avis</span></div> : null}

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
              Livraison en ville sous 48 h, ou retrait en boutique le jour même.
            </p>
            <p className="flex items-center gap-2">
              <RotateCcw size={16} aria-hidden className="text-fg-3" />
              Échange sous 7 jours si le produit n&apos;a pas servi.
            </p>
          </div>

          <div className="mt-9">
            <h2 className="text-lg">Description</h2>
            <p className="mt-2 text-fg-2">{product.description}</p>
          </div>

          {productReviews.length > 0 ? <section className="mt-9"><h2 className="text-lg">Avis clients</h2><div className="mt-3 space-y-4">{productReviews.map((review) => <article key={review.id} className="border-t border-line pt-4"><div className="flex items-center justify-between gap-3"><ReviewStars rating={review.rating} /><span className="text-sm text-fg-3">{review.customer}</span></div><h3 className="mt-2 font-semibold">{review.title}</h3><p className="mt-1 text-sm text-fg-2">{review.body}</p></article>)}</div></section> : null}

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
          <h2 className="mb-6 text-2xl">Dans la même catégorie</h2>
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
