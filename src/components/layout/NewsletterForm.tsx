"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { subscribeAction, type NewsletterState } from "@/lib/shop/newsletter-actions";

/**
 * Inscription a la newsletter, dans le pied de page. Consentement explicite
 * (case a cocher obligatoire), reponse affichee sans changer de page.
 */
export function NewsletterForm() {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeAction, { status: "idle" });

  if (state.status === "ok") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-medium text-[#16150f]">
        <CheckCircle2 size={16} aria-hidden /> {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Votre adresse email
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@exemple.com"
          className="field min-w-0 flex-1 border-[#16150f]/20 bg-white"
        />
        <button type="submit" disabled={pending} className="btn-primary shrink-0">
          {pending ? "Inscription..." : "S'inscrire"}
        </button>
      </div>
      <label className="flex items-start gap-2 text-xs text-[#46443c]">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-[#16150f]" />
        <span>
          J&apos;accepte de recevoir les emails de Bethel (nouveautés, promotions). Désinscription en un clic, à tout
          moment.
        </span>
      </label>
      {state.status === "error" ? (
        <p role="alert" className="text-sm font-medium text-[#8a2a1f]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
