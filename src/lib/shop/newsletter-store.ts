import "server-only";

import { randomUUID } from "node:crypto";
import { authSecret } from "@/lib/auth/session";
import { sql } from "@/lib/db/client";
import { NewsletterError, normalizeEmail, unsubscribeTokenIsValid } from "@/lib/shop/newsletter";

/**
 * Inscrits a la newsletter.
 *
 * Meme reponse que l'adresse soit nouvelle ou deja inscrite : le formulaire ne
 * permet pas de savoir qui est abonne.
 */
export async function subscribe(raw: { email?: unknown; consent?: unknown; source?: string }): Promise<void> {
  const email = normalizeEmail(raw.email);
  if (raw.consent !== "on" && raw.consent !== true) throw new NewsletterError("consentement");
  const source = (raw.source ?? "pied-de-page").slice(0, 40);
  // Reinscription : la marque de desinscription s'efface, le consentement est renouvele.
  await sql`
    INSERT INTO newsletter_subscribers (id, email, source)
    VALUES (${randomUUID()}, ${email}, ${source})
    ON CONFLICT (lower(email)) DO UPDATE
      SET unsubscribed_at = NULL,
          consented_at = CASE WHEN newsletter_subscribers.unsubscribed_at IS NULL
                              THEN newsletter_subscribers.consented_at ELSE now() END
  `;
}

/** Desinscription par le lien signe. Renvoie false si le lien est invalide. */
export async function unsubscribe(rawEmail: unknown, token: string | undefined): Promise<boolean> {
  let email: string;
  try {
    email = normalizeEmail(rawEmail);
  } catch {
    return false;
  }
  if (!unsubscribeTokenIsValid(email, token, authSecret())) return false;
  // Marque, jamais efface.
  await sql`
    UPDATE newsletter_subscribers SET unsubscribed_at = now()
    WHERE lower(email) = ${email} AND unsubscribed_at IS NULL
  `;
  return true;
}

export interface Subscriber {
  email: string;
  source: string;
  consentedAt: string;
  unsubscribedAt: string | null;
}

export async function newsletterCounts(): Promise<{ active: number; unsubscribed: number }> {
  const [row] = await sql<Array<{ active: number; unsubscribed: number }>>`
    SELECT count(*) FILTER (WHERE unsubscribed_at IS NULL)::int AS active,
           count(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed
    FROM newsletter_subscribers
  `;
  return row;
}

export async function listSubscribers(options: { activeOnly: boolean; limit?: number }): Promise<Subscriber[]> {
  const rows = await sql<Array<{ email: string; source: string; consented_at: Date; unsubscribed_at: Date | null }>>`
    SELECT email, source, consented_at, unsubscribed_at FROM newsletter_subscribers
    ${options.activeOnly ? sql`WHERE unsubscribed_at IS NULL` : sql``}
    ORDER BY created_at DESC
    ${options.limit ? sql`LIMIT ${options.limit}` : sql``}
  `;
  return rows.map((r) => ({
    email: r.email,
    source: r.source,
    consentedAt: r.consented_at.toISOString(),
    unsubscribedAt: r.unsubscribed_at?.toISOString() ?? null,
  }));
}
