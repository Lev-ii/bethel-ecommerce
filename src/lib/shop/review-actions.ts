"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { assertAdmin, currentUser } from "@/lib/auth/current";
import { moderateReview, submitReview } from "@/lib/shop/review-store";
import { ReviewError } from "@/lib/shop/reviews";

function trackingUrl(reference: string, token: string, extra: string) {
  const params = new URLSearchParams({ ref: reference });
  if (token) params.set("t", token);
  return `/suivi?${params.toString()}&${extra}#avis`;
}

/** Avis d'un acheteur, depuis sa page de suivi. */
export async function submitReviewAction(formData: FormData) {
  const reference = String(formData.get("reference") ?? "");
  const token = String(formData.get("t") ?? "");
  const productId = String(formData.get("productId") ?? "");
  let target: string;
  try {
    await submitReview({
      reference,
      token: token || undefined,
      user: await currentUser(),
      productId,
      raw: { rating: formData.get("rating"), body: formData.get("body"), authorName: formData.get("authorName") },
    });
    target = trackingUrl(reference, token, "avis=merci");
  } catch (error) {
    const code = error instanceof ReviewError ? error.code : "inconnue";
    if (!(error instanceof ReviewError)) console.error("[avis]", error);
    target = trackingUrl(reference, token, `avis-erreur=${code}&produit=${encodeURIComponent(productId)}`);
  }
  redirect(target);
}

/** Publier ou refuser un avis, depuis l'administration. */
export async function moderateReviewAction(formData: FormData) {
  const admin = await assertAdmin();
  const decision = formData.get("decision") === "publie" ? "publie" : "refuse";
  const back = String(formData.get("retour") ?? "en_attente");
  const result = await moderateReview(admin, String(formData.get("id") ?? ""), decision);
  if (result) {
    // La moyenne figure sur les cartes produits, les avis sur la fiche.
    revalidateTag("products");
    revalidatePath(`/boutique/${result.productSlug}`);
  }
  revalidatePath("/admin/avis");
  redirect(`/admin/avis?statut=${encodeURIComponent(back)}&ok=${decision}`);
}
