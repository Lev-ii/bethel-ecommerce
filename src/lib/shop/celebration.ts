/**
 * Quand feter une commande sur la page de confirmation.
 *
 * Seulement une commande reellement aboutie, et seulement pour celui qui l'a
 * passee : un paiement en attente peut encore echouer, et une reference
 * saisie dans l'URL ne prouve pas qu'on est l'auteur de la commande.
 */
export function shouldCelebrate(input: {
  hasAccess: boolean;
  orderFound: boolean;
  onlinePayment: boolean;
  paid: boolean;
  failed: boolean;
}): boolean {
  if (!input.hasAccess || !input.orderFound || input.failed) return false;
  // Paiement a la livraison ou au retrait : la commande est acquise des sa
  // validation. En ligne : seulement une fois le paiement confirme.
  return input.onlinePayment ? input.paid : true;
}

/** Cle de memoire de session : recharger la page ne relance pas la fete. */
export function celebrationKey(reference: string): string {
  return `bethel-fete-${reference.toLowerCase()}`;
}
