"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { markAllOrdersSeen, markOrderSeen } from "@/lib/admin/actions";
import { useUnseenOrderCount } from "@/components/admin/AdminNotifications";

/** Marque la commande comme lue a la premiere ouverture de sa ligne. */
export function MarkSeenOnOpen({ orderId }: { orderId: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  const { markSeen } = useUnseenOrderCount();
  const router = useRouter();

  useEffect(() => {
    const details = marker.current?.closest("details");
    if (!details) return;
    let done = false;
    const onToggle = () => {
      if (!details.open || done) return;
      done = true;
      markSeen(orderId);
      void markOrderSeen(orderId).then(() => router.refresh());
    };
    details.addEventListener("toggle", onToggle);
    return () => details.removeEventListener("toggle", onToggle);
  }, [orderId, markSeen, router]);

  return (
    <span
      ref={marker}
      className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
    >
      Nouvelle
    </span>
  );
}

export function MarkAllSeenButton() {
  const { count, clear } = useUnseenOrderCount();
  const [pending, startTransition] = useTransition();
  if (count === 0) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          clear();
          await markAllOrdersSeen();
        })
      }
      className="btn-outline px-3 py-1.5 text-sm"
    >
      Tout marquer comme lu ({count})
    </button>
  );
}
