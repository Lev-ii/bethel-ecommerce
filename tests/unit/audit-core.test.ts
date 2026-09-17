import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  actionsOf,
  describeChange,
  diffFields,
} from "@/lib/admin/audit-core";

describe("vocabulaire du journal", () => {
  // Sans ce test, une action ajoutee au code sans migration passerait le
  // typecheck puis ferait echouer l'ecriture en production.
  it("correspond exactement a la contrainte CHECK de la migration", () => {
    // La contrainte en vigueur est celle de la derniere migration qui la definit.
    const dir = path.join(process.cwd(), "db", "migrations");
    const latest = fs
      .readdirSync(dir)
      .sort()
      .map((file) => fs.readFileSync(path.join(dir, file), "utf8"))
      .filter((sql) => sql.includes("audit_logs_action_check") || sql.includes("action       TEXT NOT NULL CHECK"))
      .at(-1)!;
    const start = latest.includes("ADD CONSTRAINT audit_logs_action_check")
      ? latest.indexOf("ADD CONSTRAINT audit_logs_action_check")
      : latest.indexOf("action       TEXT NOT NULL CHECK");
    const check = latest.slice(start, latest.indexOf("));", start));
    const allowed = [...check.matchAll(/'([a-z_.]+)'/g)].map((m) => m[1]).sort();
    expect(allowed).toEqual(Object.keys(AUDIT_ACTIONS).sort());
  });

  it("range chaque action dans une seule categorie, sans en oublier", () => {
    const listed = Object.values(AUDIT_CATEGORIES).flatMap((c) => [...c.actions]);
    expect([...listed].sort()).toEqual(Object.keys(AUDIT_ACTIONS).sort());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("filtre par categorie, ou pas du tout", () => {
    expect(actionsOf("commandes")).toEqual(["order.status_changed"]);
    expect(actionsOf(undefined)).toBeUndefined();
  });
});

describe("diffFields", () => {
  const before = { price: 24500, stock: 12, published: true, compareAtPrice: null, name: "Trépied" };

  it("ne garde que les champs modifies", () => {
    const after = { ...before, price: 26000, published: false };
    expect(diffFields(before, after, ["price", "stock", "published", "name"])).toEqual({
      price: { from: 24500, to: 26000 },
      published: { from: true, to: false },
    });
  });

  it("ne voit aucun changement quand rien ne bouge", () => {
    expect(diffFields(before, { ...before }, ["price", "stock", "published", "compareAtPrice"])).toEqual({});
  });

  it("confond vide, null et absent", () => {
    const after = { ...before, compareAtPrice: undefined as unknown as null };
    expect(diffFields(before, after, ["compareAtPrice"])).toEqual({});
  });

  it("compare les nombres par valeur, quel que soit leur type d'origine", () => {
    const fromDb = { ...before, price: "24500" as unknown as number };
    expect(diffFields(fromDb, before, ["price"])).toEqual({});
  });

  it("detecte l'apparition d'un prix barre", () => {
    expect(diffFields(before, { ...before, compareAtPrice: 29000 as unknown as null }, ["compareAtPrice"])).toEqual({
      compareAtPrice: { from: null, to: 29000 },
    });
  });
});

describe("describeChange", () => {
  it("formate un prix en francs CFA", () => {
    expect(describeChange("price", { from: 24500, to: 26000 })).toMatch(/^Prix : 24.500 F CFA → 26.000 F CFA$/);
  });

  it("traduit un booleen et un statut de commande", () => {
    expect(describeChange("published", { from: true, to: false })).toBe("En ligne : oui → non");
    expect(describeChange("status", { from: "recue", to: "livree" })).toBe("Statut : Reçue → Livrée");
  });

  it("affiche une seule valeur pour une creation ou une suppression", () => {
    expect(describeChange("stock", { to: 12 })).toBe("Stock : 12");
    expect(describeChange("stock", { from: 3 })).toBe("Stock : 3");
  });

  it("marque une valeur vide et abrege un texte long", () => {
    expect(describeChange("compareAtPrice", { from: null, to: 29000 })).toMatch(/^Prix barré : — → 29.000 F CFA$/);
    const long = describeChange("description", { to: "x".repeat(200) });
    expect(long.length).toBeLessThan(100);
    expect(long.endsWith("…")).toBe(true);
  });

  it("garde le nom brut d'un champ inconnu plutot que de le masquer", () => {
    expect(describeChange("champ_futur", { to: "valeur" })).toBe("champ_futur : valeur");
  });
});
