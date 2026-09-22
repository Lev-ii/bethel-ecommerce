import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { SESSION_COOKIE, readClaims } from "@/lib/auth/session";
import type { SessionUser, UserRole } from "@/lib/types";

/**
 * Utilisateur connecte, ou null. Ne redirige jamais.
 *
 * Au-dela de la signature, le compte est relu en base : la session est
 * refusee si le mot de passe a change depuis la connexion (version de session
 * incrementee), si le role a change, ou si le compte n'existe plus. Un cookie
 * derobe cesse ainsi de valoir des que la victime change son mot de passe.
 * Une panne de base refuse la session plutot que de l'accepter sans controle.
 *
 * cache() : une seule lecture par requete, meme si la mise en page et la page
 * l'appellent chacune.
 */
type SessionCheck =
  | { user: SessionUser }
  | {
      user: null;
      /**
       * absente : pas de cookie valide ;
       * refusee : cookie signe mais refuse en base (mot de passe ou role
       *   change, compte absent de cette base) ;
       * indisponible : base injoignable, impossible de trancher.
       */
      reason: "absente" | "refusee" | "indisponible";
    };

const checkSession = cache(async (): Promise<SessionCheck> => {
  const store = await cookies();
  const claims = await readClaims(store.get(SESSION_COOKIE)?.value);
  if (!claims) return { user: null, reason: "absente" };

  try {
    const [account] = await sql<Array<{ session_version: number; role: UserRole }>>`
      SELECT session_version, role FROM users WHERE id = ${claims.user.id}
    `;
    if (!account) return { user: null, reason: "refusee" };
    if (account.session_version !== claims.sessionVersion) return { user: null, reason: "refusee" };
    if (account.role !== claims.user.role) return { user: null, reason: "refusee" };
  } catch (error) {
    console.error("[auth] vérification de la session impossible", error);
    return { user: null, reason: "indisponible" };
  }
  return { user: claims.user };
});

export const currentUser = cache(async (): Promise<SessionUser | null> => (await checkSession()).user);

/**
 * Renvoie vers la connexion, sans boucle.
 *
 * Le middleware ne verifie que la signature du cookie : pour lui, un cookie
 * refuse en base est encore une session, et il renvoie /connexion vers
 * l'espace reserve. Rediriger simplement vers /connexion faisait donc
 * tourner le navigateur entre les deux pages (incident du 22-09). Un cookie
 * refuse passe par /session-expiree, qui l'efface avant la connexion.
 */
function denyAccess(check: SessionCheck, suite: string): never {
  const next = encodeURIComponent(suite);
  if (!check.user && check.reason === "refusee") redirect(`/session-expiree?suite=${next}`);
  // Base injoignable : page d'erreur plutot qu'une deconnexion ou une boucle.
  if (!check.user && check.reason === "indisponible") {
    throw new Error("Vérification de la session impossible : base injoignable.");
  }
  redirect(`/connexion?suite=${next}`);
}

/**
 * Exige une session administrateur.
 *
 * Le middleware bloque deja l'acces aux routes /admin, mais cette verification
 * est refaite ici : le middleware protege la navigation, pas les actions
 * serveur, qui peuvent etre appelees directement.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const check = await checkSession();
  if (check.user?.role === "ADMIN") return check.user;
  denyAccess(check, "/admin");
}

/** Exige une session, quel que soit le role. */
export async function requireUser(suite = "/compte"): Promise<SessionUser> {
  const check = await checkSession();
  if (check.user) return check.user;
  denyAccess(check, suite);
}

/** Variante pour les actions serveur : leve au lieu de rediriger. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Action réservée à l'administration.");
  }
  return user;
}
