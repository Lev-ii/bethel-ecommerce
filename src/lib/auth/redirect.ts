/**
 * Destination apres connexion (parametre "suite").
 *
 * La valeur vient de l'URL : n'importe qui peut fabriquer un lien
 * /connexion?suite=... et le faire circuler. Sans filtre, le site servirait
 * de relais vers un domaine tiers (redirection ouverte), avec l'adresse du
 * site en tete du lien pour inspirer confiance.
 *
 * Seul un chemin interne est accepte. Les formes que les navigateurs lisent
 * comme une autre origine sont refusees : "//hote", "/\hote" (le navigateur
 * traite "\" comme "/"), un schema ("https:", "javascript:"), les caracteres
 * de controle qu'il ignore silencieusement ("/\t/hote").
 */
const BASE = "http://bethel.invalid";

export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  // Derniere barriere : quelle que soit l'ecriture, l'URL resolue doit rester
  // sur notre origine.
  if (url.origin !== BASE) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
