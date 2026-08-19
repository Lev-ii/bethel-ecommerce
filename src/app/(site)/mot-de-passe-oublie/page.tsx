import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/lib/auth/actions";
import { Field, FormError, SubmitButton } from "@/components/ui/Form";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Mot de passe oublie" };

export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; envoye?: string }>;
}) {
  const params = await searchParams;
  return <div className="shell max-w-md py-14"><Eyebrow>Votre compte</Eyebrow><h1 className="mt-2 text-3xl">Mot de passe oublie</h1>{params.envoye ? <p className="mt-4 rounded-card border border-ok/30 bg-ok/5 p-4 text-sm">Si un compte correspond a cette adresse, un lien de reinitialisation a ete prepare.</p> : <form action={requestPasswordReset} className="card mt-8 space-y-4 p-6"><FormError message={params.erreur === "email" ? "Entrez votre adresse email." : undefined} /><Field id="email" name="email" label="Email" type="email" required autoComplete="email" /><SubmitButton pendingLabel="Envoi..." className="btn-accent w-full">Recevoir un lien</SubmitButton></form>}<Link href="/connexion" className="mt-6 block text-center text-sm underline underline-offset-4">Retour a la connexion</Link></div>;
}