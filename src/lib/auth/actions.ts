"use server";

import { adminLoginEvents, clientIp, recordAuditQuietly } from "@/lib/admin/audit";
import { loginLocked } from "@/lib/auth/login-throttle";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db/client";
import { getUserByEmail } from "@/lib/repository";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { recordFailedResetAttempt, resetAttemptsBlocked, takeResetRequest } from "@/lib/auth/reset-throttle";
import { consumeResetToken } from "@/lib/auth/reset-token";
import {
  SESSION_COOKIE,
  cookieOptions,
  createToken,
  homeFor,
} from "@/lib/auth/session";
import type { User } from "@/lib/types";

/**
 * Actions d'authentification.
 *
 * Les formulaires sont de simples formulaires HTML relies a ces actions, sans
 * etat client : ils fonctionnent donc avant meme que JavaScript ait charge.
 * En cas d'erreur, l'action renvoie vers la page avec un code dans l'URL,
 * plutot que de conserver un etat en memoire. C'est un peu moins elegant
 * qu'un message rendu sur place, mais c'est robuste et sans surprise.
 */

function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}



/**
 * Ouvre la session.
 *
 * Le magasin de cookies est passe en parametre et jamais relu ici : il doit
 * etre obtenu avant le hachage du mot de passe. scrypt rend la main depuis le
 * pool de threads de Node, et un cookies() place apres echouerait.
 */
async function startSession(
  store: Awaited<ReturnType<typeof cookies>>,
  user: User
) {
  const token = await createToken(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    user.sessionVersion
  );
  store.set(SESSION_COOKIE, token, cookieOptions);
}

/** Connexion. Renvoie l'utilisateur vers l'espace correspondant a son role. */
export async function signIn(formData: FormData) {
  const store = await cookies();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  // Une destination douteuse est ignoree, pas signalee : la personne arrive
  // simplement sur son espace.
  const suite = safeRedirectPath(formData.get("suite")) ?? "";
  const back = suite ? `&suite=${encodeURIComponent(suite)}` : "";

  if (!email || !password) {
    redirect(`/connexion?erreur=champs${back}`);
  }

  let user;
  try {
    user = await getUserByEmail(email);
  } catch {
    // Une panne de base ne doit jamais ressembler a un mauvais mot de passe.
    redirect(`/connexion?erreur=service${back}`);
  }

  // Limitation verifiee AVANT le mot de passe : pendant un blocage, meme le bon
  // mot de passe est refuse, sinon le blocage ne ralentirait rien.
  if (user?.role === "ADMIN") {
    const ip = await clientIp();
    let locked = false;
    try {
      locked = loginLocked(await adminLoginEvents(user.id), ip, new Date());
    } catch (error) {
      // Meme base que la connexion : une panne ici ferait deja echouer le reste.
      console.error("[auth] vérification des tentatives impossible", error);
    }
    if (locked) redirect(`/connexion?erreur=bloque${back}`);
  }

  // Meme message dans les deux cas : distinguer les deux reviendrait a dire
  // qui possede un compte chez nous.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  // Seuls les comptes administrateurs sont journalises : les connexions des
  // clients noieraient ce qui compte. Un echec n'a pas d'acteur authentifie,
  // mais l'email vise est note.
  if (user?.role === "ADMIN") {
    await recordAuditQuietly({
      action: ok ? "auth.admin_login" : "auth.admin_login_failed",
      actor: ok ? { id: user.id, email: user.email } : null,
      actorEmail: user.email,
      entityType: "user",
      entityId: user.id,
      entityLabel: user.email,
    });
  }

  if (!user || !ok) {
    redirect(`/connexion?erreur=identifiants${back}`);
  }

  await startSession(store, user);
  revalidatePath("/", "layout");
  redirect(suite || homeFor(user.role));
}

/** Creation d'un compte client. Ce formulaire ne cree jamais d'administrateur. */
export async function signUp(formData: FormData) {
  const store = await cookies();
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (name.length < 3) redirect("/inscription?erreur=nom");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect("/inscription?erreur=email");
  }
  if (passwordProblem(password)) redirect("/inscription?erreur=motdepasse");

  let existing;
  try {
    existing = await getUserByEmail(email);
  } catch {
    // Sans verification fiable de l'unicite de l'email, on refuse de creer
    // le compte plutot que de risquer un doublon silencieux.
    redirect("/inscription?erreur=service");
  }
  if (existing) redirect("/inscription?erreur=existe");

  const passwordHash = await hashPassword(password);
  const user: User = {
    id: randomUUID(),
    email,
    name,
    phone: phone || undefined,
    passwordHash,
    role: "CLIENT",
    createdAt: new Date().toISOString(),
    sessionVersion: 0,
  };

  await sql`
    INSERT INTO users (id, email, name, password_hash, role, phone)
    VALUES (${user.id}, ${user.email}, ${user.name}, ${user.passwordHash},
            'CLIENT', ${user.phone ?? null})
  `;
  await startSession(store, user);
  revalidatePath("/", "layout");
  redirect("/compte");
}

export async function signOut() {
  const store = await cookies();

  // La suppression doit reprendre exactement les memes attributs que la pose,
  // sinon le navigateur ne fait pas correspondre les deux cookies et garde
  // l'ancien. En production, ou le cookie porte Secure, une suppression sans
  // cet attribut echoue silencieusement : la redirection a lieu, mais la
  // personne reste connectee.
  //
  // maxAge a zero plutot que delete() : l'expiration immediate est mieux
  // supportee par les navigateurs anciens, et l'en-tete porte les memes
  // attributs que la pose.
  store.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Demande de lien de reinitialisation.
 *
 * Aucun email n'est encore envoye (service a souscrire) : la page invite le
 * client a demander son lien sur WhatsApp, et l'administration le cree depuis
 * "Accès clients". Aucun jeton n'est donc cree ici : il ne parviendrait a
 * personne, et remplacerait un lien deja remis par l'administration.
 * Le jeton ne doit jamais apparaitre dans un journal.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  if (!email) redirect("/mot-de-passe-oublie?erreur=email");

  let allowed = false;
  let user;
  try {
    allowed = await takeResetRequest(await clientIp(), email);
    if (allowed) user = await getUserByEmail(email);
  } catch {
    redirect("/mot-de-passe-oublie?erreur=service");
  }
  if (!allowed) redirect("/mot-de-passe-oublie?erreur=trop");
  if (user) console.info(`[auth] demande de réinitialisation pour le compte ${user.id}`);

  redirect("/mot-de-passe-oublie?envoye=1");
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();

  // Verifie avant tout le reste, y compris le hachage (couteux) du mot de passe.
  let blocked = false;
  try {
    blocked = await resetAttemptsBlocked(ip);
  } catch {
    redirect("/mot-de-passe-oublie?erreur=service");
  }
  if (blocked) redirect("/mot-de-passe-oublie?erreur=trop");

  if (!token || passwordProblem(password)) {
    redirect(`/mot-de-passe-oublie/${encodeURIComponent(token)}?erreur=motdepasse`);
  }

  const account = await consumeResetToken(token, await hashPassword(password));
  if (!account) {
    await recordFailedResetAttempt(ip).catch((error) =>
      console.error("[auth] tentative de réinitialisation non comptée", error)
    );
    redirect("/mot-de-passe-oublie?erreur=invalide");
  }
  if (account.role === "ADMIN") {
    await recordAuditQuietly({
      action: "auth.password_reset",
      actorEmail: account.email,
      entityType: "user",
      entityId: account.id,
      entityLabel: account.email,
    });
  }
  redirect("/connexion?reset=1");
}
