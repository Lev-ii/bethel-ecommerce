import { Header } from "@/components/layout/Header";
import { currentUser } from "@/lib/auth/current";
import { Footer } from "@/components/layout/Footer";
import { MiniCartDrawer } from "@/components/cart/MiniCartDrawer";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-fg focus:px-4 focus:py-2 focus:text-bg"
      >
        Aller au contenu
      </a>
      <Header user={user} />
      <AnnouncementBar />
      <MiniCartDrawer />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <Footer isAdmin={user?.role === "ADMIN"} />
    </div>
  );
}
