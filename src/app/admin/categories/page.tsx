import type { Metadata } from "next";
import { CheckCircle2, Plus } from "lucide-react";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { FormError, SubmitButton } from "@/components/ui/Form";
import { createCategoryAction } from "@/lib/admin/category-actions";
import { CATEGORY_NAME_MAX, CATEGORY_TAGLINE_MAX, categoryErrorMessage } from "@/lib/admin/categories";
import { getCategoriesWithCounts } from "@/lib/admin/category-store";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Catégories" };

type Params = Promise<{ ok?: string; erreur?: string }>;

function successMessage(ok?: string): string | null {
  if (!ok) return null;
  if (ok === "creee") return "La catégorie a été créée. Elle apparaît en fin de menu.";
  if (ok === "modifiee") return "La catégorie a été modifiée.";
  if (ok === "inchangee") return "Aucun changement à enregistrer.";
  if (ok === "ordre") return "L'ordre du menu a été mis à jour.";
  const deleted = /^supprimees-(\d+)-(\d+)$/.exec(ok);
  if (deleted) {
    const [, n, moved] = deleted.map(Number);
    const categories = n > 1 ? `${n} catégories supprimées` : "Catégorie supprimée";
    return Number(moved) > 0
      ? `${categories}, ${moved} produit${Number(moved) > 1 ? "s" : ""} déplacé${Number(moved) > 1 ? "s" : ""}.`
      : `${categories}.`;
  }
  return null;
}

export default async function CategoriesPage({ searchParams }: { searchParams: Params }) {
  await requireAdmin();
  const { ok, erreur } = await searchParams;
  const categories = await getCategoriesWithCounts();
  const success = successMessage(ok);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Catalogue</p>
        <h1 className="mt-2 text-3xl">Catégories</h1>
        <p className="mt-2 max-w-2xl text-fg-2">
          Elles forment le menu de la boutique, dans cet ordre. Renommer une catégorie change aussi son
          adresse : les anciens liens partagés mènent alors à la boutique complète.
        </p>
      </header>

      {success ? (
        <p role="status" className="flex items-center gap-2 rounded-card border border-ok/40 bg-ok/5 px-4 py-3 text-sm text-ok">
          <CheckCircle2 size={16} aria-hidden />
          {success}
        </p>
      ) : null}
      <FormError message={categoryErrorMessage(erreur)} />

      <section className="card p-5">
        <h2 className="text-lg">Nouvelle catégorie</h2>
        <form action={createCategoryAction} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
          <div>
            <label htmlFor="new-name" className="field-label">Nom</label>
            <input id="new-name" name="name" required minLength={2} maxLength={CATEGORY_NAME_MAX} className="field" placeholder="Drones" />
          </div>
          <div>
            <label htmlFor="new-tagline" className="field-label">Accroche (facultative)</label>
            <input id="new-tagline" name="tagline" maxLength={CATEGORY_TAGLINE_MAX} className="field" placeholder="Filmer d'en haut, sans louer d'hélicoptère" />
          </div>
          <SubmitButton pendingLabel="Création...">
            <Plus size={16} aria-hidden /> Créer
          </SubmitButton>
        </form>
      </section>

      <CategoriesManager categories={categories} />
    </div>
  );
}
