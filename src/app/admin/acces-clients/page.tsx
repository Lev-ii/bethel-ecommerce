import type { Metadata } from "next";
import { ResetLinkForm } from "@/components/admin/ResetLinkForm";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Accès clients" };

export default async function ClientAccessPage() {
  await requireAdmin();

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="eyebrow">Comptes</p>
        <h1 className="mt-2 text-3xl">Accès clients</h1>
        <p className="mt-2 text-fg-2">
          Un client a oublié son mot de passe ? Créez-lui un lien de réinitialisation et envoyez-le sur WhatsApp,
          après avoir vérifié que la demande vient bien de lui (numéro du compte, commande récente). L&apos;envoi par
          email sera branché plus tard. Chaque lien créé est inscrit au journal.
        </p>
      </header>
      <ResetLinkForm />
    </div>
  );
}
