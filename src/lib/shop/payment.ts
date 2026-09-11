import "server-only";

import { sql } from "@/lib/db/client";
import { notifyCustomerLater } from "@/lib/shop/notifications";
import type { PaymentMethod } from "@/lib/types";

export interface PaymentRequest {
  amount: number;
  method: PaymentMethod;
  reference: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  callbackUrl?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResult {
  status: "paid" | "pending";
  transactionReference?: string;
  checkoutUrl?: string;
  message?: string;
}

export interface PaymentProvider {
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

/**
 * Jeko (operee par Julaya, agree BCEAO) - pas d'environnement sandbox
 * distinct : les cles du Dashboard Business determinent le mode. Source :
 * developer.jeko.africa/docs/getting-started/{introduction,developer-setup}.
 */
const JEKO_API_BASE = "https://api.jeko.africa";

/** paymentMethod attendu par Jeko pour chaque moyen de paiement en ligne. */
const JEKO_PAYMENT_METHOD: Partial<Record<PaymentMethod, string>> = {
  orange: "orange",
  mtn: "mtn",
  moov: "moov",
  djamo: "djamo",
  wave: "wave",
};

function getJekoConfig() {
  const apiKey = process.env.JEKO_API_KEY;
  const apiKeyId = process.env.JEKO_API_KEY_ID;
  const storeId = process.env.JEKO_STORE_ID;
  if (!apiKey || !apiKeyId || !storeId) return null;
  return { apiKey, apiKeyId, storeId };
}

function jekoAuthHeaders(config: NonNullable<ReturnType<typeof getJekoConfig>>) {
  return {
    "X-API-KEY": config.apiKey,
    "X-API-KEY-ID": config.apiKeyId,
  };
}

export interface JekoConfirmResult {
  paid: boolean;
  failed: boolean;
  /** transaction.amount.amount tel que renvoye par Jeko, en centimes. */
  amountCents?: number;
  raw: Record<string, unknown>;
}

/**
 * Verifie aupres de Jeko, avec nos identifiants, le statut reel d'une
 * demande de paiement. C'est la seule source de verite pour marquer une
 * commande payee : le corps d'un appel entrant sur /api/payment/ipn n'est
 * jamais fiable (n'importe qui peut le poster), il ne sert qu'a declencher
 * cette verification. Un paiement qui echoue ne declenche d'ailleurs aucun
 * webhook chez Jeko - c'est aussi cette fonction, appelee depuis la page de
 * retour, qui permet de detecter un echec.
 */
export async function confirmJekoTransaction(paymentRequestId: string): Promise<JekoConfirmResult | null> {
  const config = getJekoConfig();
  if (!config) return null;

  const endpoint = `${JEKO_API_BASE}/partner_api/payment_requests/${encodeURIComponent(paymentRequestId)}`;

  try {
    const response = await fetch(endpoint, { method: "GET", headers: jekoAuthHeaders(config) });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    // Demande inconnue de Jeko (ex. identifiant d'un ancien prestataire) :
    // elle n'a certainement pas ete payee chez eux. On ne la traite pas en
    // "injoignable", sinon la commande ne serait jamais liberee.
    if (response.status === 404) {
      return { paid: false, failed: false, raw: body };
    }

    if (!response.ok) {
      console.error("[jeko:confirm] echec de verification du paiement", paymentRequestId, body);
      return null;
    }

    const status = typeof body.status === "string" ? body.status.toLowerCase() : undefined;
    const transaction = (body.transaction as Record<string, unknown> | undefined) ?? {};
    const amountObj = transaction.amount as Record<string, unknown> | undefined;
    const amountCentsRaw = amountObj?.amount;
    const amountCents =
      typeof amountCentsRaw === "number" ? amountCentsRaw : typeof amountCentsRaw === "string" ? Number(amountCentsRaw) : undefined;

    return {
      paid: status === "success",
      failed: status === "error",
      amountCents: Number.isFinite(amountCents) ? amountCents : undefined,
      raw: body,
    };
  } catch (error) {
    console.error("[jeko:confirm] echec de verification du paiement", paymentRequestId, error);
    return null;
  }
}

const ONLINE_PAYMENT_METHODS = new Set(Object.keys(JEKO_PAYMENT_METHOD));

export type SyncOrderPaymentResult =
  | { kind: "not_found" }
  | { kind: "unverified"; orderId: string; reference: string; status: string }
  | {
      kind: "checked";
      orderId: string;
      reference: string;
      status: string;
      online: boolean;
      paid: boolean;
      failed: boolean;
    };

/**
 * Annule une commande en ligne restee impayee et remet son stock en vente.
 * Sans effet si elle a ete payee ou a change d'etat entre-temps.
 */
export async function cancelUnpaidOrder(orderId: string, reason: string): Promise<boolean> {
  const cancelledReference = await sql.begin(async (tx) => {
    const [order] = await tx<Array<{ reference: string; status: string; paid_at: string | null }>>`
      SELECT reference, status, paid_at FROM orders WHERE id = ${orderId} FOR UPDATE
    `;
    if (!order || order.paid_at !== null || order.status !== "attente_paiement") return null;

    const lines = await tx<Array<{ product_id: string; quantity: number }>>`
      SELECT product_id, quantity FROM order_lines WHERE order_id = ${orderId}
    `;
    for (const line of lines) {
      await tx`
        UPDATE products SET stock = stock + ${line.quantity}, updated_at = now()
        WHERE id = ${line.product_id}
      `;
    }
    await tx`
      UPDATE orders SET status = 'annulee', payment_error = COALESCE(payment_error, ${reason})
      WHERE id = ${orderId}
    `;
    return order.reference;
  });

  if (!cancelledReference) return false;
  notifyCustomerLater(cancelledReference, "annulee");
  return true;
}

/**
 * Relit chez Jeko le statut du paiement d'une commande et en tire les
 * consequences : payee -> 'recue', refusee -> annulee (stock rendu). Appelee
 * par le webhook, la page de retour et le cron : Jeko n'envoie aucun webhook
 * pour un paiement echoue, et un webhook peut se perdre.
 */
export async function syncOrderPayment(lookup: {
  reference?: string;
  paymentRef?: string;
}): Promise<SyncOrderPaymentResult> {
  if (!lookup.reference && !lookup.paymentRef) return { kind: "not_found" };

  const [order] = await sql<
    Array<{
      id: string;
      reference: string;
      payment_ref: string | null;
      payment_method: string;
      status: string;
      total: number;
      paid_at: string | null;
    }>
  >`
    SELECT id, reference, payment_ref, payment_method, status, total, paid_at
    FROM orders
    WHERE
      ${lookup.reference ? sql`reference = ${lookup.reference}` : sql`FALSE`}
      ${lookup.paymentRef ? sql`OR payment_ref = ${lookup.paymentRef}` : sql``}
    LIMIT 1
  `;

  if (!order) return { kind: "not_found" };

  const online = ONLINE_PAYMENT_METHODS.has(order.payment_method);
  const base = { orderId: order.id, reference: order.reference, status: order.status, online };

  if (order.paid_at) return { kind: "checked", ...base, paid: true, failed: false };
  if (!online || !order.payment_ref) return { kind: "checked", ...base, paid: false, failed: false };

  const confirmation = await confirmJekoTransaction(order.payment_ref);
  if (!confirmation) return { kind: "unverified", ...base };

  if (confirmation.failed) {
    await cancelUnpaidOrder(order.id, "Paiement refusé ou échoué chez Jeko.");
    return { kind: "checked", ...base, paid: false, failed: true };
  }

  if (!confirmation.paid) return { kind: "checked", ...base, paid: false, failed: false };

  // Le montant d'une demande Jeko est fixe par nous a la creation : un ecart
  // ne peut venir que de la facon dont Jeko le rapporte (frais deduits...).
  // On ne bloque donc pas un paiement confirme, on le signale en admin.
  const notes: string[] = [];
  const raw = confirmation.amountCents;
  if (raw !== undefined && raw !== Number(order.total) * 100) {
    notes.push(`Montant confirmé par Jeko : ${raw / 100} FCFA pour un total de ${order.total} FCFA, à vérifier.`);
  }
  if (order.status === "annulee") {
    notes.push("Paiement reçu après l'annulation de la commande (stock déjà remis en vente) : à traiter.");
  }

  const [updated] = await sql<Array<{ status: string }>>`
    UPDATE orders
    SET paid_at = now(),
        status = CASE WHEN status = 'attente_paiement' THEN 'recue' ELSE status END,
        payment_error = ${notes.length ? notes.join(" ") : null}
    WHERE id = ${order.id} AND paid_at IS NULL
    RETURNING status
  `;

  // RETURNING vide : le webhook et la page de retour sont arrives en meme
  // temps, l'autre appel a deja fait la mise a jour (et prevenu le client).
  if (updated) notifyCustomerLater(order.reference, "paiement_confirme");

  return { kind: "checked", ...base, status: updated?.status ?? base.status, paid: true, failed: false };
}

class JekoProvider implements PaymentProvider {
  async charge(request: PaymentRequest): Promise<PaymentResult> {
    if (request.method === "paiement-livraison" || request.method === "especes-retrait") {
      return { status: "pending" };
    }

    const config = getJekoConfig();
    if (!config) {
      throw new Error(
        "Jeko n'est pas configuré. Ajoute JEKO_API_KEY, JEKO_API_KEY_ID et JEKO_STORE_ID dans le fichier .env pour activer le paiement."
      );
    }

    const paymentMethod = JEKO_PAYMENT_METHOD[request.method];
    if (!paymentMethod) {
      throw new Error(`Moyen de paiement "${request.method}" non pris en charge par Jeko.`);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Le franc CFA n'a pas de subdivision : Jeko exige quand meme un montant
    // en "centimes", toujours un multiple de 100 (amountCents: 50000 vaut
    // 500 XOF - source : developer.jeko.africa/docs/payments/introduction).
    const amountCents = Math.max(100, Math.round(request.amount) * 100);

    const initPayload = {
      storeId: config.storeId,
      amountCents,
      currency: "XOF",
      reference: request.reference,
      paymentDetails: {
        type: "redirect",
        data: {
          paymentMethod,
          successUrl:
            request.returnUrl ?? `${appUrl}/commande/confirmation?ref=${encodeURIComponent(request.reference)}`,
          errorUrl: request.cancelUrl ?? `${appUrl}/panier?erreur=paiement`,
        },
      },
    };

    const initEndpoint = `${JEKO_API_BASE}/partner_api/payment_requests`;
    const initResponse = await fetch(initEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...jekoAuthHeaders(config) },
      body: JSON.stringify(initPayload),
    });
    const initBody = (await initResponse.json().catch(() => ({}))) as Record<string, unknown>;

    if (!initResponse.ok) {
      const initMessage = typeof initBody?.message === "string" ? initBody.message : JSON.stringify(initBody);
      throw new Error(
        `La création de la demande de paiement Jeko a échoué : ${initMessage} (endpoint: ${initEndpoint}, status: ${initResponse.status})`
      );
    }

    const paymentRequestId = typeof initBody.id === "string" ? initBody.id : undefined;
    const redirectUrl = typeof initBody.redirectUrl === "string" ? initBody.redirectUrl : undefined;

    if (!paymentRequestId) {
      throw new Error(`Jeko n'a pas renvoyé d'identifiant de demande de paiement. (endpoint: ${initEndpoint})`);
    }
    if (!redirectUrl) {
      throw new Error(`Jeko n'a pas renvoyé d'URL de paiement. (endpoint: ${initEndpoint})`);
    }

    // On redirige vers la page hebergee par Jeko : le client y paie avec
    // l'application de l'operateur choisi, puis revient sur successUrl ou
    // errorUrl. Le webhook (TRANSACTION_COMPLETED) et la verification
    // GET /partner_api/payment_requests/:id (voir confirmJekoTransaction)
    // sont les deux seules sources fiables pour marquer la commande payee.
    return { status: "pending", transactionReference: paymentRequestId, checkoutUrl: redirectUrl };
  }
}

export const paymentProvider: PaymentProvider = new JekoProvider();
