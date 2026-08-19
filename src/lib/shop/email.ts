import "server-only";

export interface OrderEmail {
  to: string;
  subject: string;
  reference: string;
  total: number;
}

export interface EmailProvider {
  sendOrderConfirmation(email: OrderEmail): Promise<void>;
}

class SimulatedEmailProvider implements EmailProvider {
  async sendOrderConfirmation(email: OrderEmail): Promise<void> {
    console.info(`[email] confirmation ${email.reference} préparée pour ${email.to}`);
  }
}

export const emailProvider: EmailProvider = new SimulatedEmailProvider();