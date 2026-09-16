import type { Config } from "tailwindcss";

/**
 * Design tokens Bethel.
 *
 * Toutes les couleurs sont des variables CSS definies dans globals.css, en
 * canaux RGB separes par des espaces. Deux consequences :
 *   1. le passage jour / nuit se fait en basculant une seule classe sur <html>,
 *      sans prefixer chaque element par "dark:" ;
 *   2. les modificateurs d'opacite de Tailwind restent disponibles
 *      (bg-brand/15, border-fg/20, etc.).
 *
 * La couleur de marque est #FFED43, reprise du site studiobethel.com.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: "rgb(var(--bg) / <alpha-value>)",
        "bg-2": "rgb(var(--bg-2) / <alpha-value>)",
        "bg-3": "rgb(var(--bg-3) / <alpha-value>)",

        // Texte
        fg: "rgb(var(--fg) / <alpha-value>)",
        "fg-2": "rgb(var(--fg-2) / <alpha-value>)",
        "fg-3": "rgb(var(--fg-3) / <alpha-value>)",

        // Filets
        line: "rgb(var(--line) / <alpha-value>)",
        "line-2": "rgb(var(--line-2) / <alpha-value>)",

        // Marque
        brand: "rgb(var(--brand) / <alpha-value>)",
        // Texte pose SUR le jaune : toujours sombre, dans les deux themes.
        "brand-ink": "rgb(var(--brand-ink) / <alpha-value>)",
        // Jaune assombri, utilisable comme couleur de texte sur fond clair.
        "brand-deep": "rgb(var(--brand-deep) / <alpha-value>)",

        // Etats
        ok: "rgb(var(--ok) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",

        // Graphiques : serie principale et periode de comparaison.
        "viz-accent": "rgb(var(--viz-accent) / <alpha-value>)",
        "viz-context": "rgb(var(--viz-context) / <alpha-value>)",

        // Barre laterale de l'administration : sombre dans les deux themes.
        sidebar: "rgb(var(--sidebar) / <alpha-value>)",
        "sidebar-fg": "rgb(var(--sidebar-fg) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      maxWidth: {
        shell: "1240px",
      },
      borderRadius: {
        card: "4px",
      },
      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "rise-in": "rise-in 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
