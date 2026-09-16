import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";
import { Eyebrow } from "@/components/ui/Primitives";
import { ensureAdminAccount } from "@/lib/db/seed";

export const metadata: Metadata = { title: "Connexion" };

type SearchParams = Promise<{ suite?: string; erreur?: string }>;

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await ensureAdminAccount();
  const { suite, erreur } = await searchParams;

  return (
    <div className="shell py-14 lg:py-20">
      <div className="mx-auto max-w-md">
        <Eyebrow>Votre compte</Eyebrow>
        <h1 className="mt-2 text-3xl sm:text-4xl">Connexion</h1>
        <p className="mt-2 text-fg-2">
          Retrouvez vos commandes et allez plus vite au paiement.
        </p>

        <div className="card mt-8 p-6">
          <Suspense fallback={<div className="h-64" aria-hidden />}>
            <SignInForm suite={suite} erreur={erreur} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-fg-2">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold underline underline-offset-4">
            Créer un compte
          </Link>
        </p>

        {/* <div className="mt-8 rounded-card border border-line bg-bg-2 p-4">
          <p className="eyebrow">Demonstration</p>
          <p className="mt-2 text-sm text-fg-2">
            Les identifiants administrateur doivent être définis via les variables
            d’environnement avant la mise en ligne.
          </p> 
          <p className="mt-1.5 text-sm text-fg-3">
            Pour l&apos;espace client, creez un compte : il sera de type client,
            sans acces a l&apos;administration.
          </p>
        </div>*/}
      </div>
    </div>
  );
}
