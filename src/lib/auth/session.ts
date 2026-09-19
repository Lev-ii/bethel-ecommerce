import type { SessionUser, UserRole } from "@/lib/types";

/**
 * Session utilisateur, portee par un cookie signe.
 *
 * Le jeton est de la forme  charge.signature , tous deux en base64url.
 * La signature est un HMAC-SHA256 calcule avec l'API Web Crypto : le meme
 * code fonctionne dans le middleware (runtime edge) et dans les composants
 * serveur, sans dependance.
 *
 * Ce module ne remplace pas une bibliotheque d'authentification complete.
 * Il couvre le besoin de la V2 et se remplace par NextAuth v5 sans toucher
 * aux pages : voir README, "Proteger l'administration".
 */

export const SESSION_COOKIE = "bethel_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 jours

interface Payload extends SessionUser {
  /** Expiration, en secondes depuis l'epoque. */
  exp: number;
  /**
   * Version de session du compte au moment de la connexion (users.session_version).
   * Absente des jetons emis avant son introduction : elle vaut alors 0.
   */
  sv?: number;
}

/** Ce que porte un jeton valide : l'utilisateur et la version de session. */
export interface SessionClaims {
  user: SessionUser;
  sessionVersion: number;
}

/**
 * 32 caracteres au minimum : un secret court se devine hors ligne a partir
 * d'un seul cookie de session, puis permet de signer un cookie ADMIN.
 */
export const AUTH_SECRET_MIN_LENGTH = 32;

export function authSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= AUTH_SECRET_MIN_LENGTH) return value;
  // Le depot est public : un secret de repli connu permettrait a n'importe qui
  // de forger un cookie de session ADMIN. En production, mieux vaut refuser de
  // signer que de signer avec une valeur publique.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `AUTH_SECRET est absent ou trop court (${AUTH_SECRET_MIN_LENGTH} caractères minimum, ` +
        "par exemple : openssl rand -base64 32). " +
        "Définis-le dans les variables d'environnement avant de déployer."
    );
  }
  return "bethel-secret-de-demonstration-a-remplacer";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createToken(user: SessionUser, sessionVersion = 0): Promise<string> {
  const payload: Payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
    sv: sessionVersion,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(),
    new TextEncoder().encode(body)
  );
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Verifie la signature et l'expiration. Ne consulte pas la base : c'est ce
 * que le middleware peut faire a chaque navigation. La revocation (version de
 * session) est verifiee par currentUser(), cote serveur.
 */
export async function readToken(
  token: string | undefined
): Promise<SessionUser | null> {
  return (await readClaims(token))?.user ?? null;
}

export async function readClaims(
  token: string | undefined
): Promise<SessionClaims | null> {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await key(),
      fromBase64Url(signature),
      new TextEncoder().encode(body)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body))
    ) as Payload;

    if (payload.exp * 1000 < Date.now()) return null;

    return {
      user: {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
      sessionVersion: Number.isInteger(payload.sv) ? (payload.sv as number) : 0,
    };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
  secure: process.env.NODE_ENV === "production",
};

/** Page d'arrivee apres connexion, selon le role. */
export function homeFor(role: UserRole): string {
  return role === "ADMIN" ? "/admin" : "/compte";
}
