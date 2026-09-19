/**
 * Lien de reinitialisation remis a un client par WhatsApp, en attendant
 * l'envoi par email. Fonctions pures : aucune lecture de base ni de secret.
 */

export function resetLinkUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/mot-de-passe-oublie/${token}`;
}

/**
 * Numero au format international attendu par wa.me (chiffres seuls).
 * Un numero ivoirien a 10 chiffres saisi sans indicatif recoit le +225.
 * Renvoie null pour un numero inexploitable : WhatsApp laisse alors choisir
 * le destinataire.
 */
export function whatsappNumber(phone: string | undefined | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^\d{10}$/.test(digits)) digits = `225${digits}`;
  digits = digits.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function resetLinkMessage(customerName: string, link: string, validHours: number): string {
  const firstName = customerName.trim().split(/\s+/)[0] || "";
  return (
    `Bonjour ${firstName}, voici votre lien pour choisir un nouveau mot de passe sur Bethel : ${link}\n` +
    `Il est valable ${validHours} h et ne sert qu'une fois. Ne le transmettez à personne.`
  );
}

export function whatsappShareUrl(phone: string | null, text: string): string {
  return `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
}
