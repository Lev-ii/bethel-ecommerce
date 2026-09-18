import { describe, expect, it } from "vitest";
import { isFinalStatus, isTrackableReference, statusLabelFor, trackingEvent } from "@/lib/shop/tracking";

describe("référence suivable", () => {
  it.each(["BTH-2607-1042", "bth-2609-ABC123", "BTH-VOL-000123"])("accepte %s", (ref) => {
    expect(isTrackableReference(ref)).toBe(true);
  });
  it.each(["", "BTH", "1' OR 1=1", "BTH-2607-1042/../x", "x".repeat(200)])("refuse %j", (ref) => {
    expect(isTrackableReference(ref)).toBe(false);
  });
});

describe("annonces du suivi en direct", () => {
  it("annonce une étape qui avance", () => {
    expect(trackingEvent("recue", "expediee", "livraison")).toEqual({
      kind: "advanced",
      message: "Votre commande est maintenant : Expédiée.",
    });
  });

  it("parle de retrait pour une commande à retirer", () => {
    expect(trackingEvent("preparee", "expediee", "retrait")).toMatchObject({
      message: "Votre commande est maintenant : Prête à retirer.",
    });
    expect(trackingEvent("expediee", "livree", "retrait")).toEqual({
      kind: "delivered",
      message: "Votre commande a été retirée. Merci !",
    });
  });

  it("fête la livraison", () => {
    expect(trackingEvent("expediee", "livree", "livraison")).toEqual({
      kind: "delivered",
      message: "Votre commande a été livrée. Merci !",
    });
  });

  it("annonce la confirmation d'un paiement", () => {
    expect(trackingEvent("attente_paiement", "recue", "livraison")).toMatchObject({ kind: "advanced" });
  });

  it("annonce une annulation", () => {
    expect(trackingEvent("attente_paiement", "annulee", "livraison")).toMatchObject({ kind: "cancelled" });
  });

  it("reste silencieux sans changement ou lors d'une correction de l'administration", () => {
    expect(trackingEvent("preparee", "preparee", "livraison")).toEqual({ kind: "none" });
    expect(trackingEvent("expediee", "preparee", "livraison")).toEqual({ kind: "none" });
  });

  it("arrête d'interroger une fois livrée ou annulée", () => {
    expect(isFinalStatus("livree")).toBe(true);
    expect(isFinalStatus("annulee")).toBe(true);
    expect(isFinalStatus("expediee")).toBe(false);
  });

  it("garde les libellés standards en livraison", () => {
    expect(statusLabelFor("expediee", "livraison")).toBe("Expédiée");
    expect(statusLabelFor("livree", "livraison")).toBe("Livrée");
  });
});
