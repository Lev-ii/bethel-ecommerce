"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LayoutDashboard, Package, ScrollText, ShoppingCart, Tags } from "lucide-react";
import { KelvinBar } from "@/components/ui/Primitives";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useUnseenOrderCount } from "@/components/admin/AdminNotifications";

const links = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/categories", label: "Catégories", icon: Tags },
  { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
  { href: "/admin/journal", label: "Journal", icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();
  const { count: unseen } = useUnseenOrderCount();

  return (
    <aside className="shrink-0 border-b border-sidebar-fg/15 bg-sidebar text-sidebar-fg lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-sidebar-fg/15">
      <KelvinBar className="shrink-0" />

      <div className="flex items-center justify-between px-5 py-4 lg:block lg:px-5 lg:py-6">
        <div>
          <Logo href="/admin" variant="light" className="h-6" label="Bethel, administration" />
          <p className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-sidebar-fg/50 lg:block">
            Administration
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-sidebar-fg/60 hover:text-sidebar-fg lg:hidden"
        >
          Boutique <ExternalLink size={13} aria-hidden />
        </Link>
      </div>

      <nav className="px-3 pb-4 lg:px-3" aria-label="Navigation administration">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 whitespace-nowrap rounded-card px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-brand text-brand-ink font-semibold"
                      : "text-sidebar-fg/60 hover:bg-sidebar-fg/5 hover:text-sidebar-fg"
                  }`}
                >
                  <Icon size={17} aria-hidden />
                  {label}
                  {href === "/admin/commandes" && unseen > 0 ? (
                    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular">
                      {unseen > 99 ? "99+" : unseen}
                      <span className="sr-only"> nouvelle{unseen > 1 ? "s" : ""} commande{unseen > 1 ? "s" : ""}</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto hidden items-center justify-between px-5 pb-6 lg:flex">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-sidebar-fg/50 hover:text-sidebar-fg"
        >
          Voir la boutique <ExternalLink size={13} aria-hidden />
        </Link>
        <ThemeToggle className="text-sidebar-fg/60 hover:bg-sidebar-fg/10 hover:text-sidebar-fg" />
      </div>
    </aside>
  );
}
