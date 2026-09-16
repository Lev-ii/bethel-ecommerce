import { NextRequest } from "next/server";
import { clientIp } from "@/lib/admin/audit";
import { currentUser } from "@/lib/auth/current";
import { authSecret } from "@/lib/auth/session";
import { sql } from "@/lib/db/client";
import { isLikelyBot, viewDay, visitorHash } from "@/lib/shop/product-views";

export const runtime = "nodejs";

const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Signale l'affichage d'une fiche produit. Les fiches etant pre-generees, le
 * comptage ne peut pas se faire au rendu : le navigateur l'annonce apres
 * affichage.
 *
 * Repond toujours 204 : un visiteur n'a rien a apprendre de la decision de
 * compter ou non (robot, administrateur, doublon du jour, produit inconnu).
 */
export async function POST(request: NextRequest) {
  try {
    const productId = (await request.text()).trim();
    const userAgent = request.headers.get("user-agent");

    if (!IDENTIFIER.test(productId) || isLikelyBot(userAgent)) return new Response(null, { status: 204 });

    const user = await currentUser();
    if (user?.role === "ADMIN") return new Response(null, { status: 204 });

    const day = viewDay(new Date());
    const hash = visitorHash({ secret: authSecret(), day, ip: await clientIp(), userAgent: userAgent! });

    // Seuls les produits en ligne comptent ; un identifiant inconnu n'insere
    // rien, au lieu de lever une erreur de cle etrangere.
    await sql`
      INSERT INTO product_views (product_id, day, visitor_hash)
      SELECT id, ${day}::date, ${hash} FROM products WHERE id = ${productId} AND published
      ON CONFLICT DO NOTHING
    `;
  } catch (error) {
    // Un comptage perdu ne doit jamais se voir cote client.
    console.error("[vues] enregistrement impossible", error);
  }
  return new Response(null, { status: 204 });
}
