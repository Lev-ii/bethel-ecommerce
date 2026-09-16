import { NextRequest, NextResponse } from "next/server";
import { isValidJekoSignature } from "@/lib/shop/jeko-signature";
import { syncOrderPayment } from "@/lib/shop/payment";

export const runtime = "nodejs";

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "This IPN endpoint expects a POST callback from the payment provider." },
    { status: 405 }
  );
}

export async function POST(request: NextRequest) {
  try {
    // La signature HMAC porte sur le corps brut, pas sur le JSON re-serialise
    // apres parsing : on lit le texte d'abord.
    const rawBody = await request.text();

    if (!isValidJekoSignature(rawBody, request.headers.get("Jeko-Signature"))) {
      console.warn(
        process.env.JEKO_WEBHOOK_SECRET
          ? "[payment:ipn] signature Jeko invalide ou absente"
          : "[payment:ipn] JEKO_WEBHOOK_SECRET absent en production : webhook refusé"
      );
      return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody || "{}") as Record<string, unknown>;

    // SERVICE_PROVIDER_LINK_REQUEST arrive dans une enveloppe { event, payload }
    // que nous n'utilisons pas (pas de Service Provider) : on accuse reception
    // sans rien faire, pour que Jeko ne compte pas d'echec de livraison.
    if (typeof payload.event === "string") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // TRANSACTION_COMPLETED est la transaction elle-meme, sans enveloppe.
    const transactionDetails = (payload.transactionDetails as Record<string, unknown> | undefined) ?? {};
    const reference = asString(transactionDetails.reference);
    const paymentRef = asString(transactionDetails.id);

    // Le webhook global recoit toutes les transactions du compte (liens de
    // paiement, Jeko Box en boutique, transferts). Repondre en erreur a ce qui
    // ne nous concerne pas compterait comme un echec de livraison, et Jeko
    // desactive le webhook, sans prevenir, apres 15 echecs consecutifs.
    if (!reference && !paymentRef) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await syncOrderPayment({ reference, paymentRef });

    if (result.kind === "not_found") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (result.kind === "unverified") {
      return NextResponse.json(
        { ok: false, error: "Could not verify payment with Jeko." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      reference: result.reference,
      paid: result.paid,
      currentStatus: result.status,
    });
  } catch (error) {
    console.error("[payment:ipn]", error);
    return NextResponse.json(
      { ok: false, error: "IPN callback could not be processed." },
      { status: 500 }
    );
  }
}
