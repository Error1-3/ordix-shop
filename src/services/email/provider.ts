import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type Mail = { to: string; subject: string; html: string; text: string };

export interface EmailProvider {
  send(mail: Mail): Promise<void>;
}

class ConsoleProvider implements EmailProvider {
  async send(mail: Mail) {
    console.log(`\n[email:console] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
  }
}

class ResendProvider implements EmailProvider {
  private client = new Resend(env().RESEND_API_KEY);
  async send(mail: Mail) {
    const { error } = await this.client.emails.send({ from: env().EMAIL_FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    if (error) throw new Error(`Resend: ${error.message}`);
  }
}

class SmtpProvider implements EmailProvider {
  private transport = nodemailer.createTransport({
    host: env().SMTP_HOST, port: env().SMTP_PORT, secure: env().SMTP_PORT === 465,
    auth: env().SMTP_USER ? { user: env().SMTP_USER, pass: env().SMTP_PASSWORD } : undefined,
  });
  async send(mail: Mail) {
    await this.transport.sendMail({ from: env().EMAIL_FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
  }
}

let provider: EmailProvider | null = null;

export function emailProvider(): EmailProvider {
  if (provider) return provider;
  const e = env();
  if (e.EMAIL_PROVIDER === "resend" && e.RESEND_API_KEY) provider = new ResendProvider();
  else if (e.EMAIL_PROVIDER === "smtp" && e.SMTP_HOST) provider = new SmtpProvider();
  else {
    if (e.NODE_ENV === "production") console.warn("[email] No e-mail provider configured in production — messages are only logged!");
    provider = new ConsoleProvider();
  }
  return provider;
}
