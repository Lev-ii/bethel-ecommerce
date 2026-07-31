import type { Metadata } from "next";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Commandes" };

export default async function AdminCommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string }>;
}) {
  await requireAdmin();
  const { etat } = await searchParams;
  return <OrdersTable filter={etat} />;
}
