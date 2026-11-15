import { afterEach, describe, expect, it, vi } from 'vitest';

import { isPerfOverlayEnabled, PERF_OVERLAY_ENV_VAR } from './overlay';

/**
 * Unit tier for the strict build-time flag (AC-19): only the exact string `'true'` turns
 * the dev overlay on, so a typo (`'TRUE'`, `'1'`, `'yes'`) or a missing value can never
 * ship debug UI to production.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isPerfOverlayEnabled', () => {
  it('pins the environment variable name', () => {
    expect(PERF_OVERLAY_ENV_VAR).toBe('VITE_PERF_OVERLAY');
  });

  it('is true only for the exact string true', () => {
    expect(isPerfOverlayEnabled({ VITE_PERF_OVERLAY: 'true' })).toBe(true);
  });

  it('is false for absent, empty, numeric, upper-case and yes values', () => {
    const disabled: ReadonlyArray<Record<string, unknown>> = [
      {},
      { VITE_PERF_OVERLAY: undefined },
      { VITE_PERF_OVERLAY: '' },
      { VITE_PERF_OVERLAY: '1' },
      { VITE_PERF_OVERLAY: 'TRUE' },
      { VITE_PERF_OVERLAY: 'yes' },
      { VITE_PERF_OVERLAY: true },
      { VITE_PERF_OVERLAY: 1 },
    ];
    const results = disabled.map((env) => isPerfOverlayEnabled(env));

    expect(results).toEqual([false, false, false, false, false, false, false, false]);
  });

  it('defaults to the Vite environment object at call time', () => {
    vi.stubEnv('VITE_PERF_OVERLAY', 'true');
    expect(isPerfOverlayEnabled()).toBe(true);

    vi.stubEnv('VITE_PERF_OVERLAY', 'false');
    expect(isPerfOverlayEnabled()).toBe(false);
  });
});
