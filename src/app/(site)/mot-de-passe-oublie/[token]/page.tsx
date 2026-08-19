import type { Metadata } from "next";
import { resetPassword } from "@/lib/auth/actions";
import { Field, FormError, SubmitButton } from "@/components/ui/Form";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function NewPasswordPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  return <div className="shell max-w-md py-14"><Eyebrow>Votre compte</Eyebrow><h1 className="mt-2 text-3xl">Choisir un nouveau mot de passe</h1><form action={resetPassword} className="card mt-8 space-y-4 p-6"><FormError message={query.erreur === "motdepasse" ? "Le mot de passe doit faire au moins 8 caracteres, avec une lettre et un chiffre." : undefined} /><input type="hidden" name="token" value={token} /><Field id="password" name="password" label="Nouveau mot de passe" type="password" required autoComplete="new-password" /><SubmitButton pendingLabel="Enregistrement..." className="btn-accent w-full">Enregistrer</SubmitButton></form></div>;
}