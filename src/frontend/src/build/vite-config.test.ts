import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ManualChunks = (id: string) => string | undefined;

/** A freshly evaluated Vite config (each case stubs its own environment first). */
async function loadConfig(): Promise<typeof import('../../vite.config')['default']> {
  vi.resetModules();
  const module = await import('../../vite.config');
  return module.default;
}

/** Runs `loadConfig` and returns the exact thrown error message. */
async function configErrorMessage(): Promise<string> {
  try {
    await loadConfig();
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  throw new Error('expected the Vite config to throw');
}

/**
 * The production config is a plain object; `output` may be an array in Vite's
 * type surface even though this config defines a single object.
 */
function manualChunksOf(config: Awaited<ReturnType<typeof loadConfig>>): ManualChunks {
  const output = config.build?.rollupOptions?.output;
  const options = Array.isArray(output) ? output[0] : output;
  const manualChunks = options?.manualChunks;
  if (typeof manualChunks !== 'function') {
    throw new Error('the Vite config must declare a function-form output.manualChunks');
  }
  return manualChunks as ManualChunks;
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', undefined);
  vi.stubEnv('VITE_WS_URL', undefined);
  vi.stubEnv('VITE_CLOUD_DEPLOY', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('vite build configuration', () => {
  it('emits the manifest the bundle-budget gate reads', async () => {
    const config = await loadConfig();
    expect(config.build?.manifest).toBe(true);
  });

  it('pins the post-split chunk warning limit', async () => {
    const config = await loadConfig();
    expect(config.build?.chunkSizeWarningLimit).toBe(900);
  });

  it('splits the Three.js vendor packages into a named three chunk', async () => {
    const manualChunks = manualChunksOf(await loadConfig());
    expect(manualChunks('/repo/node_modules/three/build/three.module.js')).toBe('three');
    expect(manualChunks('/repo/node_modules/three/examples/jsm/controls/OrbitControls.js')).toBe(
      'three',
    );
    // Windows separators normalize before the node_modules match.
    expect(manualChunks('C:\\repo\\node_modules\\three\\build\\three.module.js')).toBe('three');
  });

  it('splits react, react-dom, and scheduler into a named react chunk', async () => {
    const manualChunks = manualChunksOf(await loadConfig());
    expect(manualChunks('/repo/node_modules/react/index.js')).toBe('react');
    expect(manualChunks('/repo/node_modules/react-dom/client.js')).toBe('react');
    expect(manualChunks('/repo/node_modules/scheduler/index.js')).toBe('react');
  });

  it('leaves app code and look-alike packages in their default chunks', async () => {
    const manualChunks = manualChunksOf(await loadConfig());
    expect(manualChunks('/repo/src/frontend/src/App.tsx')).toBeUndefined();
    expect(manualChunks('/repo/node_modules/three-mesh-bvh/src/index.js')).toBeUndefined();
    expect(manualChunks('/repo/node_modules/react-router-dom/index.js')).toBeUndefined();
  });
});

describe('runtime config bridge (define)', () => {
  it('bridges the empty local defaults', async () => {
    const config = await loadConfig();
    expect(config.define).toEqual({
      'import.meta.env.VITE_API_URL': '""',
      'import.meta.env.VITE_WS_URL': '""',
      'import.meta.env.VITE_CLOUD_DEPLOY': '"false"',
    });
  });

  it('bridges an explicit cloud build with both URLs', async () => {
    vi.stubEnv('VITE_CLOUD_DEPLOY', 'true');
    vi.stubEnv('VITE_API_URL', 'https://api.example.test');
    vi.stubEnv('VITE_WS_URL', 'wss://api.example.test/ws');

    const config = await loadConfig();

    expect(config.define).toEqual({
      'import.meta.env.VITE_API_URL': '"https://api.example.test"',
      'import.meta.env.VITE_WS_URL': '"wss://api.example.test/ws"',
      'import.meta.env.VITE_CLOUD_DEPLOY': '"true"',
    });
  });

  it('accepts an API-only cloud build (the resolver derives wss://)', async () => {
    vi.stubEnv('VITE_CLOUD_DEPLOY', 'true');
    vi.stubEnv('VITE_API_URL', 'https://api.example.test');

    const config = await loadConfig();

    expect(config.define).toEqual({
      'import.meta.env.VITE_API_URL': '"https://api.example.test"',
      'import.meta.env.VITE_WS_URL': '""',
      'import.meta.env.VITE_CLOUD_DEPLOY': '"true"',
    });
  });

  it('fails before the build when cloud mode has no API URL', async () => {
    vi.stubEnv('VITE_CLOUD_DEPLOY', 'true');

    expect(await configErrorMessage()).toBe(
      'VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true',
    );
  });

  it('fails before the build when cloud mode has a relative API URL', async () => {
    vi.stubEnv('VITE_CLOUD_DEPLOY', 'true');
    vi.stubEnv('VITE_API_URL', '/api');

    expect(await configErrorMessage()).toBe(
      'VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true',
    );
  });

  it('fails before the build when the resolved cloud socket is not wss://', async () => {
    vi.stubEnv('VITE_CLOUD_DEPLOY', 'true');
    vi.stubEnv('VITE_API_URL', 'https://api.example.test');
    vi.stubEnv('VITE_WS_URL', 'ws://api.example.test/ws');

    expect(await configErrorMessage()).toBe(
      'VITE_WS_URL must resolve to an absolute wss:// URL when VITE_CLOUD_DEPLOY=true',
    );
  });
});
