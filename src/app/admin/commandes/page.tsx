import type { Metadata } from "next";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { parseOrderFilters, type RawSearchParams } from "@/lib/admin/order-filters";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Commandes" };

export default async function AdminCommandesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAdmin();
  return <OrdersTable filters={parseOrderFilters(await searchParams)} />;
}
