import "server-only";

import postgres from "postgres";

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
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL n'est pas defini. Copiez .env.example vers .env et renseignez la connexion Supabase."
    );
  }

  return postgres(url, {
    // Supabase impose TLS. En local, le certificat n'existe pas.
    ssl: url.includes("localhost") || url.includes("127.0.0.1")
      ? false
      : "require",
    // Le pooler de Supabase ne supporte pas les requetes preparees.
    prepare: false,
    // Vercel execute des fonctions courtes : un pool large ne sert a rien et
    // epuiserait le quota de connexions de la base.
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export const sql = globalForDb.__bethelSql ?? connect();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__bethelSql = sql;
}
