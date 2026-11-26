import { describe, expect, it, vi } from 'vitest';

import * as template from './email-template.js';
import { runEmailTestCli } from './email-cli.js';
import {
  BREVO_API_ACCOUNT_URL,
  BREVO_API_HOST,
  BREVO_API_PORT,
  BREVO_API_SEND_URL,
  BREVO_API_TIMEOUT_MS,
  BrevoApiEmailService,
  EmailDeliveryError,
  FakeEmailService,
  SmtpEmailService,
  VERIFICATION_EMAIL_SUBJECT,
  buildSmtpTransportOptions,
  createEmailService,
  createSmtpEmailService,
  renderVerificationEmail,
  type BrevoRequest,
  type BrevoRequestInit,
  type BrevoResponseLike,
  type CapturedVerificationEmail,
  type EmailTransport,
  type OutgoingEmail,
  type SmtpEmailConfig,
  type SmtpTransportOptions,
} from './email.js';

const VERIFICATION_URL = 'http://localhost:5173/verify?token=abc123def456';
const PLAIN_TEXT =
  'Welcome to CubeClicker!\n\n' +
  'Verify your email address by opening the link below:\n' +
  `${VERIFICATION_URL}\n\n` +
  'If you did not create an account, you can ignore this email.';

const CREDENTIALS = {
  user: 'smtp-login@example.test',
  pass: 'smtp-key-for-tests',
} as const;

const BREVO_CONFIG: SmtpEmailConfig = {
  smtpHost: 'smtp-relay.brevo.com',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: CREDENTIALS.user,
  smtpPass: CREDENTIALS.pass,
  smtpFrom: 'CubeClicker <no-reply@example.com>',
  smtpConnectionTimeoutMs: 10_000,
};

/** Synthetic REST-key-shaped fixture; never recorded in an artifact. */
const API_KEY = 'xkeysib-' + 'A'.repeat(24);
const API_FROM = 'CubeClicker <no-reply@example.com>';
const BARE_API_FROM = 'no-reply@example.com';
const API_RECIPIENT = 'verification-recipient@example.com';

/** Runs a constructor/factory and returns the thrown `Error`, or null. */
function captureError(run: () => unknown): Error | null {
  try {
    run();
    return null;
  } catch (error) {
    return error as Error;
  }
}

function createTransportMock() {
  const sendMail = vi
    .fn<(options: OutgoingEmail) => Promise<unknown>>()
    .mockResolvedValue({ messageId: 'msg-1' });
  const transport: EmailTransport = { sendMail };
  return { sendMail, transport };
}

describe('template re-exports (T4)', () => {
  it('re-exports the pinned subject and the pure renderer', () => {
    expect(VERIFICATION_EMAIL_SUBJECT).toBe('Verify your CubeClicker email');
    expect(renderVerificationEmail).toBe(template.renderVerificationEmail);
  });
});

describe('buildSmtpTransportOptions (AC-5, AC-6)', () => {
  it('pins the Brevo 587 STARTTLS options with auth', () => {
    expect(
      buildSmtpTransportOptions({
        host: 'smtp-relay.brevo.com',
        port: 587,
        user: CREDENTIALS.user,
        pass: CREDENTIALS.pass,
        from: 'no-reply@example.com',
      }),
    ).toStrictEqual({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'smtp-login@example.test', pass: 'smtp-key-for-tests' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  });

  it('uses implicit TLS on 465 and never requires STARTTLS', () => {
    expect(
      buildSmtpTransportOptions({
        host: 'smtp-relay.brevo.com',
        port: 465,
        secure: true,
        user: CREDENTIALS.user,
        pass: CREDENTIALS.pass,
        from: 'no-reply@example.com',
      }),
    ).toStrictEqual({
      host: 'smtp-relay.brevo.com',
      port: 465,
      secure: true,
      requireTLS: false,
      auth: { user: 'smtp-login@example.test', pass: 'smtp-key-for-tests' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  });

  it('derives implicit TLS from port 465 when secure is omitted', () => {
    expect(
      buildSmtpTransportOptions({
        host: 'smtp-relay.brevo.com',
        port: 465,
        from: 'no-reply@example.com',
      }),
    ).toStrictEqual({
      host: 'smtp-relay.brevo.com',
      port: 465,
      secure: true,
      requireTLS: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  });

  it('honours an explicit secure=false on 465 and then requires STARTTLS', () => {
    expect(
      buildSmtpTransportOptions({
        host: 'smtp-relay.brevo.com',
        port: 465,
        secure: false,
        user: CREDENTIALS.user,
        pass: CREDENTIALS.pass,
        from: 'no-reply@example.com',
      }),
    ).toStrictEqual({
      host: 'smtp-relay.brevo.com',
      port: 465,
      secure: false,
      requireTLS: true,
      auth: { user: 'smtp-login@example.test', pass: 'smtp-key-for-tests' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  });

  it('keeps the Mailpit defaults plaintext with no auth property (AC-6)', () => {
    const options = buildSmtpTransportOptions({
      host: 'mailpit',
      port: 1025,
      from: 'no-reply@cubeclicker.local',
    });

    expect(options).toStrictEqual({
      host: 'mailpit',
      port: 1025,
      secure: false,
      requireTLS: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    expect(Object.hasOwn(options, 'auth')).toBe(false);
  });

  it('applies the configured timeout to all three timeout fields', () => {
    expect(
      buildSmtpTransportOptions({
        host: 'smtp-relay.brevo.com',
        port: 587,
        user: CREDENTIALS.user,
        pass: CREDENTIALS.pass,
        from: 'no-reply@example.com',
        connectionTimeoutMs: 2500,
      }),
    ).toStrictEqual({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'smtp-login@example.test', pass: 'smtp-key-for-tests' },
      connectionTimeout: 2500,
      greetingTimeout: 2500,
      socketTimeout: 2500,
    });
  });

  it('omits auth and STARTTLS unless both credentials are set', () => {
    const withoutPass = buildSmtpTransportOptions({
      host: 'smtp-relay.brevo.com',
      port: 587,
      user: CREDENTIALS.user,
      pass: null,
      from: 'no-reply@example.com',
    });
    expect(withoutPass).toStrictEqual({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    expect(Object.hasOwn(withoutPass, 'auth')).toBe(false);

    const withoutUser = buildSmtpTransportOptions({
      host: 'smtp-relay.brevo.com',
      port: 587,
      user: null,
      pass: CREDENTIALS.pass,
      from: 'no-reply@example.com',
    });
    expect(withoutUser).toStrictEqual({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    expect(Object.hasOwn(withoutUser, 'auth')).toBe(false);
  });
});

describe('createSmtpEmailService (AC-5)', () => {
  it('passes the built transport options to the factory exactly once', () => {
    const { sendMail, transport } = createTransportMock();
    const factory = vi
      .fn<(options: SmtpTransportOptions) => EmailTransport>()
      .mockReturnValue(transport);

    const service = createSmtpEmailService(BREVO_CONFIG, factory);

    expect(service).toBeInstanceOf(SmtpEmailService);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'smtp-login@example.test', pass: 'smtp-key-for-tests' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends exactly { from, to, subject, text, html } through the factory transport', async () => {
    const { sendMail, transport } = createTransportMock();
    const service = createSmtpEmailService(BREVO_CONFIG, () => transport);

    await service.sendVerification('user@example.com', VERIFICATION_URL, {
      expiresInMs: 3_600_000,
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: 'CubeClicker <no-reply@example.com>',
      to: 'user@example.com',
      subject: 'Verify your CubeClicker email',
      text: PLAIN_TEXT,
      html: renderVerificationEmail(VERIFICATION_URL, { expiresInMs: 3_600_000 }).html,
    });
    expect(sendMail.mock.calls[0]![0].html).toContain('This link expires in 1 hour.');
  });
});

describe('operator CLI integration (AC-2(d))', () => {
  it('prints the redacted exact failure line through the real SmtpEmailService wrapper', async () => {
    const env = {
      SMTP_HOST: 'smtp-relay.brevo.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: CREDENTIALS.user,
      SMTP_PASS: CREDENTIALS.pass,
      SMTP_FROM: 'CubeClicker <no-reply@example.com>',
    };
    const source = Object.assign(
      new Error(`535 authentication failed for ${CREDENTIALS.user} (${CREDENTIALS.pass})`),
      { code: 'EAUTH' },
    );
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockRejectedValue(source);
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runEmailTestCli(['--to', 'user@example.com'], env, {
      createService: (config) => createSmtpEmailService(config, () => ({ sendMail })),
      log: (line) => stdout.push(line),
      logError: (line) => stderr.push(line),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([
      'Failed to send test email via smtp-relay.brevo.com:587: 535 authentication failed for [redacted] ([redacted])',
    ]);
    expect(stderr.join('\n')).not.toContain(CREDENTIALS.user);
    expect(stderr.join('\n')).not.toContain(CREDENTIALS.pass);
  });
});

describe('FakeEmailService', () => {
  it('starts with no captured messages', () => {
    const fake = new FakeEmailService();
    expect(fake.sent).toEqual([]);
  });

  it('captures the recipient and URL with no TTL by default', async () => {
    const fake = new FakeEmailService();
    await fake.sendVerification('user@example.com', VERIFICATION_URL);
    const expected: CapturedVerificationEmail = {
      to: 'user@example.com',
      verificationUrl: VERIFICATION_URL,
      expiresInMs: undefined,
    };
    expect(fake.sent).toStrictEqual([expected]);
  });

  it('records the token lifetime when the caller supplies it', async () => {
    const fake = new FakeEmailService();
    await fake.sendVerification('user@example.com', VERIFICATION_URL, {
      expiresInMs: 3_600_000,
    });
    expect(fake.sent).toStrictEqual([
      { to: 'user@example.com', verificationUrl: VERIFICATION_URL, expiresInMs: 3_600_000 },
    ]);
  });

  it('captures multiple messages in order', async () => {
    const fake = new FakeEmailService();
    await fake.sendVerification('first@example.com', 'http://localhost:5173/verify?token=first');
    await fake.sendVerification('second@example.com', 'http://localhost:5173/verify?token=second', {
      expiresInMs: 604_800_000,
    });
    expect(fake.sent).toStrictEqual([
      {
        to: 'first@example.com',
        verificationUrl: 'http://localhost:5173/verify?token=first',
        expiresInMs: undefined,
      },
      {
        to: 'second@example.com',
        verificationUrl: 'http://localhost:5173/verify?token=second',
        expiresInMs: 604_800_000,
      },
    ]);
  });

  it('records verifyCalls and resolves by default', async () => {
    const fake = new FakeEmailService();

    expect(fake.verifyCalls).toBe(0);
    await expect(fake.verify()).resolves.toBeUndefined();
    await expect(fake.verify()).resolves.toBeUndefined();

    expect(fake.verifyCalls).toBe(2);
    expect(fake.failNextVerify).toBeUndefined();
  });

  it('rejects once with the injected failNextVerify and then clears it', async () => {
    const fake = new FakeEmailService();
    const failure = new Error('probe refused');
    fake.failNextVerify = failure;

    await expect(fake.verify()).rejects.toBe(failure);

    expect(fake.verifyCalls).toBe(1);
    expect(fake.failNextVerify).toBeUndefined();

    await expect(fake.verify()).resolves.toBeUndefined();

    expect(fake.verifyCalls).toBe(2);
  });
});

describe('SmtpEmailService', () => {
  it('sends a rendered verification email through the injected transport factory', async () => {
    const { sendMail, transport } = createTransportMock();
    const service = new SmtpEmailService(
      {
        host: 'smtp.example.com',
        port: 587,
        user: CREDENTIALS.user,
        pass: CREDENTIALS.pass,
        from: 'no-reply@cubeclicker.local',
      },
      () => transport,
    );

    await service.sendVerification('user@example.com', VERIFICATION_URL);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: 'no-reply@cubeclicker.local',
      to: 'user@example.com',
      subject: 'Verify your CubeClicker email',
      text: PLAIN_TEXT,
      html: renderVerificationEmail(VERIFICATION_URL).html,
    });
  });

  it('wraps transport failures in EmailDeliveryError with the verbatim source message', async () => {
    const source = Object.assign(new Error('smtp down'), { code: 'ETIMEDOUT' });
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockRejectedValue(source);
    const service = new SmtpEmailService(
      { host: 'smtp.example.com', port: 587, from: 'no-reply@cubeclicker.local' },
      () => ({ sendMail }),
    );

    const error = await service
      .sendVerification('user@example.com', VERIFICATION_URL)
      .catch((reason: unknown) => reason as Error);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    const typed = error as EmailDeliveryError;
    expect(typed.message).toBe('smtp down');
    expect(typed.host).toBe('smtp.example.com');
    expect(typed.port).toBe(587);
    expect(typed.errorType).toBe('Error');
    expect(typed.transportCode).toBe('ETIMEDOUT');
  });

  it('reports the configured host and port when send fails through createSmtpEmailService', async () => {
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockRejectedValue(new Error('connection refused'));
    const service = createSmtpEmailService(BREVO_CONFIG, () => ({ sendMail }));

    const error = await service
      .sendVerification('user@example.com', VERIFICATION_URL)
      .catch((reason: unknown) => reason as Error);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    const typed = error as EmailDeliveryError;
    expect(typed.name).toBe('EmailDeliveryError');
    expect(typed.code).toBe('verification_email_failed');
    expect(typed.transport).toBe('smtp');
    expect(typed.host).toBe('smtp-relay.brevo.com');
    expect(typed.port).toBe(587);
    expect(typed.errorType).toBe('Error');
    expect(typed.transportCode).toBeUndefined();
    expect(typed.message).toBe('connection refused');
  });

  it('keeps credentials and token shapes out of every enumerable field except message (AC-2(b))', async () => {
    const token = 'a'.repeat(64);
    const message =
      `535 authentication failed for ${CREDENTIALS.user} (${CREDENTIALS.pass}) token=${token}`;
    const source = Object.assign(new Error(message), { code: 'EAUTH' });
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockRejectedValue(source);
    const service = new SmtpEmailService(
      {
        host: 'smtp.example.com',
        port: 587,
        user: CREDENTIALS.user,
        pass: CREDENTIALS.pass,
        from: 'no-reply@cubeclicker.local',
      },
      () => ({ sendMail }),
    );

    const error = await service
      .sendVerification('user@example.com', VERIFICATION_URL)
      .catch((reason: unknown) => reason as Error);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    const typed = error as EmailDeliveryError;
    expect(typed.name).toBe('EmailDeliveryError');
    expect(typed.code).toBe('verification_email_failed');
    expect(typed.transport).toBe('smtp');
    expect(typed.host).toBe('smtp.example.com');
    expect(typed.port).toBe(587);
    expect(typed.errorType).toBe('Error');
    expect(typed.transportCode).toBe('EAUTH');
    expect(typed.message).toBe(message);

    const enumerableStrings = Object.entries(typed)
      .filter(([key]) => key !== 'message')
      .map(([, value]) => value)
      .filter((value): value is string => typeof value === 'string');
    for (const secret of [CREDENTIALS.user, CREDENTIALS.pass, token]) {
      expect(enumerableStrings.filter((value) => value.includes(secret))).toStrictEqual([]);
    }
  });
});

describe('SmtpEmailService.verify (AC-2(c))', () => {
  it('delegates to the transport verify exactly once and resolves', async () => {
    const verify = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true });
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockResolvedValue({ messageId: 'unused' });
    const service = new SmtpEmailService(
      { host: 'smtp.example.com', port: 587, from: 'no-reply@cubeclicker.local' },
      () => ({ sendMail, verify }),
    );

    await expect(service.verify()).resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(0);
  });

  it('wraps a verify rejection in EmailDeliveryError with the configured host and port', async () => {
    const source = Object.assign(new Error('greeting timeout'), { code: 'ETIMEDOUT' });
    const verify = vi.fn<() => Promise<unknown>>().mockRejectedValue(source);
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockResolvedValue({ messageId: 'unused' });
    const service = new SmtpEmailService(
      { host: 'smtp-relay.brevo.com', port: 2525, from: 'no-reply@cubeclicker.local' },
      () => ({ sendMail, verify }),
    );

    const error = await service
      .verify()
      .catch((reason: unknown) => reason as Error);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    const typed = error as EmailDeliveryError;
    expect(typed.name).toBe('EmailDeliveryError');
    expect(typed.code).toBe('verification_email_failed');
    expect(typed.transport).toBe('smtp');
    expect(typed.host).toBe('smtp-relay.brevo.com');
    expect(typed.port).toBe(2525);
    expect(typed.errorType).toBe('Error');
    expect(typed.transportCode).toBe('ETIMEDOUT');
    expect(typed.message).toBe('greeting timeout');
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('resolves without calling anything when the transport has no verify', async () => {
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockResolvedValue({ messageId: 'unused' });
    const service = new SmtpEmailService(
      { host: 'mailpit', port: 1025, from: 'no-reply@cubeclicker.local' },
      () => ({ sendMail }),
    );

    await expect(service.verify()).resolves.toBeUndefined();

    expect(sendMail).toHaveBeenCalledTimes(0);
  });
});

describe('EmailDeliveryError (AC-2)', () => {
  it('pins the typed fields and preserves the source message verbatim', () => {
    const source = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:587'), {
      code: 'ECONNREFUSED',
    });

    const error = new EmailDeliveryError(source, 'smtp-relay.brevo.com', 587);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(error.name).toBe('EmailDeliveryError');
    expect(error.code).toBe('verification_email_failed');
    expect(error.transport).toBe('smtp');
    expect(error.host).toBe('smtp-relay.brevo.com');
    expect(error.port).toBe(587);
    expect(error.errorType).toBe('Error');
    expect(error.transportCode).toBe('ECONNREFUSED');
    expect(error.message).toBe('connect ECONNREFUSED 127.0.0.1:587');
  });

  it('uses the source error name as errorType', () => {
    const source = new Error('mailbox unavailable');
    source.name = 'MailboxError';

    const error = new EmailDeliveryError(source, 'smtp.example.com', 587);

    expect(error.errorType).toBe('MailboxError');
    expect(error.transportCode).toBeUndefined();
  });

  it('reports unknown errorType and a stringified message for non-Error rejections', () => {
    const textError = new EmailDeliveryError('relay refused', 'mailpit', 1025);

    expect(textError.errorType).toBe('unknown');
    expect(textError.message).toBe('relay refused');
    expect(textError.transportCode).toBeUndefined();

    const nullError = new EmailDeliveryError(null, 'mailpit', 1025);

    expect(nullError.errorType).toBe('unknown');
    expect(nullError.message).toBe('null');
    expect(nullError.transportCode).toBeUndefined();
  });

  it.each([
    { label: 'uppercase acronym', code: 'EAUTH', expected: 'EAUTH' },
    { label: 'underscore', code: 'E_AUTH', expected: 'E_AUTH' },
    { label: '40 characters', code: 'A'.repeat(40), expected: 'A'.repeat(40) },
    { label: 'lowercase', code: 'econnrefused', expected: undefined },
    { label: 'hyphen', code: 'E-AUTH', expected: undefined },
    { label: 'trailing space', code: 'EAUTH ', expected: undefined },
    { label: '41 characters', code: 'A'.repeat(41), expected: undefined },
    { label: 'non-string', code: 535, expected: undefined },
    { label: 'absent', code: undefined, expected: undefined },
  ])('keeps $label transport codes only when provider-shaped', ({ code, expected }) => {
    const source = Object.assign(new Error('rejected'), { code });

    expect(new EmailDeliveryError(source, 'smtp.example.com', 587).transportCode).toBe(expected);
  });

  it('keeps the SMTP form and verbatim message while accepting an explicit transport', () => {
    const source = Object.assign(new Error('Unauthorized'), { code: 'HTTP_401' });

    const smtp = new EmailDeliveryError(source, 'smtp-relay.brevo.com', 587);
    const api = new EmailDeliveryError(source, 'api.brevo.com', 443, 'brevo-api');

    expect(smtp.transport).toBe('smtp');
    expect(smtp.message).toBe('Unauthorized');
    expect(smtp.transportCode).toBe('HTTP_401');
    expect(api.transport).toBe('brevo-api');
    expect(api.message).toBe('Unauthorized');
    expect(api.errorType).toBe('Error');
    expect(api.transportCode).toBe('HTTP_401');
    expect(api.host).toBe('api.brevo.com');
    expect(api.port).toBe(443);
  });
});

describe('Brevo API constants (AC-3, AC-4)', () => {
  it('pins the exported endpoint and 10-second timeout by value', () => {
    expect(BREVO_API_TIMEOUT_MS).toBe(10000);
    expect(BREVO_API_HOST).toBe('api.brevo.com');
    expect(BREVO_API_PORT).toBe(443);
    expect(BREVO_API_SEND_URL).toBe('https://api.brevo.com/v3/smtp/email');
    expect(BREVO_API_ACCOUNT_URL).toBe('https://api.brevo.com/v3/account');
  });
});

describe('BrevoApiEmailService request contract (AC-3)', () => {
  it('pins the exact POST request with a display-name sender and the branded template', async () => {
    const request = vi.fn<BrevoRequest>().mockResolvedValue({ ok: true, status: 201 });
    const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);
    const options = { expiresInMs: 3_600_000 };

    await expect(
      service.sendVerification(API_RECIPIENT, VERIFICATION_URL, options),
    ).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers).toStrictEqual({
      'api-key': API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    });
    expect(init.body).toBe(
      JSON.stringify({
        sender: { email: 'no-reply@example.com', name: 'CubeClicker' },
        to: [{ email: 'verification-recipient@example.com' }],
        subject: 'Verify your CubeClicker email',
        htmlContent: renderVerificationEmail(VERIFICATION_URL, options).html,
        textContent: PLAIN_TEXT,
      }),
    );
    expect(Object.keys(JSON.parse(init.body!) as Record<string, unknown>)).toStrictEqual([
      'sender',
      'to',
      'subject',
      'htmlContent',
      'textContent',
    ]);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);
  });

  it('omits the sender name for a bare sender and matches the SMTP payload byte-for-byte', async () => {
    const request = vi.fn<BrevoRequest>().mockResolvedValue({ ok: true, status: 202 });
    const apiService = new BrevoApiEmailService(
      { apiKey: API_KEY, from: BARE_API_FROM },
      request,
    );
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockResolvedValue({ messageId: 'smtp-parity' });
    const smtpService = new SmtpEmailService(
      { host: 'smtp-relay.brevo.com', port: 587, from: BARE_API_FROM },
      () => ({ sendMail }),
    );
    const options = { expiresInMs: 3_600_000 };

    await apiService.sendVerification(API_RECIPIENT, VERIFICATION_URL, options);
    await smtpService.sendVerification(API_RECIPIENT, VERIFICATION_URL, options);

    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe(BREVO_API_SEND_URL);
    const body = JSON.parse(init.body!) as {
      sender: unknown;
      to: unknown;
      subject: string;
      htmlContent: string;
      textContent: string;
    };
    expect(body.sender).toStrictEqual({ email: 'no-reply@example.com' });
    expect(body.to).toStrictEqual([{ email: 'verification-recipient@example.com' }]);
    const smtpPayload = sendMail.mock.calls[0]![0];
    expect(body.subject).toBe(smtpPayload.subject);
    expect(body.textContent).toBe(smtpPayload.text);
    expect(body.htmlContent).toBe(smtpPayload.html);
    expect(body.subject).toBe('Verify your CubeClicker email');
  });

  it.each([201, 202])(
    'resolves on HTTP %i without reading the response body',
    async (status) => {
      let bodyReads = 0;
      const response = {
        ok: true,
        status,
        get text(): string {
          bodyReads += 1;
          return 'provider body';
        },
      };
      const request = vi.fn<BrevoRequest>().mockResolvedValue(response);
      const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

      await expect(
        service.sendVerification(API_RECIPIENT, VERIFICATION_URL),
      ).resolves.toBeUndefined();

      expect(bodyReads).toBe(0);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an unparseable SMTP_FROM at construction with the config message', () => {
    const failure = captureError(
      () => new BrevoApiEmailService({ apiKey: API_KEY, from: 'not an address' }),
    );

    expect(failure?.message).toBe(
      'SMTP_FROM must be an address or "Display Name <address>" when EMAIL_TRANSPORT=brevo-api',
    );
  });
});

describe('BrevoApiEmailService failures (AC-4)', () => {
  it.each([400, 401, 403, 429, 500])(
    'maps HTTP %i to the fixed typed failure',
    async (status) => {
      const request = vi.fn<BrevoRequest>().mockResolvedValue({ ok: false, status });
      const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

      const error = await service
        .sendVerification(API_RECIPIENT, VERIFICATION_URL)
        .catch((reason: unknown) => reason as EmailDeliveryError);

      expect(error).toBeInstanceOf(EmailDeliveryError);
      expect(error.name).toBe('EmailDeliveryError');
      expect(error.code).toBe('verification_email_failed');
      expect(error.transport).toBe('brevo-api');
      expect(error.host).toBe('api.brevo.com');
      expect(error.port).toBe(443);
      expect(error.errorType).toBe('BrevoApiError');
      expect(error.transportCode).toBe(`HTTP_${status}`);
      expect(error.message).toBe(`Brevo API responded with HTTP ${status}`);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it('maps a TimeoutError to the fixed timeout message with no transport code', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    const request = vi.fn<BrevoRequest>().mockRejectedValue(timeout);
    const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

    const error = await service
      .sendVerification(API_RECIPIENT, VERIFICATION_URL)
      .catch((reason: unknown) => reason as EmailDeliveryError);

    expect(error.transport).toBe('brevo-api');
    expect(error.errorType).toBe('TimeoutError');
    expect(error.transportCode).toBeUndefined();
    expect(error.message).toBe('Brevo API request timed out after 10000ms');
  });

  it('uses the configured timeout in the timeout message', async () => {
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    const request = vi.fn<BrevoRequest>().mockRejectedValue(timeout);
    const service = new BrevoApiEmailService(
      { apiKey: API_KEY, from: API_FROM, timeoutMs: 2500 },
      request,
    );

    const error = await service
      .sendVerification(API_RECIPIENT, VERIFICATION_URL)
      .catch((reason: unknown) => reason as EmailDeliveryError);

    expect(error.message).toBe('Brevo API request timed out after 2500ms');
  });

  it('maps any other rejection without smuggling its provider code', async () => {
    const source = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    const request = vi.fn<BrevoRequest>().mockRejectedValue(source);
    const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

    const error = await service
      .sendVerification(API_RECIPIENT, VERIFICATION_URL)
      .catch((reason: unknown) => reason as EmailDeliveryError);

    expect(error.transport).toBe('brevo-api');
    expect(error.errorType).toBe('Error');
    expect(error.transportCode).toBeUndefined();
    expect(error.message).toBe('Brevo API request failed');
  });

  it('reports unknown for a non-Error rejection', async () => {
    const request = vi.fn<BrevoRequest>().mockRejectedValue('relay refused');
    const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

    const error = await service
      .sendVerification(API_RECIPIENT, VERIFICATION_URL)
      .catch((reason: unknown) => reason as EmailDeliveryError);

    expect(error.errorType).toBe('unknown');
    expect(error.transportCode).toBeUndefined();
    expect(error.message).toBe('Brevo API request failed');
  });

  it('never reads or leaks a provider body and never exposes the API key', async () => {
    const syntheticRestKey = 'xkeysib-' + 'b'.repeat(24);
    const syntheticSmtpKey = 'xsmtpsib-' + 'c'.repeat(15);
    const providerBody = `${API_RECIPIENT} ${syntheticRestKey} ${syntheticSmtpKey}`;
    let bodyReads = 0;
    const response = {
      ok: false,
      status: 401,
      get text(): Promise<string> {
        bodyReads += 1;
        return Promise.resolve(providerBody);
      },
    };
    const request = vi.fn<BrevoRequest>().mockResolvedValue(response);
    const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

    const error = await service
      .sendVerification(API_RECIPIENT, VERIFICATION_URL)
      .catch((reason: unknown) => reason as EmailDeliveryError);

    expect(providerBody).toContain(API_RECIPIENT);
    expect(bodyReads).toBe(0);
    expect(error.message).toBe('Brevo API responded with HTTP 401');
    expect(error.transportCode).toBe('HTTP_401');

    const enumerableStrings = Object.entries(error)
      .filter(([key]) => key !== 'message')
      .map(([, value]) => value)
      .filter((value): value is string => typeof value === 'string');
    for (const secret of [API_RECIPIENT, syntheticRestKey, syntheticSmtpKey, API_KEY]) {
      expect(enumerableStrings.filter((value) => value.includes(secret))).toStrictEqual([]);
      expect(error.message.includes(secret)).toBe(false);
    }
  });
});

describe('BrevoApiEmailService.verify (AC-4(e))', () => {
  it('calls GET /v3/account once with the exact headers and a timeout signal', async () => {
    const request = vi.fn<BrevoRequest>().mockResolvedValue({ ok: true, status: 200 });
    const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

    await expect(service.verify()).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/account');
    expect(init.method).toBe('GET');
    expect(init.headers).toStrictEqual({
      'api-key': API_KEY,
      accept: 'application/json',
    });
    expect(Object.hasOwn(init, 'body')).toBe(false);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);
  });

  it('maps a 401 probe rejection without reading the account body', async () => {
    let bodyReads = 0;
    const response = {
      ok: false,
      status: 401,
      get json(): Promise<unknown> {
        bodyReads += 1;
        return Promise.resolve({ email: API_RECIPIENT });
      },
    };
    const request = vi.fn<BrevoRequest>().mockResolvedValue(response);
    const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

    const error = await service
      .verify()
      .catch((reason: unknown) => reason as EmailDeliveryError);

    expect(bodyReads).toBe(0);
    expect(error.name).toBe('EmailDeliveryError');
    expect(error.transport).toBe('brevo-api');
    expect(error.errorType).toBe('BrevoApiError');
    expect(error.transportCode).toBe('HTTP_401');
    expect(error.message).toBe('Brevo API responded with HTTP 401');
  });

  it('maps a probe timeout with the fixed message', async () => {
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    const request = vi.fn<BrevoRequest>().mockRejectedValue(timeout);
    const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

    const error = await service
      .verify()
      .catch((reason: unknown) => reason as EmailDeliveryError);

    expect(error.errorType).toBe('TimeoutError');
    expect(error.transportCode).toBeUndefined();
    expect(error.message).toBe('Brevo API request timed out after 10000ms');
  });

  it('maps any other probe rejection with the fixed message', async () => {
    const request = vi.fn<BrevoRequest>().mockRejectedValue(new Error('dns failure'));
    const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM }, request);

    const error = await service
      .verify()
      .catch((reason: unknown) => reason as EmailDeliveryError);

    expect(error.errorType).toBe('Error');
    expect(error.transportCode).toBeUndefined();
    expect(error.message).toBe('Brevo API request failed');
  });

  it('posts through the default global-fetch seam and reads only ok/status', async () => {
    let bodyReads = 0;
    const response = {
      ok: true,
      status: 201,
      get text(): Promise<string> {
        bodyReads += 1;
        return Promise.resolve('provider body');
      },
    };
    const fetchMock = vi
      .fn<(url: string, init: BrevoRequestInit) => Promise<BrevoResponseLike>>()
      .mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    try {
      const service = new BrevoApiEmailService({ apiKey: API_KEY, from: API_FROM });

      await expect(
        service.sendVerification(API_RECIPIENT, VERIFICATION_URL),
      ).resolves.toBeUndefined();

      expect(bodyReads).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(BREVO_API_SEND_URL);
      expect(init.method).toBe('POST');
      expect(init.headers).toStrictEqual({
        'api-key': API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('createEmailService (AC-5 transport selection)', () => {
  it('constructs the SMTP service and never calls the API request seam', () => {
    const { transport } = createTransportMock();
    const smtpTransportFactory = vi
      .fn<(options: SmtpTransportOptions) => EmailTransport>()
      .mockReturnValue(transport);
    const brevoRequest = vi.fn<BrevoRequest>();

    const service = createEmailService(
      { ...BREVO_CONFIG, emailTransport: 'smtp', brevoApiKey: null },
      { smtpTransportFactory, brevoRequest },
    );

    expect(service).toBeInstanceOf(SmtpEmailService);
    expect(smtpTransportFactory).toHaveBeenCalledTimes(1);
    expect(smtpTransportFactory).toHaveBeenCalledWith({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'smtp-login@example.test', pass: 'smtp-key-for-tests' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    expect(brevoRequest).toHaveBeenCalledTimes(0);
  });

  it('constructs the API service and never calls the SMTP transport factory', async () => {
    const request = vi.fn<BrevoRequest>().mockResolvedValue({ ok: true, status: 201 });
    const smtpTransportFactory = vi
      .fn<(options: SmtpTransportOptions) => EmailTransport>()
      .mockReturnValue(createTransportMock().transport);

    const service = createEmailService(
      {
        ...BREVO_CONFIG,
        emailTransport: 'brevo-api',
        brevoApiKey: API_KEY,
        smtpFrom: API_FROM,
      },
      { smtpTransportFactory, brevoRequest: request },
    );

    expect(service).toBeInstanceOf(BrevoApiEmailService);
    expect(smtpTransportFactory).toHaveBeenCalledTimes(0);

    await service.sendVerification(API_RECIPIENT, VERIFICATION_URL);

    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe(BREVO_API_SEND_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toStrictEqual({
      'api-key': API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    });
    expect(JSON.parse(init.body!)).toStrictEqual({
      sender: { email: 'no-reply@example.com', name: 'CubeClicker' },
      to: [{ email: 'verification-recipient@example.com' }],
      subject: 'Verify your CubeClicker email',
      htmlContent: renderVerificationEmail(VERIFICATION_URL).html,
      textContent: PLAIN_TEXT,
    });
  });

  it.each([
    { label: 'null', key: null },
    { label: 'empty', key: '' },
  ])('fails closed for brevo-api with a $label key', ({ key }) => {
    const smtpTransportFactory = vi
      .fn<(options: SmtpTransportOptions) => EmailTransport>();

    const failure = captureError(() =>
      createEmailService(
        {
          ...BREVO_CONFIG,
          emailTransport: 'brevo-api',
          brevoApiKey: key,
          smtpFrom: API_FROM,
        },
        { smtpTransportFactory },
      ),
    );

    expect(failure?.message).toBe(
      'BREVO_API_KEY must be a non-empty string when EMAIL_TRANSPORT=brevo-api',
    );
    expect(smtpTransportFactory).toHaveBeenCalledTimes(0);
  });
});
