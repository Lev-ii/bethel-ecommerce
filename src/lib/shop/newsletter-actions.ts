"use server";

import { subscribe } from "@/lib/shop/newsletter-store";
import { NewsletterError, newsletterErrorMessages } from "@/lib/shop/newsletter";

export interface NewsletterState {
  status: "idle" | "ok" | "error";
  message?: string;
}

export async function subscribeAction(_previous: NewsletterState, formData: FormData): Promise<NewsletterState> {
  try {
    await subscribe({ email: formData.get("email"), consent: formData.get("consent"), source: "pied-de-page" });
    return { status: "ok", message: "Merci ! Vous recevrez nos nouveautés et promotions." };
  } catch (error) {
    if (error instanceof NewsletterError) return { status: "error", message: newsletterErrorMessages[error.code] };
    console.error("[newsletter]", error);
    return { status: "error", message: "L'inscription n'a pas abouti. Réessayez dans un instant." };
  }
}
