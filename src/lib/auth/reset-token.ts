import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db/client";

/**
 * Jetons de reinitialisation de mot de passe.
 *
 * Seule l'empreinte SHA-256 est stockee : une fuite de la table ne donne aucun
 * lien utilisable. Le jeton en clair n'existe que dans le lien remis au client,
 * et ne doit jamais etre ecrit dans un journal.
 */

/** Lien remis par l'administration via WhatsApp : le temps que le client le lise. */
export const ADMIN_RESET_LINK_HOURS = 24;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cree un jeton pour ce compte, en remplacant le precedent. A appeler dans la
 * transaction qui journalise la creation : soit le lien et sa trace existent
 * ensemble, soit aucun.
 */
export async function issueResetToken(tx: typeof sql, userId: string, validHours: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await tx`DELETE FROM password_reset_tokens WHERE user_id = ${userId} OR expires_at < now()`;
  await tx`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${hashResetToken(token)}, now() + make_interval(hours => ${validHours}))
  `;
  return token;
}

/**
 * Consomme le jeton et enregistre le nouveau mot de passe, en une seule
 * instruction : deux envois simultanes du meme lien ne peuvent pas reussir
 * tous les deux. La version de session est incrementee : toutes les sessions
 * ouvertes avant le changement sont revoquees.
 *
 * Renvoie le compte modifie, ou null si le lien est inconnu, expire ou deja utilise.
 */
export async function consumeResetToken(
  token: string,
  passwordHash: string
): Promise<{ id: string; email: string; role: string } | null> {
  const [account] = await sql<Array<{ id: string; email: string; role: string }>>`
    WITH used AS (
      UPDATE password_reset_tokens
      SET used_at = now()
      WHERE token_hash = ${hashResetToken(token)}
        AND expires_at > now()
        AND used_at IS NULL
      RETURNING user_id
    )
    UPDATE users u
    SET password_hash = ${passwordHash},
        session_version = u.session_version + 1
    FROM used
    WHERE u.id = used.user_id
    RETURNING u.id, u.email, u.role
  `;
  return account ?? null;
}
