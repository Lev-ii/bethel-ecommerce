import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Questions fréquentes" };

const questions = [
  ["Quels sont les délais de livraison ?", "À Abidjan, comptez généralement 48 heures. Pour l'intérieur du pays, nous vous confirmons le délai par téléphone."],
  ["Puis-je payer à la livraison ?", "Oui, cette option est disponible pour les livraisons. Le paiement se fait directement au livreur."],
  ["Puis-je retirer ma commande en boutique ?", "Oui, choisissez le retrait en boutique lors de la commande. Nous vous appelons pour confirmer sa disponibilité."],
  ["Comment suivre ma commande ?", "Utilisez la référence reçue après la commande sur la page Suivre ma commande."],
];

export default function FaqPage() {
  return <div className="shell max-w-3xl py-14"><Eyebrow>Aide</Eyebrow><h1 className="mt-2 text-3xl sm:text-4xl">Questions fréquentes</h1><div className="mt-8 divide-y divide-line border-y border-line">{questions.map(([question, answer]) => <details key={question} className="py-5"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-3 max-w-2xl text-fg-2">{answer}</p></details>)}</div></div>;
}