import { ChevronDown } from "lucide-react";
import {
  canAdvanceOrder,
  formatDateTime,
  formatPrice,
  orderStatusFlow,
  orderStatusLabel,
  paymentMethodLabel,
} from "@/lib/format";
import { getOrders } from "@/lib/repository";
import { PAYMENT_TIMEOUT_MINUTES, releaseExpiredReservationsQuietly } from "@/lib/shop/reservations";
import { setOrderStatus } from "@/lib/admin/actions";
import { MarkAllSeenButton, MarkSeenOnOpen } from "@/components/admin/OrderSeenControls";
import type { OrderStatus } from "@/lib/types";


export async function OrdersTable({ filter }: { filter?: string }) {
  await releaseExpiredReservationsQuietly();
  const all = await getOrders();
  const active = (filter ?? "toutes") as OrderStatus | "toutes";
  const orders = active === "toutes" ? all : all.filter((o) => o.status === active);

  const filters: Array<{ value: string; label: string }> = [
    { value: "toutes", label: "Toutes" },
    { value: "attente_paiement", label: orderStatusLabel.attente_paiement },
    ...orderStatusFlow.map((s) => ({ value: s, label: orderStatusLabel[s] })),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Ventes</p>
          <h1 className="mt-2 text-3xl">Commandes</h1>
        </div>
        <MarkAllSeenButton />
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer par état">
        {filters.map((f) => (
          <a
            key={f.value}
            href={f.value === "toutes" ? "/admin/commandes" : `/admin/commandes?etat=${f.value}`}
            aria-current={active === f.value ? "page" : undefined}
            className={`rounded-card border px-3 py-1.5 text-sm transition-colors ${
              active === f.value
                ? "border-fg bg-fg text-bg"
                : "border-line bg-bg text-fg-2 hover:border-fg-3 hover:text-fg"
            }`}
          >
            {f.label}
          </a>
        ))}
      </nav>

      <div className="card divide-y divide-line overflow-hidden">
        {orders.map((o) => (
          <details key={o.id} className="group">
            <summary className="flex cursor-pointer items-center gap-4 px-4 py-3.5 hover:bg-bg-2">
              <ChevronDown
                size={16}
                aria-hidden
                className="shrink-0 text-fg-3 transition-transform group-open:rotate-180"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  {o.unseen ? <MarkSeenOnOpen orderId={o.id} /> : null}
                  <span className="tabular text-sm font-semibold">{o.reference}</span>
                  <span className="truncate text-sm text-fg-2">{o.customerName}</span>
                </div>
                <p className="text-xs text-fg-3">
                  {formatDateTime(o.createdAt)} &middot;{" "}
                  {o.deliveryMode === "retrait" ? "Retrait" : "Livraison"}
                </p>
              </div>
              <span className="tabular shrink-0 text-sm font-semibold">
                {formatPrice(o.total)}
              </span>
              <StatusPill status={o.status} />
            </summary>

            <div className="border-t border-line bg-bg-2 px-4 py-5">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">Client</h3>
                  <dl className="mt-2 space-y-1 text-sm text-fg-2">
                    <div className="flex gap-2">
                        <dt className="text-fg-3">Téléphone</dt>
                      <dd className="tabular">{o.customerPhone}</dd>
                    </div>
                    {o.customerEmail ? (
                      <div className="flex gap-2">
                        <dt className="text-fg-3">Email</dt>
                        <dd className="truncate">{o.customerEmail}</dd>
                      </div>
                    ) : null}
                    {o.address ? (
                      <div className="flex gap-2">
                        <dt className="text-fg-3">Adresse</dt>
                        <dd>
                          {o.address}
                          {o.city ? `, ${o.city}` : ""}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <dt className="text-fg-3">Paiement</dt>
                      <dd>{paymentMethodLabel[o.paymentMethod] ?? o.paymentMethod}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-fg-3">Compte</dt>
                      <dd>{o.userId ? "Client connecté" : "Commande sans compte"}</dd>
                    </div>
                  </dl>

                  {o.paymentError ? (
                    <p className="mt-3 rounded-card border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                      <span className="font-semibold">Erreur paiement (debug) : </span>
                      {o.paymentError}
                    </p>
                  ) : null}
                </div>

                <div>
                  <h3 className="text-sm font-semibold">Contenu</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {o.lines.map((l) => (
                      <li key={l.productId} className="flex justify-between gap-3">
                        <span className="text-fg-2">
                          <span className="tabular">{l.quantity}&times;</span> {l.name}
                        </span>
                        <span className="tabular">
                          {formatPrice(l.unitPrice * l.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 border-t border-line pt-4">
                {!canAdvanceOrder(o) ? (
                  <p className="text-sm text-fg-2">
                    {o.status === "annulee"
                      ? "Commande annulée : elle ne peut plus être avancée."
                      : `Paiement mobile money non confirmé : la commande ne peut pas être préparée. Sans paiement, elle est annulée automatiquement ${PAYMENT_TIMEOUT_MINUTES} minutes après sa création.`}
                  </p>
                ) : (
                <>
                {o.status === "attente_paiement" ? (
                  <p className="mb-3 text-sm text-fg-2">
                    Paiement en ligne non reçu, mais retrait en boutique : vous pouvez avancer la
                    commande si le client règle sur place.
                  </p>
                ) : null}
                <p className="field-label">Faire avancer la commande</p>
                <p className="-mt-1 mb-2 text-xs text-fg-3">
                  Le client est prévenu à chaque étape par WhatsApp{o.customerEmail ? " et par email" : ""}.
                </p>
                <div className="flex flex-wrap gap-2">
                  {orderStatusFlow.map((s) => (
                    <form key={s} action={setOrderStatus}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="status" value={s} />
                      <button
                        type="submit"
                        aria-pressed={o.status === s}
                        className={`rounded-card border px-3 py-1.5 text-sm transition-colors ${
                          o.status === s
                            ? "border-fg bg-fg text-bg"
                            : "border-line bg-bg text-fg-2 hover:border-fg-3 hover:text-fg"
                        }`}
                      >
                        {orderStatusLabel[s]}
                      </button>
                    </form>
                  ))}
                </div>
                </>
                )}
              </div>
            </div>
          </details>
        ))}

        {orders.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-2">
            Aucune commande dans cet état.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const tone =
    status === "livree"
      ? "border-ok/30 bg-ok/5 text-ok"
      : status === "annulee"
        ? "border-danger/30 bg-danger/5 text-danger"
        : status === "attente_paiement"
          ? "border-dashed border-line-2 bg-bg text-fg-3"
          : status === "recue"
          ? "border-brand bg-brand/20 text-brand-deep"
          : "border-line bg-bg text-fg-2";

  return (
    <span
      className={`hidden shrink-0 rounded-card border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide sm:inline-block ${tone}`}
    >
      {orderStatusLabel[status]}
    </span>
  );
}
