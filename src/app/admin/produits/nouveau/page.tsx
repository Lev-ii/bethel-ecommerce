import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Ajouter du matériel" };

export default async function NouveauProduitPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  await requireAdmin();
  const { erreur } = await searchParams;

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/produits"
          className="inline-flex items-center gap-1 text-sm text-fg-2 hover:text-fg"
        >
          <ChevronLeft size={15} aria-hidden /> Produits
        </Link>
        <h1 className="mt-3 text-3xl">Ajouter du matériel</h1>
        <p className="mt-2 text-fg-2">
          La fiche apparaît dans la boutique dès qu&apos;elle est publiée.
        </p>
      </header>

      <ProductForm erreur={erreur} />
    </div>
  );
}
