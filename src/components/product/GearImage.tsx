import Image from "next/image";

/**
 * Image d'un materiel, posee sur le fond de vignette de la marque.
 *
 * Le fond est en CSS (classe .gear-backdrop) et vit sous l'image. Les vraies
 * photos, une fois disponibles, se posent dessus sans rien changer ici :
 * exportez-les en PNG a fond transparent.
 *
 * Les illustrations SVG de demonstration sont monochromes. Elles sont
 * inversees en mode nuit pour rester lisibles sur le fond sombre. Ce
 * traitement ne s'applique qu'aux .svg : une photo ne sera jamais inversee.
 */
export function GearImage({
  src,
  alt,
  size = 400,
  className = "",
  imageClassName = "",
  padding = "p-[10%]",
  priority = false,
  dimmed = false,
  compact = false,
}: {
  src: string;
  alt: string;
  size?: number;
  /** Classes du fond (dimensions, arrondi). */
  className?: string;
  /** Classes de l'image seule (transitions, transformations). */
  imageClassName?: string;
  /** Marge autour du materiel, pour qu'il respire sur le fond. */
  padding?: string;
  priority?: boolean;
  /** Attenue l'image, pour signaler une rupture de stock. */
  dimmed?: boolean;
  /** Grille resserree, pour les vignettes de moins de 100 px. */
  compact?: boolean;
}) {
  const isPlaceholder = src.endsWith(".svg");

  return (
    <div className={className}>
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className={`h-full w-full object-contain ${padding} ${
          isPlaceholder ? "dark:invert" : ""
        } ${dimmed ? "opacity-40" : ""} ${imageClassName}`}
      />
    </div>
  );
}