import { describe, expect, it } from "vitest";
import {
  bucketLabel,
  bucketStart,
  dashboardHref,
  parseDashboardParams,
} from "@/lib/admin/dashboard-range";

const TODAY = new Date("2026-09-16T14:30:00Z");

describe("parseDashboardParams", () => {
  it("prend 30 jours et la vue d'ensemble par defaut", () => {
    const r = parseDashboardParams({}, TODAY);
    expect([r.period, r.view, r.bucket, r.bucketCount]).toEqual(["30j", "ensemble", "day", 30]);
  });

  it("ignore une periode ou une vue inconnue", () => {
    const r = parseDashboardParams({ periode: "1an", vue: "graphique" }, TODAY);
    expect([r.period, r.view]).toEqual(["30j", "ensemble"]);
  });

  it("borne 7 jours aujourd'hui compris, precedee de 7 jours contigus", () => {
    const r = parseDashboardParams({ periode: "7j" }, TODAY);
    expect([r.from, r.to, r.previousFrom, r.previousTo]).toEqual([
      "2026-09-10",
      "2026-09-16",
      "2026-09-03",
      "2026-09-09",
    ]);
  });

  it("ignore l'heure : seul le jour compte", () => {
    const late = parseDashboardParams({ periode: "7j" }, new Date("2026-09-16T23:59:59Z"));
    const early = parseDashboardParams({ periode: "7j" }, new Date("2026-09-16T00:00:00Z"));
    expect(late).toEqual(early);
  });

  it("regroupe 90 jours en 13 tranches de 7 jours", () => {
    const r = parseDashboardParams({ periode: "90j" }, TODAY);
    expect([r.bucket, r.bucketCount, r.from]).toEqual(["week", 13, "2026-06-19"]);
  });

  it("prend 12 mois civils, le mois en cours compris, precedes des 12 d'avant", () => {
    const r = parseDashboardParams({ periode: "12m" }, TODAY);
    expect([r.from, r.to, r.previousFrom, r.previousTo, r.bucketCount]).toEqual([
      "2025-10-01",
      "2026-09-16",
      "2024-10-01",
      "2025-09-30",
      12,
    ]);
  });

  it("traverse correctement un changement d'annee et fevrier", () => {
    const r = parseDashboardParams({ periode: "30j" }, new Date("2024-03-01T08:00:00Z"));
    expect([r.from, r.previousTo]).toEqual(["2024-02-01", "2024-01-31"]);
  });
});

describe("bucketStart et bucketLabel", () => {
  it("avance d'un jour, d'une semaine ou d'un mois selon le decoupage", () => {
    expect(bucketStart({ bucket: "day", from: "2026-09-10" }, 3)).toBe("2026-09-13");
    expect(bucketStart({ bucket: "week", from: "2026-06-19" }, 2)).toBe("2026-07-03");
    expect(bucketStart({ bucket: "month", from: "2025-10-01" }, 3)).toBe("2026-01-01");
  });

  it("libelle un jour en JJ/MM et un mois en toutes lettres", () => {
    expect(bucketLabel("day", "2026-09-05")).toBe("05/09");
    expect(bucketLabel("month", "2026-02-01")).toBe("févr. 26");
  });
});

describe("dashboardHref", () => {
  const base = parseDashboardParams({}, TODAY);

  it("omet les valeurs par defaut", () => {
    expect(dashboardHref(base, {})).toBe("/admin");
  });

  it("garde la vue en changeant de periode", () => {
    const r = parseDashboardParams({ vue: "produits" }, TODAY);
    expect(dashboardHref(r, { period: "7j" })).toBe("/admin?periode=7j&vue=produits");
  });
});
