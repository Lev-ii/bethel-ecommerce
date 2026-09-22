"use client";

import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Filet de securite pour toute page qui echoue a lire la base (commandes,
 * comptes...) : ces donnees n'ont pas de repli statique plausible, contrairement
 * au catalogue produit. Sans cette page, Next affiche son ecran d'erreur brut.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[app:error]", error);
  }, [error]);

  // reset() seul reaffiche la meme erreur quand elle vient du serveur : on
  // redemande d'abord la page au serveur.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    // Page de secours sans en-tete ni pied de page : le message est centre
    // dans l'ecran plutot que colle en haut.
    <div className="shell flex min-h-dvh items-center justify-center py-14">
      <div className="card w-full max-w-xl p-7 text-center">
        <h1 className="text-2xl">Service momentanément indisponible</h1>
        <p className="mt-3 text-fg-2">
          Une erreur technique nous empêche d&apos;afficher cette page. Réessayez dans un instant.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={retry} className="btn-primary">
            Réessayer
          </button>
          <Link href="/" className="btn-outline">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
