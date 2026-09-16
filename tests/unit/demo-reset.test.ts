import { describe, expect, it } from "vitest";
import { assertDemoResetAllowed, demoResetAllowed } from "@/lib/admin/demo-reset";

describe("garde-fou de la reinitialisation", () => {
  it("est ferme par defaut, sans variable", () => {
    expect(demoResetAllowed({})).toBe(false);
  });

  it.each(["false", "1", "TRUE", "yes", ""])("reste ferme pour ALLOW_DEMO_RESET=%s", (value) => {
    expect(demoResetAllowed({ ALLOW_DEMO_RESET: value })).toBe(false);
  });

  // Le cas qui compte : un serveur de production, ou un serveur local branche
  // sur la base de production, n'a pas l'autorisation.
  it("refuse en production meme avec la bonne confirmation", () => {
    expect(() => assertDemoResetAllowed("SUPPRIMER", { NODE_ENV: "production" })).toThrow(/désactivée/);
  });

  it("refuse en developpement sans autorisation explicite", () => {
    expect(() => assertDemoResetAllowed("SUPPRIMER", { NODE_ENV: "development" })).toThrow(/désactivée/);
  });

  it.each([null, "", "supprimer", "SUPPRIMER ", "oui"])(
    "exige la confirmation exacte, meme autorisee (%s)",
    (confirmation) => {
      expect(() => assertDemoResetAllowed(confirmation, { ALLOW_DEMO_RESET: "true" })).toThrow(/Confirmation/);
    }
  );

  it("autorise seulement avec la variable et la confirmation exacte", () => {
    expect(() => assertDemoResetAllowed("SUPPRIMER", { ALLOW_DEMO_RESET: "true" })).not.toThrow();
  });
});
