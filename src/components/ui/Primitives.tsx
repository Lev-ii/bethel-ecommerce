import Link from "next/link";
import type { ReactNode } from "react";
import { discountPercent, formatPrice, stockLabel, stockState } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Bande de temperature de couleur 3200K -> 5600K. Signature de la marque. */
export function KelvinBar({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`kelvin-bar h-[3px] w-full ${className}`} />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/**
 * Etat du stock. La couleur ne porte jamais l'information seule :
 * le texte dit toujours ce qu'il en est.
 */
export function StockBadge({ product }: { product: Product }) {
  const state = stockState(product);
  const tone =
    state === "out"
      ? "text-danger border-danger/30 bg-danger/5"
      : state === "low"
        ? "text-warn border-warn/30 bg-warn/5"
        : "text-ok border-ok/30 bg-ok/5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-card border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${tone}`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {stockLabel(product)}
    </span>
  );
}

export function Price({
  product,
  size = "base",
}: {
  product: Product;
  size?: "base" | "lg";
}) {
  const off = discountPercent(product);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span
        className={`tabular font-semibold ${size === "lg" ? "text-2xl" : "text-base"}`}
      >
        {formatPrice(product.price)}
      </span>
      {product.compareAtPrice ? (
        <>
          <span className="tabular text-sm text-fg-3 line-through">
            {formatPrice(product.compareAtPrice)}
          </span>
          {off ? (
            <span className="tabular rounded-card bg-brand/25 px-1.5 py-0.5 text-[11px] font-semibold text-brand-deep">
              -{off}%
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <KelvinBar className="w-14" />
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-sm text-sm text-fg-2">{description}</p>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn-primary mt-2">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="text-2xl sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
