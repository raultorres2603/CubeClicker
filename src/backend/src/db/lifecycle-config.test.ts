import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CLEANUP_INTERVAL_MS,
  MAX_CLEANUP_INTERVAL_MS,
  MIN_CLEANUP_INTERVAL_MS,
  loadDbLifecycleConfig,
} from './lifecycle-config.js';

const BOOLEAN_ERROR = (name: string, received: string): string =>
  `${name} must be a boolean ("true", "false", "1", or "0"); received "${received}"`;

const INTERVAL_ERROR = (received: string): string =>
  `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS must be an integer between 60000 and 86400000; received "${received}"`;

describe('loadDbLifecycleConfig defaults', () => {
  it('returns the documented defaults for an empty environment (AC-14)', () => {
    expect(loadDbLifecycleConfig({})).toEqual({
      bootstrapEnabled: true,
      cleanupEnabled: true,
      cleanupIntervalMs: 3_600_000,
    });
  });

  it('pins the exported interval defaults and range', () => {
    expect([
      DEFAULT_CLEANUP_INTERVAL_MS,
      MIN_CLEANUP_INTERVAL_MS,
      MAX_CLEANUP_INTERVAL_MS,
    ]).toEqual([3_600_000, 60_000, 86_400_000]);
  });
});

describe('loadDbLifecycleConfig DB_SCHEMA_BOOTSTRAP_ENABLED', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
  ])('accepts %s', (raw, expected) => {
    expect(
      loadDbLifecycleConfig({ DB_SCHEMA_BOOTSTRAP_ENABLED: raw }).bootstrapEnabled,
    ).toBe(expected);
  });

  it('rejects an invalid value naming the exact variable', () => {
    expect(() =>
      loadDbLifecycleConfig({ DB_SCHEMA_BOOTSTRAP_ENABLED: 'maybe' }),
    ).toThrowError(new Error(BOOLEAN_ERROR('DB_SCHEMA_BOOTSTRAP_ENABLED', 'maybe')));
  });

  it('rejects an empty string naming the exact variable', () => {
    expect(() =>
      loadDbLifecycleConfig({ DB_SCHEMA_BOOTSTRAP_ENABLED: '' }),
    ).toThrowError(new Error(BOOLEAN_ERROR('DB_SCHEMA_BOOTSTRAP_ENABLED', '')));
  });
});

describe('loadDbLifecycleConfig DB_EXPIRED_TOKEN_CLEANUP_ENABLED', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
  ])('accepts %s', (raw, expected) => {
    expect(
      loadDbLifecycleConfig({ DB_EXPIRED_TOKEN_CLEANUP_ENABLED: raw }).cleanupEnabled,
    ).toBe(expected);
  });

  it('rejects an invalid value naming the exact variable', () => {
    expect(() =>
      loadDbLifecycleConfig({ DB_EXPIRED_TOKEN_CLEANUP_ENABLED: 'yes' }),
    ).toThrowError(
      new Error(BOOLEAN_ERROR('DB_EXPIRED_TOKEN_CLEANUP_ENABLED', 'yes')),
    );
  });

  it('rejects an empty string naming the exact variable', () => {
    expect(() =>
      loadDbLifecycleConfig({ DB_EXPIRED_TOKEN_CLEANUP_ENABLED: '' }),
    ).toThrowError(new Error(BOOLEAN_ERROR('DB_EXPIRED_TOKEN_CLEANUP_ENABLED', '')));
  });
});

describe('loadDbLifecycleConfig DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS', () => {
  it.each(['60000', '120000', '3600000', '86400000'])(
    'accepts the in-range integer %s',
    (raw) => {
      expect(
        loadDbLifecycleConfig({ DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS: raw })
          .cleanupIntervalMs,
      ).toBe(Number(raw));
    },
  );

  it.each(['59999', '86400001', '-60000', '0'])(
    'rejects the out-of-range integer %s naming the exact variable',
    (raw) => {
      expect(() =>
        loadDbLifecycleConfig({ DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS: raw }),
      ).toThrowError(new Error(INTERVAL_ERROR(raw)));
    },
  );

  it.each(['60000.5', '1e5', '1h', ' 60000'])(
    'rejects the non-integer value "%s" naming the exact variable',
    (raw) => {
      expect(() =>
        loadDbLifecycleConfig({ DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS: raw }),
      ).toThrowError(new Error(INTERVAL_ERROR(raw)));
    },
  );

  it('rejects an empty string naming the exact variable', () => {
    expect(() =>
      loadDbLifecycleConfig({ DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS: '' }),
    ).toThrowError(new Error(INTERVAL_ERROR('')));
  });
});

describe('loadDbLifecycleConfig combined overrides', () => {
  it('reads each variable into its own field without crossing values', () => {
    expect(
      loadDbLifecycleConfig({
        DB_SCHEMA_BOOTSTRAP_ENABLED: 'false',
        DB_EXPIRED_TOKEN_CLEANUP_ENABLED: '0',
        DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS: '120000',
      }),
    ).toEqual({
      bootstrapEnabled: false,
      cleanupEnabled: false,
      cleanupIntervalMs: 120_000,
    });
  });

  it('ignores unrelated environment variables', () => {
    expect(
      loadDbLifecycleConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://user:pass@db:5432/cubeclicker',
        LOG_LEVEL: 'info',
        METRICS_ENABLED: 'false',
      }),
    ).toEqual({
      bootstrapEnabled: true,
      cleanupEnabled: true,
      cleanupIntervalMs: 3_600_000,
    });
  });
});
