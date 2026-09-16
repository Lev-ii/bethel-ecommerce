import { afterEach, describe, expect, it, vi } from "vitest";
import { JekoTimeoutError, requestJeko } from "@/lib/shop/jeko-http";

type Step = "hang" | "hang-body" | "network" | number;

/** Faux fetch qui joue une reponse par appel, et respecte l'annulation. */
function script(...steps: Step[]) {
  const calls: number[] = [];
  const fake = vi.fn((_url: string, init?: RequestInit) => {
    const step = steps[Math.min(calls.length, steps.length - 1)];
    calls.push(Date.now());
    const signal = init?.signal;
    const hang = () =>
      new Promise<never>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });

    if (step === "hang") return hang();
    if (step === "network") return Promise.reject(new TypeError("fetch failed"));
    if (step === "hang-body") {
      return Promise.resolve({ status: 200, ok: true, text: hang } as unknown as Response);
    }
    return Promise.resolve(new Response(JSON.stringify({ status: step }), { status: step }));
  });
  vi.stubGlobal("fetch", fake);
  return { fake, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const FAST = { timeoutMs: 40, retryDelayMs: 10 };

describe("requestJeko", () => {
  it("renvoie statut et corps d'une réponse normale", async () => {
    script(200);
    await expect(requestJeko("https://api.jeko.africa/x", {}, FAST)).resolves.toEqual({
      status: 200,
      ok: true,
      body: { status: 200 },
    });
  });

  it("garde le statut d'une réponse dont le corps n'est pas du JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 })));
    await expect(requestJeko("https://api.jeko.africa/x", {}, FAST)).resolves.toEqual({ status: 502, ok: false, body: {} });
  });

  it("abandonne un appel qui ne répond pas", async () => {
    script("hang");
    const started = Date.now();

    await expect(requestJeko("https://api.jeko.africa/x", {}, FAST)).rejects.toThrow(JekoTimeoutError);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("abandonne aussi quand le corps n'arrive jamais", async () => {
    script("hang-body");
    await expect(requestJeko("https://api.jeko.africa/x", {}, FAST)).rejects.toThrow("Jeko n'a pas répondu en 0.04 s.");
  });

  it("ne réessaie jamais sans l'avoir demandé", async () => {
    const { fake } = script(503, 200);
    const response = await requestJeko("https://api.jeko.africa/x", {}, FAST);

    expect(response.status).toBe(503);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it.each([["network" as const], ["hang" as const], [503], [429]])(
    "réessaie après une panne passagère (%s) puis réussit",
    async (failure) => {
      const { fake } = script(failure, 200);
      const response = await requestJeko("https://api.jeko.africa/x", {}, { ...FAST, retries: 2 });

      expect(response.status).toBe(200);
      expect(fake).toHaveBeenCalledTimes(2);
    }
  );

  it("ne réessaie pas une erreur 4xx, qui ne changera pas", async () => {
    const { fake } = script(404, 200);
    const response = await requestJeko("https://api.jeko.africa/x", {}, { ...FAST, retries: 2 });

    expect(response.status).toBe(404);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("s'arrête après le nombre de tentatives prévu et rend la dernière réponse", async () => {
    const { fake } = script(503);
    const response = await requestJeko("https://api.jeko.africa/x", {}, { ...FAST, retries: 2 });

    expect(response.status).toBe(503);
    expect(fake).toHaveBeenCalledTimes(3);
  });

  it("relance l'erreur de la dernière tentative", async () => {
    const { fake } = script("network");
    await expect(requestJeko("https://api.jeko.africa/x", {}, { ...FAST, retries: 1 })).rejects.toThrow("fetch failed");
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("espace les tentatives de plus en plus", async () => {
    const { calls } = script(503);
    await requestJeko("https://api.jeko.africa/x", {}, { timeoutMs: 1000, retries: 2, retryDelayMs: 40 });

    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(35);
    expect(calls[2] - calls[1]).toBeGreaterThanOrEqual(75);
  });
});
