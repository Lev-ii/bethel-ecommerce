import { describe, expect, it } from "vitest";
import { ReviewError, averageRating, defaultAuthorName, parseReviewInput } from "@/lib/shop/reviews";

function codeOf(run: () => unknown) {
  try {
    run();
    return "ok";
  } catch (error) {
    return error instanceof ReviewError ? error.code : String(error);
  }
}

describe("nom affiché par défaut", () => {
  it.each([
    ["Aminata Koné", "Aminata K."],
    ["  jean-marc   kouassi  yao ", "jean-marc Y."],
    ["Moussa", "Moussa"],
    ["", "Client"],
  ])("%j donne %j", (name, expected) => {
    expect(defaultAuthorName(name)).toBe(expected);
  });
});

describe("saisie d'un avis", () => {
  const ok = { rating: "4", body: "  Très bien,   solide.  ", authorName: " Koffi   Y. " };

  it("nettoie les espaces et convertit la note", () => {
    expect(parseReviewInput(ok)).toEqual({ rating: 4, body: "Très bien, solide.", authorName: "Koffi Y." });
  });

  it("garde les retours à la ligne", () => {
    expect(parseReviewInput({ ...ok, body: "Ligne une.\r\nLigne deux." }).body).toBe("Ligne une.\nLigne deux.");
  });

  it.each([
    [{ ...ok, rating: "0" }, "note"],
    [{ ...ok, rating: "4.5" }, "note"],
    [{ ...ok, rating: undefined }, "note"],
    [{ ...ok, body: "Court" }, "texte"],
    [{ ...ok, body: "x".repeat(1001) }, "texte"],
    [{ ...ok, authorName: "1" }, "nom"],
    [{ ...ok, authorName: "12345" }, "nom"],
  ])("refuse %j", (raw, code) => {
    expect(codeOf(() => parseReviewInput(raw))).toBe(code);
  });
});

describe("moyenne", () => {
  it("arrondit à une décimale, ou rien sans avis", () => {
    expect(averageRating([5, 4])).toBe(4.5);
    expect(averageRating([5, 4, 4])).toBe(4.3);
    expect(averageRating([])).toBeNull();
  });
});
