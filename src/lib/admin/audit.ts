import "server-only";

import { headers } from "next/headers";
import type { AuditAction, AuditCategory, AuditChanges } from "@/lib/admin/audit-core";
import { actionsOf } from "@/lib/admin/audit-core";
import { sql } from "@/lib/db/client";

/** Client ou transaction postgres.js : l'entree s'ecrit dans la meme transaction que le changement. */
type Executor = typeof sql;

export interface AuditEntry {
  action: AuditAction;
  actor?: { id: string; email: string } | null;
  /** Email sans compte authentifie, pour une connexion refusee. */
  actorEmail?: string;
  entityType?: "product" | "order" | "user";
  entityId?: string;
  entityLabel?: string;
  changes?: AuditChanges;
}

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return ip ? ip.slice(0, 64) : null;
  } catch {
    // Hors d'une requete HTTP (script, test) : pas d'adresse a noter.
    return null;
  }
}

/**
 * Inscrit une entree. A appeler avec la transaction qui porte le changement :
 * soit le changement et sa trace sont enregistres ensemble, soit aucun.
 */
export async function recordAudit(db: Executor, entry: AuditEntry): Promise<void> {
  const ip = await clientIp();
  await db`
    INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, entity_label, changes, ip)
    VALUES (
      ${entry.actor?.id ?? null},
      ${entry.actor?.email ?? entry.actorEmail ?? null},
      ${entry.action},
      ${entry.entityType ?? null},
      ${entry.entityId ?? null},
      ${entry.entityLabel ?? null},
      ${sql.json((entry.changes ?? {}) as never)},
      ${ip}
    )
  `;
}

/**
 * Pour les evenements de connexion : une panne d'ecriture du journal ne doit
 * pas empecher un administrateur de se connecter. L'echec reste visible dans
 * les journaux du serveur.
 */
export async function recordAuditQuietly(entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(sql, entry);
  } catch (error) {
    console.error("[audit] entree non enregistree", entry.action, error);
  }
}

export const AUDIT_PAGE_SIZE = 30;

export interface AuditLogRow {
  id: string;
  createdAt: string;
  actorEmail: string | null;
  action: AuditAction;
  entityType: "product" | "order" | "user" | null;
  entityId: string | null;
  entityLabel: string | null;
  changes: AuditChanges;
  ip: string | null;
}

export async function getAuditLogs(options: {
  category?: AuditCategory;
  page: number;
}): Promise<{ entries: AuditLogRow[]; total: number; page: number; pageCount: number }> {
  const actions = actionsOf(options.category);
  const where = actions ? sql`WHERE action IN ${sql([...actions])}` : sql``;

  const [{ total }] = await sql<Array<{ total: number }>>`SELECT count(*)::int AS total FROM audit_logs ${where}`;
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page), pageCount);

  const rows = await sql<
    Array<{
      id: string;
      created_at: Date;
      actor_email: string | null;
      action: AuditAction;
      entity_type: AuditLogRow["entityType"];
      entity_id: string | null;
      entity_label: string | null;
      changes: AuditChanges;
      ip: string | null;
    }>
  >`
    SELECT id::text, created_at, actor_email, action, entity_type, entity_id, entity_label, changes, ip
    FROM audit_logs ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT ${AUDIT_PAGE_SIZE} OFFSET ${(page - 1) * AUDIT_PAGE_SIZE}
  `;

  return {
    total,
    page,
    pageCount,
    entries: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at.toISOString(),
      actorEmail: r.actor_email,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityLabel: r.entity_label,
      changes: r.changes ?? {},
      ip: r.ip,
    })),
  };
}
