import "server-only";

import { createHash } from "node:crypto";
import { sql } from "@/lib/db/client";

/**
 * Limitation de la reinitialisation de mot de passe.
 *
 * Comme pour la connexion administrateur, le decompte vit en base : il est
 * partage par toutes les instances serverless et survit a un redemarrage.
 *
 *  - Demandes de lien : par adresse IP (contre un robot qui arrose le
 *    formulaire) et par email vise (contre l'arrosage d'un meme compte depuis
 *    de nombreuses IP). L'email est compte qu'il corresponde a un compte ou
 *    non : le blocage ne revele donc pas qui est client.
 *  - Liens invalides presentes : par adresse IP. Les jetons font 256 bits et
 *    ne se devinent pas ; la limite coupe court a un balayage automatise.
 *
 * Une demande bloquee n'est pas comptee : une personne qui reessaie pendant
 * le blocage ne le prolonge pas.
 */

export type ThrottleBucket = "reset_request" | "reset_attempt";

export const RESET_REQUEST_WINDOW_MINUTES = 60;
export const MAX_RESET_REQUESTS_PER_IP = 5;
export const MAX_RESET_REQUESTS_PER_EMAIL = 3;

export const RESET_ATTEMPT_WINDOW_MINUTES = 15;
export const MAX_FAILED_RESET_ATTEMPTS_PER_IP = 10;

export function ipSubject(ip: string | null): string {
  // Sans adresse (hors requete HTTP), toutes les demandes partagent un compteur.
  return `ip:${ip ?? "inconnue"}`;
}

export function emailSubject(email: string): string {
  return `email:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
}

async function recentCount(bucket: ThrottleBucket, subject: string, windowMinutes: number): Promise<number> {
  const [{ n }] = await sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n
    FROM auth_throttle_events
    WHERE bucket = ${bucket}
      AND subject = ${subject}
      AND created_at > now() - make_interval(mins => ${windowMinutes})
  `;
  return n;
}

async function record(bucket: ThrottleBucket, subjects: string[]): Promise<void> {
  const rows = subjects.map((subject) => ({ bucket, subject }));
  await sql`INSERT INTO auth_throttle_events ${sql(rows, "bucket", "subject")}`;
}

/**
 * Accepte ou refuse une demande de lien. Acceptee, elle est comptee.
 * Leve en cas de panne de base : l'appelant repond "service indisponible".
 */
export async function takeResetRequest(ip: string | null, email: string): Promise<boolean> {
  const bySource = ipSubject(ip);
  const byEmail = emailSubject(email);
  const [fromIp, forEmail] = await Promise.all([
    recentCount("reset_request", bySource, RESET_REQUEST_WINDOW_MINUTES),
    recentCount("reset_request", byEmail, RESET_REQUEST_WINDOW_MINUTES),
  ]);
  if (fromIp >= MAX_RESET_REQUESTS_PER_IP || forEmail >= MAX_RESET_REQUESTS_PER_EMAIL) return false;
  await record("reset_request", [bySource, byEmail]);
  return true;
}

/** Trop de liens invalides presentes depuis cette adresse ? */
export async function resetAttemptsBlocked(ip: string | null): Promise<boolean> {
  const failures = await recentCount("reset_attempt", ipSubject(ip), RESET_ATTEMPT_WINDOW_MINUTES);
  return failures >= MAX_FAILED_RESET_ATTEMPTS_PER_IP;
}

export async function recordFailedResetAttempt(ip: string | null): Promise<void> {
  await record("reset_attempt", [ipSubject(ip)]);
}
