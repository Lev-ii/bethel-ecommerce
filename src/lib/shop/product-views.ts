import { createHmac } from "node:crypto";

/**
 * Regles du comptage des vues produit : un visiteur par jour, robots exclus,
 * sans cookie ni donnee personnelle. Pur et teste.
 *
 * Les vues sont conservees sans limite de duree, pour les etudes sur
 * plusieurs annees : aucune suppression sans decision de l'administrateur.
 */

/**
 * Robots, apercus de liens et navigateurs automatises. Liste volontairement
 * large : compter un robot fausse le classement, en oublier un humain rare
 * ne change rien.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime|curl|wget|python|axios|node-fetch|go-http/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  return !userAgent || userAgent.length < 20 || BOT_PATTERN.test(userAgent);
}

/** Jour civil UTC, soit le jour local a Abidjan. */
export function viewDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Empreinte du visiteur pour un jour donne. Le jour entre dans le calcul :
 * la meme personne a une empreinte differente le lendemain.
 */
export function visitorHash(input: { secret: string; day: string; ip: string | null; userAgent: string }): string {
  return createHmac("sha256", input.secret)
    .update(`${input.day}|${input.ip ?? "?"}|${input.userAgent}`)
    .digest("hex")
    .slice(0, 32);
}
