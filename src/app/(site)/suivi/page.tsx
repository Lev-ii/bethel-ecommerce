import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/Primitives";
import { ReviewSection } from "@/components/order/ReviewSection";
import { SuiviEnDirect } from "@/components/order/SuiviEnDirect";
import { getOrderForReview, isBuyer } from "@/lib/shop/review-store";
import { formatDate, formatPrice } from "@/lib/format";
import { getOrderByReference } from "@/lib/repository";
import { currentUser } from "@/lib/auth/current";
import { canAccessOrderDocuments, invoicePath } from "@/lib/shop/invoice";
import { PAYMENT_TIMEOUT_MINUTES, releaseExpiredReservationsQuietly } from "@/lib/shop/reservations";

export const metadata: Metadata = {
  title: "Suivre ma commande",
  description: "Retrouvez l'état de votre commande avec sa référence.",
};

type SearchParams = Promise<{ ref?: string; t?: string; avis?: string; "avis-erreur"?: string; produit?: string }>;

export default async function SuiviPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const reference = sp.ref?.trim() ?? "";
  if (reference) await releaseExpiredReservationsQuietly({ reference });
  const order = reference ? await getOrderByReference(reference) : undefined;
  const user = order ? await currentUser() : null;
  const documentsAccess = order
    ? canAccessOrderDocuments({
        reference: order.reference,
        token: sp.t,
        user,
        orderUserId: order.userId,
      })
    : false;
  // Notation : commande livree, et seulement pour l'acheteur (pas l'administration).
  const reviewOrder =
    order?.status === "livree" && isBuyer({ reference: order.reference, userId: order.userId ?? null }, sp.t, user)
      ? await getOrderForReview(order.reference)
      : undefined;

  return (
    <div className="shell py-10 lg:py-14">
      <header className="mb-8 max-w-xl">
        <Eyebrow>Suivi</Eyebrow>
        <h1 className="mt-2 text-3xl sm:text-4xl">Où en est ma commande&nbsp;?</h1>
        <p className="mt-2 text-fg-2">
          Entrez la référence reçue à la validation, du type BTH-2607-1042.
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
          <h2 className="text-lg">Aucune commande sous cette référence</h2>
          <p className="mt-2 text-sm text-fg-2">
            Vérifiez la référence, elle commence par BTH. Si le problème
            persiste, appelez la boutique au +225 07 78 84 84 74.
          </p>
          <p className="mt-3 text-sm text-fg-3">
            Pour tester la démonstration, essayez{" "}
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
              <p className="eyebrow">Référence</p>
              <p className="tabular text-lg font-semibold">{order.reference}</p>
            </div>
            <p className="text-sm text-fg-2">
              Passée le {formatDate(order.createdAt)}
            </p>
          </div>

          <SuiviEnDirect
            key={order.reference}
            reference={order.reference}
            initialStatus={order.status}
            deliveryMode={order.deliveryMode}
            paymentTimeoutMinutes={PAYMENT_TIMEOUT_MINUTES}
          />

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
            {order.paidAt || order.status === "livree" ? (
              documentsAccess ? (
                <a
                  href={invoicePath(order.reference)}
                  className="btn-outline mt-5 inline-flex"
                >
                  Télécharger la facture PDF
                </a>
              ) : (
                // La facture porte le nom, le telephone et l'adresse du client :
                // la seule reference ne suffit pas pour l'obtenir.
                <p className="mt-5 text-sm text-fg-2">
                  La facture est disponible depuis le lien reçu par WhatsApp ou par email, ou
                  depuis votre compte si la commande y est rattachée.
                </p>
              )
            ) : null}
          </div>

          {reviewOrder && reviewOrder.items.length > 0 ? (
            <ReviewSection
              order={reviewOrder}
              token={sp.t}
              thanked={sp.avis === "merci"}
              errorCode={sp["avis-erreur"]}
              errorProductId={sp.produit}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
