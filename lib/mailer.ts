import "server-only";

/**
 * Wysyłka poczty.
 *
 * Świadomie interfejs z dwiema implementacjami zamiast jednego dostawcy:
 * kancelaria ma własną domenę i najpewniej własną pocztę służbową, a wybór
 * między własnym serwerem SMTP a usługą typu Resend jest jej decyzją, nie naszą.
 * Przełączenie sprowadza się do zmiennych środowiskowych.
 *
 * Lokalnie, bez żadnej konfiguracji, wiadomości trafiają do Mailpita
 * (http://127.0.0.1:55324) — nic nie wychodzi na zewnątrz.
 */

export interface MailMessage {
  to: string;
  subject: string;
  /** Treść tekstowa — obowiązkowa; część klientów nie wyświetla HTML-a. */
  text: string;
  html?: string;
  replyTo?: string;
}

export interface Mailer {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

function fromAddress(): string {
  return process.env.RESEND_FROM || process.env.SMTP_FROM || "Legal-Wise <noreply@legal-wise.test>";
}

class ResendMailer implements Mailer {
  readonly name = "resend";

  constructor(private readonly apiKey: string) {}

  async send(message: MailMessage): Promise<void> {
    const { Resend } = await import("resend");
    const client = new Resend(this.apiKey);

    const { error } = await client.emails.send({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });

    if (error) throw new Error(`Resend: ${error.message}`);
  }
}

class SmtpMailer implements Mailer {
  readonly name = "smtp";

  constructor(
    private readonly options: {
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
    },
  ) {}

  async send(message: MailMessage): Promise<void> {
    const nodemailer = await import("nodemailer");

    const transport = nodemailer.createTransport({
      host: this.options.host,
      port: this.options.port,
      secure: this.options.secure,
      auth: this.options.user ? { user: this.options.user, pass: this.options.pass } : undefined,
    });

    await transport.sendMail({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
  }
}

/**
 * Implementacja zapasowa — zapisuje wiadomość do logu zamiast wysyłać.
 *
 * Używana, gdy nic nie jest skonfigurowane. Nie udaje wysyłki: w logu widać
 * wprost, że wiadomość nigdzie nie poszła.
 */
class ConsoleMailer implements Mailer {
  readonly name = "console";

  async send(message: MailMessage): Promise<void> {
    console.warn(
      `[poczta nieskonfigurowana] Wiadomość NIE została wysłana do ${message.to}: ${message.subject}`,
    );
  }
}

let cached: Mailer | null = null;

export function getMailer(): Mailer {
  if (cached) return cached;

  if (process.env.RESEND_API_KEY) {
    cached = new ResendMailer(process.env.RESEND_API_KEY);
  } else if (process.env.SMTP_HOST) {
    cached = new SmtpMailer({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    });
  } else if (process.env.NODE_ENV !== "production") {
    // Lokalnie kierujemy wszystko do Mailpita uruchamianego razem z Supabase.
    cached = new SmtpMailer({
      host: "127.0.0.1",
      port: Number(process.env.MAILPIT_SMTP_PORT ?? 55325),
      secure: false,
    });
  } else {
    cached = new ConsoleMailer();
  }

  return cached;
}

/** Czy wysyłka poczty jest realnie skonfigurowana. */
export function isMailerConfigured(): boolean {
  return getMailer().name !== "console";
}
