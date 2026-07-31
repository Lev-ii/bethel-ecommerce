import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Creer un compte" };

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;

  return (
    <div className="shell py-14 lg:py-20">
      <div className="mx-auto max-w-md">
        <Eyebrow>Votre compte</Eyebrow>
        <h1 className="mt-2 text-3xl sm:text-4xl">Creer un compte</h1>
        <p className="mt-2 text-fg-2">
          Pour suivre vos commandes et retrouver vos coordonnees a chaque achat.
        </p>

        <div className="card mt-8 p-6">
          <SignUpForm erreur={erreur} />
        </div>

        <p className="mt-6 text-center text-sm text-fg-2">
          Vous avez deja un compte ?{" "}
          <Link href="/connexion" className="font-semibold underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
