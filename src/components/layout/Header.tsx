"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { KelvinBar } from "@/components/ui/Primitives";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useCartCount } from "@/store/cart";
import { categories } from "@/lib/data/catalog";

const links = [
  { href: "/boutique", label: "Tout le materiel" },
  ...categories.map((c) => ({
    href: `/boutique?categorie=${c.slug}`,
    label: c.name.split(" ")[0],
  })),
  { href: "/suivi", label: "Suivre ma commande" },
];

export function Header({
  user,
}: {
  user?: { name: string; role: "ADMIN" | "CLIENT" } | null;
}) {
  const pathname = usePathname();
  const count = useCartCount();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      <KelvinBar />

      <div className="shell flex h-16 items-center gap-4">
        <Logo className="h-7 sm:h-8" />

        <nav
          className="ml-4 hidden flex-1 items-center gap-1 lg:flex"
          aria-label="Navigation principale"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-card px-3 py-2 text-sm text-fg-2 transition-colors hover:bg-bg-2 hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link href="/boutique" className="btn-ghost" aria-label="Rechercher">
            <Search size={19} aria-hidden />
          </Link>

          <ThemeToggle />

          <Link
            href={user ? (user.role === "ADMIN" ? "/admin" : "/compte") : "/connexion"}
            className="btn-ghost"
            aria-label={user ? `Compte de ${user.name}` : "Se connecter"}
            title={user ? user.name : "Se connecter"}
          >
            {user?.role === "ADMIN" ? (
              <LayoutDashboard size={19} aria-hidden />
            ) : (
              <User size={19} aria-hidden />
            )}
          </Link>

          <Link
            href="/panier"
            className="btn-ghost relative"
            aria-label={
              mounted && count > 0
                ? `Panier, ${count} article${count > 1 ? "s" : ""}`
                : "Panier"
            }
          >
            <ShoppingBag size={19} aria-hidden />
            {mounted && count > 0 ? (
              <span className="tabular absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-ink">
                {count}
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            className="btn-ghost lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {open ? <X size={19} aria-hidden /> : <Menu size={19} aria-hidden />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="menu-mobile"
          className="border-t border-line bg-bg lg:hidden"
          aria-label="Navigation mobile"
        >
          <div className="shell flex flex-col py-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="border-b border-line py-3 text-sm text-fg-2 last:border-0"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={user ? (user.role === "ADMIN" ? "/admin" : "/compte") : "/connexion"}
              className="py-3 text-sm font-medium"
            >
              {user
                ? user.role === "ADMIN"
                  ? "Administration"
                  : "Mon compte"
                : "Se connecter"}
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}