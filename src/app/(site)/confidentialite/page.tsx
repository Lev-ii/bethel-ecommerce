import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Confidentialité" };

export default function ConfidentialitePage() {
  return <div className="shell max-w-3xl py-14"><Eyebrow>Vos données</Eyebrow><h1 className="mt-2 text-3xl sm:text-4xl">Confidentialité</h1><div className="mt-8 space-y-6 text-fg-2"><p>Nous utilisons les coordonnées fournies pour traiter les commandes, organiser la livraison et répondre aux demandes.</p><p>Si vous vous inscrivez à la newsletter, nous conservons votre adresse email et la date de votre consentement, uniquement pour vous envoyer nos nouveautés et promotions. Chaque email contient un lien de désinscription ; une fois désinscrit, vous n&apos;êtes plus jamais recontacté.</p><p>Avec votre accord seulement (bandeau affiché à la première visite), nous activons les outils publicitaires de Facebook (Meta) et TikTok, qui mesurent les visites et les achats issus de nos publicités. Sans accord, ils ne sont pas chargés. Vous pouvez changer d&apos;avis à tout moment avec le lien « Cookies » en bas de page.</p><p>Les mots de passe sont hachés. Aucune donnée bancaire n&apos;est stockée par Bethel.</p><p>Pour demander une correction ou une suppression de vos données, contactez-nous au +225 07 78 84 84 74.</p></div></div>;
}