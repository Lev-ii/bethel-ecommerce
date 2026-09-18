/**
 * Sons synthetises (Web Audio) : aucun fichier a charger.
 *
 * Les navigateurs refusent de jouer un son tant que la personne n'a pas
 * touche la page. Un seul contexte audio est partage : il est deverrouille au
 * premier contact (clic, toucher, touche clavier), et audioUnlocked() permet
 * d'afficher un bouton « Activer le son » en attendant.
 */

type Ctx = AudioContext;

let shared: Ctx | null = null;
const listeners = new Set<(unlocked: boolean) => void>();

function context(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (shared) return shared;
  const Constructor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return null;
  shared = new Constructor();
  shared.addEventListener("statechange", () => listeners.forEach((listener) => listener(audioUnlocked())));
  return shared;
}

export function audioUnlocked(): boolean {
  return context()?.state === "running";
}

/** A appeler depuis un geste de la personne (clic, toucher). */
export async function unlockAudio(): Promise<boolean> {
  const ctx = context();
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === "running";
}

/** Deverrouille au premier geste, et previent quand l'etat change. */
export function watchAudio(onChange: (unlocked: boolean) => void): () => void {
  listeners.add(onChange);
  const unlock = () => void unlockAudio();
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  events.forEach((event) => window.addEventListener(event, unlock, { passive: true }));
  onChange(audioUnlocked());
  return () => {
    listeners.delete(onChange);
    events.forEach((event) => window.removeEventListener(event, unlock));
  };
}

function tone(ctx: Ctx, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
}

async function ready(): Promise<Ctx | null> {
  const ctx = context();
  if (!ctx) return null;
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  return ctx.state === "running" ? ctx : null;
}

/** Deux notes montantes, discretes : une etape de la commande a avance. */
export async function playChime(): Promise<void> {
  const ctx = await ready();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 659.25, now, 0.28, 0.14);
  tone(ctx, 987.77, now + 0.13, 0.42, 0.12);
}

/** Un « pop » puis un petit arpege montant : commande validee ou livree. */
export async function playFanfare(): Promise<void> {
  const ctx = await ready();
  if (!ctx) return;
  const now = ctx.currentTime;
  const pop = ctx.createOscillator();
  const popGain = ctx.createGain();
  pop.type = "triangle";
  pop.frequency.setValueAtTime(420, now);
  pop.frequency.exponentialRampToValueAtTime(90, now + 0.12);
  popGain.gain.setValueAtTime(0.25, now);
  popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  pop.connect(popGain).connect(ctx.destination);
  pop.start(now);
  pop.stop(now + 0.15);
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => tone(ctx, frequency, now + 0.12 + i * 0.09, 0.35, 0.16));
}
