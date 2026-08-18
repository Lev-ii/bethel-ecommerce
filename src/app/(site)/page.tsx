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

// Teintes analogues au jaune de marque (#FFED43), reprises de la bande
// "kelvin" du site : ambre profond -> or -> olive. Faible saturation,
// utilisees a basse opacite pour ne pas rivaliser avec le produit.
const CATEGORY_ACCENTS: Record<string, string> = {
  trépieds: "180 116 26", // ambre profond (identique au kelvin-bar)
  microphones: "201 138 58", // ambre chaud
  éclairage: "217 181 74", // or, proche de la marque sans la dupliquer
  objectifs: "156 139 78", // olive dore
  accessoires: "143 122 69", // olive profond
};
const FALLBACK_ACCENT = "156 139 78";

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
              Le materiel des créateurs,
              <br />
              disponible ici<span className="text-brand">.</span>
            </h1>

            <p className="mt-5 max-w-lg text-lg text-fg-2">
              Plus besoin de commander à l&apos;étranger et d&apos;attendre trois
              semaines. Du materiel choisi pour tourner, enregistrer et éclairer,
              en stock et livre sur place.
            </p>

            {/* Bande Kelvin annotee : la reference du metier, pas une decoration. */}
            <div className="mt-9 max-w-md">
              <KelvinBar className="h-2 rounded-full" />
              <div className="tabular mt-2 flex justify-between text-[11px] uppercase tracking-wide text-fg-3">
                <span>3200 K tungstene</span>
                <span>5600 K lumiere du jour</span>
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
              text: "Livre en ville ou a recuperer sur place le jour meme.",
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/boutique?categorie=${c.slug}`}
              style={
                {
                  "--accent": CATEGORY_ACCENTS[c.slug] ?? FALLBACK_ACCENT,
                } as CSSProperties
              }
              className="group flex flex-col justify-between gap-6 rounded-card
                border border-[rgb(var(--accent)/0.28)] bg-[rgb(var(--accent)/0.08)]
                p-5 transition-colors
                hover:border-[rgb(var(--accent)/0.55)] hover:bg-[rgb(var(--accent)/0.13)]"
            >
              <div>
                <h3 className="text-lg leading-snug">{c.name}</h3>
                <p className="mt-1.5 text-sm text-fg-2">{c.tagline}</p>
              </div>
              <span className="tabular flex items-center gap-1.5 text-xs uppercase tracking-wide text-fg-3">
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
          eyebrow="Selection"
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
        <ProductGrid products={featured} />
      </section>

      {/* Promotions */}
      {promos.length > 0 ? (
        <section className="border-t border-line bg-bg-2">
          <div className="shell py-14">
            <SectionHeading eyebrow="Prix reduits" title="En promotion" />
            <ProductGrid products={promos} />
          </div>
        </section>
      ) : null}
    </>
  );
}