import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { ClearCartOnMount } from "@/components/cart/ClearCartOnMount";
import { Eyebrow, KelvinBar } from "@/components/ui/Primitives";
import { formatPrice } from "@/lib/format";
import { currentUser } from "@/lib/auth/current";
import { canAccessOrderDocuments, invoicePath, trackingPath } from "@/lib/shop/invoice";
import { syncOrderPayment } from "@/lib/shop/payment";

export const metadata: Metadata = { title: "Commande confirmee" };

type SearchParams = Promise<{ ref?: string; total?: string; mode?: string; paiement?: string; t?: string }>;

async function Recap({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const reference = sp.ref ?? "BTH-0000-0000";
  const total = Number(sp.total ?? 0);
  const retrait = sp.mode === "retrait";
  // Le lien de retour apres commande porte le jeton : le client garde l'acces
  // a sa facture. Une reference saisie ou devinee dans l'URL, non.
  const documentsAccess = sp.ref
    ? canAccessOrderDocuments({ reference: sp.ref, token: sp.t, user: await currentUser() })
    : false;

  // Le client revient de la page Jeko : on relit le statut chez eux plutot
  // que d'attendre le webhook, qui peut arriver apres lui (ou se perdre).
  const sync = sp.ref ? await syncOrderPayment({ reference: sp.ref }).catch(() => null) : null;
  const paiementEnAttente =
    sp.paiement === "attente" || (sync?.kind === "checked" && sync.online && !sync.paid && !sync.failed);
  const paiementEchoue = sync?.kind === "checked" && sync.online && sync.failed;
  const paiementRecu = sync?.kind === "checked" && sync.online && sync.paid;

  return (
    <div className="card mx-auto max-w-xl overflow-hidden">
      {sp.ref && !paiementEchoue ? <ClearCartOnMount /> : null}
      <KelvinBar />
      <div className="p-7 text-center">
        <CheckCircle2
          size={40}
          aria-hidden
          className="mx-auto text-ok"
        />
        <Eyebrow>Étape 3 sur 3</Eyebrow>
        <h1 className="mt-2 text-2xl sm:text-3xl">Commande enregistrée</h1>
        <p className="mt-3 text-fg-2">
          Nous vous appelons dans l&apos;heure pour confirmer
          {retrait ? " l'heure de retrait." : " l'adresse de livraison."}
        </p>

        {paiementRecu ? (
          <div className="mt-5 rounded-card border border-ok/30 bg-ok/5 p-4 text-left">
            <p className="text-sm font-semibold text-ok">Paiement reçu</p>
            <p className="mt-1 text-sm text-fg-2">Votre paiement a bien été confirmé.</p>
          </div>
        ) : paiementEchoue ? (
          <div className="mt-5 rounded-card border border-danger/30 bg-danger/5 p-4 text-left">
            <p className="text-sm font-semibold text-danger">Le paiement n&apos;a pas abouti</p>
            <p className="mt-1 text-sm text-fg-2">
              Le paiement n&apos;a pas été validé. Votre panier est conservé : vous pouvez
              réessayer, ou nous contacter si le problème persiste.
            </p>
          </div>
        ) : paiementEnAttente ? (
          <div className="mt-5 rounded-card border border-line bg-bg-2 p-4 text-left">
            <p className="text-sm font-semibold">Paiement en cours de confirmation</p>
            <p className="mt-1 text-sm text-fg-2">
              Si vous n&apos;avez pas encore validé la demande sur votre téléphone, faites-le
              maintenant. La confirmation peut prendre quelques instants ; la commande est
              enregistrée dans tous les cas.
            </p>
          </div>
        ) : null}

        <dl className="mt-7 text-left">
          <div className="spec-row">
            <dt className="text-sm text-fg-2">Référence</dt>
            <dd className="tabular text-sm font-semibold">{reference}</dd>
          </div>
          <div className="spec-row">
            <dt className="text-sm text-fg-2">Montant</dt>
            <dd className="tabular text-sm font-semibold">
              {formatPrice(total)}
            </dd>
          </div>
          <div className="spec-row">
            <dt className="text-sm text-fg-2">Réception</dt>
            <dd className="text-sm font-semibold">
              {retrait ? "Retrait en boutique" : "Livraison sous 48 h"}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-sm text-fg-3">
          Gardez cette référence : elle permet de suivre la commande.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={documentsAccess ? trackingPath(reference) : `/suivi?ref=${encodeURIComponent(reference)}`}
            className="btn-primary"
          >
            Suivre ma commande
          </Link>
          {documentsAccess ? (
          <a href={invoicePath(reference)} className="btn-outline">
            Télécharger la facture PDF
          </a>
          ) : null}
          <Link href="/boutique" className="btn-outline">
            Continuer mes achats
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="shell py-14">
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <Recap searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
