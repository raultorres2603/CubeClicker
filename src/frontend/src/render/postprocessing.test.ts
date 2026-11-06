import type { Camera, Scene, WebGLRenderer } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BLOOM_RADIUS,
  BLOOM_STRENGTH,
  BLOOM_THRESHOLD,
  SSAO_KERNEL_RADIUS,
  SSAO_MAX_DISTANCE,
  SSAO_MIN_DISTANCE,
  createPostprocessing,
} from './postprocessing';

interface FakeComposer {
  passes: unknown[];
  render: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setPixelRatio: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

interface FakeRenderPass {
  scene: unknown;
  camera: unknown;
  dispose: ReturnType<typeof vi.fn>;
}

interface FakeSsao {
  kernelRadius: number;
  minDistance: number;
  maxDistance: number;
  dispose: ReturnType<typeof vi.fn>;
}

interface FakeBloom {
  strength: number;
  radius: number;
  threshold: number;
  dispose: ReturnType<typeof vi.fn>;
}

interface FakeOutput {
  dispose: ReturnType<typeof vi.fn>;
}

const composerInstances = vi.hoisted(() => [] as FakeComposer[]);
const renderPassInstances = vi.hoisted(() => [] as FakeRenderPass[]);
const ssaoInstances = vi.hoisted(() => [] as FakeSsao[]);
const bloomInstances = vi.hoisted(() => [] as FakeBloom[]);
const outputInstances = vi.hoisted(() => [] as FakeOutput[]);

vi.mock('three', () => ({
  Vector2: class {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
  },
}));

vi.mock('three/examples/jsm/postprocessing/EffectComposer.js', () => ({
  EffectComposer: class {
    passes: unknown[] = [];
    renderer: unknown;
    render = vi.fn();
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    dispose = vi.fn();
    constructor(renderer: unknown) {
      this.renderer = renderer;
      composerInstances.push(this);
    }
    addPass(pass: unknown): void {
      this.passes.push(pass);
    }
  },
}));

vi.mock('three/examples/jsm/postprocessing/RenderPass.js', () => ({
  RenderPass: class {
    scene: unknown;
    camera: unknown;
    dispose = vi.fn();
    constructor(scene: unknown, camera: unknown) {
      this.scene = scene;
      this.camera = camera;
      renderPassInstances.push(this);
    }
  },
}));

vi.mock('three/examples/jsm/postprocessing/SSAOPass.js', () => ({
  SSAOPass: class {
    scene: unknown;
    camera: unknown;
    kernelRadius = 0;
    minDistance = 0;
    maxDistance = 0;
    dispose = vi.fn();
    constructor(scene: unknown, camera: unknown) {
      this.scene = scene;
      this.camera = camera;
      ssaoInstances.push(this);
    }
  },
}));

vi.mock('three/examples/jsm/postprocessing/UnrealBloomPass.js', () => ({
  UnrealBloomPass: class {
    resolution: unknown;
    strength: number;
    radius: number;
    threshold: number;
    dispose = vi.fn();
    constructor(resolution: unknown, strength: number, radius: number, threshold: number) {
      this.resolution = resolution;
      this.strength = strength;
      this.radius = radius;
      this.threshold = threshold;
      bloomInstances.push(this);
    }
  },
}));

vi.mock('three/examples/jsm/postprocessing/OutputPass.js', () => ({
  OutputPass: class {
    dispose = vi.fn();
    constructor() {
      outputInstances.push(this);
    }
  },
}));

const renderer = {} as unknown as WebGLRenderer;
const scene = { isScene: true } as unknown as Scene;
const camera = { isCamera: true } as unknown as Camera;

beforeEach(() => {
  composerInstances.length = 0;
  renderPassInstances.length = 0;
  ssaoInstances.length = 0;
  bloomInstances.length = 0;
  outputInstances.length = 0;
});

describe('postprocessing constants', () => {
  it('exports the pinned SSAO and bloom constants', () => {
    expect(SSAO_KERNEL_RADIUS).toBe(0.5);
    expect(SSAO_MIN_DISTANCE).toBe(0.005);
    expect(SSAO_MAX_DISTANCE).toBe(0.1);
    expect(BLOOM_STRENGTH).toBe(0.45);
    expect(BLOOM_RADIUS).toBe(0.4);
    expect(BLOOM_THRESHOLD).toBe(0.85);
  });
});

describe('createPostprocessing', () => {
  it('builds the composer with passes in order RenderPass, SSAOPass, UnrealBloomPass, OutputPass', () => {
    createPostprocessing(renderer, scene, camera);

    expect(composerInstances).toHaveLength(1);
    expect(renderPassInstances).toHaveLength(1);
    expect(ssaoInstances).toHaveLength(1);
    expect(bloomInstances).toHaveLength(1);
    expect(outputInstances).toHaveLength(1);

    expect(composerInstances[0].passes).toEqual([
      renderPassInstances[0],
      ssaoInstances[0],
      bloomInstances[0],
      outputInstances[0],
    ]);
  });

  it('sets SSAO parameters from the pinned constants', () => {
    createPostprocessing(renderer, scene, camera);

    expect(ssaoInstances[0].kernelRadius).toBe(SSAO_KERNEL_RADIUS);
    expect(ssaoInstances[0].minDistance).toBe(SSAO_MIN_DISTANCE);
    expect(ssaoInstances[0].maxDistance).toBe(SSAO_MAX_DISTANCE);
  });

  it('sets bloom parameters from the pinned constants', () => {
    createPostprocessing(renderer, scene, camera);

    expect(bloomInstances[0].strength).toBe(BLOOM_STRENGTH);
    expect(bloomInstances[0].radius).toBe(BLOOM_RADIUS);
    expect(bloomInstances[0].threshold).toBe(BLOOM_THRESHOLD);
  });

  it('binds the RenderPass to the provided scene and camera', () => {
    createPostprocessing(renderer, scene, camera);

    expect(renderPassInstances[0].scene).toBe(scene);
    expect(renderPassInstances[0].camera).toBe(camera);
  });

  it('forwards render to the composer', () => {
    const pp = createPostprocessing(renderer, scene, camera);

    pp.render();

    expect(composerInstances[0].render).toHaveBeenCalledTimes(1);
  });

  it('forwards setSize and setPixelRatio to the composer', () => {
    const pp = createPostprocessing(renderer, scene, camera);

    pp.setSize(1600, 800);
    pp.setPixelRatio(2);

    expect(composerInstances[0].setSize).toHaveBeenCalledTimes(1);
    expect(composerInstances[0].setSize).toHaveBeenCalledWith(1600, 800);
    expect(composerInstances[0].setPixelRatio).toHaveBeenCalledTimes(1);
    expect(composerInstances[0].setPixelRatio).toHaveBeenCalledWith(2);
  });

  it('releases the composer and every pass on dispose', () => {
    const pp = createPostprocessing(renderer, scene, camera);

    pp.dispose();

    expect(composerInstances[0].dispose).toHaveBeenCalledTimes(1);
    expect(renderPassInstances[0].dispose).toHaveBeenCalledTimes(1);
    expect(ssaoInstances[0].dispose).toHaveBeenCalledTimes(1);
    expect(bloomInstances[0].dispose).toHaveBeenCalledTimes(1);
    expect(outputInstances[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('returns the narrow adapter surface', () => {
    const pp = createPostprocessing(renderer, scene, camera);
    expect(Object.keys(pp)).toEqual(['render', 'setSize', 'setPixelRatio', 'dispose']);
  });

  it('keeps pass parameters unchanged after render() calls (AC-7)', () => {
    const pp = createPostprocessing(renderer, scene, camera);

    pp.render();
    pp.render();
    pp.render();

    expect(ssaoInstances[0].kernelRadius).toBe(SSAO_KERNEL_RADIUS);
    expect(ssaoInstances[0].minDistance).toBe(SSAO_MIN_DISTANCE);
    expect(ssaoInstances[0].maxDistance).toBe(SSAO_MAX_DISTANCE);
    expect(bloomInstances[0].strength).toBe(BLOOM_STRENGTH);
    expect(bloomInstances[0].radius).toBe(BLOOM_RADIUS);
    expect(bloomInstances[0].threshold).toBe(BLOOM_THRESHOLD);
  });
});