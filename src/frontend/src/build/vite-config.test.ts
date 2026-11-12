import { describe, expect, it } from 'vitest';
import config from '../../vite.config';

type ManualChunks = (id: string) => string | undefined;

/**
 * The production config is a plain object; `output` may be an array in Vite's
 * type surface even though this config defines a single object.
 */
function manualChunksOf(): ManualChunks {
  const output = config.build?.rollupOptions?.output;
  const options = Array.isArray(output) ? output[0] : output;
  const manualChunks = options?.manualChunks;
  if (typeof manualChunks !== 'function') {
    throw new Error('the Vite config must declare a function-form output.manualChunks');
  }
  return manualChunks as ManualChunks;
}

describe('vite build configuration', () => {
  it('emits the manifest the bundle-budget gate reads', () => {
    expect(config.build?.manifest).toBe(true);
  });

  it('pins the post-split chunk warning limit', () => {
    expect(config.build?.chunkSizeWarningLimit).toBe(900);
  });

  it('splits the Three.js vendor packages into a named three chunk', () => {
    const manualChunks = manualChunksOf();
    expect(manualChunks('/repo/node_modules/three/build/three.module.js')).toBe('three');
    expect(manualChunks('/repo/node_modules/three/examples/jsm/controls/OrbitControls.js')).toBe(
      'three',
    );
    // Windows separators normalize before the node_modules match.
    expect(manualChunks('C:\\repo\\node_modules\\three\\build\\three.module.js')).toBe('three');
  });

  it('splits react, react-dom, and scheduler into a named react chunk', () => {
    const manualChunks = manualChunksOf();
    expect(manualChunks('/repo/node_modules/react/index.js')).toBe('react');
    expect(manualChunks('/repo/node_modules/react-dom/client.js')).toBe('react');
    expect(manualChunks('/repo/node_modules/scheduler/index.js')).toBe('react');
  });

  it('leaves app code and look-alike packages in their default chunks', () => {
    const manualChunks = manualChunksOf();
    expect(manualChunks('/repo/src/frontend/src/App.tsx')).toBeUndefined();
    expect(manualChunks('/repo/node_modules/three-mesh-bvh/src/index.js')).toBeUndefined();
    expect(manualChunks('/repo/node_modules/react-router-dom/index.js')).toBeUndefined();
  });
});
