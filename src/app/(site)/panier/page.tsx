import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { Eyebrow } from "@/components/ui/Primitives";
import { FormError } from "@/components/ui/Form";
import { syncOrderPayment } from "@/lib/shop/payment";

export const metadata: Metadata = { title: "Mon panier" };

const paymentErrorMessages: Record<string, string> = {
  paiement:
    "Le paiement n'a pas abouti (solde insuffisant, code refusé ou transaction annulée). Vos articles sont toujours dans le panier : vérifiez vos informations et réessayez, ou choisissez un autre moyen de paiement.",
};

type SearchParams = Promise<{ erreur?: string; ref?: string }>;

export default async function PanierPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { erreur, ref } = await searchParams;
  // Retour d'echec Jeko : si le paiement est bien refuse chez eux, la
  // commande est annulee et son stock rendu tout de suite, sans attendre le
  // cron. Encore "pending" (simple retour arriere) : le cron s'en chargera.
  if (erreur === "paiement" && ref) {
    await syncOrderPayment({ reference: ref }).catch(() => null);
  }
  const message = erreur ? (paymentErrorMessages[erreur] ?? "Une erreur est survenue. Réessayez.") : undefined;

  return (
    <div className="shell py-10 lg:py-14">
      <header className="mb-8">
        <Eyebrow>Étape 1 sur 3</Eyebrow>
        <h1 className="mt-2 text-3xl sm:text-4xl">Mon panier</h1>
      </header>
      {message ? (
        <div className="mb-6">
          <FormError message={message} />
        </div>
      ) : null}
      <CartView />
    </div>
  );
}
