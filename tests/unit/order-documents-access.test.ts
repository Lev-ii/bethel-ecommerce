import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canAccessOrderDocuments, invoiceToken, trackingPath } from "@/lib/shop/invoice";

const REF = "BTH-2609-ABC123";

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "secret-de-test-suffisamment-long");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("acces aux documents d'une commande", () => {
  // Le cas qui fermait la fuite : connaitre la reference ne suffit plus.
  it("refuse la seule reference, sans jeton ni session", () => {
    expect(canAccessOrderDocuments({ reference: REF, token: undefined, user: null })).toBe(false);
  });

  it("accepte le jeton signe de cette commande", () => {
    expect(canAccessOrderDocuments({ reference: REF, token: invoiceToken(REF), user: null })).toBe(true);
  });

  it("refuse le jeton d'une autre commande", () => {
    expect(canAccessOrderDocuments({ reference: REF, token: invoiceToken("BTH-2609-ZZZ999"), user: null })).toBe(false);
  });

  it("refuse un jeton forge", () => {
    expect(canAccessOrderDocuments({ reference: REF, token: "0".repeat(32), user: null })).toBe(false);
  });

  it("accepte le client connecte proprietaire de la commande", () => {
    expect(
      canAccessOrderDocuments({ reference: REF, token: null, user: { id: "u-1", role: "CLIENT" }, orderUserId: "u-1" })
    ).toBe(true);
  });

  it("refuse un autre client connecte", () => {
    expect(
      canAccessOrderDocuments({ reference: REF, token: null, user: { id: "u-2", role: "CLIENT" }, orderUserId: "u-1" })
    ).toBe(false);
  });

  it("refuse un client connecte pour une commande passee sans compte", () => {
    expect(canAccessOrderDocuments({ reference: REF, token: null, user: { id: "u-2", role: "CLIENT" } })).toBe(false);
  });

  it("accepte un administrateur", () => {
    expect(canAccessOrderDocuments({ reference: REF, token: null, user: { id: "a-1", role: "ADMIN" } })).toBe(true);
  });

  it("construit un lien de suivi qui porte le jeton", () => {
    expect(trackingPath(REF)).toBe(`/suivi?ref=${REF}&t=${invoiceToken(REF)}`);
  });
});
