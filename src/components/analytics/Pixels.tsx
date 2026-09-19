"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, PIXEL_IDS, PIXEL_READY_EVENT, readConsent, trackPageView, type Consent } from "@/lib/tracking/pixels";

/**
 * Scripts officiels de Meta et TikTok, charges seulement apres accord du
 * visiteur. Les identifiants sont valides en amont (lib/tracking/pixels).
 */
function facebookSnippet(id: string) {
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');window.dispatchEvent(new Event('${PIXEL_READY_EVENT.facebook}'));`;
}

function tiktokSnippet(id: string) {
  return `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${id}');ttq.page();w.dispatchEvent(new Event('${PIXEL_READY_EVENT.tiktok}'));}(window,document,'ttq');`;
}

export function Pixels() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const pathname = usePathname();
  const firstPath = useRef<string | null>(null);

  useEffect(() => {
    setConsent(readConsent());
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<Consent>).detail;
      setConsent(next);
      // Retrait de l'accord apres coup : les pixels deja charges cessent de suivre.
      if (next === "refuse") {
        const w = window as unknown as { fbq?: (...a: unknown[]) => void; ttq?: { revokeConsent?: () => void } };
        w.fbq?.("consent", "revoke");
        w.ttq?.revokeConsent?.();
      }
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  // PageView a chaque navigation ; la premiere est envoyee par le script lui-meme.
  useEffect(() => {
    if (consent !== "accepte") return;
    if (firstPath.current === null) {
      firstPath.current = pathname;
      return;
    }
    trackPageView();
  }, [pathname, consent]);

  if (consent !== "accepte") return null;
  return (
    <>
      {PIXEL_IDS.facebook ? (
        <Script id="pixel-facebook" strategy="afterInteractive">
          {facebookSnippet(PIXEL_IDS.facebook)}
        </Script>
      ) : null}
      {PIXEL_IDS.tiktok ? (
        <Script id="pixel-tiktok" strategy="afterInteractive">
          {tiktokSnippet(PIXEL_IDS.tiktok)}
        </Script>
      ) : null}
    </>
  );
}
