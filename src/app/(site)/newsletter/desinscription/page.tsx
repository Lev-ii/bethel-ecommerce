import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eyebrow } from "@/components/ui/Primitives";
import { unsubscribe } from "@/lib/shop/newsletter-store";

export const metadata: Metadata = { title: "Désinscription de la newsletter", robots: { index: false } };

type Params = Promise<{ email?: string; t?: string; fait?: string; erreur?: string }>;

/**
 * Desinscription par le lien des emails. Confirmee par un bouton, jamais a
 * l'ouverture du lien : les logiciels qui ouvrent les liens des emails pour
 * les analyser desinscriraient sinon les gens a leur insu.
 */
async function confirmUnsubscribe(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("t") ?? "");
  const ok = await unsubscribe(email, token);
  redirect(`/newsletter/desinscription?${ok ? "fait=1" : "erreur=lien"}`);
}

export default async function DesinscriptionPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  return (
    <div className="shell py-14">
      <div className="card mx-auto max-w-xl p-7">
        <Eyebrow>Newsletter</Eyebrow>
        {sp.fait ? (
          <>
            <h1 className="mt-2 text-2xl">C&apos;est fait.</h1>
            <p className="mt-2 text-fg-2">Vous ne recevrez plus nos emails. Vous pouvez vous réinscrire à tout moment depuis le bas de chaque page.</p>
            <Link href="/" className="btn-outline mt-5 inline-flex">Retour à la boutique</Link>
          </>
        ) : sp.erreur || !sp.email || !sp.t ? (
          <>
            <h1 className="mt-2 text-2xl">Lien non valide</h1>
            <p className="mt-2 text-fg-2">Utilisez le lien reçu dans un de nos emails, ou écrivez-nous au +225 07 78 84 84 74.</p>
          </>
        ) : (
          <form action={confirmUnsubscribe}>
            <h1 className="mt-2 text-2xl">Ne plus recevoir nos emails ?</h1>
            <p className="mt-2 text-fg-2">
              L&apos;adresse <span className="font-medium text-fg">{sp.email}</span> ne recevra plus la newsletter de Bethel.
            </p>
            <input type="hidden" name="email" value={sp.email} />
            <input type="hidden" name="t" value={sp.t} />
            <button type="submit" className="btn-primary mt-5">Me désinscrire</button>
          </form>
        )}
      </div>
    </div>
  );
}
