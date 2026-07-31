import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Ajouter du materiel" };

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
        <h1 className="mt-3 text-3xl">Ajouter du materiel</h1>
        <p className="mt-2 text-fg-2">
          La fiche apparait dans la boutique des qu&apos;elle est publiee.
        </p>
      </header>

      <ProductForm erreur={erreur} />
    </div>
  );
}
