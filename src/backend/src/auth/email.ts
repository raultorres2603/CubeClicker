/**
 * Email delivery for user authentication (T4) with typed delivery failures (T2).
 *
 * Transport and service layer only: message content is rendered by the pure
 * `email-template` module, whose subject and renderer are re-exported here so
 * existing imports keep working. The transport connection object is built in
 * exactly one place (`buildSmtpTransportOptions`), and both the app and the
 * operator CLI compose the service through `createEmailService`: SMTP delegates
 * to `createSmtpEmailService` (Mailpit/local), `brevo-api` to
 * `BrevoApiEmailService` (deployed HTTPS transport).
 *
 * `SmtpEmailService` wraps every transport rejection (send and probe) in an
 * `EmailDeliveryError` with the source message verbatim, because the operator
 * CLI still prints (and redacts) it; routes and logs never do. The Brevo API
 * transport always replaces the source message with a fixed, value-free string.
 */

import * as nodemailer from 'nodemailer';

import {
  DEFAULT_SMTP_CONNECTION_TIMEOUT_MS,
  parseEmailSender,
  type EmailTransportKind,
  type ParsedEmailSender,
} from './config.js';
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
  /** Optional SMTP `verify()` probe; fakes that predate it stay valid. */
  verify?(): Promise<unknown>;
}

export interface EmailService {
  sendVerification(
    to: string,
    verificationUrl: string,
    options?: VerificationEmailOptions,
  ): Promise<void>;
  /** Optional reachability probe; absent services are reported as unsupported. */
  verify?(): Promise<void>;
}

/** Only provider codes matching this shape may leave the process as a field. */
const TRANSPORT_CODE_PATTERN = /^[A-Z0-9_]{1,40}$/;

/** The source message verbatim; non-`Error` rejections are stringified as-is. */
function readSourceMessage(source: unknown): string {
  return source instanceof Error ? source.message : String(source);
}

/** The source `code`, only when it is a provider code of the pinned shape. */
function readTransportCode(source: unknown): string | undefined {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }
  const code: unknown = (source as { code?: unknown }).code;
  return typeof code === 'string' && TRANSPORT_CODE_PATTERN.test(code) ? code : undefined;
}

/**
 * A typed delivery failure (AC-2).
 *
 * `message` deliberately preserves the source message verbatim (D-4): the
 * operator CLI's accepted SMTP lines and its `redactSecrets` contract depend on
 * it. Every other field is safe to log: `transport` is the selected transport,
 * `host`/`port` are configuration, `errorType` is a name, and `transportCode`
 * is whitelisted by shape. The Brevo API transport always supplies fixed
 * messages, so no provider value can reach `message` (D-10).
 */
export class EmailDeliveryError extends Error {
  readonly code = 'verification_email_failed';
  readonly transport: EmailTransportKind;
  readonly host: string;
  readonly port: number;
  readonly errorType: string;
  readonly transportCode?: string;

  constructor(
    source: unknown,
    host: string,
    port: number,
    transport: EmailTransportKind = 'smtp',
  ) {
    super(readSourceMessage(source));
    this.name = 'EmailDeliveryError';
    this.transport = transport;
    this.host = host;
    this.port = port;
    this.errorType = source instanceof Error ? source.name : 'unknown';
    const transportCode = readTransportCode(source);
    if (transportCode !== undefined) {
      this.transportCode = transportCode;
    }
  }
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

/** `createEmailService` input: the parsed SMTP settings plus the transport choice. */
export interface EmailServiceConfig extends SmtpEmailConfig {
  emailTransport: EmailTransportKind;
  /** Required (non-empty) exactly when `emailTransport` is `brevo-api` (AC-1(d)). */
  brevoApiKey: string | null;
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
  /** Number of `verify()` probes, including rejected ones. */
  verifyCalls = 0;
  /** One-shot probe failure: the next `verify()` rejects with it, then clears. */
  failNextVerify: Error | undefined;

  async sendVerification(
    to: string,
    verificationUrl: string,
    options?: VerificationEmailOptions,
  ): Promise<void> {
    this.sent.push({ to, verificationUrl, expiresInMs: options?.expiresInMs });
  }

  async verify(): Promise<void> {
    this.verifyCalls += 1;
    const failure = this.failNextVerify;
    if (failure !== undefined) {
      this.failNextVerify = undefined;
      throw failure;
    }
  }
}

export class SmtpEmailService implements EmailService {
  private readonly transport: EmailTransport;
  private readonly from: string;
  private readonly host: string;
  private readonly port: number;

  constructor(
    options: SmtpEmailServiceOptions,
    transportFactory: SmtpTransportFactory = createNodemailerTransport,
  ) {
    this.from = options.from;
    this.host = options.host;
    this.port = options.port;
    this.transport = transportFactory(buildSmtpTransportOptions(options));
  }

  async sendVerification(
    to: string,
    verificationUrl: string,
    options?: VerificationEmailOptions,
  ): Promise<void> {
    const { subject, text, html } = renderVerificationEmail(verificationUrl, options);
    try {
      await this.transport.sendMail({ from: this.from, to, subject, text, html });
    } catch (error) {
      throw new EmailDeliveryError(error, this.host, this.port);
    }
  }

  async verify(): Promise<void> {
    const verify = this.transport.verify;
    if (verify === undefined) {
      return;
    }
    try {
      await verify.call(this.transport);
    } catch (error) {
      throw new EmailDeliveryError(error, this.host, this.port);
    }
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

/** Fixed Brevo HTTPS endpoints: the provider is committed, so no base-URL override (D-6). */
export const BREVO_API_HOST = 'api.brevo.com';
export const BREVO_API_PORT = 443;
export const BREVO_API_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
export const BREVO_API_ACCOUNT_URL = 'https://api.brevo.com/v3/account';
/** Fixed request bound covering connect and response (D-5); not an env name. */
export const BREVO_API_TIMEOUT_MS = 10_000;

/** The minimal request shape the Brevo client uses; a response body is never read. */
export interface BrevoRequestInit {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** Only `ok`/`status` are consumed: a Brevo body may contain PII (D-10). */
export interface BrevoResponseLike {
  ok: boolean;
  status: number;
}

/** Injected HTTP seam; `fetch` wrapped down to `{ ok, status }` is the default. */
export type BrevoRequest = (
  url: string,
  init: BrevoRequestInit,
) => Promise<BrevoResponseLike>;

export interface BrevoApiEmailServiceOptions {
  apiKey: string;
  /** `SMTP_FROM`; the config layer has already validated it against AC-1(g). */
  from: string;
  /** Request bound, fixed to `BREVO_API_TIMEOUT_MS` unless a test injects one. */
  timeoutMs?: number;
}

/**
 * A non-2xx Brevo response as a source error: `errorType` becomes
 * `BrevoApiError` and the whitelisted `code` becomes `HTTP_<status>`.
 */
class BrevoApiError extends Error {
  readonly code: string;

  constructor(status: number) {
    super(`Brevo API responded with HTTP ${status}`);
    this.name = 'BrevoApiError';
    this.code = `HTTP_${status}`;
  }
}

/** `AbortSignal.timeout` rejects with a `TimeoutError` (`DOMException` or Error). */
function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'TimeoutError'
  );
}

/**
 * A fixed-message source error. It intentionally carries no `code`, so a
 * transport rejection can never smuggle a provider code into the typed fields.
 */
function brevoRejection(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** Maps any request rejection to the typed, value-free delivery failure (AC-4). */
function mapBrevoRejection(error: unknown, timeoutMs: number): EmailDeliveryError {
  if (isTimeoutError(error)) {
    return new EmailDeliveryError(
      brevoRejection('TimeoutError', `Brevo API request timed out after ${timeoutMs}ms`),
      BREVO_API_HOST,
      BREVO_API_PORT,
      'brevo-api',
    );
  }
  const errorType = error instanceof Error ? error.name : 'unknown';
  return new EmailDeliveryError(
    brevoRejection(errorType, 'Brevo API request failed'),
    BREVO_API_HOST,
    BREVO_API_PORT,
    'brevo-api',
  );
}

/** The default seam: `fetch` reduced to `{ ok, status }`, so no body escapes. */
async function defaultBrevoRequest(
  url: string,
  init: BrevoRequestInit,
): Promise<BrevoResponseLike> {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status };
}

/**
 * Parses the configured sender into the exact `sender` payload. `loadAuthConfig`
 * already enforced the AC-1(g) contract for `brevo-api`; this guard only
 * protects direct construction with an unvalidated value.
 */
function parseConfiguredSender(from: string): ParsedEmailSender {
  const sender = parseEmailSender(from);
  if (sender === null) {
    throw new Error(
      'SMTP_FROM must be an address or "Display Name <address>" when EMAIL_TRANSPORT=brevo-api',
    );
  }
  return sender;
}

/**
 * Brevo Transactional Email over HTTPS 443 (deployed transport).
 *
 * The request is exact (AC-3): the fixed send endpoint, `POST`, three headers,
 * a five-key JSON body reusing the branded template, and a fresh 10-second
 * `AbortSignal`. `verify()` probes the key with `GET /v3/account`. Any non-2xx,
 * timeout or transport rejection becomes an `EmailDeliveryError` with fixed
 * messages and, for non-2xx, the whitelisted `HTTP_<status>` code. Response
 * bodies are never read (AC-4(d)).
 */
export class BrevoApiEmailService implements EmailService {
  private readonly apiKey: string;
  private readonly sender: ParsedEmailSender;
  private readonly timeoutMs: number;
  private readonly request: BrevoRequest;

  constructor(
    options: BrevoApiEmailServiceOptions,
    request: BrevoRequest = defaultBrevoRequest,
  ) {
    this.apiKey = options.apiKey;
    this.sender = parseConfiguredSender(options.from);
    this.timeoutMs = options.timeoutMs ?? BREVO_API_TIMEOUT_MS;
    this.request = request;
  }

  async sendVerification(
    to: string,
    verificationUrl: string,
    options?: VerificationEmailOptions,
  ): Promise<void> {
    const { subject, text, html } = renderVerificationEmail(verificationUrl, options);
    let response: BrevoResponseLike;
    try {
      response = await this.request(BREVO_API_SEND_URL, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw mapBrevoRejection(error, this.timeoutMs);
    }
    this.requireAccepted(response);
  }

  async verify(): Promise<void> {
    let response: BrevoResponseLike;
    try {
      response = await this.request(BREVO_API_ACCOUNT_URL, {
        method: 'GET',
        headers: {
          'api-key': this.apiKey,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw mapBrevoRejection(error, this.timeoutMs);
    }
    this.requireAccepted(response);
  }

  /** Turns a non-2xx response into the typed failure; never reads a body. */
  private requireAccepted(response: BrevoResponseLike): void {
    if (!response.ok) {
      throw new EmailDeliveryError(
        new BrevoApiError(response.status),
        BREVO_API_HOST,
        BREVO_API_PORT,
        'brevo-api',
      );
    }
  }
}

/** Injectable seams for {@link createEmailService}. */
export interface CreateEmailServiceDeps {
  /** SMTP only; the API transport never calls it. */
  smtpTransportFactory?: SmtpTransportFactory;
  /** API only; the SMTP transport never calls it. */
  brevoRequest?: BrevoRequest;
}

/**
 * The single transport selector shared by the app and the operator CLI (AC-5).
 * `smtp` keeps the existing Mailpit/local path untouched; `brevo-api` builds the
 * HTTPS service and fails closed if the key is missing (defense in depth — the
 * config layer already rejects that combination).
 */
export function createEmailService(
  config: EmailServiceConfig,
  deps: CreateEmailServiceDeps = {},
): EmailService {
  if (config.emailTransport === 'smtp') {
    return createSmtpEmailService(config, deps.smtpTransportFactory);
  }
  const apiKey = config.brevoApiKey;
  if (apiKey === null || apiKey === '') {
    throw new Error(
      'BREVO_API_KEY must be a non-empty string when EMAIL_TRANSPORT=brevo-api',
    );
  }
  return new BrevoApiEmailService(
    { apiKey, from: config.smtpFrom },
    deps.brevoRequest,
  );
}
