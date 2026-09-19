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
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const claims = await readClaims(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  try {
    const [account] = await sql<Array<{ session_version: number; role: UserRole }>>`
      SELECT session_version, role FROM users WHERE id = ${claims.user.id}
    `;
    if (!account) return null;
    if (account.session_version !== claims.sessionVersion) return null;
    if (account.role !== claims.user.role) return null;
  } catch (error) {
    console.error("[auth] vérification de la session impossible", error);
    return null;
  }
  return claims.user;
});

/**
 * Exige une session administrateur.
 *
 * Le middleware bloque deja l'acces aux routes /admin, mais cette verification
 * est refaite ici : le middleware protege la navigation, pas les actions
 * serveur, qui peuvent etre appelees directement.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/connexion?suite=/admin");
  }
  return user;
}

/** Exige une session, quel que soit le role. */
export async function requireUser(suite = "/compte"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    redirect(`/connexion?suite=${encodeURIComponent(suite)}`);
  }
  return user;
}

/** Variante pour les actions serveur : leve au lieu de rediriger. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Action réservée à l'administration.");
  }
  return user;
}
