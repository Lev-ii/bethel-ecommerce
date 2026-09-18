import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BREAKER_MS,
  catalogRead,
  isDatabaseUnavailableError,
  markDatabaseUnavailable,
  resetDatabaseBreaker,
} from "@/lib/catalog-fallback";

/**
 * Lectures du catalogue face a une base injoignable : jamais plus longues que
 * le delai maximal, et coupe-circuit apres un echec de connexion.
 */

afterEach(() => {
  resetDatabaseBreaker();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const never = () => new Promise<never>(() => {});

describe("catalogRead", () => {
  it("rend le résultat d'une requête qui répond", async () => {
    await expect(catalogRead(Promise.resolve([1, 2]))).resolves.toEqual([1, 2]);
  });

  it("abandonne une requête qui ne répond pas, avec une erreur de base injoignable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const started = Date.now();
    const error = await catalogRead(never(), 50).catch((e) => e);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it("laisse passer une erreur applicative (requête invalide), sans repli", async () => {
    const bug = Object.assign(new Error('column "prix" does not exist'), { code: "42703" });
    const error = await catalogRead(Promise.reject(bug)).catch((e) => e);
    expect(error).toBe(bug);
    expect(isDatabaseUnavailableError(error)).toBe(false);
  });

  it("après un échec de connexion, passe directement au secours sans toucher la base", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(isDatabaseUnavailableError(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }))).toBe(true);

    const query = { then: vi.fn() };
    const error = await catalogRead(query as unknown as PromiseLike<unknown>).catch((e) => e);
    expect(query.then).not.toHaveBeenCalled();
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it("réessaie la base une fois le coupe-circuit expiré", async () => {
    vi.useFakeTimers();
    markDatabaseUnavailable(Date.now());
    await expect(catalogRead(Promise.resolve("x"))).rejects.toBeTruthy();
    vi.setSystemTime(Date.now() + BREAKER_MS + 1);
    await expect(catalogRead(Promise.resolve("x"))).resolves.toBe("x");
  });
});
