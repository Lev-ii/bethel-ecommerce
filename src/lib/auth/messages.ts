/**
 * Messages d'erreur d'authentification.
 *
 * Ils vivent hors du fichier d'actions : un module "use server" ne peut
 * exporter que des fonctions asynchrones.
 */
export type AuthErrorReason =
  | "identifiants"
  | "champs"
  | "email"
  | "motdepasse"
  | "existe"
  | "nom"
  | "service";

export const authErrorMessages: Record<AuthErrorReason, string> = {
  identifiants: "Email ou mot de passe incorrect.",
  champs: "Entrez votre email et votre mot de passe.",
  email: "Cette adresse email n'est pas valide.",
  motdepasse:
    "Le mot de passe doit faire au moins 8 caracteres, avec une lettre et un chiffre.",
  existe: "Un compte existe deja avec cette adresse.",
  nom: "Indiquez votre nom complet.",
  service: "Service momentanement indisponible. Reessayez dans un instant.",
};

export function authErrorMessage(reason?: string): string | undefined {
  if (!reason) return undefined;
  return (
    authErrorMessages[reason as AuthErrorReason] ??
    "L'operation a echoue. Reessayez."
  );
}
