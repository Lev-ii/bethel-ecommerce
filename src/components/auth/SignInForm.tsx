import { signIn } from "@/lib/auth/actions";
import { authErrorMessage } from "@/lib/auth/messages";
import { Field, FormError, SubmitButton } from "@/components/ui/Form";
import Link from "next/link";

export function SignInForm({
  suite,
  erreur,
}: {
  suite?: string;
  erreur?: string;
}) {
  const message = authErrorMessage(erreur);

  return (
    <form action={signIn} className="space-y-4">
      <FormError message={message} />

      <input type="hidden" name="suite" value={suite ?? ""} />

      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
      />
      <Field
        id="password"
        name="password"
        label="Mot de passe"
        type="password"
        required
        autoComplete="current-password"
      />

      <Link href="/mot-de-passe-oublie" className="block text-sm underline underline-offset-4">
        Mot de passe oublié ?
      </Link>

      <SubmitButton pendingLabel="Connexion..." className="btn-accent w-full">
        Se connecter
      </SubmitButton>
    </form>
  );
}
