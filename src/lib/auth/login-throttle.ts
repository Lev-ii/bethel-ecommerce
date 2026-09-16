/**
 * Limitation des tentatives de connexion administrateur.
 *
 * Les tentatives sont lues dans le journal d'audit, en base : le decompte est
 * partage par toutes les instances et survit a un redemarrage, ce qu'aucun
 * compteur en memoire ne peut garantir sur un hebergement serverless.
 *
 * Deux seuils, pour ne pas offrir a un attaquant le moyen de bloquer
 * l'administrateur legitime :
 *  - par adresse IP : l'attaquant se bloque lui-meme, pas le vrai titulaire ;
 *  - par compte, plus haut : contre une attaque repartie sur de nombreuses IP,
 *    au prix d'un blocage general, mais seulement sous attaque massive.
 * Une connexion reussie remet le compteur de son adresse a zero, et le
 * compteur du compte.
 */

export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILURES_PER_IP = 5;
export const MAX_FAILURES_PER_ACCOUNT = 20;

export interface LoginEvent {
  kind: "failure" | "success";
  ip: string | null;
  at: Date;
}

export function loginLocked(events: readonly LoginEvent[], ip: string | null, now: Date): boolean {
  const since = now.getTime() - LOGIN_WINDOW_MINUTES * 60_000;
  const recent = events.filter((e) => e.at.getTime() > since);

  const lastSuccess = (fromIp?: string | null) =>
    Math.max(
      -Infinity,
      ...recent.filter((e) => e.kind === "success" && (fromIp === undefined || e.ip === fromIp)).map((e) => e.at.getTime())
    );

  const accountReset = lastSuccess();
  const accountFailures = recent.filter((e) => e.kind === "failure" && e.at.getTime() > accountReset).length;
  if (accountFailures >= MAX_FAILURES_PER_ACCOUNT) return true;

  const ipReset = lastSuccess(ip);
  const ipFailures = recent.filter((e) => e.kind === "failure" && e.ip === ip && e.at.getTime() > ipReset).length;
  return ipFailures >= MAX_FAILURES_PER_IP;
}
