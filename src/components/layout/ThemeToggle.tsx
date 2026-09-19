"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "bethel-theme";

function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Bascule jour / nuit.
 *
 * Par defaut, le theme est celui du systeme de l'appareil, et le suit s'il
 * change (bascule automatique du soir, par exemple). Un clic enregistre un
 * choix explicite ; revenir sur le theme du systeme efface ce choix, sinon un
 * clic ancien figeait le theme pour toujours.
 *
 * Le theme est applique avant le premier rendu par le script inline de
 * layout.tsx, pour eviter le flash.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = readStored();
    setTheme(stored ?? systemTheme());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readStored()) return;
      const next = systemTheme();
      setTheme(next);
      apply(next);
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    try {
      if (next === systemTheme()) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privee) : le choix vaut pour la page.
    }
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
