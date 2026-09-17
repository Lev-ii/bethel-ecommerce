import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Temps de reponse des requetes du site sous un volume realiste : 200 000
 * commandes, 400 000 lignes, 2 000 produits, 1 million de vues (voir
 * preparer.mjs). Lance par "npm run test:volume".
 *
 * Chaque requete est executee une fois a vide, puis mesuree cinq fois : on
 * retient la mediane. Les seuils sont larges : ils signalent une requete qui
 * a perdu son index, pas quelques millisecondes de variation.
 */

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const url = new URL(process.env.DATABASE_URL ?? "postgresql://x");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.includes("volume")) {
  throw new Error("Mesures de volume : base locale bethel_volume attendue (npm run test:volume).");
}

const { sql } = await import("@/lib/db/client");
const repo = await import("@/lib/repository");
const { getAuditLogs } = await import("@/lib/admin/audit");
const { parseOrderFilters } = await import("@/lib/admin/order-filters");
const { parseDashboardParams } = await import("@/lib/admin/dashboard-range");

vi.setConfig({ testTimeout: 60_000 });

const results: Array<{ label: string; ms: number; limit: number }> = [];

async function measure(label: string, limit: number, run: () => Promise<unknown>) {
  await run();
  const times: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const started = performance.now();
    await run();
    times.push(performance.now() - started);
  }
  const ms = times.sort((a, b) => a - b)[2];
  results.push({ label, ms, limit });
  return ms;
}

afterAll(async () => {
  console.log("\n" + results.map((r) => `${r.ms.toFixed(1).padStart(8)} ms  (seuil ${r.limit})  ${r.label}`).join("\n"));
  await sql.end();
});

const today = new Date();
const orders = (params: Record<string, string>) => repo.searchOrders(parseOrderFilters(params));

describe("administration : commandes", () => {
  it.each([
    ["première page, toutes commandes", {}],
    ["page 4 000 (fin de l'historique)", { page: "4000" }],
    ["filtre de statut", { etat: "recue" }],
    ["période d'un mois", { du: "2026-01-01", au: "2026-01-31" }],
    ["recherche par référence", { q: "BTH-VOL-123456" }],
    ["recherche par nom de client", { q: "Client 1234" }],
    ["recherche par téléphone", { q: "00001234" }],
  ])("%s", async (label, params) => {
    const ms = await measure(`commandes : ${label}`, 300, () => orders(params));
    expect(ms).toBeLessThan(300);
  });

  it("commandes à traiter et nouvelles commandes", async () => {
    expect(await measure("compteur à traiter", 100, () => repo.countOrdersToProcess())).toBeLessThan(100);
    expect(await measure("nouvelles commandes (pop-up)", 100, () => repo.getUnseenOrders())).toBeLessThan(100);
    expect(await measure("dernières commandes", 100, () => repo.getRecentOrders(8))).toBeLessThan(100);
  });
});

describe("administration : tableau de bord", () => {
  it.each(["7j", "30j", "90j", "12m"])("période %s", async (periode) => {
    const range = parseDashboardParams({ periode }, today);
    const ms = await measure(`tableau de bord : ${periode}`, 1000, () => repo.getDashboardStats(range));
    expect(ms).toBeLessThan(1000);
  });

  it("journal d'audit, première page", async () => {
    expect(await measure("journal d'audit", 100, () => getAuditLogs({ page: 1 }))).toBeLessThan(100);
  });
});

describe("boutique et administration : produits", () => {
  it("catalogue complet, recherche, catégorie", async () => {
    expect(await measure("catalogue : tout", 300, () => repo.getProducts({}))).toBeLessThan(300);
    expect(await measure("catalogue : recherche", 300, () => repo.getProducts({ search: "Godox" }))).toBeLessThan(300);
    expect(await measure("catalogue : en stock, prix croissant", 300, () => repo.getProducts({ inStockOnly: true, sort: "prix-croissant" }))).toBeLessThan(300);
    expect(await measure("admin : tous les produits", 300, () => repo.getAllProducts())).toBeLessThan(300);
  });

  it("fiche produit et compte client", async () => {
    expect(await measure("fiche produit", 50, () => repo.getProductBySlug("produit-volume-1500"))).toBeLessThan(50);
    expect(await measure("commande par référence", 50, () => repo.getOrderByReference("BTH-VOL-150000"))).toBeLessThan(50);
  });
});
