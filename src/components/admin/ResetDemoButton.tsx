import { RotateCcw } from "lucide-react";
import { resetDemo } from "@/lib/admin/actions";
import { SubmitButton } from "@/components/ui/Form";

/**
 * Remet le catalogue et les commandes a leur etat d'origine.
 * Les comptes ne sont pas touches : on ne veut pas perdre l'acces admin.
 */
export function ResetDemoButton() {
  return (
    <form action={resetDemo}>
      <SubmitButton pendingLabel="Remise a zero..." className="btn-outline">
        <RotateCcw size={15} aria-hidden /> Reinitialiser la demo
      </SubmitButton>
    </form>
  );
}
