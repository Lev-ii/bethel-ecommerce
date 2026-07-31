import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { ProductForm } from "@/components/admin/ProductForm";
import { DeleteProduct } from "@/components/admin/DeleteProduct";
import { productErrorMessage } from "@/lib/admin/messages";
import { requireAdmin } from "@/lib/auth/current";
import { getProductById } from "@/lib/repository";

type Params = Promise<{ id: string }>;
type Search = Promise<{ erreur?: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  return { title: product ? product.name : "Materiel introuvable" };
}

export default async function ModifierProduitPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  await requireAdmin();
  const { id } = await params;
  const { erreur } = await searchParams;
  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/produits"
          className="inline-flex items-center gap-1 text-sm text-fg-2 hover:text-fg"
        >
          <ChevronLeft size={15} aria-hidden /> Produits
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl">{product.name}</h1>
            <p className="mt-2 text-fg-2">Modifier la fiche du materiel.</p>
          </div>
          {product.published ? (
            <Link
              href={`/boutique/${product.slug}`}
              className="btn-outline"
              target="_blank"
            >
              Voir dans la boutique <ExternalLink size={14} aria-hidden />
            </Link>
          ) : null}
        </div>
      </header>

      {erreur === "confirmation" ? (
        <p
          role="alert"
          className="rounded-card border border-danger/40 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
        >
          {productErrorMessage(erreur)}
        </p>
      ) : null}

      <ProductForm product={product} erreur={erreur === "confirmation" ? undefined : erreur} />

      <DeleteProduct id={product.id} name={product.name} />
    </div>
  );
}
