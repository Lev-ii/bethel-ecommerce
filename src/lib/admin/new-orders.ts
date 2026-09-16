/**
 * Detection et cumul des nouvelles commandes signalees a l'administration.
 * Pur et teste : c'est ce qui decide si une commande est annoncee, et une seule
 * fois.
 */

export interface OrderSummary {
  id: string;
  reference: string;
  customerName: string;
  total: number;
}

/** Nombre de commandes gardees visibles dans la fenetre. */
export const POPUP_MAX_ITEMS = 3;

/** Commandes jamais vues jusqu'ici, dans l'ordre recu (plus recente d'abord). */
export function freshOrders(latest: readonly OrderSummary[], known: ReadonlySet<string>): OrderSummary[] {
  return latest.filter((order) => !known.has(order.id));
}

/**
 * Ajoute les nouvelles commandes a celles deja affichees, plus recentes en
 * tete, sans doublon. `total` compte toutes les commandes annoncees depuis
 * l'ouverture de la fenetre, y compris celles qui ne tiennent plus dans la
 * liste.
 */
export function accumulate(
  shown: { items: OrderSummary[]; total: number },
  fresh: readonly OrderSummary[]
): { items: OrderSummary[]; total: number } {
  const seen = new Set(shown.items.map((o) => o.id));
  const added = fresh.filter((o) => !seen.has(o.id));
  return {
    items: [...added, ...shown.items].slice(0, POPUP_MAX_ITEMS),
    total: shown.total + added.length,
  };
}
