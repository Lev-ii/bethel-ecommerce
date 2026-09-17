import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { FormError } from "@/components/ui/Form";
import { categoryErrorMessage } from "@/lib/admin/categories";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Produits" };

type SearchParams = Promise<{
  q?: string;
  ajoute?: string;
  modifie?: string;
  supprime?: string;
  ok?: string;
  erreur?: string;
}>;

function movedMessage(ok?: string): string | null {
  const match = /^deplaces-(\d+)$/.exec(ok ?? "");
  if (!match) return null;
  const n = Number(match[1]);
  if (n === 0) return "Les produits cochés étaient déjà dans cette catégorie.";
  return `${n} produit${n > 1 ? "s déplacés" : " déplacé"}.`;
}

export default async function AdminProduitsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const message = sp.ajoute
    ? "Le matériel a été ajouté au catalogue."
    : sp.modifie
      ? "Les modifications ont été enregistrées."
      : sp.supprime
        ? "Le matériel a été supprimé."
        : movedMessage(sp.ok);

  return (
    <ProductsTable
      query={sp.q}
      notice={
        <>
          {message ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-card border border-ok/40 bg-ok/5 px-4 py-3 text-sm text-ok"
            >
              <CheckCircle2 size={16} aria-hidden />
              {message}
            </p>
          ) : null}
          <FormError message={categoryErrorMessage(sp.erreur)} />
        </>
      }
    />
  );
}
