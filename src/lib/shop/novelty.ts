/**
 * Produits recemment ajoutes au catalogue : badge « Nouveau », section de
 * l'accueil et tri « Nouveautes d'abord ».
 *
 * Un produit est nouveau s'il a ete ajoute depuis moins de NEW_PRODUCT_DAYS
 * jours ET apres l'import initial du catalogue. Sans la seconde condition,
 * toute une boutique ouverte il y a moins de deux semaines porterait le badge.
 * L'import initial = les produits crees dans l'heure qui suit le tout premier.
 *
 * Calcule en base a chaque lecture (voir repository.ts) : aucune colonne a
 * tenir a jour, le badge disparait tout seul.
 */
export const NEW_PRODUCT_DAYS = 14;
export const INITIAL_IMPORT_WINDOW_HOURS = 1;
