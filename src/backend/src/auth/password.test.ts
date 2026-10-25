import { describe, expect, it } from 'vitest';

import { Algorithm, parseOptions } from '@node-rs/argon2';

import {
  Argon2Params,
  DEFAULT_ARGON2_PARAMS,
  createPasswordHasher,
  hashPassword,
  validateArgon2Params,
  verifyPassword,
} from './password.js';

describe('validateArgon2Params', () => {
  it('rejects memoryCost below the OWASP minimum', () => {
    expect(() =>
      validateArgon2Params({ memoryCost: 19455, timeCost: 2, parallelism: 1 }),
    ).toThrowError(
      'memoryCost must be between 19456 and 1048576; received "19455"',
    );
  });

  it('rejects timeCost below the OWASP minimum', () => {
    expect(() =>
      validateArgon2Params({ memoryCost: 19456, timeCost: 1, parallelism: 1 }),
    ).toThrowError('timeCost must be between 2 and 10; received "1"');
  });

  it('rejects timeCost above the configured maximum', () => {
    expect(() =>
      validateArgon2Params({ memoryCost: 19456, timeCost: 11, parallelism: 1 }),
    ).toThrowError('timeCost must be between 2 and 10; received "11"');
  });

  it('rejects parallelism below the OWASP minimum', () => {
    expect(() =>
      validateArgon2Params({ memoryCost: 19456, timeCost: 2, parallelism: 0 }),
    ).toThrowError('parallelism must be between 1 and 16; received "0"');
  });

  it('rejects parallelism above the configured maximum', () => {
    expect(() =>
      validateArgon2Params({ memoryCost: 19456, timeCost: 2, parallelism: 17 }),
    ).toThrowError('parallelism must be between 1 and 16; received "17"');
  });

  it('rejects non-integer memoryCost', () => {
    expect(() =>
      validateArgon2Params({ memoryCost: 19456.5, timeCost: 2, parallelism: 1 }),
    ).toThrowError('memoryCost must be an integer; received "19456.5"');
  });

  it('rejects non-integer timeCost', () => {
    expect(() =>
      validateArgon2Params({ memoryCost: 19456, timeCost: 2.5, parallelism: 1 }),
    ).toThrowError('timeCost must be an integer; received "2.5"');
  });

  it('rejects non-integer parallelism', () => {
    expect(() =>
      validateArgon2Params({ memoryCost: 19456, timeCost: 2, parallelism: 1.5 }),
    ).toThrowError('parallelism must be an integer; received "1.5"');
  });

  it('rejects memoryCost above the configured maximum', () => {
    expect(() =>
      validateArgon2Params({ memoryCost: 1048577, timeCost: 2, parallelism: 1 }),
    ).toThrowError('memoryCost must be between 19456 and 1048576; received "1048577"');
  });
});

describe('createPasswordHasher', () => {
  it('hashes a password into a PHC argon2id string', async () => {
    const hasher = createPasswordHasher(DEFAULT_ARGON2_PARAMS);
    const digest = await hasher.hash('correct horse battery staple');
    expect(digest.startsWith('$argon2id$')).toBe(true);
    const parsed = parseOptions(digest);
    expect(parsed.algorithm).toBe(Algorithm.Argon2id);
    expect(parsed.memoryCost).toBe(19456);
    expect(parsed.timeCost).toBe(2);
    expect(parsed.parallelism).toBe(1);
  });

  it('round-trips: verify returns true for the original password', async () => {
    const hasher = createPasswordHasher(DEFAULT_ARGON2_PARAMS);
    const digest = await hasher.hash('correct horse battery staple');
    const ok = await hasher.verify(digest, 'correct horse battery staple');
    expect(ok).toBe(true);
  });

  it('returns false when verifying against a wrong password', async () => {
    const hasher = createPasswordHasher(DEFAULT_ARGON2_PARAMS);
    const digest = await hasher.hash('correct horse battery staple');
    const ok = await hasher.verify(digest, 'wrong password');
    expect(ok).toBe(false);
  });

  it('produces distinct digests for the same password (distinct salts)', async () => {
    const hasher = createPasswordHasher(DEFAULT_ARGON2_PARAMS);
    const a = await hasher.hash('same password');
    const b = await hasher.hash('same password');
    expect(a).not.toBe(b);
    expect(await hasher.verify(a, 'same password')).toBe(true);
    expect(await hasher.verify(b, 'same password')).toBe(true);
  });

  it('rejects params below the OWASP minimum at construction', () => {
    expect(() =>
      createPasswordHasher({ memoryCost: 1024, timeCost: 1, parallelism: 1 }),
    ).toThrowError('memoryCost must be between 19456 and 1048576; received "1024"');
  });
});

describe('hashPassword / verifyPassword convenience functions', () => {
  it('hashPassword uses OWASP defaults when no params are given', async () => {
    const digest = await hashPassword('p@ssw0rd-12-chars');
    const parsed = parseOptions(digest);
    expect(parsed.memoryCost).toBe(19456);
    expect(parsed.timeCost).toBe(2);
    expect(parsed.parallelism).toBe(1);
  });

  it('round-trips via convenience functions', async () => {
    const digest = await hashPassword('p@ssw0rd-12-chars');
    expect(await verifyPassword(digest, 'p@ssw0rd-12-chars')).toBe(true);
    expect(await verifyPassword(digest, 'not-the-password')).toBe(false);
  });

  it('hashPassword honors explicit params', async () => {
    const params: Argon2Params = { memoryCost: 65536, timeCost: 3, parallelism: 2 };
    const digest = await hashPassword('another password', params);
    const parsed = parseOptions(digest);
    expect(parsed.memoryCost).toBe(65536);
    expect(parsed.timeCost).toBe(3);
    expect(parsed.parallelism).toBe(2);
  });
});
