import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ALLOWED_ORIGIN,
  DEFAULT_APP_BASE_URL,
  DEFAULT_ARGON2_MEMORY_COST,
  DEFAULT_ARGON2_PARALLELISM,
  DEFAULT_ARGON2_TIME_COST,
  DEFAULT_SESSION_TTL_DAYS,
  DEFAULT_SMTP_FROM,
  DEFAULT_SMTP_HOST,
  DEFAULT_SMTP_PORT,
  MAX_ARGON2_MEMORY_COST,
  MAX_ARGON2_PARALLELISM,
  MAX_ARGON2_TIME_COST,
  MAX_SESSION_TTL_DAYS,
  MAX_VERIFICATION_TOKEN_TTL_MS,
  MIN_ARGON2_MEMORY_COST,
  MIN_ARGON2_PARALLELISM,
  MIN_ARGON2_TIME_COST,
  MIN_SESSION_TTL_DAYS,
  MIN_VERIFICATION_TOKEN_TTL_MS,
  loadAuthConfig,
} from './config.js';

const DEFAULT_CONFIG = {
  databaseUrl: null,
  smtpHost: 'mailpit',
  smtpPort: 1025,
  smtpUser: null,
  smtpPass: null,
  smtpFrom: 'no-reply@cubeclicker.local',
  appBaseUrl: 'http://localhost:5173',
  allowedOrigin: 'http://localhost:5173',
  sessionCookieSecure: false,
  sessionTtlDays: 7,
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  argon2MemoryCost: 19456,
  argon2TimeCost: 2,
  argon2Parallelism: 1,
  verificationTokenTtlMs: 24 * 60 * 60 * 1000,
};

describe('pinned constants', () => {
  it('pins every default constant', () => {
    expect(DEFAULT_SMTP_HOST).toBe('mailpit');
    expect(DEFAULT_SMTP_PORT).toBe(1025);
    expect(DEFAULT_SMTP_FROM).toBe('no-reply@cubeclicker.local');
    expect(DEFAULT_APP_BASE_URL).toBe('http://localhost:5173');
    expect(DEFAULT_ALLOWED_ORIGIN).toBe('http://localhost:5173');
    expect(DEFAULT_SESSION_TTL_DAYS).toBe(7);
    expect(MIN_SESSION_TTL_DAYS).toBe(1);
    expect(MAX_SESSION_TTL_DAYS).toBe(365);
    expect(DEFAULT_ARGON2_MEMORY_COST).toBe(19456);
    expect(MIN_ARGON2_MEMORY_COST).toBe(19456);
    expect(MAX_ARGON2_MEMORY_COST).toBe(1048576);
    expect(DEFAULT_ARGON2_TIME_COST).toBe(2);
    expect(MIN_ARGON2_TIME_COST).toBe(2);
    expect(MAX_ARGON2_TIME_COST).toBe(10);
    expect(DEFAULT_ARGON2_PARALLELISM).toBe(1);
    expect(MIN_ARGON2_PARALLELISM).toBe(1);
    expect(MAX_ARGON2_PARALLELISM).toBe(16);
    expect(MIN_VERIFICATION_TOKEN_TTL_MS).toBe(60 * 1000);
    expect(MAX_VERIFICATION_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('loadAuthConfig defaults', () => {
  it('returns the pinned defaults for an empty environment', () => {
    expect(loadAuthConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it('ignores unrelated environment variables', () => {
    expect(
      loadAuthConfig({ NODE_ENV: 'production', PORT: '8080', VITE_WS_URL: 'ws://localhost:8080/ws' }),
    ).toEqual(DEFAULT_CONFIG);
  });

  it('reads DATABASE_URL when provided', () => {
    expect(
      loadAuthConfig({ DATABASE_URL: 'postgres://u:p@db:5432/cubeclicker' }).databaseUrl,
    ).toBe('postgres://u:p@db:5432/cubeclicker');
  });

  it('treats an empty DATABASE_URL as unset', () => {
    expect(loadAuthConfig({ DATABASE_URL: '' }).databaseUrl).toBeNull();
  });
});

describe('SMTP settings', () => {
  it('accepts overrides for host, port, user, pass, from', () => {
    const config = loadAuthConfig({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'user',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'noreply@example.com',
    });
    expect(config.smtpHost).toBe('smtp.example.com');
    expect(config.smtpPort).toBe(587);
    expect(config.smtpUser).toBe('user');
    expect(config.smtpPass).toBe('secret');
    expect(config.smtpFrom).toBe('noreply@example.com');
  });

  it('treats empty SMTP_USER and SMTP_PASS as unset', () => {
    const config = loadAuthConfig({ SMTP_USER: '', SMTP_PASS: '' });
    expect(config.smtpUser).toBeNull();
    expect(config.smtpPass).toBeNull();
  });

  it('uses Mailpit defaults for host and port', () => {
    const config = loadAuthConfig({});
    expect(config.smtpHost).toBe('mailpit');
    expect(config.smtpPort).toBe(1025);
  });

  it('rejects an empty SMTP_HOST', () => {
    expect(() => loadAuthConfig({ SMTP_HOST: '' })).toThrowError(
      'SMTP_HOST must be a non-empty string; received ""',
    );
  });

  it('rejects an out-of-range SMTP_PORT', () => {
    expect(() => loadAuthConfig({ SMTP_PORT: '0' })).toThrowError(
      'SMTP_PORT must be an integer between 1 and 65535; received "0"',
    );
    expect(() => loadAuthConfig({ SMTP_PORT: '70000' })).toThrowError(
      'SMTP_PORT must be an integer between 1 and 65535; received "70000"',
    );
    expect(() => loadAuthConfig({ SMTP_PORT: 'abc' })).toThrowError(
      'SMTP_PORT must be an integer between 1 and 65535; received "abc"',
    );
  });
});

describe('APP_BASE_URL and ALLOWED_ORIGIN', () => {
  it('accepts overrides', () => {
    const config = loadAuthConfig({
      APP_BASE_URL: 'https://app.example.com',
      ALLOWED_ORIGIN: 'https://app.example.com',
    });
    expect(config.appBaseUrl).toBe('https://app.example.com');
    expect(config.allowedOrigin).toBe('https://app.example.com');
  });

  it('rejects empty values', () => {
    expect(() => loadAuthConfig({ APP_BASE_URL: '' })).toThrowError(
      'APP_BASE_URL must be a non-empty string; received ""',
    );
    expect(() => loadAuthConfig({ ALLOWED_ORIGIN: '' })).toThrowError(
      'ALLOWED_ORIGIN must be a non-empty string; received ""',
    );
  });
});

describe('SESSION_COOKIE_SECURE', () => {
  it('defaults to false', () => {
    expect(loadAuthConfig({}).sessionCookieSecure).toBe(false);
  });

  it('parses true/1 and false/0', () => {
    expect(loadAuthConfig({ SESSION_COOKIE_SECURE: 'true' }).sessionCookieSecure).toBe(true);
    expect(loadAuthConfig({ SESSION_COOKIE_SECURE: '1' }).sessionCookieSecure).toBe(true);
    expect(loadAuthConfig({ SESSION_COOKIE_SECURE: 'false' }).sessionCookieSecure).toBe(false);
    expect(loadAuthConfig({ SESSION_COOKIE_SECURE: '0' }).sessionCookieSecure).toBe(false);
  });

  it('rejects other values', () => {
    expect(() => loadAuthConfig({ SESSION_COOKIE_SECURE: 'yes' })).toThrowError(
      'SESSION_COOKIE_SECURE must be a boolean ("true", "false", "1", or "0"); received "yes"',
    );
  });
});

describe('SESSION_TTL_DAYS', () => {
  it('accepts the range boundaries', () => {
    expect(loadAuthConfig({ SESSION_TTL_DAYS: '1' }).sessionTtlDays).toBe(1);
    expect(loadAuthConfig({ SESSION_TTL_DAYS: '1' }).sessionTtlMs).toBe(1 * 24 * 60 * 60 * 1000);
    expect(loadAuthConfig({ SESSION_TTL_DAYS: '365' }).sessionTtlDays).toBe(365);
  });

  it('rejects 0 and 366', () => {
    expect(() => loadAuthConfig({ SESSION_TTL_DAYS: '0' })).toThrowError(
      'SESSION_TTL_DAYS must be an integer between 1 and 365; received "0"',
    );
    expect(() => loadAuthConfig({ SESSION_TTL_DAYS: '366' })).toThrowError(
      'SESSION_TTL_DAYS must be an integer between 1 and 365; received "366"',
    );
  });

  it('rejects non-numeric and empty values', () => {
    expect(() => loadAuthConfig({ SESSION_TTL_DAYS: 'abc' })).toThrowError(
      'SESSION_TTL_DAYS must be an integer between 1 and 365; received "abc"',
    );
    expect(() => loadAuthConfig({ SESSION_TTL_DAYS: '' })).toThrowError(
      'SESSION_TTL_DAYS must be an integer between 1 and 365; received ""',
    );
  });
});

describe('Argon2 parameters', () => {
  it('accepts the minimum boundaries', () => {
    const config = loadAuthConfig({
      ARGON2_MEMORY_COST: '19456',
      ARGON2_TIME_COST: '2',
      ARGON2_PARALLELISM: '1',
    });
    expect(config.argon2MemoryCost).toBe(19456);
    expect(config.argon2TimeCost).toBe(2);
    expect(config.argon2Parallelism).toBe(1);
  });

  it('accepts the upper boundaries', () => {
    const config = loadAuthConfig({
      ARGON2_MEMORY_COST: '1048576',
      ARGON2_TIME_COST: '10',
      ARGON2_PARALLELISM: '16',
    });
    expect(config.argon2MemoryCost).toBe(1048576);
    expect(config.argon2TimeCost).toBe(10);
    expect(config.argon2Parallelism).toBe(16);
  });

  it('rejects below-minimum values', () => {
    expect(() => loadAuthConfig({ ARGON2_MEMORY_COST: '19455' })).toThrowError(
      'ARGON2_MEMORY_COST must be an integer between 19456 and 1048576; received "19455"',
    );
    expect(() => loadAuthConfig({ ARGON2_TIME_COST: '1' })).toThrowError(
      'ARGON2_TIME_COST must be an integer between 2 and 10; received "1"',
    );
    expect(() => loadAuthConfig({ ARGON2_PARALLELISM: '0' })).toThrowError(
      'ARGON2_PARALLELISM must be an integer between 1 and 16; received "0"',
    );
  });

  it('rejects non-numeric values', () => {
    expect(() => loadAuthConfig({ ARGON2_MEMORY_COST: 'abc' })).toThrowError(
      'ARGON2_MEMORY_COST must be an integer between 19456 and 1048576; received "abc"',
    );
  });
});

describe('verification token TTL', () => {
  it('accepts 1 hour and 168 hours', () => {
    expect(loadAuthConfig({ VERIFICATION_TOKEN_TTL_HOURS: '1' }).verificationTokenTtlMs).toBe(
      60 * 60 * 1000,
    );
    expect(loadAuthConfig({ VERIFICATION_TOKEN_TTL_HOURS: '168' }).verificationTokenTtlMs).toBe(
      168 * 60 * 60 * 1000,
    );
  });

  it('rejects 0 and 169 hours', () => {
    expect(() => loadAuthConfig({ VERIFICATION_TOKEN_TTL_HOURS: '0' })).toThrowError(
      'VERIFICATION_TOKEN_TTL_HOURS must be an integer between 1 and 168; received "0"',
    );
    expect(() => loadAuthConfig({ VERIFICATION_TOKEN_TTL_HOURS: '169' })).toThrowError(
      'VERIFICATION_TOKEN_TTL_HOURS must be an integer between 1 and 168; received "169"',
    );
  });
});

describe('first invalid variable', () => {
  it('reports the first invalid variable when several are invalid', () => {
    expect(() =>
      loadAuthConfig({ SMTP_PORT: '0', SESSION_TTL_DAYS: '0' }),
    ).toThrowError('SMTP_PORT must be an integer between 1 and 65535; received "0"');
  });
});