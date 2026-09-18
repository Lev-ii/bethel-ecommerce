"use client";

import { useEffect, useRef } from "react";
import { playFanfare } from "@/components/ui/sounds";
import { celebrationKey } from "@/lib/shop/celebration";

/** Jaune de marque et extremites de la barre Kelvin, plus l'encre sombre. */
const COLORS = ["#FFED43", "#B4741A", "#2A78D6", "#16150F", "#F2C21A"];
const DURATION_MS = 2600;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
}

/**
 * Confettis et fanfare, une seule fois par cle de session : recharger la page
 * ne relance pas la fete. Par defaut, la cle de la commande validee ; le suivi
 * en direct en passe une autre pour feter la livraison.
 */
export function Celebration({ reference, storageKey }: { reference: string; storageKey?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const key = storageKey ?? celebrationKey(reference);
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Stockage indisponible : on fete quand meme, au pire une fois de trop.
    }

    void playFanfare();

    // Pas d'animation pour qui a demande a limiter les mouvements.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();

    const w = window.innerWidth;
    const pieces: Piece[] = Array.from({ length: 140 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        x: fromLeft ? w * 0.1 : w * 0.9,
        y: window.innerHeight * 0.35,
        vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 7),
        vy: -(8 + Math.random() * 9),
        size: 6 + Math.random() * 6,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        color: COLORS[i % COLORS.length],
      };
    });

    let frame = 0;
    const started = performance.now();
    const tick = (time: number) => {
      const elapsed = time - started;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      context.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - DURATION_MS * 0.6) / (DURATION_MS * 0.4));
      for (const p of pieces) {
        p.vy += 0.32;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.fillStyle = p.color;
        context.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        context.restore();
      }
      if (elapsed < DURATION_MS) frame = requestAnimationFrame(tick);
      else context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [reference, storageKey]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-dvh w-screen" />;
}
