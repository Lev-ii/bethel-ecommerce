import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { authSecret, createToken, readToken } from "@/lib/auth/session";
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
    vi.stubEnv("AUTH_SECRET", "premier-secret-de-test-long");
    const token = await createToken(admin);
    vi.stubEnv("AUTH_SECRET", "second-secret-de-test-long!");
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
  it.each([undefined, "", "trop-court"])(
    "refuse de signer en production sans secret valide (%s)",
    (value) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("AUTH_SECRET", value as string);
      expect(() => authSecret()).toThrow(/AUTH_SECRET/);
    }
  );

  it("accepte un secret d'au moins seize caracteres en production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "seize-caracteres");
    expect(authSecret()).toBe("seize-caracteres");
  });

  it("tolere l'absence de secret hors production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => authSecret()).not.toThrow();
  });
});
