import { describe, expect, it } from "vitest";
import {
  countdownTo,
  formatCountdown,
  formatPromotionEnd,
  parsePromotion,
  parseShopDateTime,
  toShopDateTimeInput,
} from "@/lib/shop/promotion";

/** Promotions datees : saisie de l'administration et compte a rebours. */

const NOW = Date.parse("2026-09-20T10:00:00Z");
const raw = (price: string, startsAt: string, endsAt: string) => ({ price, startsAt, endsAt });

describe("saisie d'une promotion", () => {
  it("tous les champs vides : pas de promotion", () => {
    expect(parsePromotion(raw("", "", ""), 50_000, NOW)).toEqual({ promotion: null });
  });

  it("prix et fin : promotion immediate, a l'heure d'Abidjan (UTC)", () => {
    expect(parsePromotion(raw("39999.6", "", "2026-09-25T18:00"), 50_000, NOW)).toEqual({
      promotion: { price: 40_000, startsAt: null, endsAt: "2026-09-25T18:00:00.000Z" },
    });
  });

  it("debut programme", () => {
    const result = parsePromotion(raw("40000", "2026-09-22T08:00", "2026-09-25T18:00"), 50_000, NOW);
    expect(result).toEqual({
      promotion: { price: 40_000, startsAt: "2026-09-22T08:00:00.000Z", endsAt: "2026-09-25T18:00:00.000Z" },
    });
  });

  it.each([
    ["prix promo egal au prix de vente", raw("50000", "", "2026-09-25T18:00"), "promo-prix"],
    ["prix promo superieur", raw("60000", "", "2026-09-25T18:00"), "promo-prix"],
    ["prix promo nul", raw("0", "", "2026-09-25T18:00"), "promo-prix"],
    ["prix promo manquant", raw("", "", "2026-09-25T18:00"), "promo-prix"],
    ["fin manquante", raw("40000", "", ""), "promo-fin"],
    ["fin deja passee", raw("40000", "", "2026-09-19T18:00"), "promo-fin"],
    ["fin illisible", raw("40000", "", "25/09/2026"), "promo-fin"],
    ["debut apres la fin", raw("40000", "2026-09-26T08:00", "2026-09-25T18:00"), "promo-debut"],
    ["debut egal a la fin", raw("40000", "2026-09-25T18:00", "2026-09-25T18:00"), "promo-debut"],
  ])("refuse : %s", (_, input, error) => {
    expect(parsePromotion(input, 50_000, NOW)).toEqual({ error });
  });
});

describe("dates de la boutique", () => {
  it("aller-retour entre champ de saisie et date ISO", () => {
    const iso = parseShopDateTime("2026-09-25T18:00")!;
    expect(toShopDateTimeInput(iso)).toBe("2026-09-25T18:00");
    expect(parseShopDateTime("2026-09-25")).toBeNull();
  });

  it("annonce la fin a l'heure d'Abidjan", () => {
    expect(formatPromotionEnd("2026-09-25T18:00:00.000Z")).toBe("jusqu'au 25/09 à 18:00");
  });
});

describe("compte a rebours", () => {
  it("decoupe le temps restant", () => {
    const end = new Date(NOW + ((2 * 24 + 3) * 3600 + 12 * 60 + 5) * 1000).toISOString();
    const left = countdownTo(end, NOW)!;
    expect(left).toEqual({ days: 2, hours: 3, minutes: 12, seconds: 5 });
    expect(formatCountdown(left)).toBe("2 j 03 h 12 min 05 s");
  });

  it("sous un jour, sans les jours", () => {
    expect(formatCountdown({ days: 0, hours: 0, minutes: 4, seconds: 9 })).toBe("00 h 04 min 09 s");
  });

  it("termine a zero et apres", () => {
    const end = new Date(NOW).toISOString();
    expect(countdownTo(end, NOW)).toBeNull();
    expect(countdownTo(end, NOW + 1000)).toBeNull();
  });
});
