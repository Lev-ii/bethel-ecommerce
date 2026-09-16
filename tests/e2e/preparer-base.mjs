/**
 * Base des tests de parcours : creee si absente, puis remise aux donnees de
 * demonstration (npm run db:setup -- --force). Refuse toute base non locale :
 * --force efface les commandes.
 */

import { execFileSync } from "node:child_process";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL absent.");
const target = new URL(url);
if (!["localhost", "127.0.0.1"].includes(target.hostname)) {
  throw new Error(`Base de parcours refusée : ${target.hostname} n'est pas locale.`);
}

const name = target.pathname.slice(1);
const admin = new URL(url);
admin.pathname = "/postgres";
const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
const [exists] = await sql`SELECT 1 FROM pg_database WHERE datname = ${name}`;
if (!exists) {
  await sql.unsafe(`CREATE DATABASE "${name.replace(/"/g, "")}"`);
  console.log(`base ${name} créée`);
}
await sql.end();

execFileSync("node", ["scripts/setup-db.mjs", "--force"], { stdio: "inherit", env: process.env });
