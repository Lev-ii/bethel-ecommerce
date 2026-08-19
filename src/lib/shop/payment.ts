import "server-only";

import { randomUUID } from "node:crypto";
import type { PaymentMethod } from "@/lib/types";

export interface PaymentRequest {
  amount: number;
  method: PaymentMethod;
  reference: string;
  customerEmail?: string;
}

export interface PaymentResult {
  status: "paid" | "pending";
  transactionReference?: string;
}

export interface PaymentProvider {
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

class SimulatedPaymentProvider implements PaymentProvider {
  async charge(request: PaymentRequest): Promise<PaymentResult> {
    if (request.method === "paiement-livraison" || request.method === "especes-retrait") {
      return { status: "pending" };
    }

    return {
      status: "paid",
      transactionReference: `SIM-${randomUUID().slice(0, 8).toUpperCase()}`,
    };
  }
}

export const paymentProvider: PaymentProvider = new SimulatedPaymentProvider();