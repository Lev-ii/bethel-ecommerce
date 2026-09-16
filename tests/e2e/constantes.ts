/** Reglages partages par playwright.config.ts et les parcours. */

export const APP_PORT = 3100;
export const JEKO_PORT = 3101;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://localhost:5432/bethel_e2e";
export const E2E_CRON_SECRET = "cron-secret-des-tests-de-parcours";
