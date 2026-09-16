import { Dashboard } from "@/components/admin/Dashboard";
import { parseDashboardParams } from "@/lib/admin/dashboard-range";
import { requireAdmin } from "@/lib/auth/current";

export default async function AdminAccueilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  return <Dashboard range={parseDashboardParams(await searchParams, new Date())} />;
}
