import { describe, expect, it } from "vitest";
import { celebrationKey, shouldCelebrate } from "@/lib/shop/celebration";

const base = { hasAccess: true, orderFound: true, onlinePayment: false, paid: false, failed: false };

describe("shouldCelebrate", () => {
  it("fete une commande payable a la livraison des sa validation", () => {
    expect(shouldCelebrate(base)).toBe(true);
  });

  it("fete un paiement en ligne confirme", () => {
    expect(shouldCelebrate({ ...base, onlinePayment: true, paid: true })).toBe(true);
  });

  // Un paiement en attente peut encore echouer : pas de confettis prematures.
  it("ne fete pas un paiement en ligne encore en attente", () => {
    expect(shouldCelebrate({ ...base, onlinePayment: true, paid: false })).toBe(false);
  });

  it("ne fete jamais un paiement echoue", () => {
    expect(shouldCelebrate({ ...base, onlinePayment: true, failed: true })).toBe(false);
  });

  it("ne fete pas pour qui a seulement saisi une reference", () => {
    expect(shouldCelebrate({ ...base, hasAccess: false })).toBe(false);
  });

  it("ne fete pas une reference introuvable", () => {
    expect(shouldCelebrate({ ...base, orderFound: false })).toBe(false);
  });
});

describe("celebrationKey", () => {
  it("ne depend pas de la casse de la reference", () => {
    expect(celebrationKey("BTH-2609-ABC123")).toBe(celebrationKey("bth-2609-abc123"));
  });
});
