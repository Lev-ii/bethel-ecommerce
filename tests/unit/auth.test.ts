import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { authSecret, createToken, readClaims, readToken } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/types";

const admin: SessionUser = {
  id: "u-1",
  email: "compte@exemple.test",
  name: "Admin",
  role: "ADMIN",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("passwordProblem", () => {
  it("accepte un mot de passe conforme", () => {
    expect(passwordProblem("MotDePasse2026")).toBeNull();
  });

  it("refuse en dessous de huit caracteres", () => {
    expect(passwordProblem("beth26")).toMatch(/8/);
  });

  it("refuse sans chiffre", () => {
    expect(passwordProblem("bethelshop")).toMatch(/lettre|chiffre/);
  });

  it("refuse sans lettre", () => {
    expect(passwordProblem("20262026")).toMatch(/lettre|chiffre/);
  });
});

describe("hachage des mots de passe", () => {
  it("verifie le bon mot de passe", async () => {
    const stored = await hashPassword("MotDePasse2026");
    await expect(verifyPassword("MotDePasse2026", stored)).resolves.toBe(true);
  });

  it("refuse un mot de passe errone", async () => {
    const stored = await hashPassword("MotDePasse2026");
    await expect(verifyPassword("bethel2027", stored)).resolves.toBe(false);
  });

  it("tire un sel different a chaque appel", async () => {
    const [a, b] = await Promise.all([hashPassword("MotDePasse2026"), hashPassword("MotDePasse2026")]);
    expect(a).not.toBe(b);
    expect(a.split(":")[0]).not.toBe(b.split(":")[0]);
  });

  it("ne renvoie jamais le mot de passe en clair", async () => {
    const stored = await hashPassword("MotDePasse2026");
    expect(stored).not.toContain("MotDePasse2026");
  });

  it.each(["", "sel-sans-hachage", "a:b:c:d"])(
    "refuse un enregistrement malforme (%s)",
    async (stored) => {
      await expect(verifyPassword("MotDePasse2026", stored)).resolves.toBe(false);
    }
  );
});

describe("jeton de session", () => {
  it("relit un jeton qu'il vient de signer", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-suffisamment-long");
    const user = await readToken(await createToken(admin));
    expect(user).toEqual(admin);
  });

  it("rejette un jeton dont la charge a ete modifiee", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-suffisamment-long");
    const [, signature] = (await createToken({ ...admin, role: "CLIENT" })).split(".");
    const forged = Buffer.from(JSON.stringify({ ...admin, exp: 9e9 }), "utf8")
      .toString("base64url");
    expect(await readToken(`${forged}.${signature}`)).toBeNull();
  });

  it("rejette un jeton signe avec un autre secret", async () => {
    vi.stubEnv("AUTH_SECRET", "premier-secret-de-test-assez-long-pour-32");
    const token = await createToken(admin);
    vi.stubEnv("AUTH_SECRET", "second-secret-de-test-assez-long-pour-32!");
    expect(await readToken(token)).toBeNull();
  });

  it("rejette un jeton expire", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-suffisamment-long");
    const token = await createToken(admin);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const user = await readToken(token);
    vi.useRealTimers();
    expect(user).toBeNull();
  });

  it("porte la version de session du compte", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-suffisamment-long");
    const claims = await readClaims(await createToken(admin, 3));
    expect(claims).toEqual({ user: admin, sessionVersion: 3 });
  });

  it("lit un jeton emis avant les versions de session comme version 0", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test-suffisamment-long");
    // Jeton signe a l'ancienne : charge sans champ "sv".
    const body = Buffer.from(JSON.stringify({ ...admin, exp: Math.floor(Date.now() / 1000) + 60 })).toString("base64url");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("secret-de-test-suffisamment-long"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))).toString("base64url");
    expect(await readClaims(`${body}.${signature}`)).toEqual({ user: admin, sessionVersion: 0 });
  });

  it.each([undefined, "", "sans-point", "a.b.c.d"])(
    "rejette un jeton malforme (%s)",
    async (token) => {
      vi.stubEnv("AUTH_SECRET", "secret-de-test-suffisamment-long");
      expect(await readToken(token)).toBeNull();
    }
  );
});

// Le depot est public : un secret de repli connu permettrait de forger un
// cookie ADMIN. Ce garde-fou a ete pose le 15/09/2026.
describe("garde-fou AUTH_SECRET", () => {
  it.each([undefined, "", "trop-court", "seize-caracteres", "trente-et-un-caracteres-pile-ok"])(
    "refuse de signer en production sans secret valide (%s)",
    (value) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("AUTH_SECRET", value as string);
      expect(() => authSecret()).toThrow(/AUTH_SECRET/);
    }
  );

  it("accepte un secret d'au moins trente-deux caracteres en production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "trente-deux-caracteres-tout-pile");
    expect(authSecret()).toBe("trente-deux-caracteres-tout-pile");
  });

  it("tolere l'absence de secret hors production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => authSecret()).not.toThrow();
  });
});
