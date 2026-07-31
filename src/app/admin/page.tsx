import { Dashboard } from "@/components/admin/Dashboard";
import { requireAdmin } from "@/lib/auth/current";

export default async function AdminAccueilPage() {
  await requireAdmin();
  return <Dashboard />;
}
