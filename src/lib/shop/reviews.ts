/**
 * Regles des avis clients, sans base ni navigateur.
 */

export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 1000;
export const REVIEW_NAME_MAX = 40;

export type ReviewStatus = "en_attente" | "publie" | "refuse";

export interface ReviewInput {
  rating: number;
  body: string;
  authorName: string;
}

export class ReviewError extends Error {
  constructor(public code: ReviewErrorCode) {
    super(code);
  }
}

export type ReviewErrorCode = "note" | "texte" | "nom" | "acces" | "non-livree" | "produit" | "deja";

export const reviewErrorMessages: Record<ReviewErrorCode, string> = {
  note: "Choisissez une note de 1 à 5 étoiles.",
  texte: `Votre avis doit contenir entre ${REVIEW_BODY_MIN} et ${REVIEW_BODY_MAX} caractères.`,
  nom: `Le nom affiché doit contenir entre 2 et ${REVIEW_NAME_MAX} caractères.`,
  acces: "Ce lien ne permet pas de noter cette commande. Utilisez le lien reçu après votre achat.",
  "non-livree": "Vous pourrez noter vos articles une fois la commande livrée.",
  produit: "Cet article ne fait pas partie de la commande.",
  deja: "Vous avez déjà donné votre avis sur cet article. Merci !",
};

export function reviewErrorMessage(code?: string): string | undefined {
  if (!code) return undefined;
  return reviewErrorMessages[code as ReviewErrorCode] ?? "L'envoi de l'avis a échoué. Réessayez.";
}

/** Prenom et initiale du nom : « Aminata Koné » -> « Aminata K. ». */
export function defaultAuthorName(customerName: string): string {
  const parts = customerName.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "Client";
  const first = parts[0].slice(0, 30);
  const last = parts.length > 1 ? ` ${parts.at(-1)!.charAt(0).toUpperCase()}.` : "";
  return `${first}${last}`;
}

export function parseReviewInput(raw: { rating?: unknown; body?: unknown; authorName?: unknown }): ReviewInput {
  const rating = Number(raw.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ReviewError("note");
  const body = String(raw.body ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (body.length < REVIEW_BODY_MIN || body.length > REVIEW_BODY_MAX) throw new ReviewError("texte");
  const authorName = String(raw.authorName ?? "").replace(/\s+/g, " ").trim();
  if (authorName.length < 2 || authorName.length > REVIEW_NAME_MAX || !/\p{L}/u.test(authorName)) {
    throw new ReviewError("nom");
  }
  return { rating, body, authorName };
}

/** Moyenne arrondie a une decimale, ou null sans avis. */
export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10;
}
