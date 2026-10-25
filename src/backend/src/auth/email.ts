/**
 * Email delivery for user authentication (T7).
 */

import * as nodemailer from 'nodemailer';

export interface EmailTransport {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

export interface EmailService {
  sendVerification(to: string, verificationUrl: string): Promise<void>;
}

export interface CapturedVerificationEmail {
  to: string;
  verificationUrl: string;
}

export const VERIFICATION_EMAIL_SUBJECT = 'Verify your CubeClicker email';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderVerificationEmail(verificationUrl: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = VERIFICATION_EMAIL_SUBJECT;
  const text =
    'Welcome to CubeClicker!\n\n' +
    'Verify your email address by opening the link below:\n' +
    `${verificationUrl}\n\n` +
    'If you did not create an account, you can ignore this email.';
  const html =
    '<p>Welcome to CubeClicker!</p>' +
    '<p>Verify your email address by opening the link below:</p>' +
    `<p><a href="${escapeHtml(verificationUrl)}">${escapeHtml(verificationUrl)}</a></p>` +
    '<p>If you did not create an account, you can ignore this email.</p>';
  return { subject, text, html };
}

export class FakeEmailService implements EmailService {
  readonly sent: CapturedVerificationEmail[] = [];

  async sendVerification(to: string, verificationUrl: string): Promise<void> {
    this.sent.push({ to, verificationUrl });
  }
}

export interface SmtpEmailServiceOptions {
  host: string;
  port: number;
  secure?: boolean;
  user?: string | null;
  pass?: string | null;
  from: string;
}

export class SmtpEmailService implements EmailService {
  private readonly transport: EmailTransport;
  private readonly from: string;

  constructor(options: SmtpEmailServiceOptions, transport?: EmailTransport) {
    this.from = options.from;
    if (transport) {
      this.transport = transport;
    } else {
      const auth =
        options.user && options.pass
          ? { user: options.user, pass: options.pass }
          : undefined;
      this.transport = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure ?? options.port === 465,
        auth,
      }) as unknown as EmailTransport;
    }
  }

  async sendVerification(to: string, verificationUrl: string): Promise<void> {
    const { subject, text, html } = renderVerificationEmail(verificationUrl);
    await this.transport.sendMail({ from: this.from, to, subject, text, html });
  }
}
