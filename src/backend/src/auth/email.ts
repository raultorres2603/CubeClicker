/**
 * Email delivery for user authentication (T4).
 *
 * Transport and service layer only: message content is rendered by the pure
 * `email-template` module, whose subject and renderer are re-exported here so
 * existing imports keep working. The transport connection object is built in
 * exactly one place (`buildSmtpTransportOptions`) and both the app and the
 * operator CLI compose the service through `createSmtpEmailService`.
 */

import * as nodemailer from 'nodemailer';

import { DEFAULT_SMTP_CONNECTION_TIMEOUT_MS } from './config.js';
import {
  renderVerificationEmail,
  type VerificationEmailOptions,
} from './email-template.js';

export {
  VERIFICATION_EMAIL_SUBJECT,
  renderVerificationEmail,
} from './email-template.js';

/** Exact `sendMail` payload: no `replyTo`, no `attachments`, no CID (AC-7). */
export interface OutgoingEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailTransport {
  sendMail(options: OutgoingEmail): Promise<unknown>;
}

export interface EmailService {
  sendVerification(
    to: string,
    verificationUrl: string,
    options?: VerificationEmailOptions,
  ): Promise<void>;
}

export interface CapturedVerificationEmail {
  to: string;
  verificationUrl: string;
  /** Token lifetime handed to the template; `undefined` means the 24-hour default. */
  expiresInMs: number | undefined;
}

/**
 * The exact `nodemailer` connection object derived from the SMTP settings (AC-5).
 * `auth` is absent (not `undefined`) when no credential pair is configured.
 */
export interface SmtpTransportOptions {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth?: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}

export interface SmtpEmailServiceOptions {
  host: string;
  port: number;
  secure?: boolean;
  connectionTimeoutMs?: number;
  user?: string | null;
  pass?: string | null;
  from: string;
}

/** Structural subset of `AuthConfig` the app and CLI factories need. */
export interface SmtpEmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string;
  smtpConnectionTimeoutMs: number;
}

export type SmtpTransportFactory = (options: SmtpTransportOptions) => EmailTransport;

/** Returns a credential pair only when both values are non-empty. */
function readCredentials(
  user: string | null | undefined,
  pass: string | null | undefined,
): { user: string; pass: string } | null {
  if (!user || !pass) {
    return null;
  }
  return { user, pass };
}

/**
 * Builds the exact `nodemailer` SMTP connection options.
 *
 * - `secure` defaults to implicit TLS on port 465, so Mailpit/legacy configs
 *   stay plaintext while a 465 relay gets TLS without an explicit flag.
 * - STARTTLS is required exactly when credentials are configured and implicit
 *   TLS is off, so a configured SMTP key can never be sent cleartext.
 * - One timeout bounds the connection, the server greeting and an idle socket.
 * - `auth` exists only when both the user and the pass are non-empty.
 */
export function buildSmtpTransportOptions(
  options: SmtpEmailServiceOptions,
): SmtpTransportOptions {
  const secure = options.secure ?? options.port === 465;
  const auth = readCredentials(options.user, options.pass);
  const timeout = options.connectionTimeoutMs ?? DEFAULT_SMTP_CONNECTION_TIMEOUT_MS;
  return {
    host: options.host,
    port: options.port,
    secure,
    requireTLS: !secure && auth !== null,
    ...(auth === null ? {} : { auth }),
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
  };
}

/** The default transport factory: one lazy `nodemailer` SMTP transport. */
function createNodemailerTransport(options: SmtpTransportOptions): EmailTransport {
  return nodemailer.createTransport(options) as unknown as EmailTransport;
}

export class FakeEmailService implements EmailService {
  readonly sent: CapturedVerificationEmail[] = [];

  async sendVerification(
    to: string,
    verificationUrl: string,
    options?: VerificationEmailOptions,
  ): Promise<void> {
    this.sent.push({ to, verificationUrl, expiresInMs: options?.expiresInMs });
  }
}

export class SmtpEmailService implements EmailService {
  private readonly transport: EmailTransport;
  private readonly from: string;

  constructor(
    options: SmtpEmailServiceOptions,
    transportFactory: SmtpTransportFactory = createNodemailerTransport,
  ) {
    this.from = options.from;
    this.transport = transportFactory(buildSmtpTransportOptions(options));
  }

  async sendVerification(
    to: string,
    verificationUrl: string,
    options?: VerificationEmailOptions,
  ): Promise<void> {
    const { subject, text, html } = renderVerificationEmail(verificationUrl, options);
    await this.transport.sendMail({ from: this.from, to, subject, text, html });
  }
}

/**
 * The one composition path for the app and the operator CLI: maps the parsed
 * SMTP settings onto the transport options and constructs the service.
 */
export function createSmtpEmailService(
  config: SmtpEmailConfig,
  transportFactory?: SmtpTransportFactory,
): SmtpEmailService {
  return new SmtpEmailService(
    {
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      connectionTimeoutMs: config.smtpConnectionTimeoutMs,
      user: config.smtpUser,
      pass: config.smtpPass,
      from: config.smtpFrom,
    },
    transportFactory,
  );
}
