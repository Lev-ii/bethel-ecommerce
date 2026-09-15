import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { authSecret } from "@/lib/auth/session";
import { formatPrice, paymentMethodLabel } from "@/lib/format";
import type { Order } from "@/lib/types";

/**
 * Jeton d'acces a la facture.
 *
 * Une facture porte le nom, le telephone et l'adresse du client : la seule
 * reference ne suffit pas a la proteger, elle est courte et circule par
 * WhatsApp et par email. Le jeton est un HMAC de la reference, donc
 * impossible a deviner, stable dans le temps (les liens deja envoyes
 * continuent de fonctionner) et sans stockage.
 */
export function invoiceToken(reference: string): string {
  return createHmac("sha256", authSecret()).update(reference.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/** URL complete de la facture, jeton compris. */
export function invoicePath(reference: string): string {
  return `/api/commande/${encodeURIComponent(reference)}/facture?t=${invoiceToken(reference)}`;
}

export function invoiceTokenIsValid(reference: string, token: string | null): boolean {
  if (!token) return false;
  const expected = Buffer.from(invoiceToken(reference), "utf8");
  const actual = Buffer.from(token.trim().toLowerCase(), "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// Les polices standard du PDF ne connaissent que le jeu WinAnsi : un seul
// caractere hors de ce jeu (espace fine des montants fr-FR, lettre d'une
// autre ecriture, emoji) ferait echouer toute la facture.
const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

function pdfSafe(text: string): string {
  return Array.from(text.replace(/[\u00a0\u202f]/g, " "))
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(char)) {
        return char;
      }
      const base = char.normalize("NFD").replace(/\p{M}/gu, "");
      return base && base.codePointAt(0)! <= 0xff ? base : "?";
    })
    .join("");
}

export function invoiceFilename(order: Pick<Order, "reference">): string {
  return `facture-${order.reference}.pdf`;
}

export async function renderInvoicePdf(order: Order): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Facture ${order.reference}`);
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await document.embedPng(
    await fs.readFile(path.join(process.cwd(), "public", "logo-dark.png"))
  );

  const ink = rgb(0.1, 0.1, 0.08);
  const muted = rgb(0.42, 0.41, 0.36);
  const dark = rgb(0.086, 0.082, 0.059);
  const brand = rgb(1, 0.929, 0.263);
  const white = rgb(0.97, 0.97, 0.94);

  const draw = (text: string, x: number, y: number, size = 11, isBold = false, color = ink) => {
    page.drawText(pdfSafe(text), { x, y, size, font: isBold ? bold : font, color });
  };
  const drawRight = (text: string, right: number, y: number, size = 11, isBold = false, color = ink) => {
    const safe = pdfSafe(text);
    const width = (isBold ? bold : font).widthOfTextAtSize(safe, size);
    page.drawText(safe, { x: right - width, y, size, font: isBold ? bold : font, color });
  };

  page.drawRectangle({ x: 0, y: 662, width: 595, height: 180, color: dark });
  page.drawRectangle({ x: 0, y: 662, width: 595, height: 8, color: brand });

  // Le logo garde ses proportions : on le fait tenir dans la hauteur voulue.
  const logoSize = logo.scaleToFit(196, 34);
  const padX = 12;
  const padY = 5;
  page.drawRectangle({
    x: 42,
    y: 762,
    width: logoSize.width + padX * 2,
    height: logoSize.height + padY * 2,
    color: brand,
  });
  page.drawImage(logo, { x: 42 + padX, y: 762 + padY, width: logoSize.width, height: logoSize.height });

  draw("FACTURE", 52, 724, 16, true, white);
  draw(`Référence : ${order.reference}`, 52, 700, 10, false, white);
  draw(`Date : ${new Date(order.createdAt).toLocaleDateString("fr-FR")}`, 52, 684, 10, false, white);
  draw(order.customerName, 360, 716, 11, true, white);
  draw(order.customerPhone, 360, 698, 10, false, white);
  if (order.customerEmail) draw(order.customerEmail, 360, 680, 10, false, white);

  const right = 543;
  let y = 620;
  draw("DÉSIGNATION", 52, y, 10, true);
  drawRight("QTÉ", 360, y, 10, true);
  drawRight("PRIX UNIT.", 460, y, 10, true);
  drawRight("TOTAL", right, y, 10, true);
  y -= 8;
  page.drawLine({ start: { x: 52, y }, end: { x: right, y }, thickness: 0.6, color: muted });
  y -= 20;

  let subtotal = 0;
  for (const line of order.lines) {
    const lineTotal = line.unitPrice * line.quantity;
    subtotal += lineTotal;
    draw(line.name.slice(0, 44), 52, y);
    drawRight(String(line.quantity), 360, y);
    drawRight(formatPrice(line.unitPrice), 460, y);
    drawRight(formatPrice(lineTotal), right, y);
    y -= 22;
  }

  y -= 4;
  page.drawLine({ start: { x: 300, y: y + 10 }, end: { x: right, y: y + 10 }, thickness: 0.6, color: muted });
  y -= 10;
  draw("Sous-total", 320, y, 10, false, muted);
  drawRight(formatPrice(subtotal), right, y, 10);
  y -= 18;
  const shipping = order.total - subtotal;
  draw(order.deliveryMode === "livraison" ? "Livraison" : "Retrait en boutique", 320, y, 10, false, muted);
  drawRight(shipping > 0 ? formatPrice(shipping) : "Gratuit", right, y, 10);
  y -= 26;
  draw("TOTAL TTC", 320, y, 13, true);
  drawRight(formatPrice(order.total), right, y, 13, true);

  y -= 44;
  draw("Paiement", 52, y, 10, true);
  y -= 16;
  const method = paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod;
  draw(
    order.paidAt
      ? `Payée le ${new Date(order.paidAt).toLocaleDateString("fr-FR")} · ${method}.`
      : order.paymentMethod === "paiement-livraison"
        ? "À régler au livreur, à la réception."
        : order.paymentMethod === "especes-retrait"
          ? "À régler en espèces au retrait en boutique."
          : `${method} : paiement en attente de confirmation.`,
    52,
    y,
    10,
    false,
    muted
  );

  draw("Merci pour votre commande.", 52, 100, 10);

  return document.save();
}
