import "server-only";

import postgres from "postgres";
import { selectDatabaseUrl } from "@/lib/db/database-url";

/**
 * Connexion a la base.
 *
 * Le rechargement a chaud de Next recree les modules a chaque edition. Sans
 * ce passage par globalThis, chaque rechargement ouvrirait un nouveau pool et
 * la base finirait par refuser les connexions.
 */
const globalForDb = globalThis as unknown as {
  __bethelSql?: ReturnType<typeof postgres>;
};

function connect() {
  const url = selectDatabaseUrl(process.env);

  // Nombre de connexions ouvertes par instance de fonction serverless, pas au
  // total : sous forte charge, Vercel fait tourner plusieurs instances en
  // parallele, chacune avec son propre pool. La bonne valeur depend donc de
  // la limite de connexions de l'hebergeur de base (souvent un pooler style
  // PgBouncer) divisee par le nombre d'instances attendu — jamais un nombre
  // fixe valable partout. DB_POOL_MAX permet de l'ajuster sans toucher au
  // code au moment de choisir cet hebergeur.
  const defaultMax = process.env.NODE_ENV === "production" ? 5 : 10;
  const configuredMax = Number(process.env.DB_POOL_MAX);
  const max = Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : defaultMax;

  return postgres(url, {
    // Necessaire hors localhost ; desactive uniquement pour un Postgres local
    // sans certificat.
    ssl: url.includes("localhost") || url.includes("127.0.0.1")
      ? false
      : "require",
    // Desactive par defaut : le pooler de Supabase (PgBouncer en mode
    // transaction) ne supporte pas les requetes preparees. Un hebergeur sans
    // ce genre de pooler devant lui peut activer DB_PREPARE=true pour de
    // meilleures performances.
    prepare: process.env.DB_PREPARE === "true",
    max,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export const sql = globalForDb.__bethelSql ?? connect();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__bethelSql = sql;
}
