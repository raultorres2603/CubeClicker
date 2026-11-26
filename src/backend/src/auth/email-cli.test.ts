import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SMTP_FROM } from './config.js';
import {
  BREVO_API_SEND_URL,
  createEmailService,
  createSmtpEmailService,
  renderVerificationEmail,
  type BrevoRequest,
  type EmailTransport,
  type OutgoingEmail,
} from './email.js';
import {
  redactSecrets,
  runEmailTestCli,
  type EmailTestCliDeps,
} from './email-cli.js';

/** Independent copy of the usage pinned by `--help` (AC-9). */
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

const RECIPIENT = 'user@example.com';
const VERIFICATION_URL = 'http://localhost:5173/verify?token=cli-test';
const PLAIN_TEXT =
  'Welcome to CubeClicker!\n\n' +
  'Verify your email address by opening the link below:\n' +
  `${VERIFICATION_URL}\n\n` +
  'If you did not create an account, you can ignore this email.';

const BREVO_ENV = {
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'cli-user@example.com',
  SMTP_PASS: 'cli-pass-9f3a',
  SMTP_FROM: 'no-reply@example.com',
};

/** Synthetic API fixture: a non-secret placeholder key and a valid sender. */
const API_ENV = {
  EMAIL_TRANSPORT: 'brevo-api',
  BREVO_API_KEY: 'fixture.api.key',
  SMTP_FROM: 'CubeClicker <no-reply@example.com>',
};

const API_SUCCESS_LINE =
  'Test email sent to user@example.com via Brevo API ' +
  '(api.brevo.com:443, transport=brevo-api, from="CubeClicker <no-reply@example.com>")';

function createRecordingService() {
  const sendVerification = vi
    .fn<(to: string, verificationUrl: string) => Promise<void>>()
    .mockResolvedValue(undefined);
  return { sendVerification };
}

function createHarness(service = createRecordingService()) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const createService = vi.fn(() => service);
  const deps: EmailTestCliDeps = {
    createService,
    log: (line) => stdout.push(line),
    logError: (line) => stderr.push(line),
  };
  return { deps, stdout, stderr, createService, service };
}

describe('runEmailTestCli usage (AC-9)', () => {
  it('prints exactly the usage for --help and returns 0 without a service', async () => {
    const { deps, stdout, stderr, createService } = createHarness();

    expect(await runEmailTestCli(['--help'], BREVO_ENV, deps)).toBe(0);

    expect(stdout).toStrictEqual([USAGE]);
    expect(stderr).toStrictEqual([]);
    expect(createService).toHaveBeenCalledTimes(0);
  });
});

describe('runEmailTestCli argument errors (AC-9)', () => {
  it('reports a missing --to with usage and never constructs a service', async () => {
    const { deps, stdout, stderr, createService } = createHarness();

    expect(await runEmailTestCli([], BREVO_ENV, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual(['Missing required option: --to <address>', USAGE]);
    expect(createService).toHaveBeenCalledTimes(0);
  });

  it('treats a dangling --to as the missing required option', async () => {
    const { deps, stdout, stderr, createService } = createHarness();

    expect(await runEmailTestCli(['--to'], BREVO_ENV, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual(['Missing required option: --to <address>', USAGE]);
    expect(createService).toHaveBeenCalledTimes(0);
  });

  it('reports an unknown option with usage and never constructs a service', async () => {
    const { deps, stdout, stderr, createService } = createHarness();

    expect(await runEmailTestCli(['--recipient', RECIPIENT], BREVO_ENV, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual(['Unknown option: --recipient', USAGE]);
    expect(createService).toHaveBeenCalledTimes(0);
  });

  it('rejects an unknown option even when --to is valid', async () => {
    const { deps, stdout, stderr, createService, service } = createHarness();

    expect(
      await runEmailTestCli(['--to', RECIPIENT, '--verbose'], BREVO_ENV, deps),
    ).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual(['Unknown option: --verbose', USAGE]);
    expect(createService).toHaveBeenCalledTimes(0);
    expect(service.sendVerification).toHaveBeenCalledTimes(0);
  });

  it('rejects an invalid recipient address without constructing a service', async () => {
    const { deps, stdout, stderr, createService } = createHarness();

    expect(await runEmailTestCli(['--to', 'not-an-address'], BREVO_ENV, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual(['Invalid recipient address: "not-an-address"', USAGE]);
    expect(createService).toHaveBeenCalledTimes(0);
  });
});

describe('runEmailTestCli successful send (AC-8)', () => {
  it('sends exactly one message and prints the pinned Brevo success line', async () => {
    const { deps, stdout, stderr, createService, service } = createHarness();

    expect(await runEmailTestCli(['--to', RECIPIENT], BREVO_ENV, deps)).toBe(0);

    expect(createService).toHaveBeenCalledTimes(1);
    expect(service.sendVerification).toHaveBeenCalledTimes(1);
    expect(service.sendVerification).toHaveBeenCalledWith(RECIPIENT, VERIFICATION_URL);
    expect(stdout).toStrictEqual([
      'Test email sent to user@example.com via smtp-relay.brevo.com:587 (secure=false, starttls=required, auth=yes, from="no-reply@example.com")',
    ]);
    expect(stderr).toStrictEqual([]);
    expect(stdout.join('\n')).not.toContain('cli-user@example.com');
    expect(stdout.join('\n')).not.toContain('cli-pass-9f3a');
  });

  it('sends the branded template through the real service factory', async () => {
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockResolvedValue({ messageId: 'cli-test' });
    const transport: EmailTransport = { sendMail };
    const stdout: string[] = [];
    const stderr: string[] = [];
    const deps: EmailTestCliDeps = {
      createService: (config) => createSmtpEmailService(config, () => transport),
      log: (line) => stdout.push(line),
      logError: (line) => stderr.push(line),
    };

    expect(await runEmailTestCli(['--to', RECIPIENT], BREVO_ENV, deps)).toBe(0);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.com',
      to: 'user@example.com',
      subject: 'Verify your CubeClicker email',
      text: PLAIN_TEXT,
      html: renderVerificationEmail(VERIFICATION_URL).html,
    });
    expect(sendMail.mock.calls[0]![0].html).toContain('token=cli-test');
    expect(stdout).toStrictEqual([
      'Test email sent to user@example.com via smtp-relay.brevo.com:587 (secure=false, starttls=required, auth=yes, from="no-reply@example.com")',
    ]);
    expect(stderr).toStrictEqual([]);
  });

  it('prints the Mailpit defaults plus the default-SMTP_FROM warning', async () => {
    const { deps, stdout, stderr } = createHarness();

    expect(await runEmailTestCli(['--to', RECIPIENT], {}, deps)).toBe(0);

    expect(stdout).toStrictEqual([
      'Test email sent to user@example.com via mailpit:1025 (secure=false, starttls=off, auth=no, from="no-reply@cubeclicker.local")',
      'Warning: SMTP_FROM is the local default; set it to a verified sender before real delivery.',
    ]);
    expect(stderr).toStrictEqual([]);
  });

  it('warns when SMTP_FROM is explicitly set to the local default', async () => {
    const { deps, stdout, stderr } = createHarness();

    expect(
      await runEmailTestCli(['--to', RECIPIENT], { SMTP_FROM: DEFAULT_SMTP_FROM }, deps),
    ).toBe(0);

    expect(stdout).toStrictEqual([
      'Test email sent to user@example.com via mailpit:1025 (secure=false, starttls=off, auth=no, from="no-reply@cubeclicker.local")',
      'Warning: SMTP_FROM is the local default; set it to a verified sender before real delivery.',
    ]);
    expect(stderr).toStrictEqual([]);
  });

  it('reports implicit TLS with auth and no STARTTLS on port 465', async () => {
    const { deps, stdout, stderr } = createHarness();
    const env = {
      SMTP_HOST: 'smtp-relay.brevo.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'cli-user@example.com',
      SMTP_PASS: 'cli-pass-9f3a',
      SMTP_FROM: 'no-reply@example.com',
    };

    expect(await runEmailTestCli(['--to', RECIPIENT], env, deps)).toBe(0);

    expect(stdout).toStrictEqual([
      'Test email sent to user@example.com via smtp-relay.brevo.com:465 (secure=true, starttls=off, auth=yes, from="no-reply@example.com")',
    ]);
    expect(stderr).toStrictEqual([]);
  });
});

describe('runEmailTestCli configuration errors (AC-9)', () => {
  it('prints the sanitized invalid-configuration line and constructs no service', async () => {
    const { deps, stdout, stderr, createService } = createHarness();

    expect(
      await runEmailTestCli(['--to', RECIPIENT], { ...BREVO_ENV, SMTP_SECURE: 'yes' }, deps),
    ).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([
      'Invalid email configuration: SMTP_SECURE must be a boolean ("true", "false", "1", or "0"); received "yes"',
    ]);
    expect(createService).toHaveBeenCalledTimes(0);
  });

  it('redacts a credential value echoed by a configuration error', async () => {
    const { deps, stdout, stderr } = createHarness();
    const env = {
      ...BREVO_ENV,
      SMTP_CONNECTION_TIMEOUT_MS: 'cli-pass-9f3a',
    };

    expect(await runEmailTestCli(['--to', RECIPIENT], env, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([
      'Invalid email configuration: SMTP_CONNECTION_TIMEOUT_MS must be an integer between 1000 and 120000; received "[redacted]"',
    ]);
    expect(stderr.join('\n')).not.toContain('cli-pass-9f3a');
    expect(stderr.join('\n')).not.toContain('cli-user@example.com');
  });
});

describe('runEmailTestCli transport rejections (AC-9)', () => {
  it('redacts both credential values and a REST-key-shaped token in the exact failure line', async () => {
    const { deps, stdout, stderr, service } = createHarness();
    const restKey = 'xkeysib-' + 'a'.repeat(24);
    service.sendVerification.mockRejectedValueOnce(
      new Error(
        `535 authentication failed for ${BREVO_ENV.SMTP_USER} (${BREVO_ENV.SMTP_PASS}) with ${restKey}`,
      ),
    );

    expect(await runEmailTestCli(['--to', RECIPIENT], BREVO_ENV, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([
      'Failed to send test email via smtp-relay.brevo.com:587: 535 authentication failed for [redacted] ([redacted]) with [redacted]',
    ]);
    expect(stderr.join('\n')).not.toContain(BREVO_ENV.SMTP_USER);
    expect(stderr.join('\n')).not.toContain(BREVO_ENV.SMTP_PASS);
    expect(stderr.join('\n')).not.toContain(restKey);
  });

  it('redacts a short SMTP-key-shaped token and still returns 1', async () => {
    const { deps, stdout, stderr, service } = createHarness();
    const shortSmtpKey = 'xsmtpsib-' + 'b'.repeat(15);
    service.sendVerification.mockRejectedValueOnce(
      new Error(`relay rejected ${shortSmtpKey}`),
    );

    expect(await runEmailTestCli(['--to', RECIPIENT], BREVO_ENV, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([
      'Failed to send test email via smtp-relay.brevo.com:587: relay rejected [redacted]',
    ]);
    expect(stderr.join('\n')).not.toContain(shortSmtpKey);
  });
});

describe('runEmailTestCli Brevo API transport (AC-9)', () => {
  it('prints exactly the API success line and no SMTP fields', async () => {
    const { deps, stdout, stderr, createService, service } = createHarness();

    expect(await runEmailTestCli(['--to', RECIPIENT], API_ENV, deps)).toBe(0);

    expect(createService).toHaveBeenCalledTimes(1);
    expect(service.sendVerification).toHaveBeenCalledTimes(1);
    expect(service.sendVerification).toHaveBeenCalledWith(RECIPIENT, VERIFICATION_URL);
    expect(stdout).toStrictEqual([API_SUCCESS_LINE]);
    expect(stderr).toStrictEqual([]);
    expect(stdout.join('\n')).not.toContain('secure=');
    expect(stdout.join('\n')).not.toContain('starttls=');
    expect(stdout.join('\n')).not.toContain('auth=');
    expect(stdout.join('\n')).not.toContain(API_ENV.BREVO_API_KEY);
  });

  it('sends the branded API request through the real factory and prints the success line', async () => {
    const request = vi.fn<BrevoRequest>().mockResolvedValue({ ok: true, status: 201 });
    const stdout: string[] = [];
    const stderr: string[] = [];
    const deps: EmailTestCliDeps = {
      createService: (config) => createEmailService(config, { brevoRequest: request }),
      log: (line) => stdout.push(line),
      logError: (line) => stderr.push(line),
    };

    expect(await runEmailTestCli(['--to', RECIPIENT], API_ENV, deps)).toBe(0);

    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe(BREVO_API_SEND_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toStrictEqual({
      'api-key': API_ENV.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    });
    expect(JSON.parse(init.body!)).toStrictEqual({
      sender: { email: 'no-reply@example.com', name: 'CubeClicker' },
      to: [{ email: RECIPIENT }],
      subject: 'Verify your CubeClicker email',
      htmlContent: renderVerificationEmail(VERIFICATION_URL).html,
      textContent: PLAIN_TEXT,
    });
    expect(stdout).toStrictEqual([API_SUCCESS_LINE]);
    expect(stderr).toStrictEqual([]);
  });

  it('prints exactly the API failure line for a 401 without a key or address', async () => {
    const request = vi.fn<BrevoRequest>().mockResolvedValue({ ok: false, status: 401 });
    const stdout: string[] = [];
    const stderr: string[] = [];
    const deps: EmailTestCliDeps = {
      createService: (config) => createEmailService(config, { brevoRequest: request }),
      log: (line) => stdout.push(line),
      logError: (line) => stderr.push(line),
    };

    expect(await runEmailTestCli(['--to', RECIPIENT], API_ENV, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([
      'Failed to send test email via Brevo API (api.brevo.com:443): Brevo API responded with HTTP 401',
    ]);
    expect(stderr.join('\n')).not.toContain(API_ENV.BREVO_API_KEY);
    expect(stderr.join('\n')).not.toContain(RECIPIENT);
  });

  it('redacts the configured API key and the SMTP values from an injected rejection', async () => {
    const { deps, stdout, stderr, service } = createHarness();
    const env = {
      ...API_ENV,
      SMTP_USER: BREVO_ENV.SMTP_USER,
      SMTP_PASS: BREVO_ENV.SMTP_PASS,
    };
    service.sendVerification.mockRejectedValueOnce(
      new Error(
        `provider rejected ${env.BREVO_API_KEY} ${env.SMTP_USER} ${env.SMTP_PASS}`,
      ),
    );

    expect(await runEmailTestCli(['--to', RECIPIENT], env, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([
      'Failed to send test email via Brevo API (api.brevo.com:443): provider rejected [redacted] [redacted] [redacted]',
    ]);
    expect(stderr.join('\n')).not.toContain(env.BREVO_API_KEY);
    expect(stderr.join('\n')).not.toContain(env.SMTP_USER);
    expect(stderr.join('\n')).not.toContain(env.SMTP_PASS);
  });

  it('prints exactly the missing-key configuration line and constructs no service', async () => {
    const { deps, stdout, stderr, createService } = createHarness();
    const env = {
      EMAIL_TRANSPORT: 'brevo-api',
      SMTP_FROM: 'CubeClicker <no-reply@example.com>',
    };

    expect(await runEmailTestCli(['--to', RECIPIENT], env, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([
      'Invalid email configuration: BREVO_API_KEY must be a non-empty string when EMAIL_TRANSPORT=brevo-api',
    ]);
    expect(createService).toHaveBeenCalledTimes(0);
  });

  it('redacts the configured API key from a configuration error', async () => {
    const { deps, stdout, stderr, createService } = createHarness();
    const env = {
      ...API_ENV,
      SESSION_COOKIE_SAMESITE: API_ENV.BREVO_API_KEY,
    };

    expect(await runEmailTestCli(['--to', RECIPIENT], env, deps)).toBe(1);

    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([
      'Invalid email configuration: SESSION_COOKIE_SAMESITE must be one of "lax", "strict", or "none"; received "[redacted]"',
    ]);
    expect(createService).toHaveBeenCalledTimes(0);
    expect(stderr.join('\n')).not.toContain(API_ENV.BREVO_API_KEY);
  });
});

describe('redactSecrets (AC-9)', () => {
  it('replaces every occurrence of every configured credential value', () => {
    expect(
      redactSecrets(
        'login cli-user@example.com with cli-pass-9f3a then cli-user@example.com again',
        [BREVO_ENV.SMTP_USER, BREVO_ENV.SMTP_PASS],
      ),
    ).toBe('login [redacted] with [redacted] then [redacted] again');
  });

  it('redacts the configured Brevo API key value', () => {
    expect(
      redactSecrets(`sent with ${API_ENV.BREVO_API_KEY} now`, [API_ENV.BREVO_API_KEY]),
    ).toBe('sent with [redacted] now');
  });

  it('ignores empty, null and undefined secret values', () => {
    expect(redactSecrets('clean message', [null, undefined, ''])).toBe('clean message');
  });

  it('redacts every REST-key and SMTP-key shaped token', () => {
    const restKey = 'xkeysib-' + 'a'.repeat(24);
    const smtpKey = 'xsmtpsib-' + 'b'.repeat(15);

    expect(redactSecrets(`${restKey} ${restKey} ${smtpKey}`, [])).toBe(
      '[redacted] [redacted] [redacted]',
    );
  });

  it('leaves tokens shorter than the pinned key lengths untouched', () => {
    const shortRestKey = 'xkeysib-' + 'a'.repeat(19);
    const shortSmtpKey = 'xsmtpsib-' + 'b'.repeat(14);

    expect(redactSecrets(`${shortRestKey} ${shortSmtpKey}`, [])).toBe(
      `${shortRestKey} ${shortSmtpKey}`,
    );
  });
});

describe('email-cli executable entry', () => {
  const CLI_PATH = fileURLToPath(new URL('./email-cli.ts', import.meta.url));

  function runCliProcess(args: string[]) {
    return spawnSync(process.execPath, ['--import', 'tsx', CLI_PATH, ...args], {
      encoding: 'utf8',
      timeout: 30_000,
    });
  }

  it('prints exactly the usage with exit 0 through the real script entry', () => {
    const result = runCliProcess(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${USAGE}\n`);
    expect(result.stderr).toBe('');
  });

  it('exits 1 with the unknown-option line through the real script entry', () => {
    const result = runCliProcess(['--bogus']);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(`Unknown option: --bogus\n${USAGE}\n`);
  });
});
