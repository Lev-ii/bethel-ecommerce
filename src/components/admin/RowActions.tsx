import { Eye, EyeOff, Minus, Plus } from "lucide-react";
import { adjustStock, togglePublished } from "@/lib/admin/actions";

/**
 * Actions rapides d'une ligne de tableau.
 *
 * Chacune est un formulaire relie a une action serveur : elles fonctionnent
 * meme sans JavaScript, et le stock affiche est toujours celui qui est
 * reellement enregistre.
 */
export function StockStepper({ id, stock }: { id: string; stock: number }) {
  return (
    <div
      className="inline-flex items-center rounded-card border border-line"
      role="group"
      aria-label="Ajuster le stock"
    >
      <form action={adjustStock}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="delta" value={-1} />
        <button
          type="submit"
          disabled={stock <= 0}
          className="flex h-8 w-8 items-center justify-center text-fg-2 disabled:opacity-30"
          aria-label="Retirer une pièce"
        >
          <Minus size={14} aria-hidden />
        </button>
      </form>

      <span className="tabular w-9 text-center text-sm font-semibold">
        {stock}
      </span>

      <form action={adjustStock}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="delta" value={1} />
        <button
          type="submit"
          className="flex h-8 w-8 items-center justify-center text-fg-2"
          aria-label="Ajouter une pièce"
        >
          <Plus size={14} aria-hidden />
        </button>
      </form>
    </div>
  );
}

export function PublishToggle({
  id,
  published,
}: {
  id: string;
  published: boolean;
}) {
  const label = published ? "Retirer de la vente" : "Remettre en vente";

  return (
    <form action={togglePublished}>
      <input type="hidden" name="id" value={id} />
      {/*
        Retirer de la vente n'est pas une suppression : la fiche reste en base
        et le bouton propose de la remettre en vente. D'ou l'oeil barre plutot
        qu'une corbeille, et le vert quand l'action consiste a republier.

        Sous 1280 px, seule l'icone est affichee (la place manque) : le nom de
        l'action reste porte par aria-label et par l'infobulle.
      */}
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={`inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline ${
          published ? "text-danger" : "text-ok"
        }`}
      >
        {published ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
        <span className="hidden xl:inline">{published ? "Retirer" : "Publier"}</span>
      </button>
    </form>
  );
}
