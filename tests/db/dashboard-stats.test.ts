import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bucketStart, parseDashboardParams } from "@/lib/admin/dashboard-range";
import { sql } from "@/lib/db/client";
import { getDashboardStats } from "@/lib/repository";

/**
 * Agregations du tableau de bord contre un vrai PostgreSQL.
 *
 * Toutes les commandes de test sont datees de 2003 a 2005 et portent le
 * prefixe BTH-DASH- : les periodes testees ne contiennent qu'elles.
 */

const PREFIX = "BTH-DASH-";
let productA = "";
let productB = "";
let n = 0;

async function order(at: string, status: string, total: number, lines: Array<[string, number, number]> = []) {
  n += 1;
  const id = `dash-${n}`;
  await sql`
    INSERT INTO orders (id, reference, customer_name, customer_phone, delivery_mode,
                        payment_method, total, status, created_at)
    VALUES (${id}, ${PREFIX + n}, 'Client test', '+225 01 00 00 00', 'retrait',
            'especes-retrait', ${total}, ${status}, ${at})
  `;
  for (const [productId, quantity, unitPrice] of lines) {
    await sql`
      INSERT INTO order_lines (order_id, product_id, name, unit_price, quantity)
      VALUES (${id}, ${productId}, ${productId === productA ? "Trépied A" : "Micro B"}, ${unitPrice}, ${quantity})
    `;
  }
}

async function purge() {
  await sql`DELETE FROM orders WHERE reference LIKE ${`${PREFIX}%`}`;
}

beforeAll(async () => {
  await purge();
  const products = await sql<Array<{ id: string }>>`SELECT id FROM products ORDER BY id LIMIT 2`;
  [productA, productB] = products.map((p) => p.id);

  // --- Periode "7j" jusqu'au 10/03/2005 : du 04/03 au 10/03, precedente du 25/02 au 03/03.
  await order("2005-03-04T08:00:00Z", "livree", 10000, [[productA, 2, 5000]]);
  await order("2005-03-10T23:30:00Z", "recue", 30000, [[productB, 1, 30000]]);
  await order("2005-03-10T12:00:00Z", "annulee", 99999, [[productA, 9, 11111]]);
  await order("2005-03-06T09:00:00Z", "attente_paiement", 50000, [[productB, 5, 10000]]);
  await order("2005-03-03T23:59:00Z", "livree", 7000, [[productB, 1, 7000]]);
  await order("2005-02-25T00:00:00Z", "livree", 3000);
  await order("2005-02-24T23:59:00Z", "livree", 1_000_000);
  await order("2005-03-11T00:00:00Z", "livree", 1_000_000);

  // --- Periode "12m" jusqu'au 15/12/2004 : janvier a decembre 2004, precedente 2003.
  await order("2004-01-31T10:00:00Z", "livree", 1000);
  await order("2004-12-15T22:00:00Z", "livree", 2000);
  await order("2003-12-31T23:00:00Z", "livree", 400);
  await order("2003-01-01T00:00:00Z", "livree", 300);
});

afterAll(async () => {
  await purge();
  await sql.end();
});

describe("periode de 7 jours, par jour", () => {
  const range = parseDashboardParams({ periode: "7j" }, new Date("2005-03-10T15:00:00Z"));

  it("produit un point par jour, zeros compris", async () => {
    const stats = await getDashboardStats(range);
    expect(stats.current.map((p) => p.revenue)).toEqual([10000, 0, 0, 0, 0, 0, 30000]);
  });

  it("compte une commande passee a 23 h 30 le dernier jour", async () => {
    const stats = await getDashboardStats(range);
    expect(stats.current[6]).toEqual({ revenue: 30000, orders: 1 });
  });

  it("exclut du chiffre d'affaires les commandes annulees ou non payees", async () => {
    const stats = await getDashboardStats(range);
    expect(stats.totals.current).toEqual({ revenue: 40000, orders: 2 });
  });

  it("aligne la periode precedente jour pour jour, bornes comprises", async () => {
    const stats = await getDashboardStats(range);
    expect(stats.previous.map((p) => p.revenue)).toEqual([3000, 0, 0, 0, 0, 0, 7000]);
    expect(stats.totals.previous).toEqual({ revenue: 10000, orders: 2 });
  });

  it("repartit toutes les commandes par statut, annulees et en attente comprises", async () => {
    const stats = await getDashboardStats(range);
    expect(stats.statuses).toEqual([
      { status: "attente_paiement", count: 1 },
      { status: "recue", count: 1 },
      { status: "preparee", count: 0 },
      { status: "expediee", count: 0 },
      { status: "livree", count: 1 },
      { status: "annulee", count: 1 },
    ]);
  });

  it("classe les produits vendus par quantite, sans les commandes annulees ou non payees", async () => {
    const stats = await getDashboardStats(range);
    expect(stats.topProducts).toEqual([
      { productId: productA, name: "Trépied A", quantity: 2, revenue: 10000 },
      { productId: productB, name: "Micro B", quantity: 1, revenue: 30000 },
    ]);
  });
});

describe("periode de 90 jours, par tranche de 7 jours", () => {
  const range = parseDashboardParams({ periode: "90j" }, new Date("2005-09-30T12:00:00Z"));
  const at = (dayOffset: number, hour = "10") =>
    `${bucketStart({ bucket: "day", from: range.from }, dayOffset)}T${hour}:00:00Z`;

  beforeAll(async () => {
    await order(at(6, "23"), "livree", 100); // derniere minute de la premiere tranche
    await order(at(7), "livree", 200); // premier jour de la deuxieme
    await order(at(89), "livree", 500); // dernier jour de la periode
  });

  it("regroupe par 7 jours et place les bornes dans la bonne tranche", async () => {
    const stats = await getDashboardStats(range);
    expect(stats.current).toHaveLength(13);
    expect(stats.current[0].revenue).toBe(100);
    expect(stats.current[1].revenue).toBe(200);
    expect(stats.current[12].revenue).toBe(500);
  });
});

describe("periode de 12 mois, par mois civil", () => {
  const range = parseDashboardParams({ periode: "12m" }, new Date("2004-12-15T12:00:00Z"));

  it("place chaque commande dans son mois, periode precedente comprise", async () => {
    const stats = await getDashboardStats(range);
    expect(stats.current.map((p) => p.revenue)).toEqual([1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2000]);
    expect(stats.previous.map((p) => p.revenue)).toEqual([300, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 400]);
  });
});
