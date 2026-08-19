import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { formatDateTime, formatPrice, orderStatusLabel, stockState } from "@/lib/format";
import { getAllProducts, getOrders } from "@/lib/repository";
import { ResetDemoButton } from "@/components/admin/ResetDemoButton";

export async function Dashboard() {
  const [products, orders] = await Promise.all([getAllProducts(), getOrders()]);

  const revenue = orders
    .filter((o) => o.status !== "annulee")
    .reduce((sum, o) => sum + o.total, 0);

  const pending = orders.filter(
    (o) => o.status === "recue" || o.status === "preparee"
  );

  const alerts = products.filter((p) => p.published && stockState(p) !== "in");

  /* Produits les plus vendus, calcules a partir des lignes de commande. */
  const sold = new Map<string, { name: string; qty: number }>();
  for (const order of orders) {
    if (order.status === "annulee") continue;
    for (const line of order.lines) {
      const current = sold.get(line.productId) ?? { name: line.name, qty: 0 };
      current.qty += line.quantity;
      sold.set(line.productId, current);
    }
  }
  const bestSellers = [...sold.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  const maxQty = bestSellers[0]?.qty ?? 1;

  const recent = orders.slice(0, 5);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Vue d&apos;ensemble</p>
          <h1 className="mt-2 text-3xl">Tableau de bord</h1>
        </div>
        <ResetDemoButton />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Chiffre d'affaires" value={formatPrice(revenue)} />
        <Stat label="Commandes" value={String(orders.length)} />
        <Stat label="A traiter" value={String(pending.length)} highlight={pending.length > 0} />
        <Stat label="Alertes stock" value={String(alerts.length)} highlight={alerts.length > 0} />
      </div>

      {alerts.length > 0 ? (
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <AlertTriangle size={16} aria-hidden className="text-warn" />
            <h2 className="text-base">Stock a reapprovisionner</h2>
          </div>
          <ul className="divide-y divide-line">
            {alerts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <Link
                  href={`/admin/produits/${p.id}`}
                  className="min-w-0 truncate text-sm hover:underline"
                >
                  {p.name}
                </Link>
                <span
                  className={`tabular shrink-0 text-sm font-semibold ${
                    p.stock === 0 ? "text-danger" : "text-warn"
                  }`}
                >
                  {p.stock === 0 ? "Épuisé" : `${p.stock} restants`}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <Link
              href="/admin/produits"
              className="inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Gérer les stocks <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-base">Meilleures ventes</h2>
          </div>
          {bestSellers.length > 0 ? (
            <ul className="space-y-3.5 p-5">
              {bestSellers.map((b) => (
                <li key={b.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{b.name}</span>
                    <span className="tabular shrink-0 font-medium">
                      {b.qty} vendu{b.qty > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-bg-3" role="presentation">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(b.qty / maxQty) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-fg-2">
              Aucune vente enregistree pour l&apos;instant.
            </p>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-base">Dernieres commandes</h2>
          </div>
          <ul className="divide-y divide-line">
            {recent.map((o) => (
              <li key={o.id} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="tabular text-sm font-semibold">{o.reference}</span>
                  <span className="tabular text-sm">{formatPrice(o.total)}</span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-fg-3">
                  <span className="truncate">{o.customerName}</span>
                  <span>
                    {orderStatusLabel[o.status]} &middot; {formatDateTime(o.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <Link
              href="/admin/commandes"
              className="inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Toutes les commandes <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-5 ${highlight ? "border-brand bg-brand/10" : ""}`}>
      <p className="eyebrow">{label}</p>
      <p className="tabular mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
