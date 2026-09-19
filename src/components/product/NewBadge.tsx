/** Pastille « Nouveau » des produits ajoutes recemment (voir lib/shop/novelty). */
export function NewBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-card bg-brand px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-ink shadow-sm ${className}`}
    >
      Nouveau
    </span>
  );
}
