import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Produits" };

type SearchParams = Promise<{
  q?: string;
  ajoute?: string;
  modifie?: string;
  supprime?: string;
}>;

export default async function AdminProduitsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const message = sp.ajoute
    ? "Le materiel a été ajouté au catalogue."
    : sp.modifie
      ? "Les modifications ont été enregistrées."
      : sp.supprime
        ? "Le materiel a été supprimé."
        : null;

  return (
    <ProductsTable
      query={sp.q}
      notice={
        message ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-card border border-ok/40 bg-ok/5 px-4 py-3 text-sm text-ok"
          >
            <CheckCircle2 size={16} aria-hidden />
            {message}
          </p>
        ) : null
      }
    />
  );
}
