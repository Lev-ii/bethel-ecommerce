import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/auth/redirect";

/**
 * Parametre "suite" de la connexion : seul un chemin interne passe.
 * Chaque forme refusee ici est lue par un navigateur comme une autre origine.
 */
describe("safeRedirectPath", () => {
  it.each(["/admin", "/compte", "/admin/produits?page=2", "/produit/micro-rode#avis", "/"])(
    "accepte le chemin interne %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe(value);
    }
  );

  it.each([
    "https://evil.example",
    "http://evil.example/admin",
    "//evil.example",
    "//evil.example/admin",
    "/\\evil.example",
    "\\\\evil.example",
    "\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "evil.example",
    "admin",
    "",
    " /admin",
    `/${"a".repeat(600)}`,
  ])("refuse %j", (value) => {
    expect(safeRedirectPath(value)).toBeNull();
  });

  it("garde tel quel un chemin encode, qui reste interne", () => {
    // "/%2F%2Fevil.example" designe un chemin de notre site, pas un autre hote.
    expect(safeRedirectPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
    expect(safeRedirectPath("/%5Cevil.example")).toBe("/%5Cevil.example");
  });

  it("ignore ce qui n'est pas une chaine", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath(42)).toBeNull();
  });
});
