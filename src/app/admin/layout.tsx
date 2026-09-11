import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  AdminNotificationsProvider,
  NotificationPermissionButton,
} from "@/components/admin/AdminNotifications";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireAdmin } from "@/lib/auth/current";
import { getUnseenOrders } from "@/lib/repository";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s | Admin Bethel" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const unseen = await getUnseenOrders().catch(() => ({ count: 0, latest: [] }));

  return (
    <AdminNotificationsProvider initial={unseen}>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <AdminNav />
        <main className="min-w-0 flex-1 bg-bg-2">
          <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-6 lg:px-10 lg:py-12">
            <div className="mb-6 flex flex-wrap items-center justify-end gap-4 text-sm">
              <NotificationPermissionButton />
              <span className="text-fg-2">
                Connecté en tant que{" "}
                <span className="font-medium text-fg">{user.name}</span>
              </span>
              <SignOutButton className="btn-outline px-3 py-1.5 text-sm" />
            </div>
            {children}
          </div>
        </main>
      </div>
    </AdminNotificationsProvider>
  );
}
