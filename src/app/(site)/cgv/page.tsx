import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Conditions generales de vente" };

export default function CgvPage() {
  return (
    <LegalPage title="Conditions générales de vente" eyebrow="Cadre de vente">
      <h2>Commandes</h2>
      <p>La commande est validée après vérification des coordonnées et de la disponibilité des produits.</p>
      <h2>Paiement</h2>
      <p>Le paiement à la livraison est réglé au livreur. Les paiements en ligne sont actuellement simulés et seront remplacés par un prestataire marchand avant ouverture.</p>
      <h2>Livraison et retrait</h2>
      <p>Les délais annoncés sont indicatifs. Les frais sont affichés avant la validation et dépendent de la zone de livraison.</p>
      <h2>Retours</h2>
      <p>Contactez-nous dans les 7 jours suivant la réception pour signaler un produit défectueux ou non conforme.</p>
    </LegalPage>
  );
}

function LegalPage({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <div className="shell max-w-3xl py-14"><Eyebrow>{eyebrow}</Eyebrow><h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1><div className="prose mt-8 max-w-none space-y-6 text-fg-2">{children}</div></div>;
}