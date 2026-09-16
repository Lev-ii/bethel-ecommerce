import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Changement de statut d'une commande depuis l'administration, contre un vrai
 * PostgreSQL : regle d'avancement, correction silencieuse, trace d'audit.
 *
 * Les commandes de test portent le prefixe BTH-STAT- et sont effacees a la
 * fin, avec leurs entrees du journal.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/auth/current", () => ({
  assertAdmin: vi.fn(async () => ({ id: "admin-statut", email: "admin@bethel.test", name: "Admin", role: "ADMIN" })),
}));
vi.mock("@/lib/shop/notifications", () => ({ notifyCustomerLater: vi.fn() }));

const { sql } = await import("@/lib/db/client");
const { setOrderStatus } = await import("@/lib/admin/actions");
const { notifyCustomerLater } = await import("@/lib/shop/notifications");

const host = new URL(process.env.DATABASE_URL ?? "postgresql://x").hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error(`Tests des statuts refusés sur une base non locale (${host}).`);
}

const PREFIX = "BTH-STAT-";
let n = 0;

async function createOrder(status: string, paymentMethod = "especes-retrait", paid = false) {
  n += 1;
  const id = `stat-${n}`;
  await sql`
    INSERT INTO orders (id, reference, customer_name, customer_phone, delivery_mode,
                        payment_method, total, status, paid_at)
    VALUES (${id}, ${PREFIX + n}, 'Client statut', '+225 01 00 00 00', 'retrait',
            ${paymentMethod}, 10000, ${status}, ${paid ? sql`now()` : null})
  `;
  return id;
}

async function change(id: string, status: string) {
  const form = new FormData();
  form.set("id", id);
  form.set("status", status);
  await setOrderStatus(form);
}

async function orderOf(id: string) {
  const [row] = await sql<Array<{ status: string; paid_at: Date | null }>>`SELECT status, paid_at FROM orders WHERE id = ${id}`;
  return row;
}

async function auditOf(id: string) {
  return sql<Array<{ changes: Record<string, { from?: unknown; to: unknown }> }>>`
    SELECT changes FROM audit_logs WHERE entity_id = ${id} AND action = 'order.status_changed' ORDER BY id
  `;
}

async function purge() {
  await sql.begin(async (tx) => {
    await tx`SET LOCAL bethel.audit_purge = 'on'`;
    await tx`DELETE FROM audit_logs WHERE entity_id LIKE 'stat-%'`;
  });
  await sql`DELETE FROM orders WHERE reference LIKE ${`${PREFIX}%`}`;
}

beforeAll(purge);
afterAll(purge);
beforeEach(() => {
  vi.mocked(notifyCustomerLater).mockClear();
});

describe("changement de statut par l'administration", () => {
  it("avance la commande, prévient le client et trace le changement", async () => {
    const id = await createOrder("recue");

    await change(id, "expediee");

    expect((await orderOf(id)).status).toBe("expediee");
    expect(notifyCustomerLater).toHaveBeenCalledWith(`${PREFIX}${n}`, "expediee");
    const [entry] = await auditOf(id);
    expect(entry.changes.status).toEqual({ from: "recue", to: "expediee" });
    expect(entry.changes.correction).toBeUndefined();
  });

  it("corrige d'une étape sans prévenir le client, correction inscrite au journal", async () => {
    const id = await createOrder("expediee");

    await change(id, "preparee");

    expect((await orderOf(id)).status).toBe("preparee");
    expect(notifyCustomerLater).not.toHaveBeenCalled();
    const [entry] = await auditOf(id);
    expect(entry.changes.status).toEqual({ from: "expediee", to: "preparee" });
    expect(entry.changes.correction).toEqual({ to: "retour d'une étape, client non prévenu" });
  });

  it.each([
    ["livree", "recue"],
    ["livree", "expediee"],
    ["expediee", "recue"],
    ["annulee", "recue"],
  ])("refuse de passer de %s à %s, sans message ni trace", async (from, to) => {
    const id = await createOrder(from, "wave", true);

    await change(id, to);

    expect((await orderOf(id)).status).toBe(from);
    expect(notifyCustomerLater).not.toHaveBeenCalled();
    expect(await auditOf(id)).toHaveLength(0);
  });

  it("encaisse un paiement à la réception au passage à livrée, et le garde définitif", async () => {
    const id = await createOrder("expediee", "paiement-livraison");

    await change(id, "livree");
    const delivered = await orderOf(id);
    await change(id, "expediee");

    expect(delivered.paid_at).not.toBeNull();
    expect(await orderOf(id)).toEqual(delivered);
  });

  it("refuse un statut hors du parcours", async () => {
    const id = await createOrder("recue");

    await change(id, "annulee");
    await change(id, "attente_paiement");

    expect((await orderOf(id)).status).toBe("recue");
    expect(await auditOf(id)).toHaveLength(0);
  });
});
