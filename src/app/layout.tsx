import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BETHELSHOP",
    template: "%s | Bethel",
  },
  description:
    "Trépieds, microphones, éclairage et accessoires pour créateurs. Disponibles sur place, livrés ou à retirer.",
  openGraph: {
    title: "BETHELSHOP",
    description:
      "Trépieds, microphones, éclairage et accessoires pour créateurs. Disponibles sur place.",
    type: "website",
    locale: "fr_FR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E0C" },
  ],
};

/**
 * Applique le theme avant le premier rendu.
 *
 * Sans ce script, la page s'affiche en clair puis bascule en sombre : c'est le
 * flash blanc classique. Il doit rester inline et en tete de <body>.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('bethel-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark'){document.documentElement.classList.add('dark')}document.documentElement.style.colorScheme=t}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Icones.

            Les fichiers sont dans public/ et les balises sont ecrites ici a la
            main, parce qu'ils viennent d'un generateur qui produit ses propres
            noms. Ne pas remettre de icon.png, apple-icon.png ou favicon.ico
            dans src/app/ : Next les servirait EN PLUS, et le navigateur
            afficherait un melange des deux jeux. */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          rel="icon"
          href="/favicon-96x96.png"
          type="image/png"
          sizes="96x96"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Memes familles que studiobethel.com */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Poppins:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}