import { signUp } from "@/lib/auth/actions";
import { authErrorMessage } from "@/lib/auth/messages";
import { Field, FormError, SubmitButton } from "@/components/ui/Form";

export function SignUpForm({ erreur }: { erreur?: string }) {
  const message = authErrorMessage(erreur);

  return (
    <form action={signUp} className="space-y-4">
      <FormError message={message} />

      <Field id="name" name="name" label="Nom complet" required autoComplete="name" />
      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
      />
      <Field
        id="phone"
        name="phone"
        label="Telephone"
        type="tel"
        autoComplete="tel"
        placeholder="+225 00 00 00 00"
        hint="Nous appelons ce numero pour confirmer vos commandes."
      />
      <Field
        id="password"
        name="password"
        label="Mot de passe"
        type="password"
        required
        autoComplete="new-password"
        hint="8 caracteres minimum, avec au moins une lettre et un chiffre."
      />

      <SubmitButton pendingLabel="Creation..." className="btn-accent w-full">
        Creer mon compte
      </SubmitButton>

      
    </form>
  );
}
