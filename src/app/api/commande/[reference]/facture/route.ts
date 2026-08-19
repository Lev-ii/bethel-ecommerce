import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { getOrderByReference } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  const order = await getOrderByReference(reference);
  if (!order) return new Response("Commande introuvable", { status: 404 });

  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await fs.readFile(path.join(process.cwd(), "public", "logo-dark.png"));
  const logo = await document.embedPng(logoBytes);
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 11,
    isBold = false,
    color = rgb(0.1, 0.1, 0.08)
  ) => {
    page.drawText(text, { x, y, size, font: isBold ? bold : font, color });
  };

  const dark = rgb(0.086, 0.082, 0.059);
  const brand = rgb(1, 0.929, 0.263);
  const white = rgb(0.97, 0.97, 0.94);
  page.drawRectangle({ x: 0, y: 662, width: 595, height: 180, color: dark });
  page.drawRectangle({ x: 0, y: 662, width: 595, height: 8, color: brand });
  page.drawRectangle({ x: 42, y: 762, width: 220, height: 42, color: brand });
  page.drawImage(logo, { x: 54, y: 767, width: 196, height: 32 });
  draw("FACTURE", 52, 724, 16, true, white);
  draw(`Référence : ${order.reference}`, 52, 700, 10, false, white);
  draw(`Date : ${new Date(order.createdAt).toLocaleDateString("fr-FR")}`, 52, 684, 10, false, white);
  draw(order.customerName, 360, 716, 11, true, white);
  draw(order.customerPhone, 360, 698, 10, false, white);
  if (order.customerEmail) draw(order.customerEmail, 360, 680, 10, false, white);

  let y = 620;
  draw("DÉSIGNATION", 52, y, 10, true);
  draw("QTÉ", 405, y, 10, true);
  draw("TOTAL", 475, y, 10, true);
  y -= 28;
  for (const line of order.lines) {
    draw(line.name.slice(0, 48), 52, y);
    draw(String(line.quantity), 410, y);
    draw(`${line.unitPrice * line.quantity} FCFA`, 465, y);
    y -= 22;
  }
  y -= 12;
  draw(`Livraison : ${order.deliveryMode === "livraison" ? "Incluse dans le total" : "Retrait en boutique"}`, 52, y);
  y -= 30;
  draw(`TOTAL TTC : ${order.total} FCFA`, 360, y, 14, true);
  draw("Merci pour votre commande.", 52, 100, 10);

  const bytes = await document.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-${order.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}