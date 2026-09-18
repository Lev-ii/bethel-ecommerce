import { currentUser } from "@/lib/auth/current";
import { csvCell } from "@/lib/shop/newsletter";
import { listSubscribers } from "@/lib/shop/newsletter-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Abonnes actifs, en CSV, pour l'outil d'envoi qui sera branche plus tard. */
export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });

  const rows = await listSubscribers({ activeOnly: true });
  const lines = [
    "email;source;consentement",
    ...rows.map((r) => [csvCell(r.email), csvCell(r.source), r.consentedAt].join(";")),
  ];
  // BOM : Excel ouvre alors le fichier en UTF-8 (accents intacts).
  const body = `﻿${lines.join("\r\n")}\r\n`;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-bethel-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
