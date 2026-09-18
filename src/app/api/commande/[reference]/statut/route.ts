import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { TRACKING_CACHE_SECONDS, isTrackableReference } from "@/lib/shop/tracking";
import type { OrderStatus } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Etat d'une commande, pour le suivi en direct (/suivi).
 *
 * Seul le statut est renvoye : c'est ce que la page de suivi affiche deja a
 * qui connait la reference. Ni nom, ni telephone, ni adresse.
 *
 * Mis en cache quelques secondes par le CDN : des centaines de clients qui
 * suivent la meme commande - ou un robot qui insiste - ne coutent qu'une
 * requete en base toutes les TRACKING_CACHE_SECONDS secondes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (!isTrackableReference(reference)) {
    return NextResponse.json({ error: "Référence invalide." }, { status: 400 });
  }

  const [order] = await sql<Array<{ status: OrderStatus; delivery_mode: "livraison" | "retrait" }>>`
    SELECT status, delivery_mode FROM orders WHERE lower(reference) = lower(${reference})
  `;

  const headers = {
    "Cache-Control": `public, max-age=0, s-maxage=${TRACKING_CACHE_SECONDS}, stale-while-revalidate=${TRACKING_CACHE_SECONDS}`,
  };
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404, headers });
  return NextResponse.json({ status: order.status, deliveryMode: order.delivery_mode }, { headers });
}
