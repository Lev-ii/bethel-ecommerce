import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { ReviewStars } from "@/components/product/ReviewStars";
import { SubmitButton } from "@/components/ui/Form";
import { requireAdmin } from "@/lib/auth/current";
import { formatDateTime } from "@/lib/format";
import { moderateReviewAction } from "@/lib/shop/review-actions";
import { countReviewsByStatus, getReviewsForAdmin } from "@/lib/shop/review-store";
import type { ReviewStatus } from "@/lib/shop/reviews";

export const metadata: Metadata = { title: "Avis" };

const TABS: Array<{ key: ReviewStatus; label: string }> = [
  { key: "en_attente", label: "À modérer" },
  { key: "publie", label: "Publiés" },
  { key: "refuse", label: "Refusés" },
];

type Params = Promise<{ statut?: string; ok?: string }>;

export default async function AvisPage({ searchParams }: { searchParams: Params }) {
  await requireAdmin();
  const sp = await searchParams;
  const status: ReviewStatus = TABS.some((t) => t.key === sp.statut) ? (sp.statut as ReviewStatus) : "en_attente";
  const [reviews, counts] = await Promise.all([getReviewsForAdmin(status), countReviewsByStatus()]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Catalogue</p>
        <h1 className="mt-2 text-3xl">Avis clients</h1>
        <p className="mt-2 max-w-2xl text-fg-2">
          Seuls les acheteurs d&apos;une commande livrée peuvent noter un produit. Un avis n&apos;apparaît sur la
          boutique qu&apos;une fois publié ici. Un avis refusé est conservé, jamais effacé.
        </p>
      </header>

      {sp.ok ? (
        <p role="status" className="flex items-center gap-2 rounded-card border border-ok/40 bg-ok/5 px-4 py-3 text-sm text-ok">
          <CheckCircle2 size={16} aria-hidden />
          {sp.ok === "publie" ? "Avis publié : il apparaît sur la fiche produit." : "Avis refusé : il n'apparaît pas sur la boutique."}
        </p>
      ) : null}

      <nav aria-label="Statut des avis" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/avis?statut=${tab.key}`}
            aria-current={tab.key === status ? "page" : undefined}
            className={`rounded-card border px-3 py-1.5 text-sm ${
              tab.key === status ? "border-fg bg-fg text-bg" : "border-line bg-bg text-fg-2 hover:border-fg-3"
            }`}
          >
            {tab.label} <span className="tabular opacity-70">{counts[tab.key]}</span>
          </Link>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <p className="card px-4 py-10 text-center text-sm text-fg-2">
          {status === "en_attente" ? "Aucun avis à modérer." : "Aucun avis dans cette liste."}
        </p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/boutique/${review.productSlug}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
                    {review.productName} <ExternalLink size={13} aria-hidden />
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-fg-2">
                    <ReviewStars rating={review.rating} />
                    <span>{review.authorName}</span>
                    <span className="text-fg-3">
                      · commande{" "}
                      <Link href={`/admin/commandes?q=${encodeURIComponent(review.orderReference)}`} className="tabular underline underline-offset-4">
                        {review.orderReference}
                      </Link>{" "}
                      · {formatDateTime(review.createdAt)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {review.status !== "publie" ? (
                    <form action={moderateReviewAction}>
                      <input type="hidden" name="id" value={review.id} />
                      <input type="hidden" name="decision" value="publie" />
                      <input type="hidden" name="retour" value={status} />
                      <SubmitButton pendingLabel="..." className="btn border border-ok/40 bg-ok/10 text-ok hover:bg-ok/20">
                        Publier
                      </SubmitButton>
                    </form>
                  ) : null}
                  {review.status !== "refuse" ? (
                    <form action={moderateReviewAction}>
                      <input type="hidden" name="id" value={review.id} />
                      <input type="hidden" name="decision" value="refuse" />
                      <input type="hidden" name="retour" value={status} />
                      <SubmitButton pendingLabel="..." className="btn border border-danger/40 text-danger hover:bg-danger/10">
                        {review.status === "publie" ? "Retirer" : "Refuser"}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{review.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
