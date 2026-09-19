import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Durcissement de l'authentification, contre un vrai PostgreSQL :
 * redirection apres connexion, revocation des sessions, limitation et usage
 * unique des liens de reinitialisation, lien cree par l'administration.
 *
 * Comptes @securite.test, adresses IP de documentation (203.0.113.0/24) :
 * tout est efface a la fin, y compris les entrees de journal de ces comptes.
 */

const host = new URL(process.env.DATABASE_URL ?? "postgresql://x").hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error(`Tests de sécurité refusés sur une base non locale (${host}).`);
}

const SECRET = "secret-de-test-suffisamment-long";
vi.stubEnv("AUTH_SECRET", SECRET);

// Requete simulee : cookie de session et adresse IP choisis par chaque test.
const request = { cookie: undefined as string | undefined, ip: "203.0.113.1" };
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "bethel_session" && request.cookie ? { value: request.cookie } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
  }),
  headers: async () => new Headers({ "x-real-ip": request.ip }),
}));

class Redirected extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache:
    <A extends unknown[], T>(fn: (...args: A) => Promise<T>) =>
    (...args: A) =>
      fn(...args),
}));

const { sql } = await import("@/lib/db/client");
const { createToken } = await import("@/lib/auth/session");
const { currentUser } = await import("@/lib/auth/current");
const { hashPassword } = await import("@/lib/auth/password");
const { issueResetToken } = await import("@/lib/auth/reset-token");
const { MAX_FAILED_RESET_ATTEMPTS_PER_IP, MAX_RESET_REQUESTS_PER_EMAIL, MAX_RESET_REQUESTS_PER_IP, emailSubject, takeResetRequest } =
  await import("@/lib/auth/reset-throttle");
const { requestPasswordReset, resetPassword, signIn } = await import("@/lib/auth/actions");
const { createClientResetLink } = await import("@/lib/admin/reset-link-actions");

async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Redirected) return error.url;
    throw error;
  }
  throw new Error("aucune redirection");
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

async function createAccount(role: "CLIENT" | "ADMIN" = "CLIENT", phone: string | null = null) {
  const id = randomUUID();
  const email = `${id.slice(0, 8)}@securite.test`;
  await sql`
    INSERT INTO users (id, email, name, password_hash, role, phone)
    VALUES (${id}, ${email}, ${"Awa Koné"}, ${await hashPassword("MotDePasse2026")}, ${role}, ${phone})
  `;
  return { id, email, name: "Awa Koné", role };
}

async function sessionVersion(id: string): Promise<number> {
  const [row] = await sql<Array<{ session_version: number }>>`SELECT session_version FROM users WHERE id = ${id}`;
  return row.session_version;
}

// Empreintes des emails utilises par les tests, pour effacer leurs compteurs.
const testEmailSubjects: string[] = [];
function trackEmail(email: string) {
  testEmailSubjects.push(emailSubject(email));
  return email;
}

async function purge() {
  const ids = (await sql<Array<{ id: string }>>`SELECT id FROM users WHERE email LIKE '%@securite.test'`).map((r) => r.id);
  if (ids.length > 0) {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL bethel.audit_purge = 'on'`;
      await tx`DELETE FROM audit_logs WHERE entity_id IN ${sql(ids)}`;
    });
  }
  await sql`DELETE FROM users WHERE email LIKE '%@securite.test'`;
  await sql`DELETE FROM auth_throttle_events WHERE subject LIKE 'ip:203.0.113.%'`;
  await sql`DELETE FROM auth_throttle_events WHERE subject IN ${sql(testEmailSubjects.length > 0 ? testEmailSubjects : ["-"])}`;
}

beforeEach(async () => {
  await purge();
  request.cookie = undefined;
  request.ip = "203.0.113.1";
  cookieJar.clear();
});
afterAll(async () => {
  await purge();
  await sql.end();
});

describe("redirection après connexion", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example"])(
    "ignore une destination externe (%s) et renvoie vers l'espace du compte",
    async (suite) => {
      const user = await createAccount();
      const url = await redirectOf(() => signIn(form({ email: user.email, password: "MotDePasse2026", suite })));
      expect(url).toBe("/compte");
    }
  );

  it("suit une destination interne", async () => {
    const user = await createAccount();
    const url = await redirectOf(() => signIn(form({ email: user.email, password: "MotDePasse2026", suite: "/compte/commandes" })));
    expect(url).toBe("/compte/commandes");
  });
});

describe("révocation des sessions", () => {
  it("une session reste valable tant que le mot de passe ne change pas", async () => {
    const user = await createAccount();
    request.cookie = await createToken(user, 0);
    expect(await currentUser()).toMatchObject({ id: user.id });
  });

  it("un changement de mot de passe révoque la session ouverte avant", async () => {
    const user = await createAccount();
    request.cookie = await createToken(user, 0);
    const token = await sql.begin((tx) => issueResetToken(tx as unknown as typeof sql, user.id, 1));

    expect(await redirectOf(() => resetPassword(form({ token, password: "NouveauMdp2027" })))).toBe("/connexion?reset=1");
    expect(await sessionVersion(user.id)).toBe(1);
    expect(await currentUser()).toBeNull();

    // Une nouvelle connexion porte la nouvelle version.
    await redirectOf(() => signIn(form({ email: user.email, password: "NouveauMdp2027" })));
    request.cookie = cookieJar.get("bethel_session");
    expect(await currentUser()).toMatchObject({ id: user.id });
  });

  it("un changement de rôle ou un compte supprimé invalide la session", async () => {
    const user = await createAccount("ADMIN");
    request.cookie = await createToken(user, 0);
    await sql`UPDATE users SET role = 'CLIENT' WHERE id = ${user.id}`;
    expect(await currentUser()).toBeNull();

    await sql`DELETE FROM users WHERE id = ${user.id}`;
    expect(await currentUser()).toBeNull();
  });
});

describe("lien de réinitialisation", () => {
  it("ne sert qu'une fois, même envoyé deux fois en même temps", async () => {
    const user = await createAccount();
    const token = await sql.begin((tx) => issueResetToken(tx as unknown as typeof sql, user.id, 1));
    const results = await Promise.all([
      redirectOf(() => resetPassword(form({ token, password: "NouveauMdp2027" }))),
      redirectOf(() => resetPassword(form({ token, password: "AutreMdp2028" }))),
    ]);
    expect(results.sort()).toEqual(["/connexion?reset=1", "/mot-de-passe-oublie?erreur=invalide"]);
    expect(await sessionVersion(user.id)).toBe(1);
  });

  it("refuse un lien expiré", async () => {
    const user = await createAccount();
    const token = await sql.begin((tx) => issueResetToken(tx as unknown as typeof sql, user.id, 1));
    await sql`UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = ${user.id}`;
    expect(await redirectOf(() => resetPassword(form({ token, password: "NouveauMdp2027" })))).toBe(
      "/mot-de-passe-oublie?erreur=invalide"
    );
  });

  it(`bloque une adresse après ${MAX_FAILED_RESET_ATTEMPTS_PER_IP} liens invalides, sans toucher aux autres`, async () => {
    request.ip = "203.0.113.20";
    for (let i = 0; i < MAX_FAILED_RESET_ATTEMPTS_PER_IP; i += 1) {
      expect(await redirectOf(() => resetPassword(form({ token: `faux-${i}`, password: "NouveauMdp2027" })))).toBe(
        "/mot-de-passe-oublie?erreur=invalide"
      );
    }
    // Meme un lien valide est refuse depuis cette adresse pendant le blocage.
    const user = await createAccount();
    const token = await sql.begin((tx) => issueResetToken(tx as unknown as typeof sql, user.id, 1));
    expect(await redirectOf(() => resetPassword(form({ token, password: "NouveauMdp2027" })))).toBe(
      "/mot-de-passe-oublie?erreur=trop"
    );

    request.ip = "203.0.113.21";
    expect(await redirectOf(() => resetPassword(form({ token, password: "NouveauMdp2027" })))).toBe("/connexion?reset=1");
  });
});

describe("demandes de lien", () => {
  it(`limite une adresse IP à ${MAX_RESET_REQUESTS_PER_IP} demandes par heure`, async () => {
    request.ip = "203.0.113.30";
    for (let i = 0; i < MAX_RESET_REQUESTS_PER_IP; i += 1) {
      const email = trackEmail(`inconnu-${i}@securite.test`);
      expect(await redirectOf(() => requestPasswordReset(form({ email })))).toBe("/mot-de-passe-oublie?envoye=1");
    }
    const email = trackEmail("encore@securite.test");
    expect(await redirectOf(() => requestPasswordReset(form({ email })))).toBe("/mot-de-passe-oublie?erreur=trop");
  });

  it(`limite une même adresse email à ${MAX_RESET_REQUESTS_PER_EMAIL} demandes, quelle que soit l'IP`, async () => {
    const email = trackEmail("cible@securite.test");
    for (let i = 0; i < MAX_RESET_REQUESTS_PER_EMAIL; i += 1) {
      expect(await takeResetRequest(`203.0.113.${40 + i}`, email)).toBe(true);
    }
    expect(await takeResetRequest("203.0.113.50", email)).toBe(false);
    // Pas de fuite : une adresse sans compte est limitee de la meme facon.
    const [{ n }] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM auth_throttle_events WHERE subject = ${emailSubject(email)}
    `;
    expect(n).toBe(MAX_RESET_REQUESTS_PER_EMAIL);
  });

  it("n'écrit jamais le jeton ni le lien dans les journaux, et ne crée aucun jeton", async () => {
    const user = await createAccount();
    trackEmail(user.email);
    const logs: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((...args) => void logs.push(args.join(" ")));
    await redirectOf(() => requestPasswordReset(form({ email: user.email })));
    spy.mockRestore();

    expect(logs.join("\n")).not.toMatch(/mot-de-passe-oublie\/|[0-9a-f]{64}/);
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = ${user.id}`;
    expect(n).toBe(0);
  });
});

describe("lien créé par l'administration", () => {
  async function asAdmin() {
    const admin = await createAccount("ADMIN");
    request.cookie = await createToken(admin, 0);
    return admin;
  }

  it("crée un lien valable, prêt pour WhatsApp, et l'inscrit au journal", async () => {
    const admin = await asAdmin();
    const client = await createAccount("CLIENT", "07 78 84 84 74");
    const state = await createClientResetLink({ status: "idle" }, form({ email: client.email }));

    expect(state.status).toBe("ok");
    if (state.status !== "ok") return;
    expect(state.link).toMatch(/\/mot-de-passe-oublie\/[0-9a-f]{64}$/);
    expect(state.whatsappUrl).toMatch(/^https:\/\/wa\.me\/2250778848474\?text=/);

    const [entry] = await sql<Array<{ actor_id: string; action: string }>>`
      SELECT actor_id, action FROM audit_logs WHERE entity_id = ${client.id}
    `;
    expect(entry).toEqual({ actor_id: admin.id, action: "auth.reset_link_created" });

    request.cookie = undefined;
    const token = state.link.split("/").pop()!;
    expect(await redirectOf(() => resetPassword(form({ token, password: "NouveauMdp2027" })))).toBe("/connexion?reset=1");
  });

  it("refuse de créer un lien pour un compte administrateur", async () => {
    await asAdmin();
    const other = await createAccount("ADMIN");
    const state = await createClientResetLink({ status: "idle" }, form({ email: other.email }));
    expect(state).toMatchObject({ status: "error" });
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = ${other.id}`;
    expect(n).toBe(0);
  });

  it("est réservé à l'administration", async () => {
    const client = await createAccount();
    request.cookie = await createToken(client, 0);
    await expect(createClientResetLink({ status: "idle" }, form({ email: client.email }))).rejects.toThrow(/administration/);
  });
});
