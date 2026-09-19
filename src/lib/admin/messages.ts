/**
 * Messages d'erreur du formulaire materiel.
 *
 * Ils vivent hors du fichier d'actions : un module "use server" ne peut
 * exporter que des fonctions asynchrones.
 */
export const productErrorMessages: Record<string, string> = {
  nom: "Indiquez le nom du matériel.",
  marque: "Indiquez la marque.",
  categorie: "Choisissez une catégorie.",
  argument: "Écrivez une ligne d'argument.",
  prix: "Le prix doit être supérieur à zéro.",
  "prix-barre": "Le prix barré doit être supérieur au prix de vente.",
  stock: "Le stock doit être un nombre positif.",
  "promo-prix": "Le prix promo doit être supérieur à zéro et inférieur au prix de vente.",
  "promo-fin": "Indiquez une date de fin de promotion à venir.",
  "promo-debut": "Le début de la promotion doit précéder sa fin.",
  image: "Format d'image non accepté, ou fichier trop lourd (3 Mo maximum).",
  introuvable: "Ce matériel n'existe plus.",
  refus: "Action réservée à l'administration.",
  confirmation:
    "Le nom saisi ne correspond pas. Le matériel n'a pas été supprimé.",
};

/** Champ du formulaire a mettre en evidence pour chaque erreur. */
export const productErrorField: Record<string, string> = {
  nom: "name",
  marque: "brand",
  categorie: "category",
  argument: "headline",
  prix: "price",
  "prix-barre": "compareAtPrice",
  stock: "stock",
  image: "image",
  "promo-prix": "promoPrice",
  "promo-fin": "promoEndsAt",
  "promo-debut": "promoStartsAt",
};

export function productErrorMessage(code?: string): string | undefined {
  if (!code) return undefined;
  return productErrorMessages[code] ?? "L'enregistrement a échoué. Réessayez.";
}
