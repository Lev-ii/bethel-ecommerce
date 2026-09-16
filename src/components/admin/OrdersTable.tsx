import { ChevronDown } from "lucide-react";
import {
  canAdvanceOrder,
  formatDateTime,
  formatPrice,
  orderStatusFlow,
  orderStatusLabel,
  paymentMethodLabel,
} from "@/lib/format";
import {
  ORDER_PAGE_SIZE,
  hasActiveFilters,
  ordersHref,
  type OrderFilters,
} from "@/lib/admin/order-filters";
import { searchOrders } from "@/lib/repository";
import { PAYMENT_TIMEOUT_MINUTES, releaseExpiredReservationsQuietly } from "@/lib/shop/reservations";
import { setOrderStatus } from "@/lib/admin/actions";
import { MarkAllSeenButton, MarkSeenOnOpen } from "@/components/admin/OrderSeenControls";
import type { OrderStatus } from "@/lib/types";


/** "2026-09-15" -> "15/09/2026", sans passer par Date et ses fuseaux. */
function dayLabel(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

function periodLabel({ from, to }: OrderFilters): string {
  if (from && to) return from === to ? `le ${dayLabel(from)}` : `du ${dayLabel(from)} au ${dayLabel(to)}`;
  if (from) return `depuis le ${dayLabel(from)}`;
  if (to) return `jusqu'au ${dayLabel(to)}`;
  return "";
}

export async function OrdersTable({ filters }: { filters: OrderFilters }) {
  await releaseExpiredReservationsQuietly();
  const { orders, total, page, pageCount, countsByStatus } = await searchOrders(filters);

  // La page servie peut differer de la page demandee (ramenee a la derniere) :
  // les liens se construisent a partir de celle qui est affichee.
  const current: OrderFilters = { ...filters, page };
  const filtered = hasActiveFilters(filters);
  const count = (status: OrderStatus) => countsByStatus[status] ?? 0;
  const allCount = Object.values(countsByStatus).reduce((sum, n) => sum + (n ?? 0), 0);

  const statusFilters: Array<{ value?: OrderStatus; label: string; count: number }> = [
    { value: undefined, label: "Toutes", count: allCount },
    { value: "attente_paiement", label: orderStatusLabel.attente_paiement, count: count("attente_paiement") },
    ...orderStatusFlow.map((s) => ({ value: s, label: orderStatusLabel[s], count: count(s) })),
    { value: "annulee", label: orderStatusLabel.annulee, count: count("annulee") },
  ];

  const firstShown = (page - 1) * ORDER_PAGE_SIZE + 1;
  const lastShown = Math.min(page * ORDER_PAGE_SIZE, total);
  const period = periodLabel(filters);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Ventes</p>
          <h1 className="mt-2 text-3xl">Commandes</h1>
        </div>
        <MarkAllSeenButton />
      </header>

      {/* Formulaire en GET : les filtres vivent dans l'URL et se partagent. */}
      <form
        action="/admin/commandes"
        method="get"
        className="card grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end"
      >
        {filters.status ? <input type="hidden" name="etat" value={filters.status} /> : null}
        <div>
          <label htmlFor="commandes-q" className="field-label">
            Rechercher
          </label>
          <input
            id="commandes-q"
            name="q"
            type="search"
            defaultValue={filters.query ?? ""}
            placeholder="Référence, nom ou téléphone"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="commandes-du" className="field-label">
            Du
          </label>
          <input
            id="commandes-du"
            name="du"
            type="date"
            defaultValue={filters.from ?? ""}
            className="field tabular"
          />
        </div>
        <div>
          <label htmlFor="commandes-au" className="field-label">
            Au
          </label>
          <input
            id="commandes-au"
            name="au"
            type="date"
            defaultValue={filters.to ?? ""}
            className="field tabular"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            Filtrer
          </button>
          {filtered ? (
            <a href="/admin/commandes" className="btn-outline">
              Effacer
            </a>
          ) : null}
        </div>
      </form>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer par état">
        {statusFilters.map((f) => {
          const active = filters.status === f.value;
          return (
            <a
              key={f.value ?? "toutes"}
              href={ordersHref(current, { status: f.value })}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-card border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-fg bg-fg text-bg"
                  : "border-line bg-bg text-fg-2 hover:border-fg-3 hover:text-fg"
              }`}
            >
              {f.label}
              <span className={`tabular text-xs ${active ? "text-bg/70" : "text-fg-3"}`}>{f.count}</span>
            </a>
          );
        })}
      </nav>

      <p className="text-sm text-fg-2">
        {total === 0
          ? "Aucune commande"
          : `${firstShown}–${lastShown} sur ${total} commande${total > 1 ? "s" : ""}`}
        {period ? ` · ${period}` : ""}
        {filters.query ? ` · « ${filters.query} »` : ""}
      </p>

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
            {filtered
              ? "Aucune commande ne correspond à ces critères."
              : "Aucune commande pour le moment."}
          </p>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
          {page > 1 ? (
            <a href={ordersHref(current, { page: page - 1 })} rel="prev" className="btn-outline">
              Précédent
            </a>
          ) : (
            <span aria-disabled="true" className="btn-outline pointer-events-none opacity-40">
              Précédent
            </span>
          )}
          <span className="tabular text-fg-2">
            Page {page} sur {pageCount}
          </span>
          {page < pageCount ? (
            <a href={ordersHref(current, { page: page + 1 })} rel="next" className="btn-outline">
              Suivant
            </a>
          ) : (
            <span aria-disabled="true" className="btn-outline pointer-events-none opacity-40">
              Suivant
            </span>
          )}
        </nav>
      ) : null}
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
