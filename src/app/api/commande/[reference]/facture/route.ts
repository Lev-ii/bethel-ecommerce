import { getOrderByReference } from "@/lib/repository";
import { invoiceFilename, renderInvoicePdf } from "@/lib/shop/invoice";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  let order;
  try {
    order = await getOrderByReference(reference);
  } catch (error) {
    console.error("[facture]", error);
    return new Response("Service momentanément indisponible", { status: 503 });
  }
  if (!order) return new Response("Commande introuvable", { status: 404 });

  const bytes = await renderInvoicePdf(order);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceFilename(order)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
