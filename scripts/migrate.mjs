/**
 * Applique les migrations de db/migrations.
 *
 *   npm run db:migrate                       applique ce qui est en attente
 *   npm run db:migrate -- --status           affiche le plan, n'ecrit rien
 *   npm run db:migrate -- --baseline=0001    marque l'existant sans l'executer
 *
 * Utilise DIRECT_URL si elle existe (connexion sans pooler), sinon DATABASE_URL.
 */
import path from "node:path";
import postgres from "postgres";
import { MigrationError, runMigrations } from "./lib/migrations.mjs";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Ni DIRECT_URL ni DATABASE_URL ne sont definies.");
  process.exit(1);
}

const status = process.argv.includes("--status");
const baseline = process.argv.find((a) => a.startsWith("--baseline="))?.split("=")[1];
const host = new URL(url).hostname;
const local = host === "localhost" || host === "127.0.0.1";

// La cible est affichee avant toute action : on doit toujours savoir sur quelle
// base on travaille.
console.log(`Base cible : ${host}${status ? "  (lecture du plan seulement)" : ""}`);

const sql = postgres(url, { ssl: local ? false : "require", prepare: false, max: 1, onnotice: () => {} });
try {
  const plan = await runMigrations(sql, {
    dir: path.join(process.cwd(), "db", "migrations"),
    baseline,
    dryRun: status,
  });
  console.log(`Deja appliquees   : ${plan.alreadyApplied.join(", ") || "aucune"}`);
  if (plan.baselined.length) console.log(`Marquees (baseline): ${plan.baselined.join(", ")}`);
  console.log(`${status ? "En attente        " : "Appliquees        "} : ${plan.ran.join(", ") || "aucune"}`);
} catch (error) {
  console.error(error instanceof MigrationError ? `\nArret : ${error.message}` : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
