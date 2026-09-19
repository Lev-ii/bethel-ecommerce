"use client";

import { useActionState, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Field, FormError, SubmitButton } from "@/components/ui/Form";
import { createClientResetLink, type ResetLinkState } from "@/lib/admin/reset-link-actions";

/**
 * Creation d'un lien de reinitialisation pour un client. Le lien n'est
 * affiche qu'ici, une fois : recharger la page le fait disparaitre, et en
 * creer un nouveau invalide le precedent.
 */
export function ResetLinkForm() {
  const [state, action] = useActionState<ResetLinkState, FormData>(createClientResetLink, { status: "idle" });
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
    } catch {
      // Presse-papiers refuse (contexte non securise) : le lien reste
      // selectionnable a la main.
    }
  }

  return (
    <div className="space-y-6">
      <form action={action} className="card space-y-4 p-6">
        <FormError message={state.status === "error" ? state.message : undefined} />
        <Field id="reset-email" name="email" label="Email du compte client" type="email" required autoComplete="off" />
        <SubmitButton pendingLabel="Création..." className="btn-accent">
          Créer le lien
        </SubmitButton>
      </form>

      {state.status === "ok" ? (
        <section className="card space-y-4 p-6" aria-live="polite">
          <div>
            <p className="eyebrow">Lien pour {state.customerName}</p>
            <p className="mt-1 text-sm text-fg-2">
              {state.email} · valable {state.validHours} h, une seule utilisation. Il ne sera plus affiché après cette
              page.
            </p>
          </div>
          <p className="break-all rounded-card border border-line bg-bg-2 p-3 font-mono text-xs">{state.link}</p>
          <div className="flex flex-wrap gap-3">
            <a href={state.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-accent inline-flex items-center gap-2">
              <MessageCircle size={16} aria-hidden /> Envoyer sur WhatsApp
            </a>
            <button type="button" onClick={() => copy(state.link)} className="btn-primary inline-flex items-center gap-2">
              {copied === state.link ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied === state.link ? "Copié" : "Copier le lien"}
            </button>
          </div>
          {!state.hasPhone ? (
            <p className="text-sm text-fg-3">
              Pas de numéro exploitable sur ce compte : WhatsApp vous laissera choisir le destinataire.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
