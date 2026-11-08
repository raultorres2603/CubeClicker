/** @vitest-environment jsdom */
import { act, cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { Mesh, MeshPhysicalMaterial, Scene } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PREVIEW_REST_ROTATION_RAD, PREVIEW_ROTATION_RAD_PER_MS } from '../render/preview';
import { SpaceshipPreview } from './SpaceshipPreview';

interface RendererRecord {
  renders: Array<{ scene: unknown; camera: unknown }>;
  sizes: Array<[number, number, boolean]>;
  pixelRatios: number[];
  disposeCalls: number;
}

const threeMock = vi.hoisted(() => ({
  instances: [] as RendererRecord[],
  throwOnConstruct: false,
}));

/**
 * The preview component needs a real WebGL context; this tier replaces only
 * `WebGLRenderer` with a recording fake and keeps the actual three.js scene graph so the
 * rendered scene/model can be asserted through the real `createPreviewScene` integration.
 */
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    readonly record: RendererRecord = {
      renders: [],
      sizes: [],
      pixelRatios: [],
      disposeCalls: 0,
    };

    constructor() {
      if (threeMock.throwOnConstruct) {
        throw new Error('WebGL unavailable');
      }
      threeMock.instances.push(this.record);
    }

    setSize(width: number, height: number, updateStyle = true): void {
      this.record.sizes.push([width, height, updateStyle]);
    }

    setPixelRatio(ratio: number): void {
      this.record.pixelRatios.push(ratio);
    }

    render(scene: unknown, camera: unknown): void {
      this.record.renders.push({ scene, camera });
    }

    dispose(): void {
      this.record.disposeCalls += 1;
    }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

let scheduledFrame: FrameRequestCallback | null = null;
let nextFrameHandle = 0;
let requestFrame: ReturnType<typeof vi.fn>;
let cancelFrame: ReturnType<typeof vi.fn>;

function flushFrame(nowMs: number): void {
  const callback = scheduledFrame;
  if (callback === null) {
    throw new Error('no animation frame scheduled');
  }
  act(() => {
    callback(nowMs);
  });
}

function renderedScene(record: RendererRecord): Scene {
  const render = record.renders[0];
  if (render === undefined) {
    throw new Error('no frame rendered');
  }
  return render.scene as Scene;
}

beforeEach(() => {
  cleanup();
  threeMock.instances.length = 0;
  threeMock.throwOnConstruct = false;
  scheduledFrame = null;
  nextFrameHandle = 0;
  requestFrame = vi.fn((callback: FrameRequestCallback): number => {
    scheduledFrame = callback;
    nextFrameHandle += 1;
    return nextFrameHandle;
  });
  cancelFrame = vi.fn();
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SpaceshipPreview (SSR contract)', () => {
  it('renders a canvas element', () => {
    const html = renderToString(<SpaceshipPreview appearance={{}} />);
    expect(html).toContain('<canvas');
  });

  it('applies the spaceship-preview class', () => {
    const html = renderToString(<SpaceshipPreview appearance={{}} />);
    expect(html).toContain('spaceship-preview');
  });

  it('renders aria-label "Spaceship preview"', () => {
    const html = renderToString(<SpaceshipPreview appearance={{}} />);
    expect(html).toContain('aria-label="Spaceship preview"');
  });

  it('derives the five predecessor legacy color attributes', () => {
    const html = renderToString(<SpaceshipPreview appearance={{}} />);
    expect(html).toContain('data-nose-color="#88aaff"');
    expect(html).toContain('data-body-color="#4466cc"');
    expect(html).toContain('data-wing-color="#4466cc"');
    expect(html).toContain('data-cockpit-color="#ffffff"');
    expect(html).toContain('data-engine-color="#ff6600"');
  });

  it('reflects an equipped legacy part color', () => {
    const html = renderToString(<SpaceshipPreview appearance={{ nose: 'nose-crimson' }} />);
    expect(html).toContain('data-nose-color="#cc4444"');
  });

  it('exposes all ten default data-preview-slot attributes', () => {
    const html = renderToString(<SpaceshipPreview appearance={{}} />);
    expect(html).toContain('data-preview-slot-hull="hull-default"');
    expect(html).toContain('data-preview-slot-nose="nose-default"');
    expect(html).toContain('data-preview-slot-cockpit="cockpit-default"');
    expect(html).toContain('data-preview-slot-wing-left="wing-left-default"');
    expect(html).toContain('data-preview-slot-wing-right="wing-right-default"');
    expect(html).toContain('data-preview-slot-engine-left="engine-left-default"');
    expect(html).toContain('data-preview-slot-engine-right="engine-right-default"');
    expect(html).toContain('data-preview-slot-ignition-left="ignition-left-default"');
    expect(html).toContain('data-preview-slot-ignition-right="ignition-right-default"');
    expect(html).toContain('data-preview-slot-tail-fin="tail-fin-default"');
    expect((html.match(/data-preview-slot-/g) ?? []).length).toBe(10);
  });

  it('resolves v2 slot ids and independent left/right parts', () => {
    const html = renderToString(
      <SpaceshipPreview appearance={{ 'wing-left': 'wing-left-silver' }} />,
    );
    expect(html).toContain('data-preview-slot-wing-left="wing-left-silver"');
    expect(html).toContain('data-preview-slot-wing-right="wing-right-default"');
  });

  it('normalizes legacy appearance categories for the data attributes', () => {
    const html = renderToString(
      <SpaceshipPreview appearance={{ wings: 'wings-silver', engine: 'engine-blue' }} />,
    );
    expect(html).toContain('data-preview-slot-wing-left="wing-left-silver"');
    expect(html).toContain('data-preview-slot-wing-right="wing-right-silver"');
    expect(html).toContain('data-preview-slot-ignition-left="ignition-left-blue"');
    expect(html).toContain('data-preview-slot-ignition-right="ignition-right-blue"');
    expect(html).toContain('data-wing-color="#aaaaaa"');
    expect(html).toContain('data-engine-color="#4488ff"');
  });
});

describe('SpaceshipPreview (live WebGL contract)', () => {
  it('creates one renderer, renders the real preview scene and throttles to 30 fps', () => {
    const { container, unmount } = render(<SpaceshipPreview appearance={{}} />);

    expect(threeMock.instances).toHaveLength(1);
    const record = threeMock.instances[0]!;
    expect(record.sizes).toEqual([[1, 1, false]]);
    expect(record.pixelRatios).toEqual([1]);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(record.renders).toHaveLength(0);

    const canvas = container.querySelector('canvas');
    expect(canvas?.className).toBe('spaceship-preview');
    expect(canvas?.getAttribute('aria-label')).toBe('Spaceship preview');

    flushFrame(0);
    expect(record.renders).toHaveLength(1);
    const scene = renderedScene(record);
    expect(scene.children.map((child) => child.name)).toEqual([
      'preview-ambient',
      'preview-key-light',
      'cursor-ship-model',
    ]);
    const model = scene.getObjectByName('cursor-ship-model');
    if (model === undefined) {
      throw new Error('preview model missing');
    }
    expect(model.rotation.y).toBe(PREVIEW_REST_ROTATION_RAD);

    // 16 ms since the last rendered frame is under the 33.33 ms budget: no render.
    flushFrame(16);
    expect(record.renders).toHaveLength(1);
    expect(model.rotation.y).toBe(PREVIEW_REST_ROTATION_RAD);

    // 34 ms since the last rendered frame crosses the 30 fps budget: one render, one step.
    flushFrame(34);
    expect(record.renders).toHaveLength(2);
    expect(model.rotation.y).toBe(PREVIEW_REST_ROTATION_RAD + PREVIEW_ROTATION_RAD_PER_MS * 34);

    unmount();
    expect(record.disposeCalls).toBe(1);
    expect(cancelFrame).toHaveBeenCalledWith(4);
    expect(scene.children).toHaveLength(0);
  });

  it('holds the static reduced-motion pose while still rendering', () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === REDUCED_MOTION_QUERY,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMedia);

    render(<SpaceshipPreview appearance={{}} />);
    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);

    flushFrame(0);
    flushFrame(1000);
    const record = threeMock.instances[0]!;
    expect(record.renders).toHaveLength(2);
    const scene = renderedScene(record);
    const model = scene.getObjectByName('cursor-ship-model');
    if (model === undefined) {
      throw new Error('preview model missing');
    }
    expect(model.rotation.y).toBe(PREVIEW_REST_ROTATION_RAD);
  });

  it('re-applies an appearance change without rebuilding the context', () => {
    const { rerender } = render(<SpaceshipPreview appearance={{}} />);
    flushFrame(0);
    const record = threeMock.instances[0]!;
    const scene = renderedScene(record);

    const hullBefore = scene.getObjectByName('cursor-hull') as Mesh;
    expect((hullBefore.material as MeshPhysicalMaterial).color.getHexString()).toBe('8f9bad');

    rerender(<SpaceshipPreview appearance={{ hull: 'hull-gold' }} />);
    const hullAfter = scene.getObjectByName('cursor-hull') as Mesh;
    expect((hullAfter.material as MeshPhysicalMaterial).color.getHexString()).toBe('ccaa44');
    expect(threeMock.instances).toHaveLength(1);

    flushFrame(34);
    expect(record.renders).toHaveLength(2);
  });

  it('falls back to the empty labeled canvas when WebGL construction throws', () => {
    threeMock.throwOnConstruct = true;
    const { container, unmount } = render(<SpaceshipPreview appearance={{}} />);

    expect(threeMock.instances).toHaveLength(0);
    expect(requestFrame).not.toHaveBeenCalled();
    const canvas = container.querySelector('canvas');
    expect(canvas?.className).toBe('spaceship-preview');
    expect(canvas?.getAttribute('aria-label')).toBe('Spaceship preview');
    expect(container.querySelectorAll('canvas')).toHaveLength(1);

    unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
