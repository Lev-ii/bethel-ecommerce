import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { ProductGrid } from "@/components/product/ProductCard";
import {
  Eyebrow,
  KelvinBar,
  SectionHeading,
} from "@/components/ui/Primitives";
import {
  getCategories,
  getFeaturedProducts,
  getHeroProduct,
  getProducts,
} from "@/lib/repository";
import { GearImage } from "@/components/product/GearImage";

// Palette chaude pour le mode jour : plus claire, plus douce, mais encore
// imposee. En mode nuit, on assombrit legerement la teinte pour garder le
// meme rendu sans eblouir.
const CATEGORY_ACCENTS: Record<string, string> = {
  trepieds: "255 138 117", // FF8A75
  microphones: "255 161 117", // FFA175
  eclairage: "255 184 117", // FFB875
  objectifs: "255 204 117", // FFCC75
  accessoires: "255 227 117", // FFE375
};
const FALLBACK_ACCENT = "255 194 122";

export default async function AccueilPage() {
  const [featured, categories, all, hero] = await Promise.all([
    getFeaturedProducts(4),
    getCategories(),
    getProducts(),
    getHeroProduct(),
  ]);
  const promos = all.filter((p) => p.compareAtPrice).slice(0, 4);

  return (
    <>
      {/* Hero : la these de la boutique, avec la fiche technique en preuve. */}
      <section className="border-b border-line bg-bg-2">
        <div className="shell grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="animate-rise-in">
            <Eyebrow>Trépieds · Micros · Lumière · Accessoires</Eyebrow>

            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl">
              Le matériel des créateurs,
              <br />
              disponible ici<span className="text-brand">.</span>
            </h1>

            <p className="mt-5 max-w-lg text-lg text-fg-2">
              Plus besoin de commander à l&apos;étranger et d&apos;attendre trois
              semaines. Du matériel choisi pour tourner, enregistrer et éclairer,
              en stock et livré sur place.
            </p>

            {/* Bande Kelvin annotee : la reference du metier, pas une decoration. */}
            <div className="mt-9 max-w-md">
              <KelvinBar className="h-2 rounded-full" />
              <div className="tabular mt-2 flex justify-between text-[11px] uppercase tracking-wide text-fg-3">
                <span>3200 K tungstene</span>
                <span>5600 K lumière du jour</span>
              </div>
            </div>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/boutique" className="btn-primary">
                Voir le matériel <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/suivi" className="btn-outline">
                Suivre une commande
              </Link>
            </div>
          </div>

          {/* Fiche technique du produit mis en avant. */}
          {hero ? (
            <Link
              href={`/boutique/${hero.slug}`}
              className="card group block overflow-hidden transition-colors hover:border-fg"
            >
              <div className="grid grid-cols-[1fr_1.1fr]">
                <GearImage
                  src={hero.image}
                  alt={hero.name}
                  priority
                  className="h-full w-full"
                />
                <div className="border-l border-line p-5">
                  <Eyebrow>Fiche technique</Eyebrow>
                  <h2 className="mt-2 text-lg leading-snug">{hero.name}</h2>
                  <dl className="mt-4">
                    {hero.specs.slice(0, 4).map((s) => (
                      <div key={s.label} className="spec-row">
                        <dt className="text-xs text-fg-3">{s.label}</dt>
                        <dd className="tabular text-xs font-medium">
                          {s.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
                    Voir le produit
                    <ArrowRight
                      size={15}
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </p>
                </div>
              </div>
            </Link>
          ) : null}
        </div>
      </section>

      {/* Reassurance : trois promesses concretes, pas des slogans. */}
      <section className="border-b border-line">
        <div className="shell grid gap-6 py-8 sm:grid-cols-3">
          {[
            {
              icon: PackageCheck,
              title: "Stock réel affiché",
              text: "Le nombre de pièces restantes est celui de la boutique.",
            },
            {
              icon: Truck,
              title: "Livraison ou retrait",
              text: "Livré en ville ou à récupérer sur place le jour même.",
            },
            {
              icon: ShieldCheck,
              title: "Paiement sécurisé",
              text: "Mobile money ou carte. Aucune donnée bancaire conservée.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <Icon
                size={20}
                aria-hidden
                className="mt-0.5 shrink-0 text-brand-deep"
              />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-sm text-fg-2">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="shell py-14">
        <SectionHeading
          eyebrow="Par usage"
          title="Qu'est-ce que vous cherchez ?"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/boutique?categorie=${c.slug}`}
              style={
                {
                  "--accent": CATEGORY_ACCENTS[c.slug] ?? FALLBACK_ACCENT,
                } as CSSProperties
              }
              className="group flex flex-col justify-between gap-6 rounded-card border
                border-[rgb(var(--accent)/0.7)] bg-[rgb(var(--accent))] p-5 text-brand-ink
                shadow-[inset_0_0_0_1px_rgba(17,17,17,0.05)] transition-transform duration-150
                hover:-translate-y-0.5 dark:brightness-90"
            >
              <div>
                <h3 className="text-lg leading-snug text-brand-ink">{c.name}</h3>
                <p className="mt-1.5 text-sm text-[rgb(var(--brand-ink)/0.74)]">
                  {c.tagline}
                </p>
              </div>
              <span className="tabular flex items-center gap-1.5 text-xs uppercase tracking-wide text-[rgb(var(--brand-ink)/0.82)]">
                Parcourir
                <ArrowRight
                  size={13}
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Selection */}
      <section className="shell pb-14">
        <SectionHeading
          eyebrow="Sélection"
          title="Les plus achetés"
          action={
            <Link
              href="/boutique"
              className="text-sm font-semibold underline underline-offset-4"
            >
              Tout le matériel
            </Link>
          }
        />
        <ProductGrid products={featured} layout="rangee" />
      </section>

      {/* Promotions */}
      {promos.length > 0 ? (
        <section className="border-t border-line bg-bg-2">
          <div className="shell py-14">
            <SectionHeading eyebrow="Prix réduits" title="En promotion" />
            <ProductGrid products={promos} layout="rangee" />
          </div>
        </section>
      ) : null}
    </>
  );
}