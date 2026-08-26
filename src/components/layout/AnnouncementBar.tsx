import Link from "next/link";

export function AnnouncementBar() {
  return (
    <div className="bg-fg px-4 py-2 text-center text-xs font-medium text-bg">
      Livraison à Abidjan sous 48 h · Paiement à la livraison disponible ·{" "}
      <Link href="/faq" className="underline underline-offset-2">Besoin d'aide ?</Link>
    </div>
  );
}