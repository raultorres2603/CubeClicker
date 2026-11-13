import { describe, expect, it } from 'vitest';

import {
  LOG_LEVELS,
  loadObservabilityConfig,
  type LogLevel,
} from './config.js';

const DEFAULT_CONFIG = {
  logLevel: false,
  metricsEnabled: true,
};

describe('loadObservabilityConfig log level defaults', () => {
  it('disables logging for an empty environment', () => {
    expect(loadObservabilityConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it('disables logging for NODE_ENV=test without LOG_LEVEL', () => {
    expect(loadObservabilityConfig({ NODE_ENV: 'test' })).toEqual(DEFAULT_CONFIG);
  });

  it('disables logging for an unrecognised NODE_ENV without LOG_LEVEL', () => {
    expect(loadObservabilityConfig({ NODE_ENV: 'staging' })).toEqual(DEFAULT_CONFIG);
  });

  it('uses info for NODE_ENV=production', () => {
    expect(loadObservabilityConfig({ NODE_ENV: 'production' })).toEqual({
      logLevel: 'info',
      metricsEnabled: true,
    });
  });

  it('uses debug for NODE_ENV=development', () => {
    expect(loadObservabilityConfig({ NODE_ENV: 'development' })).toEqual({
      logLevel: 'debug',
      metricsEnabled: true,
    });
  });
});

describe('loadObservabilityConfig LOG_LEVEL override', () => {
  it.each(LOG_LEVELS)('accepts the valid level %s', (level) => {
    expect(loadObservabilityConfig({ LOG_LEVEL: level }).logLevel).toBe(level);
  });

  it('overrides NODE_ENV=production', () => {
    expect(
      loadObservabilityConfig({ NODE_ENV: 'production', LOG_LEVEL: 'warn' }).logLevel,
    ).toBe('warn');
  });

  it('overrides NODE_ENV=test', () => {
    expect(
      loadObservabilityConfig({ NODE_ENV: 'test', LOG_LEVEL: 'trace' }).logLevel,
    ).toBe('trace');
  });

  it('overrides an unset NODE_ENV', () => {
    expect(loadObservabilityConfig({ LOG_LEVEL: 'silent' }).logLevel).toBe('silent');
  });

  it('rejects an invalid LOG_LEVEL naming the variable', () => {
    expect(() => loadObservabilityConfig({ LOG_LEVEL: 'verbose' })).toThrowError(
      new Error(
        'LOG_LEVEL must be one of fatal|error|warn|info|debug|trace|silent; received "verbose"',
      ),
    );
  });

  it('rejects an empty LOG_LEVEL naming the variable', () => {
    expect(() => loadObservabilityConfig({ LOG_LEVEL: '' })).toThrowError(
      new Error(
        'LOG_LEVEL must be one of fatal|error|warn|info|debug|trace|silent; received ""',
      ),
    );
  });

  it('pins the accepted LOG_LEVEL values', () => {
    const levels: readonly LogLevel[] = LOG_LEVELS;
    expect(levels).toEqual([
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ]);
  });
});

describe('loadObservabilityConfig METRICS_ENABLED', () => {
  it('defaults to true', () => {
    expect(loadObservabilityConfig({}).metricsEnabled).toBe(true);
  });

  it('accepts true and 1', () => {
    expect(loadObservabilityConfig({ METRICS_ENABLED: 'true' }).metricsEnabled).toBe(true);
    expect(loadObservabilityConfig({ METRICS_ENABLED: '1' }).metricsEnabled).toBe(true);
  });

  it('accepts false and 0', () => {
    expect(loadObservabilityConfig({ METRICS_ENABLED: 'false' }).metricsEnabled).toBe(false);
    expect(loadObservabilityConfig({ METRICS_ENABLED: '0' }).metricsEnabled).toBe(false);
  });

  it('rejects an invalid METRICS_ENABLED naming the variable', () => {
    expect(() => loadObservabilityConfig({ METRICS_ENABLED: 'yes' })).toThrowError(
      new Error(
        'METRICS_ENABLED must be a boolean ("true", "false", "1", or "0"); received "yes"',
      ),
    );
  });

  it('rejects an empty METRICS_ENABLED naming the variable', () => {
    expect(() => loadObservabilityConfig({ METRICS_ENABLED: '' })).toThrowError(
      new Error(
        'METRICS_ENABLED must be a boolean ("true", "false", "1", or "0"); received ""',
      ),
    );
  });

  it('combines the log level and metrics overrides', () => {
    expect(
      loadObservabilityConfig({
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
        METRICS_ENABLED: 'false',
      }),
    ).toEqual({
      logLevel: 'warn',
      metricsEnabled: false,
    });
  });
});
