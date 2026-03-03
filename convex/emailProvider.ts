"use node";

// ── Email provider abstraction ──────────────────────────────────────
// Factory pattern: checks RESEND_API_KEY first, then SMTP_HOST.
// This is a utility module — no Convex function exports.

export interface EmailSendParams {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface EmailSendResult {
  provider: string;
  messageId: string;
}

export interface EmailProvider {
  send(params: EmailSendParams): Promise<EmailSendResult>;
}

// ── Resend provider ─────────────────────────────────────────────────

class ResendProvider implements EmailProvider {
  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    return {
      provider: "resend",
      messageId: data?.id ?? "unknown",
    };
  }
}

// ── Nodemailer SMTP provider ────────────────────────────────────────

class NodemailerProvider implements EmailProvider {
  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const nodemailer = await import("nodemailer");

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transport.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    return {
      provider: "smtp",
      messageId: info.messageId,
    };
  }
}

// ── Factory ─────────────────────────────────────────────────────────

export function getEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) {
    return new ResendProvider();
  }
  if (process.env.SMTP_HOST) {
    return new NodemailerProvider();
  }
  throw new Error(
    "No email provider configured. Set RESEND_API_KEY or SMTP_HOST in the Convex dashboard."
  );
}
