"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    console.error("[app:error]", error);
  }, [error]);

  return (
    <div className="shell py-14">
      <div className="card mx-auto max-w-xl p-7 text-center">
        <h1 className="text-2xl">Service momentanément indisponible</h1>
        <p className="mt-3 text-fg-2">
          Une erreur technique nous empêche d&apos;afficher cette page. Réessayez dans un instant.
        </p>
        <button type="button" onClick={reset} className="btn-primary mt-7">
          Réessayer
        </button>
      </div>
    </div>
  );
}
