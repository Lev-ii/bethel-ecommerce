/**
 * Pixels publicitaires (Meta / Facebook et TikTok), soumis au consentement.
 *
 * Rien n'est charge ni envoye tant que le visiteur n'a pas accepte (bandeau,
 * voir ConsentBanner). Le choix reste dans ce navigateur (localStorage) et se
 * change depuis le lien « Cookies » du pied de page.
 *
 * Les identifiants viennent de NEXT_PUBLIC_FACEBOOK_PIXEL_ID et
 * NEXT_PUBLIC_TIKTOK_PIXEL_ID. Ils sont inseres dans un script : on les
 * valide d'abord, pour qu'une valeur mal saisie ne puisse pas injecter de code.
 */

export const CONSENT_KEY = "bethel-consentement-pub";
export const CONSENT_EVENT = "bethel-consentement";
export const CONSENT_OPEN_EVENT = "bethel-consentement-ouvrir";

export type Consent = "accepte" | "refuse";

export function validFacebookPixelId(value: string | undefined): string | null {
  const id = value?.trim() ?? "";
  return /^\d{10,20}$/.test(id) ? id : null;
}

export function validTiktokPixelId(value: string | undefined): string | null {
  const id = value?.trim() ?? "";
  return /^[A-Z0-9]{15,32}$/i.test(id) ? id.toUpperCase() : null;
}

/** Identifiants valides, figes au build (variables NEXT_PUBLIC_*). */
export const PIXEL_IDS = {
  facebook: validFacebookPixelId(process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID),
  tiktok: validTiktokPixelId(process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID),
};

export function pixelsConfigured(ids = PIXEL_IDS): boolean {
  return Boolean(ids.facebook || ids.tiktok);
}

export function readConsent(): Consent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "accepte" || value === "refuse" ? value : null;
  } catch {
    return null;
  }
}

export function writeConsent(consent: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Stockage indisponible : le choix vaut pour cette page seulement.
  }
  window.dispatchEvent(new CustomEvent<Consent>(CONSENT_EVENT, { detail: consent }));
}

/* ----------------------------------------------------------------- Evenements */

export interface EventLine {
  id: string;
  quantity: number;
  price: number;
}

export type ShopEvent =
  | { name: "ViewContent"; lines: EventLine[] }
  | { name: "AddToCart"; lines: EventLine[] }
  | { name: "InitiateCheckout"; lines: EventLine[] }
  | { name: "Purchase"; lines: EventLine[]; value: number; orderId: string };

const CURRENCY = "XOF";

function valueOf(event: ShopEvent): number {
  return event.name === "Purchase" ? event.value : event.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

/** Arguments de fbq("track", nom, parametres, options). */
export function facebookEvent(event: ShopEvent): [string, Record<string, unknown>, Record<string, string>?] {
  const params: Record<string, unknown> = {
    content_type: "product",
    content_ids: event.lines.map((l) => l.id),
    contents: event.lines.map((l) => ({ id: l.id, quantity: l.quantity, item_price: l.price })),
    num_items: event.lines.reduce((sum, l) => sum + l.quantity, 0),
    value: valueOf(event),
    currency: CURRENCY,
  };
  // eventID : dedoublonnage avec un futur envoi cote serveur (API Conversions).
  return event.name === "Purchase" ? [event.name, params, { eventID: event.orderId }] : [event.name, params];
}

/** Arguments de ttq.track(nom, parametres). */
export function tiktokEvent(event: ShopEvent): [string, Record<string, unknown>] {
  const name = event.name === "Purchase" ? "CompletePayment" : event.name;
  return [
    name,
    {
      contents: event.lines.map((l) => ({ content_id: l.id, content_type: "product", quantity: l.quantity, price: l.price })),
      value: valueOf(event),
      currency: CURRENCY,
      ...(event.name === "Purchase" ? { order_id: event.orderId } : {}),
    },
  ];
}

type Fbq = (...args: unknown[]) => void;
type Ttq = { track: (...args: unknown[]) => void; page: () => void };

/*
 * Un evenement peut partir avant que le script du pixel soit charge (achat
 * affiche des l'arrivee sur la confirmation) : il attend dans la file de ce
 * pixel, videe par flushPixel quand le script est pret.
 */
const pending: { facebook: ShopEvent[]; tiktok: ShopEvent[] } = { facebook: [], tiktok: [] };

function send(pixel: "facebook" | "tiktok", event: ShopEvent): void {
  const w = window as unknown as { fbq?: Fbq; ttq?: Ttq };
  if (pixel === "facebook") {
    if (w.fbq) w.fbq("track", ...facebookEvent(event));
    else pending.facebook.push(event);
  } else if (w.ttq?.track) w.ttq.track(...tiktokEvent(event));
  else pending.tiktok.push(event);
}

/** Envoie l'evenement aux pixels configures ; ne fait rien sans consentement. */
export function trackShopEvent(event: ShopEvent): void {
  if (typeof window === "undefined" || readConsent() !== "accepte") return;
  if (PIXEL_IDS.facebook) send("facebook", event);
  if (PIXEL_IDS.tiktok) send("tiktok", event);
}

/** Script du pixel pret : envoie ce qui attendait. */
export function flushPixel(pixel: "facebook" | "tiktok"): void {
  const queued = pending[pixel].splice(0);
  for (const event of queued) send(pixel, event);
}

/** Emis par le script de chaque pixel une fois installe (voir Pixels.tsx). */
export const PIXEL_READY_EVENT = { facebook: "bethel-pixel-facebook", tiktok: "bethel-pixel-tiktok" } as const;

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener(PIXEL_READY_EVENT.facebook, () => flushPixel("facebook"));
  window.addEventListener(PIXEL_READY_EVENT.tiktok, () => flushPixel("tiktok"));
}

/** Page vue, a chaque navigation apres la premiere. */
export function trackPageView(): void {
  if (typeof window === "undefined" || readConsent() !== "accepte") return;
  const w = window as unknown as { fbq?: Fbq; ttq?: Ttq };
  if (PIXEL_IDS.facebook && w.fbq) w.fbq("track", "PageView");
  if (PIXEL_IDS.tiktok && w.ttq) w.ttq.page();
}
