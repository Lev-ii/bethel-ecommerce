import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Regles de la newsletter, sans base.
 */

export const NEWSLETTER_EMAIL_MAX = 254;

export class NewsletterError extends Error {
  constructor(public code: "email" | "consentement" | "lien") {
    super(code);
  }
}

export const newsletterErrorMessages: Record<NewsletterError["code"], string> = {
  email: "Cette adresse email n'est pas valide.",
  consentement: "Cochez la case pour accepter de recevoir nos emails.",
  lien: "Ce lien de désinscription n'est pas valide.",
};

/** Adresse nettoyee et validee, en minuscules. */
export function normalizeEmail(raw: unknown): string {
  const email = String(raw ?? "").trim().toLowerCase();
  if (email.length < 5 || email.length > NEWSLETTER_EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new NewsletterError("email");
  }
  return email;
}

/**
 * Jeton de desinscription : signe, pour qu'un lien ne permette de desinscrire
 * que l'adresse a laquelle il a ete envoye.
 */
export function unsubscribeToken(email: string, secret: string): string {
  return createHmac("sha256", secret).update(`newsletter:${email.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

export function unsubscribeTokenIsValid(email: string, token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const expected = Buffer.from(unsubscribeToken(email, secret));
  const actual = Buffer.from(token.trim().toLowerCase());
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Echappe une valeur pour le CSV (virgule, guillemets, formule de tableur). */
export function csvCell(value: string): string {
  // Une cellule qui commence par = + - @ serait executee comme formule par Excel.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
