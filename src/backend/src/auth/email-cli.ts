/**
 * `email:test` operator CLI (T6, AC-8, AC-9).
 *
 * Sends exactly one real message through the same configuration loading and
 * service factory the app uses (`createEmailService`), rendered by the branded
 * verification template with a synthetic `.../verify?token=cli-test` link. The
 * address is therefore a transport test, not a working verification link.
 *
 * The selected transport chooses the success/failure line, while every SMTP
 * line and argument path stays byte-identical. Every printed failure or
 * configuration line passes through `redactSecrets`, so a nodemailer error that
 * embeds the SMTP login or key, or a Brevo error that embeds the API key, prints
 * `[redacted]` instead. The CLI returns an exit code instead of exiting
 * (mirroring `db/migrate-cli.ts`) and the module-level `import.meta.url` guard
 * is the executable entry for both `tsx src/auth/email-cli.ts` and
 * `node dist/auth/email-cli.js`.
 */

import { pathToFileURL } from 'node:url';

import { DEFAULT_SMTP_FROM, loadAuthConfig, type AuthConfig } from './config.js';
import {
  BREVO_API_HOST,
  BREVO_API_PORT,
  createEmailService,
  type EmailService,
  type EmailServiceConfig,
} from './email.js';

/** Injectable seams: the service factory plus the two output writers. */
export interface EmailTestCliDeps {
  createService?: (config: EmailServiceConfig) => Pick<EmailService, 'sendVerification'>;
  log?: (line: string) => void;
  logError?: (line: string) => void;
}

/** Usage text shared by `--help` and the argument-error paths (AC-9). */
const USAGE = [
  'Usage: npm run email:test -- --to <address>',
  '       node dist/auth/email-cli.js --to <address>',
  '',
  'Sends one test message rendered with the CubeClicker verification template',
  'through the configured SMTP settings. Credentials are never printed.',
  '',
  'Options:',
  '  --to <address>  Recipient of the test message (required)',
  '  --help          Show this help and exit',
].join('\n');

/** Same pragmatic shape `AuthService` accepts for registration (AC-9). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stand-in token: the CLI proves the transport, it never issues a token. */
const CLI_VERIFICATION_URL_PATH = '/verify?token=cli-test';

/** Key-shaped material a provider or transport error might echo (AC-9). */
const KEY_PATTERNS: readonly RegExp[] = [
  /xkeysib-[A-Za-z0-9]{20,}/g,
  /xsmtpsib-[A-Za-z0-9]{15,}/g,
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Replaces each configured credential value and every Brevo REST-key/SMTP-key
 * shaped token with `[redacted]`, so no failure line can print a secret.
 * Empty, null and undefined secret values are ignored (an empty value would
 * otherwise match between every character).
 */
export function redactSecrets(
  message: string,
  secretValues: Array<string | null | undefined>,
): string {
  let redacted = message;
  for (const value of secretValues) {
    if (value) {
      redacted = redacted.split(value).join('[redacted]');
    }
  }
  for (const pattern of KEY_PATTERNS) {
    redacted = redacted.replace(pattern, '[redacted]');
  }
  return redacted;
}

/** Raw credential values, usable even when configuration parsing fails. */
function rawCredentialValues(
  env: Record<string, string | undefined>,
): Array<string | undefined> {
  return [env.SMTP_USER, env.SMTP_PASS, env.BREVO_API_KEY];
}

/**
 * Runs the CLI and returns its exit code instead of exiting, so every branch is
 * unit-testable. Arguments are parsed and the recipient validated before the
 * configuration is loaded, so invalid input never constructs a service.
 */
export async function runEmailTestCli(
  argv: string[],
  env: Record<string, string | undefined>,
  deps: EmailTestCliDeps = {},
): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const logError = deps.logError ?? ((line: string) => console.error(line));

  if (argv.includes('--help')) {
    log(USAGE);
    return 0;
  }

  let to: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--to') {
      to = argv[index + 1];
      index += 1;
      continue;
    }
    logError(`Unknown option: ${arg}`);
    logError(USAGE);
    return 1;
  }

  if (to === undefined) {
    logError('Missing required option: --to <address>');
    logError(USAGE);
    return 1;
  }
  if (!EMAIL_PATTERN.test(to)) {
    logError(`Invalid recipient address: "${to}"`);
    logError(USAGE);
    return 1;
  }

  const secrets = rawCredentialValues(env);
  let config: AuthConfig;
  let service: Pick<EmailService, 'sendVerification'>;
  try {
    config = loadAuthConfig(env);
    service = (deps.createService ?? createEmailService)(config);
  } catch (error) {
    logError(
      `Invalid email configuration: ${redactSecrets(errorMessage(error), secrets)}`,
    );
    return 1;
  }

  try {
    await service.sendVerification(to, `${config.appBaseUrl}${CLI_VERIFICATION_URL_PATH}`);
  } catch (error) {
    const apiTransport = config.emailTransport === 'brevo-api';
    const target = apiTransport
      ? `Brevo API (${BREVO_API_HOST}:${BREVO_API_PORT})`
      : `${config.smtpHost}:${config.smtpPort}`;
    const failureSecrets = apiTransport
      ? [config.brevoApiKey, config.smtpUser, config.smtpPass]
      : [config.smtpUser, config.smtpPass];
    logError(
      `Failed to send test email via ${target}: ` +
        redactSecrets(errorMessage(error), failureSecrets),
    );
    return 1;
  }

  if (config.emailTransport === 'brevo-api') {
    log(
      `Test email sent to ${to} via Brevo API ` +
        `(${BREVO_API_HOST}:${BREVO_API_PORT}, transport=brevo-api, from="${config.smtpFrom}")`,
    );
    return 0;
  }

  const auth = config.smtpUser !== null && config.smtpPass !== null;
  const starttls = !config.smtpSecure && auth ? 'required' : 'off';
  log(
    `Test email sent to ${to} via ${config.smtpHost}:${config.smtpPort} ` +
      `(secure=${String(config.smtpSecure)}, starttls=${starttls}, ` +
      `auth=${auth ? 'yes' : 'no'}, from="${config.smtpFrom}")`,
  );
  if (config.smtpFrom === DEFAULT_SMTP_FROM) {
    log(
      'Warning: SMTP_FROM is the local default; set it to a verified sender before real delivery.',
    );
  }
  return 0;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(invokedPath).href
) {
  process.exitCode = await runEmailTestCli(process.argv.slice(2), process.env);
}
