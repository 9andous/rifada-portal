// Outbound email is stubbed for this phase. Swap ConsoleEmailService for a real transport
// (SMTP, government relay) by implementing EmailService; callers do not change.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    if (process.env.NODE_ENV === "production") return;
    console.info(`[email:dev] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}

export const emailService: EmailService = new ConsoleEmailService();
