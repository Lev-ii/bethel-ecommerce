import "server-only";

/**
 * WhatsApp Business via l'API Cloud de Meta
 * (POST https://graph.facebook.com/{version}/{phone-number-id}/messages).
 *
 * Un message envoye a l'initiative de la boutique doit utiliser un modele
 * valide au prealable par Meta (categorie "Utilite"), en francais. Les deux
 * modeles attendus, a creer tels quels dans WhatsApp Manager :
 *
 * bethel_facture - en-tete : Document
 *   "Bonjour {{1}}, merci pour votre commande {{2}} d'un montant de {{3}}.
 *    Vous trouverez votre facture en pièce jointe."
 *
 * bethel_suivi - sans en-tete
 *   "Bonjour {{1}}, votre commande {{2}} est maintenant : {{3}}.
 *    Suivez-la avec votre référence sur notre site."
 */
export const WHATSAPP_TEMPLATES = {
  invoice: "bethel_facture",
  status: "bethel_suivi",
} as const;

function getWhatsAppConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return null;
  return {
    accessToken,
    phoneNumberId,
    apiVersion: process.env.WHATSAPP_API_VERSION || "v25.0",
    language: process.env.WHATSAPP_TEMPLATE_LANG || "fr",
  };
}

export function isWhatsAppConfigured(): boolean {
  return getWhatsAppConfig() !== null;
}

/**
 * Numero saisi librement au checkout -> format international. Un numero
 * ivoirien a 10 chiffres sans indicatif recoit +225.
 */
export function toWhatsAppNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = `225${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

type TemplateComponent =
  | { type: "header"; parameters: Array<{ type: "document"; document: { link: string; filename: string } }> }
  | { type: "body"; parameters: Array<{ type: "text"; text: string }> };

export async function sendWhatsAppTemplate(
  to: string,
  template: string,
  components: TemplateComponent[]
): Promise<void> {
  const config = getWhatsAppConfig();
  if (!config) {
    console.info(`[whatsapp non configuré] modèle ${template} pour ${to} non envoyé`);
    return;
  }

  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template, language: { code: config.language }, components },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`WhatsApp ${template} vers ${to} refusé (HTTP ${response.status}) : ${body.slice(0, 300)}`);
  }
}

export function bodyParams(...values: string[]): TemplateComponent {
  return { type: "body", parameters: values.map((text) => ({ type: "text", text })) };
}

export function documentHeader(link: string, filename: string): TemplateComponent {
  return { type: "header", parameters: [{ type: "document", document: { link, filename } }] };
}
