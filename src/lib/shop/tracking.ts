import { orderStatusFlow, orderStatusLabel } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

/**
 * Regles du suivi en direct d'une commande, sans navigateur ni base.
 */

/** Intervalle d'interrogation quand l'onglet est visible. */
export const TRACKING_POLL_MS = 10_000;

/** Duree de cache de l'etat d'une commande au niveau du CDN. */
export const TRACKING_CACHE_SECONDS = 5;

/** Reference de commande plausible : evite d'interroger la base pour n'importe quoi. */
export function isTrackableReference(value: string): boolean {
  return /^BTH-[0-9A-Z]{3,5}-[0-9A-Z]{3,8}$/i.test(value.trim());
}

/** Une fois livree ou annulee, la commande n'evolue plus : on arrete d'interroger. */
export function isFinalStatus(status: OrderStatus): boolean {
  return status === "livree" || status === "annulee";
}

/** Libelle d'une etape, adapte au retrait en boutique. */
export function statusLabelFor(status: OrderStatus, deliveryMode: "livraison" | "retrait"): string {
  if (deliveryMode === "retrait") {
    if (status === "expediee") return "Prête à retirer";
    if (status === "livree") return "Retirée";
  }
  return orderStatusLabel[status];
}

export type TrackingEvent =
  | { kind: "none" }
  | { kind: "advanced"; message: string }
  | { kind: "delivered"; message: string }
  | { kind: "cancelled"; message: string };

/** Ce qu'il faut annoncer au client quand l'etat passe de previous a next. */
export function trackingEvent(
  previous: OrderStatus,
  next: OrderStatus,
  deliveryMode: "livraison" | "retrait"
): TrackingEvent {
  if (previous === next) return { kind: "none" };
  if (next === "annulee") return { kind: "cancelled", message: "Votre commande a été annulée." };
  if (next === "livree") {
    return {
      kind: "delivered",
      message: deliveryMode === "retrait" ? "Votre commande a été retirée. Merci !" : "Votre commande a été livrée. Merci !",
    };
  }
  // Un recul (correction de l'administration) ne merite pas de son.
  if (orderStatusFlow.indexOf(next) < orderStatusFlow.indexOf(previous)) return { kind: "none" };
  return { kind: "advanced", message: `Votre commande est maintenant : ${statusLabelFor(next, deliveryMode)}.` };
}
