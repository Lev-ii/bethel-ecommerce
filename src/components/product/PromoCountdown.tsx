"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import { countdownTo, formatCountdown, formatPromotionEnd } from "@/lib/shop/promotion";

/**
 * Compte a rebours d'une promotion datee.
 *
 * Le rendu serveur affiche la date de fin (« jusqu'au 25/09 a 18:00 ») : juste
 * sans JavaScript, et identique au premier rendu du navigateur. Le decompte
 * prend le relais une fois la page chargee. A zero, la page est rafraichie :
 * le prix normal revient (le catalogue est en cache au plus 30 s, d'ou un
 * second rafraichissement).
 */
const CATALOG_CACHE_MS = 31_000;

export function PromoCountdown({
  endsAt,
  variant = "compact",
  className = "",
}: {
  endsAt: string;
  variant?: "compact" | "large";
  className?: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const refreshed = useRef(false);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = now === null ? undefined : countdownTo(endsAt, now);

  useEffect(() => {
    if (left !== null || refreshed.current) return;
    refreshed.current = true;
    router.refresh();
    const later = setTimeout(() => router.refresh(), CATALOG_CACHE_MS);
    return () => clearTimeout(later);
  }, [left, router]);

  const text =
    left === undefined ? formatPromotionEnd(endsAt) : left === null ? "Promotion terminée" : `Fin dans ${formatCountdown(left)}`;

  if (variant === "large") {
    return (
      <p
        role="timer"
        aria-label={left ? `Promotion, fin dans ${formatCountdown(left)}` : text}
        className={`inline-flex items-center gap-2 rounded-card border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-semibold text-danger ${className}`}
      >
        <Timer size={16} aria-hidden />
        <span className="tabular">{left === undefined ? `Promotion ${text}` : text}</span>
      </p>
    );
  }
  return (
    <p role="timer" className={`tabular inline-flex items-center gap-1 text-xs font-medium text-danger ${className}`}>
      <Timer size={12} aria-hidden />
      {text}
    </p>
  );
}
