import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/shop/reservations";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { releasedOrderIds, paidOrderIds } = await releaseExpiredReservations();
  if (releasedOrderIds.length > 0) revalidateTag("products");
  return NextResponse.json({ ok: true, released: releasedOrderIds.length, paid: paidOrderIds.length });
}
