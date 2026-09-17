/**
 * Regles des categories, sans acces a la base : validees ici, appliquees par
 * lib/admin/category-store.ts.
 */

export const CATEGORY_NAME_MAX = 60;
export const CATEGORY_TAGLINE_MAX = 120;

export interface CategoryInput {
  name: string;
  tagline: string;
}

export class CategoryError extends Error {
  constructor(public code: CategoryErrorCode) {
    super(code);
  }
}

export type CategoryErrorCode =
  | "nom"
  | "accroche"
  | "introuvable"
  | "selection"
  | "destination"
  | "destination-supprimee"
  | "derniere"
  | "produits"
  | "sans-changement";

export const categoryErrorMessages: Record<CategoryErrorCode, string> = {
  nom: `Le nom doit contenir entre 2 et ${CATEGORY_NAME_MAX} caractères, dont au moins une lettre ou un chiffre.`,
  accroche: `L'accroche ne doit pas dépasser ${CATEGORY_TAGLINE_MAX} caractères.`,
  introuvable: "Cette catégorie n'existe plus.",
  selection: "Sélectionnez au moins une catégorie.",
  destination: "Des produits sont rangés dans la sélection : choisissez où les déplacer.",
  "destination-supprimee": "La catégorie de destination ne peut pas faire partie des catégories supprimées.",
  derniere: "Il doit rester au moins une catégorie.",
  produits: "Sélectionnez au moins un produit et une catégorie de destination.",
  "sans-changement": "Aucun changement à enregistrer.",
};

export function categoryErrorMessage(code?: string): string | undefined {
  if (!code) return undefined;
  return categoryErrorMessages[code as CategoryErrorCode] ?? "L'opération a échoué. Réessayez.";
}

/** Nom et accroche nettoyes, ou CategoryError. */
export function parseCategoryInput(raw: { name?: unknown; tagline?: unknown }): CategoryInput {
  const name = String(raw.name ?? "").replace(/\s+/g, " ").trim();
  const tagline = String(raw.tagline ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > CATEGORY_NAME_MAX || !/[\p{L}\p{N}]/u.test(name)) {
    throw new CategoryError("nom");
  }
  if (tagline.length > CATEGORY_TAGLINE_MAX) throw new CategoryError("accroche");
  return { name, tagline };
}

/**
 * Suppression de plusieurs categories. Verifie la selection sans la base :
 * il doit rester une categorie, et la destination des produits ne peut pas
 * etre elle-meme supprimee.
 */
export function checkDeletion(options: {
  selected: string[];
  existing: string[];
  productCount: number;
  destination?: string;
}): void {
  const selected = [...new Set(options.selected)].filter((slug) => options.existing.includes(slug));
  if (selected.length === 0) throw new CategoryError("selection");
  if (selected.length >= options.existing.length) throw new CategoryError("derniere");
  if (options.destination && selected.includes(options.destination)) {
    throw new CategoryError("destination-supprimee");
  }
  if (options.productCount > 0) {
    if (!options.destination) throw new CategoryError("destination");
    if (!options.existing.includes(options.destination)) throw new CategoryError("destination");
  }
}
