import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bethel — Materiel pour createurs de contenu",
    template: "%s | Bethel",
  },
  description:
    "Trepieds, microphones, eclairage et accessoires pour createurs. Disponibles sur place, livres ou a retirer.",
  openGraph: {
    title: "Bethel — Materiel pour createurs de contenu",
    description:
      "Trepieds, microphones, eclairage et accessoires pour createurs. Disponibles sur place.",
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
