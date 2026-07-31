"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db/client";
import { getUserByEmail } from "@/lib/repository";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  cookieOptions,
  createToken,
  homeFor,
} from "@/lib/auth/session";
import {
  clearLoginAttempts,
  isLoginBlocked,
  recordFailedLogin,
} from "@/lib/auth/security";
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
  const token = await createToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  store.set(SESSION_COOKIE, token, cookieOptions);
}

/** Connexion. Renvoie l'utilisateur vers l'espace correspondant a son role. */
export async function signIn(formData: FormData) {
  const store = await cookies();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const suite = String(formData.get("suite") ?? "");
  const back = suite ? `&suite=${encodeURIComponent(suite)}` : "";
  const ip = store.get("x-forwarded-for")?.value;

  if (!email || !password) {
    redirect(`/connexion?erreur=champs${back}`);
  }

  if (isLoginBlocked(email, ip)) {
    redirect(`/connexion?erreur=identifiants${back}`);
  }

  const user = await getUserByEmail(email);
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    recordFailedLogin(email, ip);
    redirect(`/connexion?erreur=identifiants${back}`);
  }

  clearLoginAttempts(email, ip);
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
  if (await getUserByEmail(email)) redirect("/inscription?erreur=existe");

  const passwordHash = await hashPassword(password);
  const user: User = {
    id: randomUUID(),
    email,
    name,
    phone: phone || undefined,
    passwordHash,
    role: "CLIENT",
    createdAt: new Date().toISOString(),
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
  store.delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}
