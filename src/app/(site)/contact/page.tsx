import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return <div className="shell max-w-3xl py-14"><Eyebrow>Nous joindre</Eyebrow><h1 className="mt-2 text-3xl sm:text-4xl">Une question sur un produit ?</h1><p className="mt-3 max-w-xl text-fg-2">Notre équipe vous répond et vous aide à choisir le matériel adapté à votre projet.</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><a href="tel:+2250778848474" className="card flex items-center gap-3 p-5"><Phone size={20} aria-hidden /><span><strong className="block">Téléphone</strong><span className="text-sm text-fg-2">+225 07 78 84 84 74</span></span></a><a href="mailto:studiobethelci@gmail.com" className="card flex items-center gap-3 p-5"><Mail size={20} aria-hidden /><span><strong className="block">Email</strong><span className="text-sm text-fg-2">studiobethelci@gmail.com</span></span></a></div><p className="mt-8 text-sm text-fg-2">Retrait en boutique du lundi au samedi. Consultez aussi notre <Link href="/faq" className="font-semibold underline underline-offset-4">FAQ</Link>.</p></div>;
}