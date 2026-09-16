import { vi } from "vitest";

/**
 * Faux Jeko pour les tests : remplace fetch et joue l'API partenaire
 * (creation et lecture des demandes de paiement). Le vrai code du prestataire
 * s'execute, aucun appel reseau ne part.
 *
 * Utilisation : const jeko = createFakeJeko(); vi.stubGlobal("fetch", jeko.fetch);
 * puis jeko.reset() avant chaque test.
 */

export interface FakeJekoRequest {
  status: "pending" | "success" | "error";
  amountCents?: number;
}

export function createFakeJeko() {
  const state = {
    /** Toute requete repond 503. */
    down: false,
    /** La creation repond 500. */
    createFails: false,
    /** La creation echoue au niveau reseau, sans reponse. */
    createNetworkError: false,
    /** Nombre de prochaines verifications qui repondent 503. */
    failingChecks: 0,
    /** Retient les verifications jusqu'a ce que ce nombre d'appels soit en cours. */
    holdUntil: 0,
    created: 0,
    checks: 0,
    /** Chaque appel recu, avec son signal d'annulation. */
    calls: [] as Array<{ method: string; url: string; signal?: AbortSignal | null }>,
    requests: new Map<string, FakeJekoRequest>(),
  };
  const waiting: Array<() => void> = [];

  function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith("https://api.jeko.africa/")) throw new Error(`Appel réseau inattendu : ${url}`);
    const method = init?.method ?? "GET";
    state.calls.push({ method, url, signal: init?.signal });
    if (state.down) return json(503, { message: "indisponible" });

    if (method === "POST") {
      if (state.createNetworkError) throw new TypeError("fetch failed");
      if (state.createFails) return json(500, { message: "erreur interne Jeko" });
      state.created += 1;
      const id = `pr-test-${state.created}`;
      const body = JSON.parse(String(init?.body)) as { amountCents: number };
      state.requests.set(id, { status: "pending", amountCents: body.amountCents });
      return json(201, { id, redirectUrl: `https://pay.jeko.africa/${id}` });
    }

    state.checks += 1;
    if (state.failingChecks > 0) {
      state.failingChecks -= 1;
      return json(503, { message: "indisponible" });
    }
    if (state.holdUntil > 0) {
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
        if (waiting.length >= state.holdUntil) waiting.splice(0).forEach((release) => release());
      });
    }

    const id = decodeURIComponent(url.split("/").pop() ?? "");
    const request = state.requests.get(id);
    if (!request) return json(404, { message: "inconnue" });
    return json(200, { id, status: request.status, transaction: { amount: { amount: request.amountCents } } });
  });

  function reset() {
    Object.assign(state, {
      down: false,
      createFails: false,
      createNetworkError: false,
      failingChecks: 0,
      holdUntil: 0,
      checks: 0,
    });
    state.calls.length = 0;
    state.requests.clear();
    waiting.length = 0;
  }

  /** Fixe l'issue d'une demande de paiement. */
  function settle(paymentRef: string, update: Partial<FakeJekoRequest>) {
    const request = state.requests.get(paymentRef);
    if (!request) throw new Error(`Demande inconnue : ${paymentRef}`);
    Object.assign(request, update);
  }

  return { state, fetch, reset, settle };
}
