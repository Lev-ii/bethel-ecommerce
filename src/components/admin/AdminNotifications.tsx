"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, X } from "lucide-react";
import { POPUP_MAX_ITEMS, accumulate, freshOrders, type OrderSummary } from "@/lib/admin/new-orders";
import { formatPrice } from "@/lib/format";
import type { UnseenOrders } from "@/lib/repository";

interface NotificationsContextValue {
  count: number;
  markSeen: (orderId: string) => void;
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  count: 0,
  markSeen: () => {},
  clear: () => {},
});

export function useUnseenOrderCount() {
  return useContext(NotificationsContext);
}


const TITLE_PREFIX = /^\(\d+\)\s/;

/** Bip court a deux notes, sans fichier audio. */
function playChime(context: AudioContext | null) {
  if (!context) return;
  const now = context.currentTime;
  [880, 1320].forEach((frequency, i) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + i * 0.16);
    gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.16 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.3);
    osc.connect(gain).connect(context.destination);
    osc.start(now + i * 0.16);
    osc.stop(now + i * 0.16 + 0.32);
  });
}

export function AdminNotificationsProvider({
  initial,
  children,
}: {
  initial: UnseenOrders;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(initial.count);
  // Fenetre des nouvelles commandes : reste ouverte jusqu'a ce que l'admin la ferme.
  const [popup, setPopup] = useState<{ items: OrderSummary[]; total: number } | null>(null);
  const known = useRef(new Set(initial.latest.map((o) => o.id)));
  const countRef = useRef(initial.count);
  const audio = useRef<AudioContext | null>(null);

  // Les navigateurs n'autorisent le son qu'apres une interaction : on
  // prepare le contexte audio au premier clic dans l'admin.
  useEffect(() => {
    const unlock = () => {
      if (!audio.current) {
        try {
          audio.current = new AudioContext();
        } catch {
          audio.current = null;
        }
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/admin/commandes/flux");
    source.addEventListener("commandes", (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as UnseenOrders;
      const fresh = freshOrders(data.latest, known.current);
      data.latest.forEach((o) => known.current.add(o.id));
      setCount(data.count);

      if (fresh.length > 0 && data.count > countRef.current) {
        const newest = fresh[0];
        setPopup((current) => accumulate(current ?? { items: [], total: 0 }, fresh));
        playChime(audio.current);
        if ("Notification" in window && Notification.permission === "granted") {
          const notification = new Notification(
            fresh.length > 1 ? `${fresh.length} nouvelles commandes` : "Nouvelle commande",
            {
              body: `${newest.reference} · ${newest.customerName} · ${formatPrice(newest.total)}`,
              tag: "bethel-commandes",
              icon: "/favicon-96x96.png",
            }
          );
          notification.onclick = () => {
            window.focus();
            window.location.assign("/admin/commandes");
            notification.close();
          };
        }
      }
      countRef.current = data.count;
    });
    return () => source.close();
  }, []);

  // Compteur dans le titre de l'onglet, reapplique quand Next change le
  // titre en naviguant.
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(TITLE_PREFIX, "");
      const next = count > 0 ? `(${count}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [count]);

  // Appelee une seule fois par commande non lue ouverte (voir MarkSeenOnOpen).
  const markSeen = useCallback((orderId: string) => {
    known.current.add(orderId);
    setCount((c) => {
      const next = Math.max(0, c - 1);
      countRef.current = next;
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    countRef.current = 0;
    setCount(0);
  }, []);

  return (
    <NotificationsContext.Provider value={{ count, markSeen, clear }}>
      {children}
      {popup ? (
        <div
          role="alert"
          aria-labelledby="popup-commandes-titre"
          className="fixed bottom-5 right-5 z-50 w-[min(24rem,calc(100vw-2.5rem))] animate-rise-in overflow-hidden rounded-card border-2 border-brand bg-bg text-fg shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 bg-brand px-4 py-2.5 text-brand-ink">
            <p id="popup-commandes-titre" className="flex items-center gap-2 text-sm font-semibold">
              <BellRing size={17} aria-hidden />
              {popup.total > 1 ? `${popup.total} nouvelles commandes` : "Nouvelle commande"}
            </p>
            <button
              type="button"
              onClick={() => setPopup(null)}
              aria-label="Fermer"
              className="rounded-card p-1 text-brand-ink/70 transition-colors hover:bg-brand-ink/10 hover:text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-ink"
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <ul className="divide-y divide-line">
            {popup.items.map((order) => (
              <li key={order.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="tabular text-sm font-semibold">{order.reference}</p>
                  <p className="break-words text-xs text-fg-2">{order.customerName}</p>
                </div>
                <p className="tabular shrink-0 text-sm font-semibold">{formatPrice(order.total)}</p>
              </li>
            ))}
          </ul>
          {popup.total > POPUP_MAX_ITEMS ? (
            <p className="border-t border-line px-4 py-2 text-xs text-fg-3">
              et {popup.total - POPUP_MAX_ITEMS} autre{popup.total - POPUP_MAX_ITEMS > 1 ? "s" : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            <Link
              href={
                popup.total === 1
                  ? `/admin/commandes?q=${encodeURIComponent(popup.items[0].reference)}`
                  : "/admin/commandes?etat=recue"
              }
              onClick={() => setPopup(null)}
              className="btn-accent px-3 py-1.5 text-sm"
            >
              {popup.total === 1 ? "Voir la commande" : "Voir les commandes"}
            </Link>
            <button type="button" onClick={() => setPopup(null)} className="btn-ghost px-3 py-1.5 text-sm">
              Plus tard
            </button>
          </div>
        </div>
      ) : null}
    </NotificationsContext.Provider>
  );
}

/** Autoriser les notifications systeme (visibles meme hors de l'onglet). */
export function NotificationPermissionButton() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  if (permission === null || permission === "unsupported") return null;

  if (permission === "granted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-card border border-ok/30 bg-ok/10 px-3 py-1.5 text-sm font-medium text-ok">
        <Bell size={14} aria-hidden /> Alertes activées
      </span>
    );
  }

  if (permission === "denied") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-card border border-warn/30 bg-warn/10 px-3 py-1.5 text-sm font-medium text-warn"
        title="Réautorisez les notifications dans les réglages du navigateur pour ce site."
      >
        <BellOff size={14} aria-hidden /> Alertes bloquées par le navigateur
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => setPermission(await Notification.requestPermission())}
      className="btn-accent inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
    >
      <Bell size={14} aria-hidden /> Activer les alertes commandes
    </button>
  );
}
