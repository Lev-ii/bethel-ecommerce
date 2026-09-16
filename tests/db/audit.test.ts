import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_PAGE_SIZE, getAuditLogs, recordAudit } from "@/lib/admin/audit";
import { sql } from "@/lib/db/client";

/**
 * Journal d'audit contre un vrai PostgreSQL.
 *
 * Ces tests vident la table audit_logs : ils refusent de s'executer ailleurs
 * que sur une base locale.
 */

const host = new URL(process.env.DATABASE_URL ?? "postgresql://x").hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error(`Tests du journal refuses sur une base non locale (${host}) : ils videntt audit_logs.`);
}

async function purge() {
  await sql.begin(async (tx) => {
    await tx`SET LOCAL bethel.audit_purge = 'on'`;
    await tx`DELETE FROM audit_logs`;
  });
}

const admin = { id: "admin-test", email: "admin@bethel.test" };

beforeAll(purge);
afterAll(async () => {
  await purge();
  await sql.end();
});

describe("ecriture", () => {
  it("inscrit une entree complete, changements compris", async () => {
    await recordAudit(sql, {
      action: "product.updated",
      actor: admin,
      entityType: "product",
      entityId: "p-001",
      entityLabel: "Trépied",
      changes: { price: { from: 24500, to: 26000 } },
    });
    const { entries } = await getAuditLogs({ page: 1 });
    expect(entries[0]).toMatchObject({
      actorEmail: "admin@bethel.test",
      action: "product.updated",
      entityType: "product",
      entityId: "p-001",
      entityLabel: "Trépied",
      changes: { price: { from: 24500, to: 26000 } },
      ip: null,
    });
  });

  it("refuse une action absente du vocabulaire", async () => {
    await expect(
      recordAudit(sql, { action: "product.renamed" as never, actor: admin })
    ).rejects.toThrow(/audit_logs_action_check|violates check constraint/);
  });

  it("s'annule avec la transaction du changement qu'elle decrit", async () => {
    const before = (await getAuditLogs({ page: 1 })).total;
    await expect(
      sql.begin(async (tx) => {
        await recordAudit(tx as unknown as typeof sql, { action: "demo.reset", actor: admin });
        throw new Error("le changement echoue");
      })
    ).rejects.toThrow("le changement echoue");
    expect((await getAuditLogs({ page: 1 })).total).toBe(before);
  });
});

describe("ajout seul", () => {
  it("refuse la modification d'une entree", async () => {
    await expect(sql`UPDATE audit_logs SET actor_email = 'pirate@x.test'`).rejects.toThrow(/ajout seul/);
  });

  it("refuse la suppression d'une entree", async () => {
    await expect(sql`DELETE FROM audit_logs`).rejects.toThrow(/ajout seul/);
  });

  it("refuse le vidage de la table", async () => {
    await expect(sql`TRUNCATE audit_logs`).rejects.toThrow(/ajout seul/);
  });

  it("n'autorise une purge que declaree explicitement, dans une transaction", async () => {
    // Hors transaction, SET LOCAL ne dure pas : la suppression suivante est refusee.
    await sql`SET LOCAL bethel.audit_purge = 'on'`.catch(() => {});
    await expect(sql`DELETE FROM audit_logs`).rejects.toThrow(/ajout seul/);
  });
});

describe("lecture", () => {
  beforeAll(async () => {
    await purge();
    for (let i = 0; i < AUDIT_PAGE_SIZE + 5; i += 1) {
      await recordAudit(sql, { action: "product.stock_adjusted", actor: admin, entityLabel: `Produit ${i}` });
    }
    await recordAudit(sql, { action: "auth.admin_login_failed", actorEmail: "admin@bethel.test" });
    await recordAudit(sql, { action: "order.status_changed", actor: admin, entityLabel: "BTH-2609-TEST" });
  });

  it("pagine du plus recent au plus ancien", async () => {
    const p1 = await getAuditLogs({ page: 1 });
    expect(p1.total).toBe(AUDIT_PAGE_SIZE + 7);
    expect(p1.pageCount).toBe(2);
    expect(p1.entries).toHaveLength(AUDIT_PAGE_SIZE);
    expect(p1.entries[0].action).toBe("order.status_changed");
    const p2 = await getAuditLogs({ page: 2 });
    expect(p2.entries).toHaveLength(7);
    expect(p2.entries.some((e) => p1.entries.some((f) => f.id === e.id))).toBe(false);
  });

  it("filtre par categorie", async () => {
    const connexions = await getAuditLogs({ category: "connexions", page: 1 });
    expect(connexions.entries.map((e) => e.action)).toEqual(["auth.admin_login_failed"]);
    const commandes = await getAuditLogs({ category: "commandes", page: 1 });
    expect(commandes.total).toBe(1);
  });

  it("ramene une page trop lointaine a la derniere", async () => {
    expect((await getAuditLogs({ page: 999 })).page).toBe(2);
  });
});
