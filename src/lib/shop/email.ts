import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Uint8Array }>;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Aucun service d'envoi n'est encore branche (il faut un domaine verifie) :
 * les emails sont prepares en entier mais seulement journalises.
 */
class SimulatedEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    const files = message.attachments?.map((a) => `${a.filename} (${a.content.byteLength} o)`).join(", ");
    console.info(
      `[email simulé] à ${message.to} · « ${message.subject} »${files ? ` · pièce jointe : ${files}` : ""}\n${message.text}`
    );
  }
}

export const emailProvider: EmailProvider = new SimulatedEmailProvider();
