import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { ReviewStars } from "@/components/product/ReviewStars";
import { StarInput } from "@/components/order/StarInput";
import { FormError, SubmitButton } from "@/components/ui/Form";
import { submitReviewAction } from "@/lib/shop/review-actions";
import type { OrderForReview } from "@/lib/shop/review-store";
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, REVIEW_NAME_MAX, defaultAuthorName, reviewErrorMessage } from "@/lib/shop/reviews";

/**
 * « Notez vos articles » : sous la page de suivi d'une commande livree,
 * seulement pour l'acheteur. Un formulaire par produit ; un produit deja note
 * affiche l'etat de son avis.
 */
export function ReviewSection({
  order,
  token,
  thanked,
  errorCode,
  errorProductId,
}: {
  order: OrderForReview;
  token?: string;
  thanked: boolean;
  errorCode?: string;
  errorProductId?: string;
}) {
  const authorName = defaultAuthorName(order.customerName);

  return (
    <section id="avis" className="mt-8 scroll-mt-24 border-t border-line pt-6">
      <h2 className="text-lg">Notez vos articles</h2>
      <p className="mt-1 text-sm text-fg-2">
        Votre avis aide les autres créateurs à choisir. Il est publié après une vérification rapide par notre équipe,
        avec la mention « Achat vérifié ».
      </p>

      {thanked ? (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-card border border-ok/40 bg-ok/5 px-4 py-3 text-sm text-ok">
          <CheckCircle2 size={16} aria-hidden /> Merci pour votre avis ! Il sera publié après validation.
        </p>
      ) : null}

      <ul className="mt-5 grid gap-5 lg:grid-cols-2">
        {order.items.map((item) => (
          <li key={item.productId} className="rounded-card border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {item.productSlug ? (
                  <Link href={`/boutique/${item.productSlug}`} className="hover:underline">
                    {item.name}
                  </Link>
                ) : (
                  item.name
                )}
              </p>
              {item.review ? (
                <span className="inline-flex items-center gap-2 text-sm text-fg-2">
                  <ReviewStars rating={item.review.rating} />
                  {item.review.status === "publie" ? (
                    <span className="text-ok">Publié</span>
                  ) : item.review.status === "en_attente" ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={13} aria-hidden /> En attente de validation
                    </span>
                  ) : (
                    <span>Non publié</span>
                  )}
                </span>
              ) : null}
            </div>

            {!item.review ? (
              <form action={submitReviewAction} className="mt-4 space-y-4">
                <input type="hidden" name="reference" value={order.reference} />
                <input type="hidden" name="t" value={token ?? ""} />
                <input type="hidden" name="productId" value={item.productId} />
                {errorProductId === item.productId ? <FormError message={reviewErrorMessage(errorCode)} /> : null}
                <StarInput name="rating" id={`note-${item.productId}`} />
                <div>
                  <label htmlFor={`avis-${item.productId}`} className="field-label">
                    Votre avis
                  </label>
                  <textarea
                    id={`avis-${item.productId}`}
                    name="body"
                    required
                    minLength={REVIEW_BODY_MIN}
                    maxLength={REVIEW_BODY_MAX}
                    rows={3}
                    placeholder="Qualité, facilité d'utilisation, ce que vous en faites…"
                    className="field"
                  />
                </div>
                <div className="max-w-xs">
                  <label htmlFor={`nom-${item.productId}`} className="field-label">
                    Nom affiché
                  </label>
                  <input
                    id={`nom-${item.productId}`}
                    name="authorName"
                    required
                    minLength={2}
                    maxLength={REVIEW_NAME_MAX}
                    defaultValue={authorName}
                    className="field"
                  />
                </div>
                <SubmitButton pendingLabel="Envoi...">Envoyer mon avis</SubmitButton>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
