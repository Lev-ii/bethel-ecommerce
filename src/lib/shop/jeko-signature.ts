import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verification de l'en-tete Jeko-Signature : HMAC-SHA256 du corps brut, en
 * hexadecimal minuscule (developer.jeko.africa/docs/webhooks/integration).
 *
 * Sans secret configure :
 *  - en production, refus. Un webhook non signe ne peut pas marquer une
 *    commande payee (le statut est toujours relu chez Jeko), mais n'importe qui
 *    pourrait declencher ces relectures en masse, a nos frais ;
 *  - ailleurs, acceptation, pour pouvoir developper sans compte Jeko.
 */
export function isValidJekoSignature(
  rawBody: string,
  signatureHeader: string | null,
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  const secret = env.JEKO_WEBHOOK_SECRET;
  if (!secret) return env.NODE_ENV !== "production";
  if (!signatureHeader) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const actual = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
