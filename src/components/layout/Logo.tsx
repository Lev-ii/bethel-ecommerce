"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * Logo Bethel.
 *
 * Convention reprise de studiobethel.com :
 *   logo-light.png = logo clair, pose SUR un fond sombre
 *   logo-dark.png  = logo sombre, pose SUR un fond clair
 *
 * Les deux fichiers sont rendus en meme temps et l'un des deux est masque en
 * CSS selon la classe "dark" de <html>. C'est volontaire : cela evite le
 * clignotement qu'on aurait en attendant que JavaScript ait lu le theme.
 */
export function Logo({
  href = "/",
  className = "h-7",
  variant = "auto",
  label = "Bethel, accueil",
}: {
  href?: string | null;
  className?: string;
  /** "auto" suit le theme, "light"/"dark" force une version. */
  variant?: "auto" | "light" | "dark";
  label?: string;
}) {
  const common = {
    alt: "Bethel",
    width: 600,
    height: 120,
    priority: true,
  };

  const images =
    variant === "auto" ? (
      <>
        <Image
          {...common}
          src="/logo-dark.png"
          className={`${className} w-auto object-contain dark:hidden`}
        />
        <Image
          {...common}
          src="/logo-light.png"
          className={`${className} hidden w-auto object-contain dark:block`}
        />
      </>
    ) : (
      <Image
        {...common}
        src={variant === "light" ? "/logo-light.png" : "/logo-dark.png"}
        className={`${className} w-auto object-contain`}
      />
    );

  if (!href) {
    return <span className="inline-flex items-center">{images}</span>;
  }

  return (
    <Link href={href} aria-label={label} className="inline-flex items-center">
      {images}
    </Link>
  );
}