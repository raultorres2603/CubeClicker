import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import {
  CORS_ALLOW_HEADERS,
  CORS_ALLOW_METHODS,
  CORS_MAX_AGE_SECONDS,
  DEFAULT_CORS_ORIGIN,
  isOriginAllowed,
  isWebSocketOriginAllowed,
  resolveCorsOrigins,
} from './cors.js';

const CLOUD_ORIGIN = 'https://app.example.test';
const PREFLIGHT_HEADERS = {
  'access-control-request-method': 'POST',
  'access-control-request-headers': 'content-type',
};

async function withApp<T>(
  env: Record<string, string | undefined>,
  fn: (app: ReturnType<typeof buildApp>) => Promise<T>,
): Promise<T> {
  const app = buildApp(env);
  try {
    await app.ready();
    return await fn(app);
  } finally {
    await app.close();
  }
}

describe('resolveCorsOrigins', () => {
  it('defaults to the local frontend origin when neither variable is set', () => {
    expect(resolveCorsOrigins({})).toEqual([DEFAULT_CORS_ORIGIN]);
    expect(DEFAULT_CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('falls back to ALLOWED_ORIGIN when CORS_ORIGIN is unset or empty', () => {
    expect(resolveCorsOrigins({ ALLOWED_ORIGIN: CLOUD_ORIGIN })).toEqual([CLOUD_ORIGIN]);
    expect(resolveCorsOrigins({ ALLOWED_ORIGIN: CLOUD_ORIGIN, CORS_ORIGIN: '' })).toEqual([
      CLOUD_ORIGIN,
    ]);
    expect(resolveCorsOrigins({ ALLOWED_ORIGIN: CLOUD_ORIGIN, CORS_ORIGIN: '   ' })).toEqual([
      CLOUD_ORIGIN,
    ]);
  });

  it('prefers CORS_ORIGIN and parses a trimmed comma-separated list', () => {
    expect(
      resolveCorsOrigins({
        ALLOWED_ORIGIN: 'http://localhost:5173',
        CORS_ORIGIN: ' https://app.example.test , , https://admin.example.test ',
      }),
    ).toEqual(['https://app.example.test', 'https://admin.example.test']);
  });

  it('throws when the configured list has no origin', () => {
    expect(() => resolveCorsOrigins({ CORS_ORIGIN: ' , , ' })).toThrowError(
      'CORS_ORIGIN must list at least one origin',
    );
    expect(() => resolveCorsOrigins({ CORS_ORIGIN: ',', ALLOWED_ORIGIN: '' })).toThrowError(
      'CORS_ORIGIN must list at least one origin',
    );
  });
});

describe('isOriginAllowed', () => {
  it('matches whole origins only', () => {
    const allowed = ['https://app.example.test', 'https://admin.example.test'];
    expect(isOriginAllowed('https://app.example.test', allowed)).toBe(true);
    expect(isOriginAllowed('https://admin.example.test', allowed)).toBe(true);
    expect(isOriginAllowed('https://app.example.test.evil.example', allowed)).toBe(false);
    expect(isOriginAllowed('http://app.example.test', allowed)).toBe(false);
    expect(isOriginAllowed('https://app.example.test/', allowed)).toBe(false);
  });
});

describe('isWebSocketOriginAllowed', () => {
  const allowed = ['https://app.example.test'];

  it('allows a missing Origin for non-browser clients', () => {
    expect(isWebSocketOriginAllowed(undefined, allowed)).toBe(true);
  });

  it('allows only an exact allowlisted Origin', () => {
    expect(isWebSocketOriginAllowed('https://app.example.test', allowed)).toBe(true);
    expect(isWebSocketOriginAllowed('https://evil.example', allowed)).toBe(false);
    expect(isWebSocketOriginAllowed('', allowed)).toBe(false);
  });
});

describe('CORS hook integration (AC-5)', () => {
  it('answers an allowlisted preflight with exact credentialed headers and no cookie', async () => {
    await withApp({ CORS_ORIGIN: CLOUD_ORIGIN }, async (app) => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/auth/login',
        headers: { origin: CLOUD_ORIGIN, ...PREFLIGHT_HEADERS },
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(response.headers['access-control-allow-origin']).toBe(CLOUD_ORIGIN);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toBe(CORS_ALLOW_METHODS);
      expect(response.headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS');
      expect(response.headers['access-control-allow-headers']).toBe(CORS_ALLOW_HEADERS);
      expect(response.headers['access-control-allow-headers']).toBe('Content-Type,Accept');
      expect(
        String(response.headers['access-control-allow-headers'])
          .toLowerCase()
          .split(',')
          .map((value) => value.trim()),
      ).toEqual(['content-type', 'accept']);
      expect(response.headers['access-control-max-age']).toBe(String(CORS_MAX_AGE_SECONDS));
      expect(response.headers.vary).toBe('Origin');
      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  it('adds credentialed CORS headers to an actual allowlisted request', async () => {
    await withApp({ CORS_ORIGIN: CLOUD_ORIGIN }, async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { origin: CLOUD_ORIGIN },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
      expect(response.headers['access-control-allow-origin']).toBe(CLOUD_ORIGIN);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers.vary).toBe('Origin');
    });
  });

  it('rejects a disallowed Origin with the auth 403 and no allow header', async () => {
    await withApp({ CORS_ORIGIN: CLOUD_ORIGIN }, async (app) => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { origin: 'https://evil.example' },
        payload: { username: 'alice', password: 'password1234' },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ message: 'origin not allowed', code: 'origin_not_allowed' });
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    });
  });

  it('rejects a disallowed preflight without reflecting the origin', async () => {
    await withApp({ CORS_ORIGIN: CLOUD_ORIGIN }, async (app) => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/auth/login',
        headers: { origin: 'https://evil.example', ...PREFLIGHT_HEADERS },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ message: 'origin not allowed', code: 'origin_not_allowed' });
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers.vary).toBe('Origin');
    });
  });

  it('keeps /healthz public without a CORS grant for an unknown or missing Origin', async () => {
    await withApp({ CORS_ORIGIN: CLOUD_ORIGIN }, async (app) => {
      const anonymous = await app.inject({ method: 'GET', url: '/healthz' });
      expect(anonymous.statusCode).toBe(200);
      expect(anonymous.json()).toEqual({ status: 'ok' });
      expect(anonymous.headers['access-control-allow-origin']).toBeUndefined();

      const unknown = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { origin: 'https://evil.example' },
      });
      expect(unknown.statusCode).toBe(200);
      expect(unknown.json()).toEqual({ status: 'ok' });
      expect(unknown.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  it('allows each origin of a comma-separated list and no others', async () => {
    const env = {
      CORS_ORIGIN: 'https://app.example.test, https://admin.example.test',
    };
    await withApp(env, async (app) => {
      for (const origin of ['https://app.example.test', 'https://admin.example.test']) {
        const allowed = await app.inject({
          method: 'OPTIONS',
          url: '/auth/login',
          headers: { origin, ...PREFLIGHT_HEADERS },
        });
        expect(allowed.statusCode).toBe(204);
        expect(allowed.headers['access-control-allow-origin']).toBe(origin);
        expect(allowed.headers['access-control-allow-credentials']).toBe('true');
      }

      const denied = await app.inject({
        method: 'OPTIONS',
        url: '/auth/login',
        headers: { origin: 'https://other.example.test', ...PREFLIGHT_HEADERS },
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  it('keeps the local dev origin allowed through the ALLOWED_ORIGIN fallback', async () => {
    await withApp({}, async (app) => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/auth/login',
        headers: { origin: 'http://localhost:5173', ...PREFLIGHT_HEADERS },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  it('never emits a wildcard allow-origin', async () => {
    await withApp({ CORS_ORIGIN: CLOUD_ORIGIN }, async (app) => {
      const allowed = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { origin: CLOUD_ORIGIN },
      });
      expect(allowed.headers['access-control-allow-origin']).not.toBe('*');

      const denied = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { origin: 'https://evil.example' },
      });
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
