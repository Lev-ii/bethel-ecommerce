import { Minus, Plus } from "lucide-react";
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
          aria-label="Retirer une piece"
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
          aria-label="Ajouter une piece"
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
  return (
    <form action={togglePublished}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-sm text-fg-3 underline underline-offset-4 hover:text-fg"
      >
        {published ? "Retirer" : "Publier"}
      </button>
    </form>
  );
}
