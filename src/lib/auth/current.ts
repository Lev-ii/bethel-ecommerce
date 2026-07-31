import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readToken } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/types";

/** Utilisateur connecte, ou null. Ne redirige jamais. */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readToken(store.get(SESSION_COOKIE)?.value);
}

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
    throw new Error("Action reservee a l'administration.");
  }
  return user;
}
