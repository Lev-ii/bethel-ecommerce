"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "bethel-theme";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

/**
 * Bascule jour / nuit.
 *
 * Le theme est applique avant le premier rendu par le script inline de
 * layout.tsx, pour eviter le flash. Ce composant ne fait que le lire et le
 * changer.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    setTheme(stored ?? system);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn-ghost ${className}`}
      aria-label={
        theme === "dark" ? "Passer en mode jour" : "Passer en mode nuit"
      }
      title={theme === "dark" ? "Mode jour" : "Mode nuit"}
    >
      {/* Les deux icones sont rendues et masquees en CSS : le bouton affiche
          la bonne des le premier rendu, sans attendre JavaScript. */}
      <Sun size={18} aria-hidden className="hidden dark:block" />
      <Moon size={18} aria-hidden className="dark:hidden" />
    </button>
  );
}
