"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { GearImage } from "@/components/product/GearImage";
import { PromoCountdown } from "@/components/product/PromoCountdown";
import { discountPercent, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

/**
 * Carte d'arrivee : a la premiere page vue, une carte monte en bas de
 * l'ecran avec la derniere nouveaute et la meilleure promotion.
 *
 * - une fois par session et par selection : vue, elle ne revient qu'a la
 *   visite suivante, ou plus tot si la nouveaute ou la promotion change ;
 * - jamais pendant l'achat (panier, commande, suivi) ni sur les pages de
 *   compte : elle y gênerait plus qu'elle n'aiderait ;
 * - non modale : pas de fond grise, la page reste utilisable ; Echap la ferme ;
 * - mouvement reduit respecte : la carte apparait sans glisser.
 */

export const ARRIVAL_STORAGE_KEY = "bethel-carte-arrivee";
const ARRIVAL_DELAY_MS = 1200;
const HIDDEN_PREFIXES = ["/panier", "/commande", "/suivi", "/compte", "/connexion", "/inscription", "/mot-de-passe-oublie"];

type Item = { product: Product; kind: "nouveau" | "promo" };

export function ArrivalCard({ arrival, promo }: { arrival?: Product; promo?: Product }) {
  const pathname = usePathname();
  const [state, setState] = useState<"hidden" | "open" | "closing">("hidden");

  const items: Item[] = [];
  if (arrival) items.push({ product: arrival, kind: "nouveau" });
  if (promo && promo.id !== arrival?.id) items.push({ product: promo, kind: "promo" });
  const signature = items.map((i) => `${i.kind}:${i.product.id}`).join("|");
  const hiddenHere = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (!signature || hiddenHere || state !== "hidden") return;
    let seen: string | null = null;
    try {
      seen = window.sessionStorage.getItem(ARRIVAL_STORAGE_KEY);
    } catch {
      // Stockage indisponible : la carte s'affiche, sans memoire.
    }
    if (seen === signature) return;
    const timer = setTimeout(() => {
      try {
        window.sessionStorage.setItem(ARRIVAL_STORAGE_KEY, signature);
      } catch {
        // Tant pis : elle reviendra a la prochaine page chargee.
      }
      setState("open");
    }, ARRIVAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [signature, hiddenHere, state]);

  const close = () => setState("closing");

  useEffect(() => {
    if (state !== "open") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  // Navigation vers une page d'achat pendant qu'elle est ouverte : on la retire.
  if (state === "hidden" || (hiddenHere && state === "open")) return null;

  return (
    <aside
      aria-label="À ne pas manquer"
      data-testid="carte-arrivee"
      onAnimationEnd={() => state === "closing" && setState("hidden")}
      className={`fixed bottom-4 left-4 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-bg shadow-2xl motion-reduce:animate-none ${
        state === "closing" ? "animate-card-out" : "animate-card-in"
      }`}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="eyebrow">À ne pas manquer</p>
        <button type="button" onClick={close} className="btn-ghost -mr-2 p-1.5" aria-label="Fermer">
          <X size={16} aria-hidden />
        </button>
      </div>
      <ul>
        {items.map(({ product, kind }, index) => {
          const off = discountPercent(product);
          return (
            <li
              key={kind}
              className="animate-rise-in border-b border-line last:border-b-0 motion-reduce:animate-none"
              style={{ animationDelay: `${250 + index * 120}ms` }}
            >
              <Link
                href={`/boutique/${product.slug}`}
                onClick={close}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-2"
              >
                <GearImage src={product.image} alt="" size={128} compact className="h-16 w-16 shrink-0 rounded-card" />
                <div className="min-w-0 flex-1">
                  <span
                    className={`relative inline-flex overflow-hidden rounded-card px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      kind === "nouveau" ? "bg-brand text-brand-ink" : "bg-danger text-white"
                    }`}
                  >
                    {kind === "nouveau" ? "Nouveau" : off ? `Promo -${off}%` : "Promo"}
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1/3 animate-shine bg-white/50 blur-[2px] motion-reduce:hidden"
                    />
                  </span>
                  <p className="mt-1 truncate text-sm font-semibold group-hover:underline">{product.name}</p>
                  <p className="tabular text-xs">
                    <span className="font-semibold">{formatPrice(product.price)}</span>
                    {kind === "promo" && product.compareAtPrice ? (
                      <span className="ml-2 text-fg-3 line-through">{formatPrice(product.compareAtPrice)}</span>
                    ) : null}
                  </p>
                  {kind === "promo" && product.promotion?.active ? (
                    <PromoCountdown endsAt={product.promotion.endsAt} className="mt-0.5" />
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
