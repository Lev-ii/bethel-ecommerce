/**
 * Messages d'erreur du formulaire materiel.
 *
 * Ils vivent hors du fichier d'actions : un module "use server" ne peut
 * exporter que des fonctions asynchrones.
 */
export const productErrorMessages: Record<string, string> = {
  nom: "Indiquez le nom du materiel.",
  marque: "Indiquez la marque.",
  categorie: "Choisissez une categorie.",
  argument: "Ecrivez une ligne d'argument.",
  prix: "Le prix doit etre superieur a zero.",
  "prix-barre": "Le prix barre doit etre superieur au prix de vente.",
  stock: "Le stock doit etre un nombre positif.",
  image: "Format d'image non accepte, ou fichier trop lourd (3 Mo maximum).",
  introuvable: "Ce materiel n'existe plus.",
  refus: "Action reservee a l'administration.",
  confirmation:
    "Le nom saisi ne correspond pas. Le materiel n'a pas ete supprime.",
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
};

export function productErrorMessage(code?: string): string | undefined {
  if (!code) return undefined;
  return productErrorMessages[code] ?? "L'enregistrement a echoue. Reessayez.";
}
