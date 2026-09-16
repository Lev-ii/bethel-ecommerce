import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORDER_PAGE_SIZE, parseOrderFilters } from "@/lib/admin/order-filters";
import { sql } from "@/lib/db/client";
import { searchOrders } from "@/lib/repository";

/**
 * Historique des commandes contre un vrai PostgreSQL.
 *
 * Les commandes de test sont datees de janvier 2001 et portent le prefixe
 * BTH-HIST- : chaque recherche est bornee a cette periode, ce qui les isole
 * des commandes de demonstration sans avoir a vider la base.
 */

const PREFIX = "BTH-HIST-";
const WINDOW = { du: "2001-01-01", au: "2001-01-31" };

async function purge() {
  await sql`DELETE FROM orders WHERE reference LIKE ${`${PREFIX}%`}`;
}

async function insert(o: {
  n: string;
  name: string;
  phone?: string;
  status: string;
  day: string;
  minute?: number;
}) {
  const createdAt = `${o.day}T10:${String(o.minute ?? 0).padStart(2, "0")}:00Z`;
  await sql`
    INSERT INTO orders (id, reference, customer_name, customer_phone, delivery_mode,
                        payment_method, total, status, created_at)
    VALUES (${`hist-${o.n}`}, ${PREFIX + o.n}, ${o.name}, ${o.phone ?? "+225 01 00 00 00"},
            'retrait', 'especes-retrait', 10000, ${o.status}, ${createdAt})
  `;
}

beforeAll(async () => {
  await purge();

  // 30 commandes livrees le 10 janvier, une par minute : de quoi remplir
  // deux pages et verifier l'ordre.
  for (let i = 0; i < 30; i += 1) {
    await insert({ n: `L${String(i).padStart(2, "0")}`, name: `Client ${i}`, status: "livree", day: "2001-01-10", minute: i });
  }
  await insert({ n: "A1", name: "Awa Kone", phone: "+225 07 11 22 33", status: "annulee", day: "2001-01-05" });
  await insert({ n: "R1", name: "Moussa Traore", status: "recue", day: "2001-01-20" });
  await insert({ n: "R2", name: "Remise 50% client", status: "recue", day: "2001-01-31", minute: 59 });
});

afterAll(async () => {
  await purge();
  await sql.end();
});

const search = (params: Record<string, string>) =>
  searchOrders(parseOrderFilters({ ...WINDOW, ...params }));

describe("pagination", () => {
  it("sert une premiere page pleine, triee de la plus recente a la plus ancienne", async () => {
    const result = await search({ etat: "livree" });
    expect(result.total).toBe(30);
    expect(result.pageCount).toBe(2);
    expect(result.orders).toHaveLength(ORDER_PAGE_SIZE);
    expect(result.orders[0].reference).toBe(`${PREFIX}L29`);
  });

  it("sert le reste sur la page suivante, sans doublon", async () => {
    const [p1, p2] = await Promise.all([search({ etat: "livree" }), search({ etat: "livree", page: "2" })]);
    expect(p2.orders).toHaveLength(30 - ORDER_PAGE_SIZE);
    const seen = new Set(p1.orders.map((o) => o.id));
    expect(p2.orders.some((o) => seen.has(o.id))).toBe(false);
  });

  it("ramene une page trop lointaine a la derniere page", async () => {
    const result = await search({ etat: "livree", page: "99" });
    expect(result.page).toBe(2);
    expect(result.orders.length).toBeGreaterThan(0);
  });
});

describe("filtres", () => {
  it("compte chaque statut sur la periode, independamment du statut choisi", async () => {
    const result = await search({ etat: "annulee" });
    expect(result.total).toBe(1);
    expect(result.countsByStatus).toEqual({ livree: 30, annulee: 1, recue: 2 });
  });

  it("inclut le dernier jour de la periode jusqu'a 23 h 59", async () => {
    const result = await search({ etat: "recue", du: "2001-01-31", au: "2001-01-31" });
    expect(result.orders.map((o) => o.reference)).toEqual([`${PREFIX}R2`]);
  });

  it("exclut ce qui sort de la periode", async () => {
    const result = await search({ du: "2001-01-11", au: "2001-01-19" });
    expect(result.total).toBe(0);
    expect(result.orders).toEqual([]);
  });

  it("trouve une commande par sa reference", async () => {
    const result = await search({ q: "hist-a1" });
    expect(result.orders.map((o) => o.reference)).toEqual([`${PREFIX}A1`]);
  });

  it("trouve un client par son nom, sans tenir compte de la casse", async () => {
    const result = await search({ q: "moussa" });
    expect(result.orders.map((o) => o.customerName)).toEqual(["Moussa Traore"]);
  });

  it("trouve un client par une partie de son telephone", async () => {
    const result = await search({ q: "11 22" });
    expect(result.orders.map((o) => o.reference)).toEqual([`${PREFIX}A1`]);
  });

  // Sans echappement, "%" correspondrait a toutes les commandes de la periode.
  it("traite le caractere % comme un caractere, pas comme un joker", async () => {
    const result = await search({ q: "%" });
    expect(result.orders.map((o) => o.reference)).toEqual([`${PREFIX}R2`]);
  });

  it("traite le caractere _ comme un caractere, pas comme un joker", async () => {
    const result = await search({ q: "_" });
    expect(result.total).toBe(0);
  });
});
