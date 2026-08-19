import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegalesPage() {
  return <div className="shell max-w-3xl py-14"><Eyebrow>Informations</Eyebrow><h1 className="mt-2 text-3xl sm:text-4xl">Mentions légales</h1><div className="mt-8 space-y-6 text-fg-2"><p>Bethel est une boutique en ligne de matériel pour créateurs de contenu.</p><p>Éditeur : Bethel. Contact : +225 07 78 84 84 74.</p><p>Hébergement : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.</p></div></div>;
}