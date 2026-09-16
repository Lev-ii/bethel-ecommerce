/**
 * Garde-fou de la reinitialisation de la demonstration.
 *
 * Reinitialiser efface TOUTES les commandes et TOUS les produits, puis recharge
 * le catalogue de demonstration. Sur une vraie boutique, c'est irreversible.
 *
 * Le verrou ne peut pas reposer sur l'environnement ("pas en production") :
 * un serveur de developpement branche sur la base de production effacerait les
 * memes donnees. Il repose donc sur une autorisation explicite, absente par
 * defaut partout, a ne poser que sur une base locale jetable.
 */

export const DEMO_RESET_CONFIRMATION = "SUPPRIMER";

export function demoResetAllowed(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.ALLOW_DEMO_RESET === "true";
}

/** Leve une erreur explicite si la reinitialisation n'est pas autorisee. */
export function assertDemoResetAllowed(confirmation: unknown, env: Readonly<Record<string, string | undefined>> = process.env): void {
  if (!demoResetAllowed(env)) {
    throw new Error(
      "Réinitialisation désactivée. Elle efface toutes les commandes et tous les produits : " +
        "elle n'est permise qu'avec ALLOW_DEMO_RESET=true, sur une base locale de développement."
    );
  }
  if (confirmation !== DEMO_RESET_CONFIRMATION) {
    throw new Error(`Confirmation manquante : saisissez ${DEMO_RESET_CONFIRMATION} pour réinitialiser.`);
  }
}
