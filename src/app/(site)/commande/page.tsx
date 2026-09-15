import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/cart/CheckoutForm";
import { Eyebrow } from "@/components/ui/Primitives";
import { currentUser } from "@/lib/auth/current";
import { getUserById } from "@/lib/repository";

export const metadata: Metadata = { title: "Commander" };

export default async function CommandePage() {
  const session = await currentUser();

  // Le telephone n'est pas dans la session : on le relit pour pre-remplir.
  // Cette lecture est un confort, pas une condition de la commande : si la
  // base ne repond pas, le formulaire s'affiche sans pre-remplissage plutot
  // que de faire tomber le tunnel d'achat sur la frontiere d'erreur.
  let stored;
  if (session) {
    try {
      stored = await getUserById(session.id);
    } catch (error) {
      console.error("[commande] pre-remplissage indisponible", session.id, error);
    }
  }

  const account = session
    ? { name: session.name, email: session.email, phone: stored?.phone }
    : null;

  return (
    <div className="shell py-10 lg:py-14">
      <header className="mb-8">
        <Eyebrow>Etape 2 sur 3</Eyebrow>
        <h1 className="mt-2 text-3xl sm:text-4xl">Commander</h1>
        {!session ? (
          <p className="mt-2 text-fg-2">
            Vous pouvez commander sans compte.{" "}
            <Link
              href="/connexion?suite=/commande"
              className="font-medium underline underline-offset-4"
            >
              Se connecter
            </Link>{" "}
            remplit vos coordonnees et garde la commande dans votre historique.
          </p>
        ) : null}
      </header>

      <CheckoutForm account={account} />
    </div>
  );
}
