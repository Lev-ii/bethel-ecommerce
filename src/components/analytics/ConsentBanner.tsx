"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONSENT_OPEN_EVENT, pixelsConfigured, readConsent, writeConsent } from "@/lib/tracking/pixels";

/**
 * Bandeau de consentement aux pixels publicitaires. Affiche a la premiere
 * visite (et depuis le lien « Cookies »), seulement si un pixel est configure.
 * Refuser est aussi simple qu'accepter.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!pixelsConfigured()) return;
    if (readConsent() === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (consent: "accepte" | "refuse") => {
    writeConsent(consent);
    setOpen(false);
  };

  return (
    <section
      aria-label="Cookies publicitaires"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/95 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur"
    >
      <div className="shell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg-2">
          Nous utilisons les outils de Facebook et TikTok pour mesurer nos publicités. Ils ne sont activés qu&apos;avec
          votre accord.{" "}
          <Link href="/confidentialite" className="underline underline-offset-4">
            En savoir plus
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn-outline" onClick={() => choose("refuse")}>
            Refuser
          </button>
          <button type="button" className="btn-primary" onClick={() => choose("accepte")}>
            Accepter
          </button>
        </div>
      </div>
    </section>
  );
}

/** Lien du pied de page pour revoir son choix. */
export function CookieSettingsButton({ className }: { className?: string }) {
  if (!pixelsConfigured()) return null;
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
      Cookies
    </button>
  );
}
