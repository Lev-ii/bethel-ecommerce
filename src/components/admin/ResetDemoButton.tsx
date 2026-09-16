import { RotateCcw } from "lucide-react";
import { resetDemo } from "@/lib/admin/actions";
import { DEMO_RESET_CONFIRMATION } from "@/lib/admin/demo-reset";
import { SubmitButton } from "@/components/ui/Form";

/**
 * Remet le catalogue et les commandes a leur etat d'origine.
 * N'est affiche qu'avec ALLOW_DEMO_RESET=true (voir lib/admin/demo-reset).
 * Les comptes ne sont pas touches : on ne veut pas perdre l'acces admin.
 */
export function ResetDemoButton() {
  return (
    <form action={resetDemo} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="reinit-confirmation" className="field-label">
          Efface commandes et produits — saisir {DEMO_RESET_CONFIRMATION}
        </label>
        <input
          id="reinit-confirmation"
          name="confirmation"
          required
          autoComplete="off"
          pattern={DEMO_RESET_CONFIRMATION}
          className="field"
        />
      </div>
      <SubmitButton pendingLabel="Remise à zéro..." className="btn-outline">
        <RotateCcw size={15} aria-hidden /> Réinitialiser la démo
      </SubmitButton>
    </form>
  );
}
