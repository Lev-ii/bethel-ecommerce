import { describe, expect, it } from "vitest";
import {
  LOGIN_WINDOW_MINUTES,
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_IP,
  loginLocked,
  type LoginEvent,
} from "@/lib/auth/login-throttle";

const NOW = new Date("2026-09-16T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const failures = (count: number, ip: string | null, minutesAgo = 1): LoginEvent[] =>
  Array.from({ length: count }, () => ({ kind: "failure", ip, at: ago(minutesAgo) }));

describe("limitation par adresse IP", () => {
  it("laisse essayer sous le seuil", () => {
    expect(loginLocked(failures(MAX_FAILURES_PER_IP - 1, "1.1.1.1"), "1.1.1.1", NOW)).toBe(false);
  });

  it("bloque l'adresse au seuil", () => {
    expect(loginLocked(failures(MAX_FAILURES_PER_IP, "1.1.1.1"), "1.1.1.1", NOW)).toBe(true);
  });

  // Le cas qui protege l'administrateur legitime : l'attaquant ne le bloque pas.
  it("ne bloque pas une autre adresse que celle qui echoue", () => {
    expect(loginLocked(failures(MAX_FAILURES_PER_IP, "6.6.6.6"), "1.1.1.1", NOW)).toBe(false);
  });

  it("oublie les echecs sortis de la fenetre", () => {
    const old = failures(MAX_FAILURES_PER_IP, "1.1.1.1", LOGIN_WINDOW_MINUTES + 1);
    expect(loginLocked(old, "1.1.1.1", NOW)).toBe(false);
  });

  it("remet le compteur a zero apres une connexion reussie depuis la meme adresse", () => {
    const events: LoginEvent[] = [
      ...failures(MAX_FAILURES_PER_IP, "1.1.1.1", 10),
      { kind: "success", ip: "1.1.1.1", at: ago(5) },
    ];
    expect(loginLocked(events, "1.1.1.1", NOW)).toBe(false);
  });

  it("ne remet pas a zero le compteur d'une adresse avec la reussite d'une autre", () => {
    const events: LoginEvent[] = [
      ...failures(MAX_FAILURES_PER_IP, "6.6.6.6", 10),
      { kind: "success", ip: "1.1.1.1", at: ago(5) },
    ];
    expect(loginLocked(events, "6.6.6.6", NOW)).toBe(true);
  });

  it("compte les echecs posterieurs a la derniere reussite", () => {
    const events: LoginEvent[] = [
      { kind: "success", ip: "1.1.1.1", at: ago(10) },
      ...failures(MAX_FAILURES_PER_IP, "1.1.1.1", 5),
    ];
    expect(loginLocked(events, "1.1.1.1", NOW)).toBe(true);
  });
});

describe("limitation par compte", () => {
  it("bloque toutes les adresses face a une attaque repartie", () => {
    const spread = Array.from({ length: MAX_FAILURES_PER_ACCOUNT }, (_, i): LoginEvent => ({
      kind: "failure",
      ip: `10.0.0.${i}`,
      at: ago(2),
    }));
    expect(loginLocked(spread, "1.1.1.1", NOW)).toBe(true);
  });

  it("ne bloque pas le compte juste sous le seuil", () => {
    const spread = Array.from({ length: MAX_FAILURES_PER_ACCOUNT - 1 }, (_, i): LoginEvent => ({
      kind: "failure",
      ip: `10.0.0.${i}`,
      at: ago(2),
    }));
    expect(loginLocked(spread, "1.1.1.1", NOW)).toBe(false);
  });

  it("ne bloque rien sans evenement", () => {
    expect(loginLocked([], "1.1.1.1", NOW)).toBe(false);
  });
});
