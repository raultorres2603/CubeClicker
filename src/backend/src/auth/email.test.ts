import { describe, expect, it, vi } from 'vitest';

import * as template from './email-template.js';
import {
  FakeEmailService,
  SmtpEmailService,
  VERIFICATION_EMAIL_SUBJECT,
  buildSmtpTransportOptions,
  createSmtpEmailService,
  renderVerificationEmail,
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

  it('propagates transport failures', async () => {
    const sendMail = vi
      .fn<(options: OutgoingEmail) => Promise<unknown>>()
      .mockRejectedValue(new Error('smtp down'));
    const service = new SmtpEmailService(
      { host: 'smtp.example.com', port: 587, from: 'no-reply@cubeclicker.local' },
      () => ({ sendMail }),
    );

    const error = await service
      .sendVerification('user@example.com', VERIFICATION_URL)
      .catch((reason: unknown) => reason as Error);

    expect(error.message).toBe('smtp down');
  });
});
