/**
 * Post-processing pipeline (realistic-lighting-materials T1).
 *
 * Owns the `EffectComposer` plus, in order: `RenderPass(scene, camera)`,
 * `SSAOPass`, `UnrealBloomPass`, `OutputPass`. The pass parameters are pinned
 * once at construction from the exported constants and are never mutated per
 * frame (AC-4, AC-5, AC-7).
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
 * Builds the SSAO + bloom post-processing pipeline bound to `(scene, camera)`.
 *
 * The composer is fully constructed up front; pass parameters are set once from
 * the pinned constants and never re-applied per frame.
 */
export function createPostprocessing(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
): Postprocessing {
  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);

  const ssaoPass = new SSAOPass(scene, camera);
  ssaoPass.kernelRadius = SSAO_KERNEL_RADIUS;
  ssaoPass.minDistance = SSAO_MIN_DISTANCE;
  ssaoPass.maxDistance = SSAO_MAX_DISTANCE;

  const bloomPass = new UnrealBloomPass(
    new Vector2(),
    BLOOM_STRENGTH,
    BLOOM_RADIUS,
    BLOOM_THRESHOLD,
  );

  const outputPass = new OutputPass();

  composer.addPass(renderPass);
  composer.addPass(ssaoPass);
  composer.addPass(bloomPass);
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
      ssaoPass.dispose?.();
      bloomPass.dispose?.();
      outputPass.dispose?.();
    },
  };
}