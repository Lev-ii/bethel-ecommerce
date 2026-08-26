import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "À propos" };

export default function AboutPage() {
  return <div className="shell max-w-3xl py-14"><Eyebrow>À propos de Bethel</Eyebrow><h1 className="mt-2 text-3xl sm:text-4xl">Du matériel choisi pour créer ici.</h1><div className="mt-8 space-y-6 text-lg leading-relaxed text-fg-2"><p>Bethel est une boutique pensée pour les créateurs de contenu à Abidjan et en Côte d'Ivoire.</p><p>Nous sélectionnons des accessoires utiles, disponibles localement, avec des fiches claires et un accompagnement humain avant et après l'achat.</p><p>Notre objectif est simple : vous permettre de tourner, enregistrer et éclairer vos projets sans attendre un colis venu de l'étranger.</p></div></div>;
}