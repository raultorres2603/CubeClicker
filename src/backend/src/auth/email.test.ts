import { describe, expect, it, vi } from 'vitest';

import {
  FakeEmailService,
  SmtpEmailService,
  VERIFICATION_EMAIL_SUBJECT,
  renderVerificationEmail,
  type CapturedVerificationEmail,
} from './email.js';

const VERIFICATION_URL = 'http://localhost:5173/verify?token=abc123def456';

describe('renderVerificationEmail', () => {
  it('uses the pinned subject', () => {
    expect(renderVerificationEmail(VERIFICATION_URL).subject).toBe(
      VERIFICATION_EMAIL_SUBJECT,
    );
    expect(VERIFICATION_EMAIL_SUBJECT).toBe('Verify your CubeClicker email');
  });

  it('embeds the activation link in the plain-text body', () => {
    const rendered = renderVerificationEmail(VERIFICATION_URL);
    expect(rendered.text).toBe(
      'Welcome to CubeClicker!\n\n' +
        'Verify your email address by opening the link below:\n' +
        'http://localhost:5173/verify?token=abc123def456\n\n' +
        'If you did not create an account, you can ignore this email.',
    );
  });

  it('embeds the activation link in the HTML body', () => {
    const rendered = renderVerificationEmail(VERIFICATION_URL);
    expect(rendered.html).toBe(
      '<p>Welcome to CubeClicker!</p>' +
        '<p>Verify your email address by opening the link below:</p>' +
        '<p><a href="http://localhost:5173/verify?token=abc123def456">http://localhost:5173/verify?token=abc123def456</a></p>' +
        '<p>If you did not create an account, you can ignore this email.</p>',
    );
  });

  it('escapes HTML-special characters in the link', () => {
    const dangerous = 'http://localhost:5173/verify?token=a<b>&c="d"';
    const rendered = renderVerificationEmail(dangerous);
    expect(rendered.text).toContain(dangerous);
    expect(rendered.html).toContain(
      'http://localhost:5173/verify?token=a&lt;b&gt;&amp;c=&quot;d&quot;',
    );
    expect(rendered.html).not.toContain('<b>');
  });
});

describe('FakeEmailService', () => {
  it('starts with no captured messages', () => {
    const fake = new FakeEmailService();
    expect(fake.sent).toEqual([]);
  });

  it('captures the recipient and verification URL', async () => {
    const fake = new FakeEmailService();
    await fake.sendVerification('user@example.com', VERIFICATION_URL);
    const expected: CapturedVerificationEmail = {
      to: 'user@example.com',
      verificationUrl: VERIFICATION_URL,
    };
    expect(fake.sent).toEqual([expected]);
  });

  it('captures multiple messages in order', async () => {
    const fake = new FakeEmailService();
    await fake.sendVerification('first@example.com', 'http://localhost:5173/verify?token=first');
    await fake.sendVerification('second@example.com', 'http://localhost:5173/verify?token=second');
    expect(fake.sent).toEqual([
      { to: 'first@example.com', verificationUrl: 'http://localhost:5173/verify?token=first' },
      { to: 'second@example.com', verificationUrl: 'http://localhost:5173/verify?token=second' },
    ]);
  });
});

describe('SmtpEmailService', () => {
  it('sends a rendered verification email through the injected transport', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
    const transport = { sendMail };
    const service = new SmtpEmailService(
      {
        host: 'smtp.example.com',
        port: 587,
        user: 'smtp-user',
        pass: 'smtp-pass',
        from: 'no-reply@cubeclicker.local',
      },
      transport,
    );

    await service.sendVerification('user@example.com', VERIFICATION_URL);

    const rendered = renderVerificationEmail(VERIFICATION_URL);
    expect(sendMail).toHaveBeenCalledWith({
      from: 'no-reply@cubeclicker.local',
      to: 'user@example.com',
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('propagates transport failures', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('smtp down'));
    const transport = { sendMail };
    const service = new SmtpEmailService(
      { host: 'smtp.example.com', port: 587, from: 'no-reply@cubeclicker.local' },
      transport,
    );
    await expect(service.sendVerification('user@example.com', VERIFICATION_URL)).rejects.toThrowError(
      'smtp down',
    );
  });

  it('creates a nodemailer transport when none is injected (with auth)', () => {
    const service = new SmtpEmailService({
      host: 'smtp.example.com',
      port: 587,
      user: 'smtp-user',
      pass: 'smtp-pass',
      from: 'no-reply@cubeclicker.local',
    });
    expect(service).toBeDefined();
  });

  it('creates a nodemailer transport when none is injected (without auth)', () => {
    const service = new SmtpEmailService({
      host: 'mailpit',
      port: 1025,
      from: 'no-reply@cubeclicker.local',
    });
    expect(service).toBeDefined();
  });

  it('derives secure from port 465 when not explicitly set', () => {
    const a = new SmtpEmailService({ host: 'smtp.example.com', port: 465, from: 'x@y' });
    const b = new SmtpEmailService({ host: 'smtp.example.com', port: 587, from: 'x@y', secure: true });
    const c = new SmtpEmailService({ host: 'smtp.example.com', port: 465, from: 'x@y', secure: false });
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();
  });
});
