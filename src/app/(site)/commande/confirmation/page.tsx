import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { Eyebrow, KelvinBar } from "@/components/ui/Primitives";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Commande confirmee" };

type SearchParams = Promise<{ ref?: string; total?: string; mode?: string }>;

async function Recap({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const reference = sp.ref ?? "BTH-0000-0000";
  const total = Number(sp.total ?? 0);
  const retrait = sp.mode === "retrait";

  return (
    <div className="card mx-auto max-w-xl overflow-hidden">
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
          <Link href={`/suivi?ref=${reference}`} className="btn-primary">
            Suivre ma commande
          </Link>
          <a href={`/api/commande/${reference}/facture`} className="btn-outline">
            Télécharger la facture PDF
          </a>
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
