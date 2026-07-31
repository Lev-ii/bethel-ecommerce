import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { EmptyState, Eyebrow } from "@/components/ui/Primitives";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireUser } from "@/lib/auth/current";
import { getOrdersForUser } from "@/lib/repository";
import { formatDate, formatPrice, orderStatusLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Mon compte" };

export default async function ComptePage() {
  const user = await requireUser();
  const orders = await getOrdersForUser(user.id);

  return (
    <div className="shell py-10 lg:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Mon compte</Eyebrow>
          <h1 className="mt-2 text-3xl sm:text-4xl">Bonjour {user.name}</h1>
          <p className="mt-2 text-fg-2">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <section>
        <h2 className="mb-4 text-xl">Mes commandes</h2>

        {orders.length === 0 ? (
          <EmptyState
            title="Aucune commande pour l'instant"
            description="Vos commandes passees depuis ce compte apparaitront ici, avec leur suivi."
            actionLabel="Voir le materiel"
            actionHref="/boutique"
          />
        ) : (
          <ul className="card divide-y divide-line">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-4 p-4">
                <Package size={18} aria-hidden className="shrink-0 text-fg-3" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/suivi?ref=${order.reference}`}
                    className="tabular font-semibold hover:underline"
                  >
                    {order.reference}
                  </Link>
                  <p className="text-sm text-fg-3">
                    {formatDate(order.createdAt)} &middot;{" "}
                    {order.lines.length} article
                    {order.lines.length > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="tabular font-semibold">
                  {formatPrice(order.total)}
                </span>
                <span className="rounded-card border border-line px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-fg-2">
                  {orderStatusLabel[order.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
