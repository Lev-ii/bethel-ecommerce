import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/actions";
import { Field, FormError, SubmitButton } from "@/components/ui/Form";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Mot de passe oublié" };

// Tant que l'envoi d'emails n'est pas branche, le lien est remis sur WhatsApp
// par la boutique (administration, "Accès clients").
const SHOP_PHONE = "+225 07 78 84 84 74";
const SHOP_WHATSAPP = "https://wa.me/2250778848474";

const ERRORS: Record<string, string> = {
  email: "Entrez votre adresse email.",
  service: "Service momentanément indisponible. Réessayez dans quelques minutes.",
  trop: "Trop de demandes. Réessayez dans une heure, ou écrivez-nous sur WhatsApp.",
  invalide: "Ce lien n'est plus valable : il a expiré ou a déjà servi. Demandez-en un nouveau.",
};

export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; envoye?: string }>;
}) {
  const params = await searchParams;
  return <div className="shell max-w-md py-14"><Eyebrow>Votre compte</Eyebrow><h1 className="mt-2 text-3xl">Mot de passe oublié</h1>{params.envoye ? <div className="mt-4 space-y-3 rounded-card border border-ok/30 bg-ok/5 p-4 text-sm"><p>Demande enregistrée. Pour recevoir votre lien de réinitialisation, écrivez-nous sur WhatsApp en indiquant l&apos;adresse email de votre compte.</p><a href={SHOP_WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn-accent inline-flex">WhatsApp : {SHOP_PHONE}</a></div> : <form action={requestPasswordReset} className="card mt-8 space-y-4 p-6"><FormError message={params.erreur ? ERRORS[params.erreur] : undefined} /><Field id="email" name="email" label="Email" type="email" required autoComplete="email" /><SubmitButton pendingLabel="Envoi..." className="btn-accent w-full">Demander un lien</SubmitButton></form>}<Link href="/connexion" className="mt-6 block text-center text-sm underline underline-offset-4">Retour à la connexion</Link></div>;
}
