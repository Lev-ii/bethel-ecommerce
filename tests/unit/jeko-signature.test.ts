import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidJekoSignature } from "@/lib/shop/jeko-signature";

const SECRET = "secret-webhook-jeko";
const BODY = '{"transactionDetails":{"reference":"BTH-2609-ABC123"}}';
const sign = (body: string, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");
const prod = { NODE_ENV: "production", JEKO_WEBHOOK_SECRET: SECRET };

describe("signature du webhook Jeko", () => {
  it("accepte une signature valide", () => {
    expect(isValidJekoSignature(BODY, sign(BODY), prod)).toBe(true);
  });

  it("tolere majuscules et espaces autour de la signature", () => {
    expect(isValidJekoSignature(BODY, `  ${sign(BODY).toUpperCase()} `, prod)).toBe(true);
  });

  it("refuse un corps modifie apres signature", () => {
    expect(isValidJekoSignature(BODY.replace("ABC123", "ZZZ999"), sign(BODY), prod)).toBe(false);
  });

  it("refuse une signature faite avec un autre secret", () => {
    expect(isValidJekoSignature(BODY, sign(BODY, "autre-secret"), prod)).toBe(false);
  });

  it.each([null, "", "abc", "0".repeat(64)])("refuse une signature absente ou fausse (%s)", (header) => {
    expect(isValidJekoSignature(BODY, header, prod)).toBe(false);
  });

  // Le changement : sans secret, la production refuse au lieu d'accepter.
  it("refuse tout en production si le secret n'est pas configure", () => {
    expect(isValidJekoSignature(BODY, sign(BODY), { NODE_ENV: "production" })).toBe(false);
    expect(isValidJekoSignature(BODY, null, { NODE_ENV: "production" })).toBe(false);
  });

  it("accepte hors production sans secret, pour developper sans compte Jeko", () => {
    expect(isValidJekoSignature(BODY, null, { NODE_ENV: "development" })).toBe(true);
  });
});
