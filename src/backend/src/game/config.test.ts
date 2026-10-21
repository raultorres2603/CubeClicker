import { describe, expect, it } from 'vitest';

import {
  CLICK_RATE_LIMIT_PER_SECOND,
  DEFAULT_MAX_USERS_PER_SERVER,
  DEFAULT_RECONNECT_GRACE_MS,
  MAX_CONNECTIONS,
  MAX_RECONNECT_GRACE_MS,
  MAX_USERS_PER_SERVER,
  MIN_RECONNECT_GRACE_MS,
  MIN_USERS_PER_SERVER,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_MISSED_PONGS_LIMIT,
  loadGameConfig,
} from './config.js';

/** The pinned configuration with no env overrides (spec § Pinned constants). */
const DEFAULT_CONFIG = {
  maxUsersPerServer: 10,
  reconnectGraceMs: 30_000,
  clickRateLimitPerSecond: 30,
  heartbeatIntervalMs: 30_000,
  missedPongsLimit: 2,
  maxMessageBytes: 1024,
  maxConnections: 200,
};

describe('pinned constants', () => {
  it('pins every constant from the spec table', () => {
    expect(DEFAULT_MAX_USERS_PER_SERVER).toBe(10);
    expect(MIN_USERS_PER_SERVER).toBe(2);
    expect(MAX_USERS_PER_SERVER).toBe(24);
    expect(DEFAULT_RECONNECT_GRACE_MS).toBe(30_000);
    expect(MIN_RECONNECT_GRACE_MS).toBe(1_000);
    expect(MAX_RECONNECT_GRACE_MS).toBe(600_000);
    expect(CLICK_RATE_LIMIT_PER_SECOND).toBe(30);
    expect(WS_HEARTBEAT_INTERVAL_MS).toBe(30_000);
    expect(WS_MISSED_PONGS_LIMIT).toBe(2);
    expect(MAX_CONNECTIONS).toBe(200);
  });
});

describe('loadGameConfig defaults', () => {
  it('returns the pinned defaults for an empty environment', () => {
    expect(loadGameConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it('ignores unrelated environment variables', () => {
    expect(
      loadGameConfig({ NODE_ENV: 'production', PORT: '8080', VITE_WS_URL: 'ws://localhost:8080/ws' }),
    ).toEqual(DEFAULT_CONFIG);
  });

  it('keeps the fixed limits while an env value is overridden', () => {
    expect(loadGameConfig({ MAX_USERS_PER_SERVER: '2', RECONNECT_GRACE_MS: '1000' })).toEqual({
      maxUsersPerServer: 2,
      reconnectGraceMs: 1_000,
      clickRateLimitPerSecond: 30,
      heartbeatIntervalMs: 30_000,
      missedPongsLimit: 2,
      maxMessageBytes: 1024,
      maxConnections: 200,
    });
  });
});

describe('MAX_USERS_PER_SERVER', () => {
  it('accepts the range boundaries 2, 10 and 24', () => {
    expect(loadGameConfig({ MAX_USERS_PER_SERVER: '2' }).maxUsersPerServer).toBe(2);
    expect(loadGameConfig({ MAX_USERS_PER_SERVER: '10' }).maxUsersPerServer).toBe(10);
    expect(loadGameConfig({ MAX_USERS_PER_SERVER: '24' }).maxUsersPerServer).toBe(24);
  });

  it('rejects 1 with an error naming the variable', () => {
    expect(() => loadGameConfig({ MAX_USERS_PER_SERVER: '1' })).toThrowError(
      'MAX_USERS_PER_SERVER must be an integer between 2 and 24; received "1"',
    );
  });

  it('rejects 25 with an error naming the variable', () => {
    expect(() => loadGameConfig({ MAX_USERS_PER_SERVER: '25' })).toThrowError(
      'MAX_USERS_PER_SERVER must be an integer between 2 and 24; received "25"',
    );
  });

  it('rejects a non-numeric value with an error naming the variable', () => {
    expect(() => loadGameConfig({ MAX_USERS_PER_SERVER: 'abc' })).toThrowError(
      'MAX_USERS_PER_SERVER must be an integer between 2 and 24; received "abc"',
    );
  });

  it('rejects a non-integer value and an empty value', () => {
    expect(() => loadGameConfig({ MAX_USERS_PER_SERVER: '10.5' })).toThrowError(
      'MAX_USERS_PER_SERVER must be an integer between 2 and 24; received "10.5"',
    );
    expect(() => loadGameConfig({ MAX_USERS_PER_SERVER: '' })).toThrowError(
      'MAX_USERS_PER_SERVER must be an integer between 2 and 24; received ""',
    );
  });
});

describe('RECONNECT_GRACE_MS', () => {
  it('accepts the range boundaries 1000 and 600000', () => {
    expect(loadGameConfig({ RECONNECT_GRACE_MS: '1000' }).reconnectGraceMs).toBe(1_000);
    expect(loadGameConfig({ RECONNECT_GRACE_MS: '600000' }).reconnectGraceMs).toBe(600_000);
  });

  it('rejects 999 and 600001 with an error naming the variable', () => {
    expect(() => loadGameConfig({ RECONNECT_GRACE_MS: '999' })).toThrowError(
      'RECONNECT_GRACE_MS must be an integer between 1000 and 600000; received "999"',
    );
    expect(() => loadGameConfig({ RECONNECT_GRACE_MS: '600001' })).toThrowError(
      'RECONNECT_GRACE_MS must be an integer between 1000 and 600000; received "600001"',
    );
  });

  it('rejects a non-numeric value with an error naming the variable', () => {
    expect(() => loadGameConfig({ RECONNECT_GRACE_MS: 'abc' })).toThrowError(
      'RECONNECT_GRACE_MS must be an integer between 1000 and 600000; received "abc"',
    );
  });

  it('reports the first invalid variable when both are invalid', () => {
    expect(() =>
      loadGameConfig({ MAX_USERS_PER_SERVER: '99', RECONNECT_GRACE_MS: 'abc' }),
    ).toThrowError('MAX_USERS_PER_SERVER must be an integer between 2 and 24; received "99"');
  });
});
