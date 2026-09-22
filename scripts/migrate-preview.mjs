/**
 * Migrations de la base de staging, au debut de chaque build de preversion.
 *
 * Sans elle, chaque nouvelle migration cassait les preversions : leur base
 * (Neon) restait en retard, et le build echouait sur une table absente.
 *
 * N'agit QUE sur un build Vercel de preversion (VERCEL_ENV=preview), et
 * seulement avec l'adresse de staging (STAGING_DATABASE_URL*) : jamais sur la
 * production, qui reste migree a la main (npm run db:migrate). Partout
 * ailleurs (local, CI, production), ne fait rien.
 */
import path from "node:path";
import postgres from "postgres";
import { MigrationError, runMigrations } from "./lib/migrations.mjs";

if (process.env.VERCEL_ENV !== "preview") process.exit(0);

// Connexion directe (sans pooler) si l'integration Neon la fournit.
const url = process.env.STAGING_DATABASE_URL_UNPOOLED || process.env.STAGING_DATABASE_URL;
if (!url) {
  console.error("[migrations preversion] STAGING_DATABASE_URL absente : une preversion n'utilise jamais la base de production.");
  process.exit(1);
}
const productionUrl = process.env.DATABASE_URL;
if (productionUrl && new URL(productionUrl).hostname === new URL(url).hostname) {
  console.error("[migrations preversion] la base de staging a le meme hote que DATABASE_URL : arret par prudence.");
  process.exit(1);
}

console.log(`[migrations preversion] base de staging : ${new URL(url).hostname}`);
const host = new URL(url).hostname;
const local = host === "localhost" || host === "127.0.0.1";
const sql = postgres(url, { ssl: local ? false : "require", prepare: false, max: 1, onnotice: () => {} });
try {
  // La base de staging est partagee par toutes les preversions : une branche
  // plus avancee a pu y poser des migrations que celle-ci n'a pas encore.
  const plan = await runMigrations(sql, { dir: path.join(process.cwd(), "db", "migrations"), allowNewerApplied: true });
  console.log(`[migrations preversion] appliquees : ${plan.ran.join(", ") || "aucune"}`);
  if (plan.ahead.length > 0) {
    console.warn(
      `[migrations preversion] attention : la base de staging a deja ${plan.ahead.join(", ")}, ` +
        "posee(s) par une branche plus recente. Cette preversion tourne sur un schema en avance."
    );
  }
} catch (error) {
  console.error(error instanceof MigrationError ? `[migrations preversion] arret : ${error.message}` : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
