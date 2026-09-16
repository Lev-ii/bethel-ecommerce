import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { APP_PORT, E2E_CRON_SECRET, E2E_DATABASE_URL, JEKO_PORT } from "./tests/e2e/constantes";

/**
 * Tests de parcours : le site construit et lance comme en production, face a
 * un faux Jeko local et a une base dediee.
 *
 * Le .env du projet contient les cles de production (Jeko, WhatsApp,
 * Supabase). Next le chargerait, mais ne remplace jamais une variable deja
 * definie : chacune de ses cles est donc fixee ici, vide par defaut.
 */

function neutralisedDotEnv(): Record<string, string> {
  const keys = new Set<string>();
  for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (match) keys.add(match[1]);
    }
  }
  return Object.fromEntries([...keys].map((key) => [key, ""]));
}

const serverEnv: Record<string, string> = {
  ...neutralisedDotEnv(),
  DATABASE_URL: E2E_DATABASE_URL,
  AUTH_SECRET: "secret-de-session-des-tests-de-parcours",
  CRON_SECRET: E2E_CRON_SECRET,
  JEKO_API_BASE: `http://127.0.0.1:${JEKO_PORT}`,
  JEKO_API_KEY: "cle-e2e",
  JEKO_API_KEY_ID: "id-e2e",
  JEKO_STORE_ID: "boutique-e2e",
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${APP_PORT}`,
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "tests/e2e",
  // Une seule base et un stock partage : les parcours s'enchainent.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
    locale: "fr-FR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/faux-jeko.mjs",
      url: `http://127.0.0.1:${JEKO_PORT}/sante`,
      env: { FAKE_JEKO_PORT: String(JEKO_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `node tests/e2e/preparer-base.mjs && npx next build && npx next start -H 127.0.0.1 -p ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}`,
      env: serverEnv,
      timeout: 600_000,
      reuseExistingServer: false,
      stdout: "pipe",
    },
  ],
});
