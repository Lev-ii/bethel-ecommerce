import Link from "next/link";
import { categories } from "@/lib/data/catalog";
import { KelvinBar } from "@/components/ui/Primitives";
import { Logo } from "@/components/layout/Logo";

export function Footer({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <footer className="mt-20 border-t border-line bg-[#ffed43]">
      <KelvinBar />
      <div className="shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo href={null} className="h-7" variant="dark" />
          <p className="max-w-xs text-sm text-[#46443c]">
            Le materiel des createurs de contenu, disponible sur place. Choisi,
            teste, livre ici.
          </p>
        </div>

        <div className="space-y-3">
          <p className="eyebrow text-[#16150f]">Informations</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/a-propos" className="text-[#46443c] hover:text-[#16150f]">À propos</Link></li>
            <li><Link href="/contact" className="text-[#46443c] hover:text-[#16150f]">Contact</Link></li>
            <li><Link href="/faq" className="text-[#46443c] hover:text-[#16150f]">FAQ</Link></li>
            <li><Link href="/cgv" className="text-[#46443c] hover:text-[#16150f]">CGV</Link></li>
            <li><Link href="/mentions-legales" className="text-[#46443c] hover:text-[#16150f]">Mentions légales</Link></li>
            <li><Link href="/confidentialite" className="text-[#46443c] hover:text-[#16150f]">Confidentialité</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="eyebrow text-[#16150f]">Categories</p>
          <ul className="space-y-2 text-sm">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/boutique?categorie=${c.slug}`}
                  className="text-[#46443c] hover:text-[#16150f]"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <p className="eyebrow text-[#16150f]">Commande</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/suivi" className="text-[#46443c] hover:text-[#16150f]">
                Suivre ma commande
              </Link>
            </li>
            <li>
              <Link href="/panier" className="text-[#46443c] hover:text-[#16150f]">
                Mon panier
              </Link>
            </li>
            {isAdmin ? (
              <li>
                <Link href="/admin" className="text-[#46443c] hover:text-[#16150f]">
                  Administration
                </Link>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="space-y-3">
          <p className="eyebrow text-[#16150f]">Nous joindre</p>
          <ul className="space-y-2 text-sm text-[#46443c] hover:text-[#16150f]">
            <li>
              <a className="tabular" href="tel:+2250778848474" >
                +225 07 78 84 84 74
              </a>
            </li>
            <li>
              <a
                href="mailto:studiobethelci@gmail.com"
                className="text-[#46443c] hover:text-[#16150f]"
              >
                studiobethelci@gmail.com
              </a>
            </li>
            <li>Retrait en boutique du lundi au samedi</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="shell flex flex-col gap-2 py-5 text-xs text-[#6c695e] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Bethel. Tous droits reserves.</p>
          <p className="tabular">
            Studio conçu avec amour à Abidjan, Côte d'Ivoire.
          </p>
        </div>
      </div>
    </footer>
  );
}
