/** Reglages partages par playwright.config.ts et les parcours. */

export const APP_PORT = 3100;
export const JEKO_PORT = 3101;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://localhost:5432/bethel_e2e";
export const E2E_CRON_SECRET = "cron-secret-des-tests-de-parcours";
export const E2E_AUTH_SECRET = "secret-de-session-des-tests-de-parcours";

/**
 * Administrateur de la base de parcours, cree par preparer-base.mjs. Ces
 * identifiants ne valent que pour cette base locale et jetable : le code ne
 * contient aucun identifiant de production.
 */
export const E2E_ADMIN = { email: "admin@parcours.test", password: "parcours-2026" };

/** Faux identifiants de pixels (format valide) : aucun appel ne sort, les requetes externes sont coupees. */
export const E2E_PIXELS = { facebook: "123456789012345", tiktok: "C1ABCDEF2345GHIJ6789" };
export const CONSENT_KEY = "bethel-consentement-pub";
