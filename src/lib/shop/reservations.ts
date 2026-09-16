import "server-only";

import { sql } from "@/lib/db/client";
import { cancelUnpaidOrder, syncOrderPayment } from "@/lib/shop/payment";

/** Delai laisse au client pour finaliser son paiement mobile money. */
export const PAYMENT_TIMEOUT_MINUTES = 30;

export interface ReleaseExpiredReservationsResult {
  releasedOrderIds: string[];
  paidOrderIds: string[];
}

/**
 * Une commande payee en ligne reserve son stock des sa creation, avant meme
 * que le client ait termine le paiement (voir placeOrder dans actions.ts).
 * S'il abandonne - fermer la page Jeko ne previent personne, la demande y
 * reste "pending" -, la commande est annulee et son stock rendu passe le
 * delai.
 *
 * Appelee par le cron, mais aussi a chaque nouvelle commande et a
 * l'ouverture de l'admin ou du suivi : l'annulation ne depend donc pas de la
 * frequence du cron. Avant d'annuler, on redemande a Jeko - un webhook perdu
 * ne doit pas faire annuler une commande bel et bien payee.
 *
 * Ne vide pas le cache produits (interdit pendant le rendu d'une page) : a
 * l'appelant de faire revalidateTag("products") s'il le peut.
 */
export async function releaseExpiredReservations(
  options: { reference?: string } = {}
): Promise<ReleaseExpiredReservationsResult> {
  const candidates = await sql<Array<{ id: string; reference: string }>>`
    SELECT id, reference FROM orders
    WHERE status = 'attente_paiement'
      AND paid_at IS NULL
      AND created_at < now() - make_interval(mins => ${PAYMENT_TIMEOUT_MINUTES})
      ${options.reference ? sql`AND reference = ${options.reference}` : sql``}
  `;

  const releasedOrderIds: string[] = [];
  const paidOrderIds: string[] = [];

  for (const candidate of candidates) {
    const sync = await syncOrderPayment({ reference: candidate.reference });
    // Jeko injoignable : on retentera au prochain passage plutot que
    // d'annuler a l'aveugle.
    if (sync.kind === "unverified") continue;
    if (sync.kind === "checked" && sync.paid) {
      paidOrderIds.push(candidate.id);
      continue;
    }
    if (sync.kind === "checked" && sync.failed) {
      releasedOrderIds.push(candidate.id);
      continue;
    }

    const released = await cancelUnpaidOrder(
      candidate.id,
      `Paiement non finalisé dans les ${PAYMENT_TIMEOUT_MINUTES} minutes : commande annulée automatiquement, stock remis en vente.`
    );
    if (released) releasedOrderIds.push(candidate.id);
  }

  return { releasedOrderIds, paidOrderIds };
}

/** Variante pour les pages : ne doit jamais faire echouer l'affichage. */
export async function releaseExpiredReservationsQuietly(options: { reference?: string } = {}) {
  try {
    return await releaseExpiredReservations(options);
  } catch (error) {
    console.error("[reservations] libération des commandes expirées échouée", error);
    return { releasedOrderIds: [], paidOrderIds: [] };
  }
}
