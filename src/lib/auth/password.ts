import "server-only";

import { AsyncResource } from "node:async_hooks";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/**
 * Enveloppe de scrypt qui conserve le contexte de la requete.
 *
 * scrypt rend la main depuis le pool de threads de Node. Sans AsyncResource,
 * le contexte d'execution est perdu au retour, et tout appel a cookies() ou
 * headers() place apres echoue avec "called outside a request scope".
 * Le symptome est trompeur : seul le chemin de succes casse, puisque lui seul
 * ouvre une session apres la verification.
 */
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      AsyncResource.bind((error: Error | null, key?: Buffer) => {
        if (error) reject(error);
        else resolve(key as Buffer);
      })
    );
  });
}

/**
 * Hachage des mots de passe avec scrypt, fourni par Node.
 *
 * scrypt est volontairement lent et gourmand en memoire : c'est ce qui rend
 * une attaque par force brute couteuse. Aucune dependance externe n'est
 * necessaire, et le format de sortie reste lisible : "sel:hachage".
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await derive(password, salt);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const derived = await derive(password, salt);
  const expected = Buffer.from(hash, "hex");

  if (expected.length !== derived.length) return false;
  // Comparaison a temps constant : une comparaison classique fuite de
  // l'information par sa duree.
  return timingSafeEqual(expected, derived);
}

/** Regles minimales, verifiees cote serveur et rappelees dans le formulaire. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) {
    return "Le mot de passe doit faire au moins 8 caractères.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  return null;
}
