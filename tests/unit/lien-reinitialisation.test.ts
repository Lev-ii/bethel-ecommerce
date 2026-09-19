import { describe, expect, it } from "vitest";
import { resetLinkMessage, resetLinkUrl, whatsappNumber, whatsappShareUrl } from "@/lib/admin/reset-link";

describe("lien de réinitialisation remis sur WhatsApp", () => {
  it("construit le lien sur l'adresse publique du site", () => {
    expect(resetLinkUrl("https://bethel.ci/", "abc")).toBe("https://bethel.ci/mot-de-passe-oublie/abc");
    expect(resetLinkUrl("https://bethel.ci", "abc")).toBe("https://bethel.ci/mot-de-passe-oublie/abc");
  });

  it.each([
    ["07 78 84 84 74", "2250778848474"],
    ["0778848474", "2250778848474"],
    ["+225 07 78 84 84 74", "2250778848474"],
    ["00225 07 78 84 84 74", "2250778848474"],
    ["+33 6 12 34 56 78", "33612345678"],
  ])("met %j au format wa.me", (input, expected) => {
    expect(whatsappNumber(input)).toBe(expected);
  });

  it.each([undefined, null, "", "123", "pas un numéro"])("renonce à un numéro inexploitable (%j)", (input) => {
    expect(whatsappNumber(input)).toBeNull();
  });

  it("prépare le message avec le prénom, la durée et l'avertissement", () => {
    const text = resetLinkMessage("Awa Koné", "https://bethel.ci/mot-de-passe-oublie/abc", 24);
    expect(text).toContain("Bonjour Awa,");
    expect(text).toContain("https://bethel.ci/mot-de-passe-oublie/abc");
    expect(text).toContain("24 h");
    expect(text).toContain("Ne le transmettez à personne");
  });

  it("encode le message dans le lien WhatsApp", () => {
    const url = whatsappShareUrl("2250778848474", "a & b");
    expect(url).toBe("https://wa.me/2250778848474?text=a%20%26%20b");
    expect(whatsappShareUrl(null, "x")).toBe("https://wa.me/?text=x");
  });
});
