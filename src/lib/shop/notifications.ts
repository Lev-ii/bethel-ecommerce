import "server-only";

import { after } from "next/server";
import { formatPrice, paymentMethodLabel } from "@/lib/format";
import { getOrderByReference } from "@/lib/repository";
import { emailProvider } from "@/lib/shop/email";
import { invoiceFilename, invoicePath, renderInvoicePdf } from "@/lib/shop/invoice";
import {
  WHATSAPP_TEMPLATES,
  bodyParams,
  documentHeader,
  sendWhatsAppTemplate,
  toWhatsAppNumber,
} from "@/lib/shop/whatsapp";
import type { Order } from "@/lib/types";

export type CustomerEvent =
  | "commande_recue"
  | "paiement_confirme"
  | "preparee"
  | "expediee"
  | "livree"
  | "annulee";

const OFFLINE_METHODS = new Set(["paiement-livraison", "especes-retrait"]);

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Message {
  subject: string;
  /** Phrase courte reprise dans le modele WhatsApp de suivi : "... est maintenant : <status>." */
  status: string;
  paragraphs: string[];
  withInvoice: boolean;
}

function buildMessage(order: Order, event: CustomerEvent): Message {
  const ref = order.reference;
  const total = formatPrice(order.total);
  const pickup = order.deliveryMode === "retrait";
  const offline = OFFLINE_METHODS.has(order.paymentMethod);

  switch (event) {
    case "commande_recue":
      return {
        subject: `Commande ${ref} enregistrée`,
        status: "enregistrée",
        paragraphs: [
          `Votre commande ${ref} d'un montant de ${total} est bien enregistrée.`,
          pickup
            ? "Nous vous prévenons dès qu'elle est prête à être retirée en boutique."
            : "Nous vous appelons pour confirmer la livraison.",
        ],
        withInvoice: false,
      };
    case "paiement_confirme":
      return {
        subject: `Paiement reçu · facture ${ref}`,
        status: "payée",
        paragraphs: [
          `Nous avons bien reçu votre paiement de ${total} par ${paymentMethodLabel[order.paymentMethod] ?? "mobile money"}.`,
          "Votre facture est jointe à ce message. Nous vous prévenons à chaque étape de votre commande.",
        ],
        withInvoice: true,
      };
    case "preparee":
      return {
        subject: `Commande ${ref} en préparation`,
        status: "en préparation",
        paragraphs: [`Votre commande ${ref} est en cours de préparation.`],
        withInvoice: false,
      };
    case "expediee":
      return pickup
        ? {
            subject: `Commande ${ref} prête à retirer`,
            status: "prête à être retirée en boutique",
            paragraphs: [`Votre commande ${ref} est prête : vous pouvez venir la retirer en boutique.`],
            withInvoice: false,
          }
        : {
            subject: `Commande ${ref} en route`,
            status: "en route vers vous",
            paragraphs: [`Votre commande ${ref} est en route. Le livreur vous appelle avant de passer.`],
            withInvoice: false,
          };
    case "livree":
      return {
        subject: pickup ? `Commande ${ref} retirée` : `Commande ${ref} livrée`,
        status: pickup ? "retirée" : "livrée",
        paragraphs: [
          pickup ? `Votre commande ${ref} a bien été retirée. Merci !` : `Votre commande ${ref} a bien été livrée. Merci !`,
          // Paiement a la reception : c'est maintenant qu'il est encaisse, la
          // facture part donc a ce moment-la.
          ...(offline ? ["Votre facture est jointe à ce message."] : []),
        ],
        withInvoice: offline,
      };
    case "annulee":
      return {
        subject: `Commande ${ref} annulée`,
        status: "annulée, le paiement n'ayant pas été finalisé",
        paragraphs: [
          `Votre commande ${ref} a été annulée car le paiement n'a pas été finalisé.`,
          "Aucun article ne vous est réservé : vous pouvez repasser commande à tout moment.",
        ],
        withInvoice: false,
      };
  }
}

function renderEmail(order: Order, message: Message) {
  const trackUrl = `${appUrl()}/suivi?ref=${encodeURIComponent(order.reference)}`;
  const greeting = `Bonjour ${order.customerName},`;
  const text = [greeting, "", ...message.paragraphs, "", `Suivre la commande : ${trackUrl}`, "", "L'équipe Bethel"].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f4ee;font-family:Helvetica,Arial,sans-serif;color:#1a1a14">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#16150f;padding:18px 24px;border-bottom:4px solid #ffed43;color:#f7f7f0;font-weight:bold;font-size:18px">Bethel</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 14px">${escapeHtml(greeting)}</p>
${message.paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(p)}</p>`).join("")}
<p style="margin:22px 0 6px"><a href="${escapeHtml(trackUrl)}" style="display:inline-block;background:#16150f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px">Suivre ma commande</a></p>
<p style="margin:18px 0 0;color:#6b6a5c;font-size:13px">Référence : ${escapeHtml(order.reference)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}

/** Prevenir le client par email (s'il en a laisse un) et par WhatsApp. */
export async function notifyCustomer(reference: string, event: CustomerEvent): Promise<void> {
  const order = await getOrderByReference(reference).catch((error) => {
    console.error("[notification] commande introuvable", reference, error);
    return undefined;
  });
  if (!order) return;

  const message = buildMessage(order, event);
  const invoice = message.withInvoice ? await renderInvoicePdf(order) : null;

  if (order.customerEmail) {
    const { text, html } = renderEmail(order, message);
    await emailProvider
      .send({
        to: order.customerEmail,
        subject: message.subject,
        text,
        html,
        attachments: invoice ? [{ filename: invoiceFilename(order), content: invoice }] : undefined,
      })
      .catch((error) => console.error("[notification] email", reference, event, error));
  }

  const phone = toWhatsAppNumber(order.customerPhone);
  if (!phone) {
    console.warn("[notification] numéro WhatsApp invalide", reference, order.customerPhone);
    return;
  }

  const firstName = order.customerName.trim().split(/\s+/)[0] || order.customerName;
  const whatsapp = invoice
    ? sendWhatsAppTemplate(phone, WHATSAPP_TEMPLATES.invoice, [
        // Meta telecharge le PDF lui-meme depuis cette URL : elle doit rester
        // accessible sans session. Le jeton signe la protege.
        documentHeader(`${appUrl()}${invoicePath(order.reference)}`, invoiceFilename(order)),
        bodyParams(firstName, order.reference, formatPrice(order.total)),
      ])
    : sendWhatsAppTemplate(phone, WHATSAPP_TEMPLATES.status, [
        bodyParams(firstName, order.reference, message.status),
      ]);
  await whatsapp.catch((error) => console.error("[notification] whatsapp", reference, event, error));
}

/**
 * Envoie apres la reponse : ni l'admin qui avance une commande, ni le
 * webhook Jeko (5 s de delai avant nouvel essai) n'attendent l'envoi.
 */
export function notifyCustomerLater(reference: string, event: CustomerEvent): void {
  const task = () => notifyCustomer(reference, event);
  try {
    after(task);
  } catch {
    void task();
  }
}
