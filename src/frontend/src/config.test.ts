import { describe, expect, it } from 'vitest';

import { resolveFrontendConfig } from './config';

/** Runs `fn` and returns the exact thrown error message (fails the test on no throw). */
function errorMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  throw new Error('expected the resolver to throw');
}

describe('resolveFrontendConfig — local / same-origin mode', () => {
  it('falls back to the same-origin API base and the pinned local WebSocket URL', () => {
    expect(resolveFrontendConfig({})).toEqual({
      apiBaseUrl: '',
      wsUrl: 'ws://localhost:8080/ws',
    });
  });

  it('removes a single trailing slash from the API base and derives wss:// for the socket', () => {
    expect(resolveFrontendConfig({ VITE_API_URL: 'https://api.example.test/' })).toEqual({
      apiBaseUrl: 'https://api.example.test',
      wsUrl: 'wss://api.example.test/ws',
    });
  });

  it('removes every trailing slash, including repeated slashes', () => {
    expect(resolveFrontendConfig({ VITE_API_URL: 'https://api.example.test//' })).toEqual({
      apiBaseUrl: 'https://api.example.test',
      wsUrl: 'wss://api.example.test/ws',
    });
  });

  it('trims surrounding whitespace from the API base', () => {
    expect(resolveFrontendConfig({ VITE_API_URL: '  https://api.example.test/  ' })).toEqual({
      apiBaseUrl: 'https://api.example.test',
      wsUrl: 'wss://api.example.test/ws',
    });
  });

  it('derives a ws:// socket from an http:// API base', () => {
    expect(resolveFrontendConfig({ VITE_API_URL: 'http://localhost:8080' })).toEqual({
      apiBaseUrl: 'http://localhost:8080',
      wsUrl: 'ws://localhost:8080/ws',
    });
  });

  it('uses an explicit WebSocket URL verbatim', () => {
    expect(
      resolveFrontendConfig({
        VITE_API_URL: 'https://api.example.test',
        VITE_WS_URL: 'wss://mp.example.test/ws',
      }),
    ).toEqual({
      apiBaseUrl: 'https://api.example.test',
      wsUrl: 'wss://mp.example.test/ws',
    });
  });

  it('treats an empty WebSocket URL as unset and derives the socket', () => {
    expect(
      resolveFrontendConfig({ VITE_API_URL: 'https://api.example.test', VITE_WS_URL: '' }),
    ).toEqual({
      apiBaseUrl: 'https://api.example.test',
      wsUrl: 'wss://api.example.test/ws',
    });
  });

  it('keeps local mode permissive for an explicit ws:// socket', () => {
    expect(resolveFrontendConfig({ VITE_WS_URL: 'ws://mp.example.test/ws' })).toEqual({
      apiBaseUrl: '',
      wsUrl: 'ws://mp.example.test/ws',
    });
  });

  it('does not infer cloud mode from VITE_CLOUD_DEPLOY in the env object', () => {
    expect(
      resolveFrontendConfig({ VITE_API_URL: '/api', VITE_CLOUD_DEPLOY: 'true' }),
    ).toEqual({
      apiBaseUrl: '/api',
      wsUrl: 'ws://localhost:8080/ws',
    });
  });
});

describe('resolveFrontendConfig — cloud mode', () => {
  it('derives wss://<api-host>/ws from an API-only cloud config', () => {
    expect(resolveFrontendConfig({ VITE_API_URL: 'https://api.example.test' }, { cloud: true })).toEqual({
      apiBaseUrl: 'https://api.example.test',
      wsUrl: 'wss://api.example.test/ws',
    });
  });

  it('accepts both explicit cloud URLs', () => {
    expect(
      resolveFrontendConfig(
        { VITE_API_URL: 'https://api.example.test', VITE_WS_URL: 'wss://api.example.test/ws' },
        { cloud: true },
      ),
    ).toEqual({
      apiBaseUrl: 'https://api.example.test',
      wsUrl: 'wss://api.example.test/ws',
    });
  });

  it('normalizes repeated trailing slashes in cloud mode too', () => {
    expect(
      resolveFrontendConfig({ VITE_API_URL: 'https://api.example.test//' }, { cloud: true }),
    ).toEqual({
      apiBaseUrl: 'https://api.example.test',
      wsUrl: 'wss://api.example.test/ws',
    });
  });

  it('rejects a missing API URL naming VITE_API_URL', () => {
    expect(errorMessage(() => resolveFrontendConfig({}, { cloud: true }))).toBe(
      'VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true',
    );
  });

  it('rejects an empty API URL naming VITE_API_URL', () => {
    expect(errorMessage(() => resolveFrontendConfig({ VITE_API_URL: '' }, { cloud: true }))).toBe(
      'VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true',
    );
  });

  it('rejects a relative API URL naming VITE_API_URL', () => {
    expect(errorMessage(() => resolveFrontendConfig({ VITE_API_URL: '/api' }, { cloud: true }))).toBe(
      'VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true',
    );
  });

  it('rejects an http:// API URL naming VITE_API_URL (mixed content)', () => {
    expect(
      errorMessage(() =>
        resolveFrontendConfig({ VITE_API_URL: 'http://api.example.test' }, { cloud: true }),
      ),
    ).toBe('VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true');
  });

  it('rejects an unparseable scheme-only API URL naming VITE_API_URL', () => {
    expect(errorMessage(() => resolveFrontendConfig({ VITE_API_URL: 'https://' }, { cloud: true }))).toBe(
      'VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true',
    );
  });

  it('rejects an explicit ws:// WebSocket URL naming VITE_WS_URL and wss://', () => {
    expect(
      errorMessage(() =>
        resolveFrontendConfig(
          { VITE_API_URL: 'https://api.example.test', VITE_WS_URL: 'ws://api.example.test/ws' },
          { cloud: true },
        ),
      ),
    ).toBe('VITE_WS_URL must resolve to an absolute wss:// URL when VITE_CLOUD_DEPLOY=true');
  });

  it('rejects a relative WebSocket URL in cloud mode', () => {
    expect(
      errorMessage(() =>
        resolveFrontendConfig(
          { VITE_API_URL: 'https://api.example.test', VITE_WS_URL: '/ws' },
          { cloud: true },
        ),
      ),
    ).toBe('VITE_WS_URL must resolve to an absolute wss:// URL when VITE_CLOUD_DEPLOY=true');
  });

  it('rejects an unparseable scheme-only WebSocket URL in cloud mode', () => {
    expect(
      errorMessage(() =>
        resolveFrontendConfig(
          { VITE_API_URL: 'https://api.example.test', VITE_WS_URL: 'wss://' },
          { cloud: true },
        ),
      ),
    ).toBe('VITE_WS_URL must resolve to an absolute wss:// URL when VITE_CLOUD_DEPLOY=true');
  });
});
