"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Check, Heart } from "lucide-react";
import { Celebration } from "@/components/cart/Celebration";
import { playChime, unlockAudio, watchAudio } from "@/components/ui/sounds";
import { orderStatusFlow } from "@/lib/format";
import {
  TRACKING_POLL_MS,
  isFinalStatus,
  statusLabelFor,
  trackingEvent,
} from "@/lib/shop/tracking";
import type { OrderStatus } from "@/lib/types";

/**
 * Etapes d'une commande, mises a jour sans recharger la page.
 *
 * Le navigateur interroge /api/commande/<ref>/statut toutes les
 * TRACKING_POLL_MS, seulement quand l'onglet est visible, et s'arrete des que
 * la commande est livree ou annulee. Une interrogation plutot qu'un flux
 * ouvert : chaque requete est courte et mise en cache par le CDN, alors
 * qu'un flux par client tiendrait une connexion a la base (voir l'incident
 * du flux d'administration, commit du 15-09).
 */
export function SuiviEnDirect({
  reference,
  initialStatus,
  deliveryMode,
  paymentTimeoutMinutes,
}: {
  reference: string;
  initialStatus: OrderStatus;
  deliveryMode: "livraison" | "retrait";
  paymentTimeoutMinutes: number;
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const statusRef = useRef(initialStatus);
  const router = useRouter();

  useEffect(() => watchAudio(setSoundOn), []);

  const check = useCallback(async () => {
    if (isFinalStatus(statusRef.current)) return;
    try {
      const response = await fetch(`/api/commande/${encodeURIComponent(reference)}/statut`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { status: OrderStatus };
      const event = trackingEvent(statusRef.current, data.status, deliveryMode);
      statusRef.current = data.status;
      setStatus(data.status);
      if (event.kind === "none") return;
      setAnnouncement(event.message);
      if (event.kind === "delivered") {
        setCelebrate(true);
        // Fait apparaitre « Notez vos articles », rendue cote serveur.
        router.refresh();
      }
      else void playChime();
    } catch {
      // Reseau coupe : on reessaiera au prochain tour.
    }
  }, [reference, deliveryMode, router]);

  useEffect(() => {
    if (isFinalStatus(initialStatus)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible" || isFinalStatus(statusRef.current)) return;
      timer = setTimeout(async () => {
        await check();
        schedule();
      }, TRACKING_POLL_MS);
    };
    // Retour sur l'onglet : on verifie tout de suite, puis on reprend le rythme.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check().then(schedule);
      else clearTimeout(timer);
    };
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [initialStatus, check]);

  const currentIndex = orderStatusFlow.indexOf(status);
  const delivered = status === "livree";
  const live = !isFinalStatus(status);

  return (
    <>
      {celebrate ? <Celebration reference={reference} storageKey={`bethel-livree-${reference.toLowerCase()}`} /> : null}

      {live ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-fg-2">
          <p className="flex items-center gap-2">
            <span aria-hidden className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            Suivi en direct : cette page se met à jour toute seule.
          </p>
          {soundOn ? (
            <span className="inline-flex items-center gap-1.5 text-fg-3">
              <Bell size={14} aria-hidden /> Son activé
            </span>
          ) : (
            <button type="button" onClick={() => void unlockAudio()} className="btn-outline inline-flex items-center gap-1.5 py-1.5 text-sm">
              <BellOff size={14} aria-hidden /> Activer le son
            </button>
          )}
        </div>
      ) : null}

      {/* Annonce lue par les lecteurs d'ecran a chaque changement d'etape. */}
      <div aria-live="polite" role="status" className="mt-4">
        {announcement ? (
          <p className="rounded-card border border-ok/30 bg-ok/5 px-4 py-3 text-sm font-medium text-ok motion-safe:animate-[pulse_1s_ease-in-out_2]">
            {announcement}
          </p>
        ) : null}
      </div>

      {status === "attente_paiement" ? (
        <p className="mt-6 rounded-card border border-line bg-bg-2 p-4 text-sm text-fg-2">
          <span className="font-semibold text-fg">Paiement en attente.</span> La commande sera traitée dès que le
          paiement mobile money sera confirmé. Sans paiement sous {paymentTimeoutMinutes} minutes, elle est annulée
          automatiquement.
        </p>
      ) : status === "annulee" ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/5 p-4 text-sm text-fg-2">
          <span className="font-semibold text-danger">Commande annulée.</span> Si vous avez été débité, contactez-nous
          avec cette référence.
        </p>
      ) : null}

      {delivered ? (
        <div className="mt-6 rounded-card border border-brand/60 bg-brand/15 p-5">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Heart size={18} aria-hidden className="text-danger" /> Merci pour votre confiance !
          </p>
          <p className="mt-2 text-sm text-fg-2">
            {deliveryMode === "retrait"
              ? "Votre commande a bien été retirée en boutique."
              : "Votre commande vous a bien été livrée."}{" "}
            Nous espérons que ce matériel vous aidera à créer. Une question, un souci ? Appelez-nous au +225 07 78 84 84
            74, nous sommes là.
          </p>
          <Link href="/boutique" className="btn-primary mt-4 inline-flex">
            Continuer mes achats
          </Link>
        </div>
      ) : null}

      {/* Etapes du parcours. L'etat courant est nomme, pas seulement colore. */}
      <ol className="mt-7 space-y-0">
        {orderStatusFlow.map((step, index) => {
          const done = currentIndex >= index;
          const isCurrent = currentIndex === index;
          return (
            <li key={step} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] transition-colors duration-500 ${
                    done ? "border-ok bg-ok text-bg" : "border-line text-fg-3"
                  }`}
                >
                  {done ? <Check size={14} /> : index + 1}
                </span>
                {index < orderStatusFlow.length - 1 ? (
                  <span aria-hidden className={`w-px flex-1 transition-colors duration-500 ${done ? "bg-ok" : "bg-line"}`} />
                ) : null}
              </div>
              <div className="pb-6">
                <p className={`font-semibold ${done ? "" : "text-fg-3"}`} data-etape={step}>
                  {statusLabelFor(step, deliveryMode)}
                  {isCurrent && !delivered ? (
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
    </>
  );
}
