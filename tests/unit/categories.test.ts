import { describe, expect, it } from "vitest";
import { CategoryError, checkDeletion, parseCategoryInput } from "@/lib/admin/categories";
import { firstFreeSlug, slugify } from "@/lib/slug";

function codeOf(run: () => unknown) {
  try {
    run();
    return "ok";
  } catch (error) {
    return error instanceof CategoryError ? error.code : String(error);
  }
}

describe("adresse d'une catégorie", () => {
  it.each([
    ["Éclairage", "eclairage"],
    ["Trépieds & stabilisation", "trepieds-stabilisation"],
    ["  Micros  (sans fil) ", "micros-sans-fil"],
    ["Ça coûte 5 000 F !", "ca-coute-5-000-f"],
  ])("%j donne %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("ne finit jamais par un tiret après troncature", () => {
    expect(slugify(`${"a".repeat(59)} b`)).toBe("a".repeat(59));
  });

  it("choisit la première variante libre", () => {
    expect(firstFreeSlug("son", [])).toBe("son");
    expect(firstFreeSlug("son", ["son", "son-2"])).toBe("son-3");
  });
});

describe("saisie d'une catégorie", () => {
  it("nettoie les espaces et accepte une accroche vide", () => {
    expect(parseCategoryInput({ name: "  Drones   FPV ", tagline: undefined })).toEqual({ name: "Drones FPV", tagline: "" });
  });

  it.each([[""], ["x"], ["!!"], ["a".repeat(61)]])("refuse le nom %j", (name) => {
    expect(codeOf(() => parseCategoryInput({ name }))).toBe("nom");
  });

  it("refuse une accroche trop longue", () => {
    expect(codeOf(() => parseCategoryInput({ name: "Drones", tagline: "x".repeat(121) }))).toBe("accroche");
  });
});

describe("suppression", () => {
  const existing = ["a", "b", "c"];

  it.each([
    [{ selected: [], productCount: 0 }, "selection"],
    [{ selected: ["z"], productCount: 0 }, "selection"],
    [{ selected: ["a", "b", "c"], productCount: 0 }, "derniere"],
    [{ selected: ["a"], productCount: 3 }, "destination"],
    [{ selected: ["a"], productCount: 3, destination: "z" }, "destination"],
    [{ selected: ["a", "b"], productCount: 3, destination: "b" }, "destination-supprimee"],
    [{ selected: ["a"], productCount: 0 }, "ok"],
    [{ selected: ["a", "a", "b"], productCount: 2, destination: "c" }, "ok"],
  ])("%j -> %s", (options, expected) => {
    expect(codeOf(() => checkDeletion({ existing, ...options }))).toBe(expected);
  });
});
