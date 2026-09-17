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
          <div className="mx-auto w-full max-w-screen-2xl px-5 py-8 sm:px-6 lg:px-10 lg:py-12 min-[1920px]:max-w-[2000px] min-[1920px]:px-14">
            <div className="mb-6 flex flex-wrap items-center justify-end gap-4 text-sm">
              <NotificationPermissionButton />
              <span className="text-fg-2">
                Connecté en tant que{" "}
                <span className="font-medium text-fg">{user.name}</span>
              </span>
              <SignOutButton className="inline-flex items-center gap-1.5 rounded-card border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger" />
            </div>
            {children}
          </div>
        </main>
      </div>
    </AdminNotificationsProvider>
  );
}
