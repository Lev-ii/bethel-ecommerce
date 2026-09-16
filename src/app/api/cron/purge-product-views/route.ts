import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { viewsRetentionCutoff } from "@/lib/shop/product-views";

export const runtime = "nodejs";

/**
 * Efface les vues produit que le tableau de bord ne lit plus (voir
 * viewsRetentionCutoff). Jamais planifiee : lancee a la main par l'admin
 * (workflow GitHub "Purger les vues produit anciennes").
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = viewsRetentionCutoff(new Date());
  const deleted = await sql`DELETE FROM product_views WHERE day < ${cutoff}::date`;
  return NextResponse.json({ ok: true, before: cutoff, deleted: deleted.count });
}
