/**
 * Base a utiliser selon l'environnement Vercel.
 *
 * Une preversion (VERCEL_ENV=preview) utilise la base de staging Neon, et n'a
 * jamais le droit de retomber sur la base de production : elle sert a essayer
 * du code non encore valide, elle ne doit pas pouvoir ecrire dans les vraies
 * commandes. Sans base de staging, elle echoue franchement.
 */
export function selectDatabaseUrl(env: Readonly<Record<string, string | undefined>>): string {
  if (env.VERCEL_ENV === "preview") {
    if (!env.STAGING_DATABASE_URL) {
      throw new Error(
        "STAGING_DATABASE_URL n'est pas défini pour cette préversion. " +
          "Une préversion n'utilise jamais la base de production."
      );
    }
    return env.STAGING_DATABASE_URL;
  }
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL n'est pas défini. Copiez .env.example vers .env et renseignez la connexion Supabase."
    );
  }
  return env.DATABASE_URL;
}
