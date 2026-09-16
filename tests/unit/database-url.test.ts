import { describe, expect, it } from "vitest";
import { selectDatabaseUrl } from "@/lib/db/database-url";

const PROD = "postgresql://prod@supabase/postgres";
const STAGING = "postgresql://staging@neon/neondb";

describe("choix de la base", () => {
  it("utilise la production en production", () => {
    expect(selectDatabaseUrl({ VERCEL_ENV: "production", DATABASE_URL: PROD, STAGING_DATABASE_URL: STAGING })).toBe(PROD);
  });

  it("utilise la base de staging sur une preversion", () => {
    expect(selectDatabaseUrl({ VERCEL_ENV: "preview", DATABASE_URL: PROD, STAGING_DATABASE_URL: STAGING })).toBe(STAGING);
  });

  // La garantie qui compte : une preversion mal configuree ne touche jamais la production.
  it("refuse de retomber sur la production si la base de staging manque", () => {
    expect(() => selectDatabaseUrl({ VERCEL_ENV: "preview", DATABASE_URL: PROD })).toThrow(/jamais la base de production/);
  });

  it("utilise DATABASE_URL en local et en CI, hors Vercel", () => {
    expect(selectDatabaseUrl({ DATABASE_URL: "postgresql://localhost/bethel_dev" })).toBe("postgresql://localhost/bethel_dev");
  });

  it("signale l'absence de toute base", () => {
    expect(() => selectDatabaseUrl({})).toThrow(/DATABASE_URL/);
  });
});
