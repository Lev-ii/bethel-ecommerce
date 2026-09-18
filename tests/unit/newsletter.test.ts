import { describe, expect, it } from "vitest";
import { NewsletterError, csvCell, normalizeEmail, unsubscribeToken, unsubscribeTokenIsValid } from "@/lib/shop/newsletter";

const SECRET = "secret-de-test-suffisamment-long";

function codeOf(run: () => unknown) {
  try {
    run();
    return "ok";
  } catch (error) {
    return error instanceof NewsletterError ? error.code : String(error);
  }
}

describe("adresse email", () => {
  it("nettoie espaces et majuscules", () => {
    expect(normalizeEmail("  Awa.Kone@Exemple.CI ")).toBe("awa.kone@exemple.ci");
  });
  it.each(["", "awa", "awa@", "@exemple.ci", "awa@exemple", "a wa@exemple.ci", `${"a".repeat(250)}@x.ci`])("refuse %j", (raw) => {
    expect(codeOf(() => normalizeEmail(raw))).toBe("email");
  });
});

describe("lien de désinscription", () => {
  it("n'est valable que pour son adresse, quelle que soit la casse", () => {
    const token = unsubscribeToken("awa@exemple.ci", SECRET);
    expect(unsubscribeTokenIsValid("AWA@exemple.ci", token, SECRET)).toBe(true);
    expect(unsubscribeTokenIsValid("autre@exemple.ci", token, SECRET)).toBe(false);
    expect(unsubscribeTokenIsValid("awa@exemple.ci", token, "un-autre-secret-assez-long")).toBe(false);
    expect(unsubscribeTokenIsValid("awa@exemple.ci", undefined, SECRET)).toBe(false);
    expect(unsubscribeTokenIsValid("awa@exemple.ci", "abc", SECRET)).toBe(false);
  });
});

describe("export CSV", () => {
  it("laisse une valeur simple telle quelle", () => {
    expect(csvCell("awa@exemple.ci")).toBe("awa@exemple.ci");
  });
  it("neutralise une formule de tableur", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+225")).toBe("'+225");
    expect(csvCell("@SUM(1)")).toBe("'@SUM(1)");
  });
  it("protège séparateurs et guillemets", () => {
    expect(csvCell('a;b"c')).toBe('"a;b""c"');
  });
});
