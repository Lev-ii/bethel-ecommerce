/**
 * Echelles et formats des graphiques : des graduations rondes, des montants
 * compacts, des ecarts signes. Pur et teste : c'est ici qu'une erreur ferait
 * mentir un axe.
 */

/**
 * Graduations "rondes" couvrant [0, max] : pas de 1, 2, 2,5 ou 5 fois une
 * puissance de dix, environ `target` intervalles. Toujours au moins un
 * intervalle, meme sans donnee, pour que l'axe existe.
 */
export function niceTicks(max: number, target = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function trimDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toString().replace(".", ",");
}

/** Montant court pour un axe : 950, 12 k, 1,5 M. Le detail exact va a l'infobulle. */
export function compactAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trimDecimal(value / 1_000_000)} M`;
  if (abs >= 1_000) return `${trimDecimal(value / 1_000)} k`;
  return String(Math.round(value));
}

export interface Delta {
  /** Variation en pourcentage arrondi, ou null si la periode precedente vaut 0. */
  percent: number | null;
  direction: "up" | "down" | "flat";
}

/**
 * Ecart relatif a la periode precedente. Une base nulle ne donne pas un
 * pourcentage infini : on le signale plutot qu'on l'affiche.
 */
export function delta(current: number, previous: number): Delta {
  if (previous === 0) return { percent: null, direction: current > 0 ? "up" : "flat" };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { percent, direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat" };
}
