"use client";

import { useEffect } from "react";

/**
 * Signale l'affichage de la fiche, une fois, apres rendu. sendBeacon survit a
 * la fermeture de l'onglet et ne ralentit pas la page.
 */
export function ProductViewBeacon({ productId }: { productId: string }) {
  useEffect(() => {
    // Un navigateur pilote par un robot se declare souvent : inutile d'appeler.
    if (navigator.webdriver) return;
    const body = new Blob([productId], { type: "text/plain" });
    if (!navigator.sendBeacon?.("/api/produits/vue", body)) {
      void fetch("/api/produits/vue", { method: "POST", body: productId, keepalive: true }).catch(() => {});
    }
  }, [productId]);
  return null;
}
