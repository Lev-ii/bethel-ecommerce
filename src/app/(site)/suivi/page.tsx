import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Eyebrow } from "@/components/ui/Primitives";
import {
  formatDate,
  formatPrice,
  orderStatusFlow,
  orderStatusLabel,
} from "@/lib/format";
import { getOrderByReference } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Suivre ma commande",
  description: "Retrouvez l'etat de votre commande avec sa reference.",
};

type SearchParams = Promise<{ ref?: string }>;

export default async function SuiviPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const reference = sp.ref?.trim() ?? "";
  const order = reference ? await getOrderByReference(reference) : undefined;

  return (
    <div className="shell py-10 lg:py-14">
      <header className="mb-8 max-w-xl">
        <Eyebrow>Suivi</Eyebrow>
        <h1 className="mt-2 text-3xl sm:text-4xl">Où en est ma commande ?</h1>
        <p className="mt-2 text-fg-2">
          Entrez la référence réçue a la validation, du type BTH-2607-1042.
        </p>
      </header>

      {/* Formulaire en GET : la recherche reste dans l'URL et se partage. */}
      <form
        action="/suivi"
        method="get"
        className="flex max-w-xl flex-col gap-3 sm:flex-row"
      >
        <div className="flex-1">
          <label htmlFor="ref" className="sr-only">
            Référence de commande
          </label>
          <input
            id="ref"
            name="ref"
            defaultValue={reference}
            placeholder="BTH-2607-1042"
            className="field tabular"
          />
        </div>
        <button type="submit" className="btn-primary">
          Rechercher
        </button>
      </form>

      {reference && !order ? (
        <div className="card mt-8 max-w-xl p-6">
          <h2 className="text-lg">Aucune commande sous cette reference</h2>
          <p className="mt-2 text-sm text-fg-2">
            Verifiez la reference, elle commence par BTH. Si le probleme
            persiste, appelez la boutique au +225 07 78 84 84 74.
          </p>
          <p className="mt-3 text-sm text-fg-3">
            Pour tester la demonstration, essayez{" "}
            <Link
              href="/suivi?ref=BTH-2607-1042"
              className="tabular underline underline-offset-4"
            >
              BTH-2607-1042
            </Link>
            .
          </p>
        </div>
      ) : null}

      {order ? (
        <div className="card mt-8 max-w-2xl p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="eyebrow">Reference</p>
              <p className="tabular text-lg font-semibold">{order.reference}</p>
            </div>
            <p className="text-sm text-fg-2">
              Passee le {formatDate(order.createdAt)}
            </p>
          </div>

          {/* Etapes du parcours. L'etat courant est nomme, pas seulement colore. */}
          <ol className="mt-7 space-y-0">
            {orderStatusFlow.map((status, index) => {
              const currentIndex = orderStatusFlow.indexOf(order.status);
              const done = currentIndex >= index;
              const isCurrent = currentIndex === index;
              return (
                <li key={status} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] ${
                        done
                          ? "border-ok bg-ok text-bg"
                          : "border-line text-fg-3"
                      }`}
                    >
                      {done ? <Check size={14} /> : index + 1}
                    </span>
                    {index < orderStatusFlow.length - 1 ? (
                      <span
                        aria-hidden
                        className={`w-px flex-1 ${done ? "bg-ok" : "bg-line"}`}
                      />
                    ) : null}
                  </div>
                  <div className="pb-6">
                    <p
                      className={`font-semibold ${done ? "" : "text-fg-3"}`}
                    >
                      {orderStatusLabel[status]}
                      {isCurrent ? (
                        <span className="ml-2 rounded-card bg-brand/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-brand-deep">
                          En cours
                        </span>
                      ) : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="border-t border-line pt-5">
            <h2 className="text-base">Contenu</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {order.lines.map((line) => (
                <li key={line.productId} className="flex justify-between gap-3">
                  <span className="text-fg-2">
                    <span className="tabular">{line.quantity}&times;</span>{" "}
                    {line.name}
                  </span>
                  <span className="tabular font-medium">
                    {formatPrice(line.unitPrice * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="font-semibold">Total</span>
              <span className="tabular text-lg font-semibold">
                {formatPrice(order.total)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
