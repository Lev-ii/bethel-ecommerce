import { describe, expect, it } from "vitest";
import {
  escapeLike,
  hasActiveFilters,
  ordersHref,
  parseOrderFilters,
} from "@/lib/admin/order-filters";

describe("parseOrderFilters", () => {
  it("renvoie la premiere page sans filtre pour une URL vide", () => {
    expect(parseOrderFilters({})).toEqual({
      status: undefined,
      from: undefined,
      to: undefined,
      query: undefined,
      page: 1,
    });
  });

  it("lit un statut connu, y compris les commandes annulees", () => {
    expect(parseOrderFilters({ etat: "annulee" }).status).toBe("annulee");
    expect(parseOrderFilters({ etat: "attente_paiement" }).status).toBe("attente_paiement");
  });

  it("ignore un statut inconnu plutot que de le transmettre a la requete", () => {
    expect(parseOrderFilters({ etat: "payee' OR 1=1" }).status).toBeUndefined();
  });

  it("garde des dates valides", () => {
    const f = parseOrderFilters({ du: "2026-09-01", au: "2026-09-15" });
    expect([f.from, f.to]).toEqual(["2026-09-01", "2026-09-15"]);
  });

  it.each(["2026-02-31", "2026-13-01", "15/09/2026", "demain", ""])(
    "rejette une date qui n'existe pas ou mal formee : %s",
    (value) => {
      expect(parseOrderFilters({ du: value }).from).toBeUndefined();
    }
  );

  it("remet dans l'ordre une periode saisie a l'envers", () => {
    const f = parseOrderFilters({ du: "2026-09-30", au: "2026-09-01" });
    expect([f.from, f.to]).toEqual(["2026-09-01", "2026-09-30"]);
  });

  it("nettoie la recherche et ignore une recherche vide", () => {
    expect(parseOrderFilters({ q: "  BTH-2609  " }).query).toBe("BTH-2609");
    expect(parseOrderFilters({ q: "   " }).query).toBeUndefined();
  });

  it("tronque une recherche demesuree", () => {
    expect(parseOrderFilters({ q: "x".repeat(500) }).query).toHaveLength(80);
  });

  it.each([
    ["3", 3],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["abc", 1],
    ["999999999", 10_000],
  ])("borne le numero de page %s a %i", (value, expected) => {
    expect(parseOrderFilters({ page: value }).page).toBe(expected);
  });

  it("prend la premiere valeur d'un parametre repete", () => {
    expect(parseOrderFilters({ etat: ["livree", "annulee"] }).status).toBe("livree");
  });
});

describe("ordersHref", () => {
  const base = parseOrderFilters({ etat: "livree", du: "2026-09-01", q: "Awa", page: "4" });

  it("renvoie l'adresse nue sans filtre", () => {
    expect(ordersHref(parseOrderFilters({}))).toBe("/admin/commandes");
  });

  it("ramene a la premiere page quand un critere change", () => {
    expect(ordersHref(base, { status: "annulee" })).toBe(
      "/admin/commandes?etat=annulee&du=2026-09-01&q=Awa"
    );
  });

  it("conserve les autres criteres en changeant de page", () => {
    expect(ordersHref(base, { page: 5 })).toBe(
      "/admin/commandes?etat=livree&du=2026-09-01&q=Awa&page=5"
    );
  });

  it("retire un critere mis a undefined", () => {
    expect(ordersHref(base, { status: undefined })).toBe("/admin/commandes?du=2026-09-01&q=Awa");
  });

  it("encode la recherche", () => {
    expect(ordersHref(parseOrderFilters({ q: "Koné & fils" }))).toBe(
      "/admin/commandes?q=Kon%C3%A9+%26+fils"
    );
  });
});

describe("hasActiveFilters", () => {
  it("ne compte pas le numero de page comme un filtre", () => {
    expect(hasActiveFilters(parseOrderFilters({ page: "3" }))).toBe(false);
  });

  it("detecte n'importe quel critere", () => {
    expect(hasActiveFilters(parseOrderFilters({ q: "Awa" }))).toBe(true);
  });
});

describe("escapeLike", () => {
  it.each([
    ["50%", "50\\%"],
    ["a_b", "a\\_b"],
    ["c:\\x", "c:\\\\x"],
    ["BTH-2609", "BTH-2609"],
  ])("echappe %s", (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});
