import { currentUser } from "@/lib/auth/current";
import { getOrderByReference } from "@/lib/repository";
import { invoiceFilename, invoiceTokenIsValid, renderInvoicePdf } from "@/lib/shop/invoice";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  // La facture contient des donnees personnelles. Deux acces seulement : un
  // lien signe (celui envoye au client par WhatsApp ou email) ou une session
  // d'administration. On repond 404 dans les deux cas de refus, pour ne pas
  // confirmer l'existence d'une reference a qui la devinerait.
  const token = new URL(request.url).searchParams.get("t");
  if (!invoiceTokenIsValid(reference, token)) {
    const user = await currentUser();
    if (user?.role !== "ADMIN") {
      return new Response("Commande introuvable", { status: 404 });
    }
  }

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
