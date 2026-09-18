import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pixels publicitaires : identifiants valides seulement, rien sans
 * consentement, format des evenements Meta et TikTok, file d'attente.
 */

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubEnv("NEXT_PUBLIC_FACEBOOK_PIXEL_ID", "123456789012345");
  vi.stubEnv("NEXT_PUBLIC_TIKTOK_PIXEL_ID", "C1ABCDEF2345GHIJ6789");
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function load() {
  return import("@/lib/tracking/pixels");
}

const line = { id: "p-001", quantity: 2, price: 24500 };

describe("identifiants", () => {
  it("accepte des identifiants au bon format", async () => {
    const { validFacebookPixelId, validTiktokPixelId } = await load();
    expect(validFacebookPixelId(" 123456789012345 ")).toBe("123456789012345");
    expect(validTiktokPixelId("c1abcdef2345ghij6789")).toBe("C1ABCDEF2345GHIJ6789");
  });

  it.each(["", "abc", "123');alert(1);//", "1234567890</script><script>alert(1)"])("refuse %j (rien n'est injecté)", async (bad) => {
    const { validFacebookPixelId, validTiktokPixelId } = await load();
    expect(validFacebookPixelId(bad)).toBeNull();
    expect(validTiktokPixelId(bad)).toBeNull();
  });

  it("aucun pixel configuré : rien n'est proposé", async () => {
    vi.stubEnv("NEXT_PUBLIC_FACEBOOK_PIXEL_ID", "");
    vi.stubEnv("NEXT_PUBLIC_TIKTOK_PIXEL_ID", "x');alert(1)//");
    vi.resetModules();
    const { pixelsConfigured } = await load();
    expect(pixelsConfigured()).toBe(false);
  });
});

describe("événements", () => {
  it("Meta : montant en FCFA, articles, et identifiant d'achat pour le dédoublonnage", async () => {
    const { facebookEvent } = await load();
    expect(facebookEvent({ name: "AddToCart", lines: [line] })).toEqual([
      "AddToCart",
      {
        content_type: "product",
        content_ids: ["p-001"],
        contents: [{ id: "p-001", quantity: 2, item_price: 24500 }],
        num_items: 2,
        value: 49000,
        currency: "XOF",
      },
    ]);
    const [, params, options] = facebookEvent({ name: "Purchase", lines: [line], value: 54000, orderId: "BTH-2609-X" });
    expect(params.value).toBe(54000);
    expect(options).toEqual({ eventID: "BTH-2609-X" });
  });

  it("TikTok : l'achat s'appelle CompletePayment", async () => {
    const { tiktokEvent } = await load();
    const [name, params] = tiktokEvent({ name: "Purchase", lines: [line], value: 54000, orderId: "BTH-2609-X" });
    expect(name).toBe("CompletePayment");
    expect(params).toMatchObject({ value: 54000, currency: "XOF", order_id: "BTH-2609-X" });
  });
});

describe("consentement", () => {
  it("sans accord, rien n'est envoyé", async () => {
    const fbq = vi.fn();
    vi.stubGlobal("window", { dispatchEvent: vi.fn(), fbq, ttq: { track: vi.fn(), page: vi.fn() } });
    const { trackShopEvent, writeConsent } = await load();
    trackShopEvent({ name: "AddToCart", lines: [line] });
    writeConsent("refuse");
    trackShopEvent({ name: "AddToCart", lines: [line] });
    expect(fbq).not.toHaveBeenCalled();
  });

  it("avec accord, envoie aux deux pixels ; avant chargement, l'événement attend son script", async () => {
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    const pixels = await load();
    pixels.writeConsent("accepte");
    pixels.trackShopEvent({ name: "Purchase", lines: [line], value: 54000, orderId: "BTH-2609-X" });

    const fbq = vi.fn();
    const track = vi.fn();
    Object.assign(window, { fbq, ttq: { track, page: vi.fn() } });
    pixels.flushPixel("facebook");
    pixels.flushPixel("tiktok");
    pixels.flushPixel("facebook");

    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq.mock.calls[0][0]).toBe("track");
    expect(fbq.mock.calls[0][1]).toBe("Purchase");
    expect(track).toHaveBeenCalledWith("CompletePayment", expect.objectContaining({ order_id: "BTH-2609-X" }));
  });
});
