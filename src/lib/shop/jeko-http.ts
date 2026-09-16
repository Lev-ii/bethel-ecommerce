/**
 * Appel HTTP a Jeko, borne dans le temps.
 *
 * Sans delai maximal, un Jeko qui ne repond plus bloque la validation d'une
 * commande et l'affichage de la page de confirmation (qui verifie le paiement
 * pendant le rendu) jusqu'a l'arret de la fonction par Vercel.
 *
 * Le delai couvre aussi la lecture du corps : des en-tetes recus suivis d'un
 * corps qui n'arrive jamais bloqueraient tout autant.
 */

export interface JekoRequestOptions {
  /** Duree maximale d'une tentative, lecture du corps comprise. */
  timeoutMs: number;
  /**
   * Nouvelles tentatives apres une panne passagere (reseau, delai depasse,
   * 429, 5xx). Jamais apres une reponse 4xx, qui ne changera pas.
   * A reserver aux lectures : rejouer une creation risquerait un doublon.
   */
  retries?: number;
  /** Attente avant la premiere nouvelle tentative, doublee a chaque fois. */
  retryDelayMs?: number;
}

export interface JekoResponse {
  status: number;
  ok: boolean;
  body: Record<string, unknown>;
}

export class JekoTimeoutError extends Error {}

function isTransient(status: number): boolean {
  return status === 429 || status >= 500;
}

async function attempt(url: string, init: RequestInit, timeoutMs: number): Promise<JekoResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    } catch {
      // Corps vide ou non JSON (page d'erreur d'un proxy) : on garde le statut.
    }
    return { status: response.status, ok: response.ok, body };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new JekoTimeoutError(`Jeko n'a pas répondu en ${timeoutMs / 1000} s.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestJeko(url: string, init: RequestInit, options: JekoRequestOptions): Promise<JekoResponse> {
  const retries = options.retries ?? 0;
  const delay = options.retryDelayMs ?? 500;

  for (let n = 0; ; n += 1) {
    const last = n >= retries;
    try {
      const response = await attempt(url, init, options.timeoutMs);
      if (last || !isTransient(response.status)) return response;
    } catch (error) {
      if (last) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay * 2 ** n));
  }
}

export const JEKO_API_BASE = "https://api.jeko.africa";

/**
 * Adresse de l'API Jeko. JEKO_API_BASE la remplace pour les tests de
 * parcours, qui font tourner un faux Jeko local : seule une adresse localhost
 * est acceptee, et jamais sur Vercel. Impossible donc de detourner les
 * paiements de la boutique en ligne par une variable d'environnement.
 */
export function jekoApiBase(env: Readonly<Record<string, string | undefined>>): string {
  const override = env.JEKO_API_BASE;
  if (!override) return JEKO_API_BASE;
  if (env.VERCEL_ENV) {
    throw new Error("JEKO_API_BASE est réservé aux tests locaux : refusé sur Vercel.");
  }
  if (!/^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(override)) {
    throw new Error("JEKO_API_BASE doit être une adresse locale, par exemple http://127.0.0.1:3101.");
  }
  return override;
}
