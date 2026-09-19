"use client";

import { useEffect } from "react";
import { trackShopEvent, type ShopEvent } from "@/lib/tracking/pixels";

/**
 * Envoie un evenement aux pixels a l'affichage. onceKey : une seule fois par
 * session (un achat recharge ne compte pas deux fois).
 */
export function TrackEvent({ event, onceKey }: { event: ShopEvent; onceKey?: string }) {
  const serialized = JSON.stringify(event);
  useEffect(() => {
    if (onceKey) {
      try {
        if (sessionStorage.getItem(onceKey)) return;
        sessionStorage.setItem(onceKey, "1");
      } catch {
        // Stockage indisponible : on envoie quand meme.
      }
    }
    trackShopEvent(JSON.parse(serialized) as ShopEvent);
  }, [serialized, onceKey]);
  return null;
}
