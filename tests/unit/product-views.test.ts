import { describe, expect, it } from "vitest";
import { isLikelyBot, viewDay, visitorHash } from "@/lib/shop/product-views";

const CHROME = "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const base = { secret: "secret-de-test-suffisamment-long", day: "2026-09-16", ip: "41.202.10.5", userAgent: CHROME };

describe("isLikelyBot", () => {
  it("laisse passer un navigateur de telephone", () => {
    expect(isLikelyBot(CHROME)).toBe(false);
  });

  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "WhatsApp/2.23.20.0 A",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/126.0 Safari/537.36",
    "curl/8.4.0",
  ])("ecarte un robot ou un apercu de lien : %s", (ua) => {
    expect(isLikelyBot(ua)).toBe(true);
  });

  it("ecarte une requete sans navigateur declare", () => {
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot("x")).toBe(true);
  });
});

describe("visitorHash", () => {
  it("donne la meme empreinte au meme visiteur le meme jour", () => {
    expect(visitorHash(base)).toBe(visitorHash({ ...base }));
  });

  // C'est ce qui empeche de suivre quelqu'un d'un jour a l'autre.
  it("change d'un jour a l'autre pour le meme visiteur", () => {
    expect(visitorHash(base)).not.toBe(visitorHash({ ...base, day: "2026-09-17" }));
  });

  it("distingue deux telephones derriere la meme adresse IP d'operateur", () => {
    const autre = CHROME.replace("SM-A135F", "TECNO KI5");
    expect(visitorHash(base)).not.toBe(visitorHash({ ...base, userAgent: autre }));
  });

  it("ne contient pas l'adresse IP", () => {
    expect(visitorHash(base)).not.toContain("41.202");
  });
});

describe("viewDay", () => {
  it("prend le jour UTC, soit le jour d'Abidjan", () => {
    expect(viewDay(new Date("2026-09-16T23:59:59Z"))).toBe("2026-09-16");
  });
});
