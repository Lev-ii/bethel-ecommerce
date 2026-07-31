import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="text-3xl">Cette page n&apos;existe pas</h1>
      <p className="max-w-sm text-fg-2">
        Le lien est peut-etre ancien, ou le produit a ete retire du catalogue.
      </p>
      <Link href="/boutique" className="btn-primary mt-2">
        Voir le materiel
      </Link>
    </div>
  );
}
