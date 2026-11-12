/**
 * Post-processing pipeline (realistic-lighting-materials T1; adaptive-render-budget-v2 T2).
 *
 * Owns the `EffectComposer` plus the tier's pass list: `RenderPass(scene, camera)` and
 * `OutputPass` always, `UnrealBloomPass` at high/medium, `SSAOPass` at high only. The pass
 * parameters are pinned once at construction from the exported constants and are never
 * mutated per frame (AC-4, AC-5, AC-6, AC-7). The adapter never calls this builder at low.
 *
 * Layer: render adapter (`render/**`), three.js only. No game logic.
 */

import type { Camera, Scene, WebGLRenderer } from 'three';
import { Vector2 } from 'three';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import type { QualityTier } from './quality';

/** Ambient-occlusion kernel radius (world units). */
export const SSAO_KERNEL_RADIUS = 0.5;
/** Minimum view-space distance considered for AO. */
export const SSAO_MIN_DISTANCE = 0.005;
/** Maximum view-space distance considered for AO. */
export const SSAO_MAX_DISTANCE = 0.1;

/** Bloom intensity. */
export const BLOOM_STRENGTH = 0.45;
/** Bloom blur radius. */
export const BLOOM_RADIUS = 0.4;
/** Bloom luminance threshold. */
export const BLOOM_THRESHOLD = 0.85;

/** Narrow adapter surface returned by {@link createPostprocessing}. */
export interface Postprocessing {
  render(): void;
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  dispose(): void;
}

/**
 * Builds the tier's post-processing pipeline bound to `(scene, camera)`.
 *
 * High keeps the accepted SSAO + bloom list; medium keeps bloom without SSAO; low would
 * build only the base render + output passes, but the adapter bypasses this builder at
 * low (plain `renderer.render`). The composer is fully constructed up front; pass
 * parameters are set once from the pinned constants and never re-applied per frame.
 */
export function createPostprocessing(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  tier: QualityTier,
): Postprocessing {
  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  let ssaoPass: SSAOPass | null = null;
  if (tier === 'high') {
    ssaoPass = new SSAOPass(scene, camera);
    ssaoPass.kernelRadius = SSAO_KERNEL_RADIUS;
    ssaoPass.minDistance = SSAO_MIN_DISTANCE;
    ssaoPass.maxDistance = SSAO_MAX_DISTANCE;
    composer.addPass(ssaoPass);
  }

  let bloomPass: UnrealBloomPass | null = null;
  if (tier !== 'low') {
    bloomPass = new UnrealBloomPass(
      new Vector2(),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    composer.addPass(bloomPass);
  }

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return {
    render(): void {
      composer.render();
    },
    setSize(width: number, height: number): void {
      composer.setSize(width, height);
    },
    setPixelRatio(ratio: number): void {
      composer.setPixelRatio(ratio);
    },
    dispose(): void {
      composer.dispose();
      renderPass.dispose?.();
      ssaoPass?.dispose?.();
      bloomPass?.dispose?.();
      outputPass.dispose?.();
    },
  };
}