/** @vitest-environment jsdom */
/**
 * Lootbox reveal component tests (game-feel-overhaul T3; spec AC-7, AC-8, AC-9, AC-10,
 * AC-12, AC-31).
 *
 * The component owns the browser boundary, so these tests exercise it through a real React
 * render in jsdom with two injected seams: `createRenderer` returns a recording fake (there
 * is no WebGL context in jsdom) and `createStage` returns either a recording fake stage or,
 * in the integration test, the real `createRevealStage` scene graph. `requestAnimationFrame`
 * is stubbed with a manual scheduler so every frame is deterministic.
 */
import { readFileSync } from 'node:fs';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mesh, MeshPhysicalMaterial, PerspectiveCamera, Scene, type WebGLRenderer } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LootboxGrant } from '../game/types';
import {
  createRevealStagePose,
  revealStagePose,
  type RevealUiPhase,
} from '../game/reveal-motion';
import type { RevealStage } from '../render/lootbox-reveal';
import {
  LootboxReveal,
  REVEAL_FRAME_INTERVAL_MS,
  REVEAL_MAX_FPS,
  REVEAL_MAX_PIXEL_RATIO,
  type LootboxRevealProps,
} from './LootboxReveal';

// jsdom rewrites `import.meta.url` to an http URL, so read from the workspace cwd (the
// frontend package root) like the other component tests.
const APP_SOURCE = readFileSync('src/App.tsx', 'utf8');

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

function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
}

function restoreDocumentHidden(): void {
  delete (document as unknown as Record<string, unknown>).hidden;
}

beforeEach(() => {
  cleanup();
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
  restoreDocumentHidden();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

interface RendererRecord {
  renderer: WebGLRenderer;
  sizes: Array<[number, number, boolean]>;
  pixelRatios: number[];
  renders: Array<{ scene: unknown; camera: unknown }>;
  disposeCalls: () => number;
}

/** Recording stand-in for the single WebGL context (jsdom has no WebGL). */
function fakeRenderer(): RendererRecord {
  const sizes: Array<[number, number, boolean]> = [];
  const pixelRatios: number[] = [];
  const renders: Array<{ scene: unknown; camera: unknown }> = [];
  let disposeCalls = 0;
  const renderer = {
    setSize(width: number, height: number, updateStyle = true): void {
      sizes.push([width, height, updateStyle]);
    },
    setPixelRatio(ratio: number): void {
      pixelRatios.push(ratio);
    },
    render(scene: unknown, camera: unknown): void {
      renders.push({ scene, camera });
    },
    dispose(): void {
      disposeCalls += 1;
    },
  } as unknown as WebGLRenderer;
  return { renderer, sizes, pixelRatios, renders, disposeCalls: () => disposeCalls };
}

interface StageRecord {
  stage: RevealStage;
  scene: Scene;
  camera: PerspectiveCamera;
  updateProjectionMatrix: ReturnType<typeof vi.fn>;
  updates: Array<[number, boolean]>;
  disposeCalls: () => number;
}

/** Recording stand-in for the reveal stage: the real scene contract is T2's test tier. */
function fakeStage(): StageRecord {
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 20);
  const updateProjectionMatrix = vi.fn((): void => undefined);
  camera.updateProjectionMatrix = updateProjectionMatrix;
  const updates: Array<[number, boolean]> = [];
  let disposeCalls = 0;
  const stage = {
    scene,
    camera,
    model: null,
    stageAppearance: {},
    ring: new Mesh(),
    update(elapsedMs: number, reducedMotion: boolean) {
      updates.push([elapsedMs, reducedMotion]);
      return createRevealStagePose();
    },
    dispose(): void {
      disposeCalls += 1;
    },
  } as unknown as RevealStage;
  return { stage, scene, camera, updateProjectionMatrix, updates, disposeCalls: () => disposeCalls };
}

function grant(overrides: Partial<LootboxGrant> = {}): LootboxGrant {
  return {
    partId: 'wing-left-silver',
    slot: 'wing-left',
    rarity: 'rare',
    duplicate: false,
    sequence: 1,
    ...overrides,
  };
}

/** An epic shot grant: finish `solar`, form `kite`, catalog name `Solar Kite Bolt`. */
function shotGrant(overrides: Partial<LootboxGrant> = {}): LootboxGrant {
  return {
    partId: 'shot-kite-solar',
    slot: 'shot',
    rarity: 'epic',
    duplicate: false,
    sequence: 1,
    ...overrides,
  };
}

function rootOf(container: HTMLElement): HTMLElement {
  const root = container.querySelector<HTMLElement>('.lootbox-reveal');
  if (root === null) {
    throw new Error('reveal root missing');
  }
  return root;
}

function attributesOf(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const attribute of Array.from(element.attributes)) {
    attributes[attribute.name] = attribute.value;
  }
  return attributes;
}

/** Every attribute value and text node under `container`: the raw-wire-string scan surface. */
function textAndAttributeValues(container: HTMLElement): string[] {
  const values: string[] = [];
  const elements = [container, ...Array.from(container.querySelectorAll('*'))];
  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      values.push(attribute.value);
    }
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        values.push(node.textContent ?? '');
      }
    }
  }
  return values;
}

function parseStaticMarkup(element: ReactElement): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(element);
  return host;
}

/** Renders the reveal with recording seams and the pinned valid grant by default. */
function renderReveal(overrides: Partial<LootboxRevealProps> = {}) {
  const renderer = fakeRenderer();
  const stage = fakeStage();
  const onEquip = vi.fn((): void => undefined);
  const onDismiss = vi.fn((): void => undefined);
  const createRenderer = vi.fn((): WebGLRenderer => renderer.renderer);
  const createStage = vi.fn((): RevealStage => stage.stage);
  const props: LootboxRevealProps = {
    grant: grant(),
    appearance: { hull: 'hull-gold' },
    parts: { 'wing-left-silver': 2 },
    phase: 'rest',
    onEquip,
    onDismiss,
    createRenderer,
    createStage,
    ...overrides,
  };
  const result = render(<LootboxReveal {...props} />);
  return {
    ...result,
    props,
    renderer,
    stage,
    createRenderer,
    createStage,
    onEquip,
    onDismiss,
  };
}

describe('LootboxReveal constants (AC-12)', () => {
  it('pins the 30 fps cap, its interval and the pixel-ratio cap', () => {
    expect(REVEAL_MAX_FPS).toBe(30);
    expect(REVEAL_FRAME_INTERVAL_MS).toBe(1000 / 30);
    expect(REVEAL_MAX_PIXEL_RATIO).toBe(2);
  });
});

describe('LootboxReveal DOM contract (AC-7)', () => {
  it('renders the exact root attributes, stage, card and texts for a rare new part', () => {
    const { container } = renderReveal();
    const root = rootOf(container);

    expect(container.querySelectorAll('.lootbox-reveal')).toHaveLength(1);
    expect(attributesOf(root)).toEqual({
      class: 'lootbox-reveal',
      role: 'group',
      'aria-live': 'off',
      'aria-label': 'Lootbox reveal: Port Silver Wing',
      'data-reveal-active': 'true',
      'data-reveal-phase': 'rest',
      'data-reveal-sequence': '1',
      'data-part-id': 'wing-left-silver',
      'data-slot': 'wing-left',
      'data-rarity': 'rare',
      'data-duplicate': 'false',
      'data-owned-count': '2',
      'data-reveal-3d': 'ready',
      'data-reduced-motion': 'false',
    });

    const stages = container.querySelectorAll<HTMLElement>('.lootbox-stage');
    expect(stages).toHaveLength(1);
    expect(stages[0]?.getAttribute('data-reveal-stage')).toBe('true');
    const cards = container.querySelectorAll<HTMLElement>('.lootbox-reveal-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.getAttribute('data-reveal-card')).toBe('true');

    const card = cards[0];
    if (card === null || card === undefined) {
      throw new Error('reveal card missing');
    }
    expect(card.querySelector('.lootbox-reveal-rarity')?.textContent).toBe('Rare');
    expect(card.querySelector('.lootbox-reveal-part')?.textContent).toBe('Port Silver Wing');
    expect(card.querySelector('.lootbox-reveal-slot')?.textContent).toBe('Port Wing');
    expect(card.querySelector('.lootbox-reveal-duplicate')?.textContent).toBe('New');
    expect(card.querySelector('.lootbox-reveal-owned')?.textContent).toBe('Owned ×2');
    expect(screen.getByRole('button', { name: 'Equip Port Silver Wing' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Dismiss lootbox reveal' })).toBeInstanceOf(
      HTMLButtonElement,
    );

    const canvas = container.querySelector('canvas');
    if (canvas === null) {
      throw new Error('reveal canvas missing');
    }
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.className).toBe('lootbox-stage-canvas');
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    expect(container.querySelectorAll('[data-fallback-ship="true"]')).toHaveLength(0);
  });

  it('renders an epic duplicate already equipped with the exact labels and a disabled Equip', () => {
    const { container } = renderReveal({
      grant: grant({ partId: 'hull-gold', slot: 'hull', rarity: 'epic', duplicate: true, sequence: 3 }),
      appearance: { hull: 'hull-gold' },
      parts: { 'hull-gold': 5 },
    });
    const root = rootOf(container);

    expect(root.getAttribute('data-rarity')).toBe('epic');
    expect(root.getAttribute('data-duplicate')).toBe('true');
    expect(root.getAttribute('data-owned-count')).toBe('5');
    expect(root.getAttribute('aria-label')).toBe('Lootbox reveal: Gold Hull');
    expect(container.querySelector('.lootbox-reveal-rarity')?.textContent).toBe('Epic');
    expect(container.querySelector('.lootbox-reveal-part')?.textContent).toBe('Gold Hull');
    expect(container.querySelector('.lootbox-reveal-slot')?.textContent).toBe('Hull');
    expect(container.querySelector('.lootbox-reveal-duplicate')?.textContent).toBe('Duplicate');
    expect(container.querySelector('.lootbox-reveal-owned')?.textContent).toBe('Owned ×5');

    const equip = screen.getByRole('button', { name: 'Equipped' });
    expect(equip.className).toBe('customization-reveal-equip');
    expect(equip.hasAttribute('disabled')).toBe(true);
    expect(equip.hasAttribute('aria-label')).toBe(false);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Dismiss lootbox reveal' }),
    );
  });

  it.each(['hull', 'warp-core'])(
    'renders the catalog slot and never the wire slot %s (AC-7)',
    (wireSlot) => {
      const { container } = renderReveal({ grant: grant({ slot: wireSlot }) });
      const root = rootOf(container);

      expect(root.getAttribute('data-slot')).toBe('wing-left');
      expect(root.getAttribute('data-part-id')).toBe('wing-left-silver');
      expect(container.querySelector('.lootbox-reveal-slot')?.textContent).toBe('Port Wing');
      expect(textAndAttributeValues(container)).not.toContain(wireSlot);
    },
  );

  it('renders the catalog slot when the wire slot is missing', () => {
    const { container } = renderReveal({ grant: grant({ slot: '' }) });
    expect(rootOf(container).getAttribute('data-slot')).toBe('wing-left');
    expect(container.querySelector('.lootbox-reveal-slot')?.textContent).toBe('Port Wing');
  });

  it('reads the owned count from the parts map and defaults a missing count to 0', () => {
    const counted = renderReveal({ parts: { 'wing-left-silver': 4 } });
    expect(rootOf(counted.container).getAttribute('data-owned-count')).toBe('4');
    expect(counted.container.querySelector('.lootbox-reveal-owned')?.textContent).toBe('Owned ×4');

    cleanup();
    const missing = renderReveal({ parts: {} });
    expect(rootOf(missing.container).getAttribute('data-owned-count')).toBe('0');
    expect(missing.container.querySelector('.lootbox-reveal-owned')?.textContent).toBe('Owned ×0');
  });

  it.each([-2, Number.NaN, 2.5])(
    'sanitises the invalid owned count %s to 0',
    (count) => {
      const { container } = renderReveal({ parts: { 'wing-left-silver': count } });
      expect(rootOf(container).getAttribute('data-owned-count')).toBe('0');
      expect(container.querySelector('.lootbox-reveal-owned')?.textContent).toBe('Owned ×0');
    },
  );

  it('sanitises an unknown part to the fixed AC-7 values and never leaks the raw strings', () => {
    const createRenderer = vi.fn((): WebGLRenderer => {
      throw new Error('must not build a renderer for an unknown part');
    });
    const createStage = vi.fn((): RevealStage => {
      throw new Error('must not build a stage for an unknown part');
    });
    const { container } = render(
      <LootboxReveal
        grant={grant({ partId: 'mystery-part', slot: 'warp-core', sequence: 7 })}
        appearance={{}}
        parts={{ 'mystery-part': 3 }}
        phase="rest"
        onDismiss={vi.fn((): void => undefined)}
        createRenderer={createRenderer}
        createStage={createStage}
      />,
    );
    const root = rootOf(container);

    expect(attributesOf(root)).toEqual({
      class: 'lootbox-reveal',
      role: 'group',
      'aria-live': 'off',
      'aria-label': 'Lootbox reveal: Unknown part',
      'data-reveal-active': 'true',
      'data-reveal-phase': 'rest',
      'data-reveal-sequence': '7',
      'data-part-id': 'unknown',
      'data-slot': '',
      'data-rarity': 'rare',
      'data-duplicate': 'false',
      'data-owned-count': '0',
      'data-reveal-3d': 'unavailable',
      'data-reduced-motion': 'false',
    });
    expect(container.querySelector('.lootbox-reveal-part')?.textContent).toBe('Unknown part');
    expect(container.querySelector('.lootbox-reveal-slot')).toBeNull();
    expect(container.querySelector('.lootbox-stage')).toBeNull();
    expect(container.querySelector('[data-reveal-stage="true"]')).toBeNull();
    expect(container.querySelector('[data-fallback-ship="true"]')).toBeNull();
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Equip Unknown part' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }));
    expect(createRenderer).not.toHaveBeenCalled();
    expect(createStage).not.toHaveBeenCalled();
    expect(textAndAttributeValues(container)).not.toContain('mystery-part');
    expect(textAndAttributeValues(container)).not.toContain('warp-core');
  });

  it.each<[RevealUiPhase, string]>([
    ['idle', 'charge'],
    ['charge', 'charge'],
    ['orb', 'orb'],
    ['flash', 'flash'],
    ['reveal', 'reveal'],
    ['settle', 'settle'],
    ['rest', 'rest'],
  ])('maps the panel phase %s to data-reveal-phase %s and never renders idle', (phase, expected) => {
    const { container } = renderReveal({ phase });
    expect(rootOf(container).getAttribute('data-reveal-phase')).toBe(expected);
    expect(container.innerHTML).not.toContain('data-reveal-phase="idle"');
  });

  it('updates the phase attribute without rebuilding the renderer or the loop', () => {
    const harness = renderReveal({ phase: 'charge' });
    expect(rootOf(harness.container).getAttribute('data-reveal-phase')).toBe('charge');
    expect(requestFrame).toHaveBeenCalledTimes(1);

    harness.rerender(<LootboxReveal {...harness.props} phase="flash" />);

    expect(rootOf(harness.container).getAttribute('data-reveal-phase')).toBe('flash');
    expect(harness.createRenderer).toHaveBeenCalledTimes(1);
    expect(harness.createStage).toHaveBeenCalledTimes(1);
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  it('is a non-live group: no polite/status/alert region and no aria-modal', () => {
    const { container } = renderReveal();
    const root = rootOf(container);

    expect(root.getAttribute('role')).toBe('group');
    expect(root.getAttribute('aria-live')).toBe('off');
    expect(root.hasAttribute('aria-modal')).toBe(false);
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(0);
    expect(container.querySelectorAll('[role="status"], [role="alert"]')).toHaveLength(0);
  });
});

describe('LootboxReveal focus and dismissal (AC-8)', () => {
  it('moves focus to Equip on mount', () => {
    renderReveal();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Equip Port Silver Wing' }),
    );
  });

  it('refocuses Equip on a new sequence and replaces the stage exactly once', () => {
    const renderers: RendererRecord[] = [];
    const stages: StageRecord[] = [];
    const createRenderer = vi.fn((): WebGLRenderer => {
      const record = fakeRenderer();
      renderers.push(record);
      return record.renderer;
    });
    const createStage = vi.fn((): RevealStage => {
      const record = fakeStage();
      stages.push(record);
      return record.stage;
    });
    const onDismiss = vi.fn((): void => undefined);
    const baseProps: LootboxRevealProps = {
      grant: grant({ sequence: 1 }),
      appearance: {},
      parts: { 'wing-left-silver': 2 },
      phase: 'charge',
      onDismiss,
      createRenderer,
      createStage,
    };
    const { container, rerender } = render(<LootboxReveal {...baseProps} />);
    expect(renderers).toHaveLength(1);
    expect(stages).toHaveLength(1);

    screen.getByRole('button', { name: 'Dismiss lootbox reveal' }).focus();
    rerender(<LootboxReveal {...baseProps} grant={grant({ sequence: 2 })} />);

    expect(rootOf(container).getAttribute('data-reveal-sequence')).toBe('2');
    expect(renderers).toHaveLength(2);
    expect(stages).toHaveLength(2);
    expect(stages[0]?.disposeCalls()).toBe(1);
    expect(renderers[0]?.disposeCalls()).toBe(1);
    expect(stages[1]?.disposeCalls()).toBe(0);
    expect(renderers[1]?.disposeCalls()).toBe(0);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Equip Port Silver Wing' }),
    );
  });

  it('dismisses exactly once on Escape from inside the reveal', () => {
    const { onDismiss } = renderReveal();
    const equip = screen.getByRole('button', { name: 'Equip Port Silver Wing' });

    fireEvent.keyDown(equip, { key: 'Enter' });
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.keyDown(equip, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses exactly once on the Dismiss button', () => {
    const { onDismiss } = renderReveal();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('equips through onEquip first and dismisses exactly once after it', () => {
    const calls: string[] = [];
    const onEquip = vi.fn((partId: string): void => {
      calls.push(`equip:${partId}`);
    });
    const onDismiss = vi.fn((): void => {
      calls.push('dismiss');
    });
    renderReveal({ onEquip, onDismiss });

    fireEvent.click(screen.getByRole('button', { name: 'Equip Port Silver Wing' }));

    expect(onEquip).toHaveBeenNthCalledWith(1, 'wing-left-silver');
    expect(calls).toEqual(['equip:wing-left-silver', 'dismiss']);
  });

  it('still dismisses on Equip when no onEquip handler is supplied', () => {
    const onDismiss = vi.fn((): void => undefined);
    const { container } = renderReveal({ onDismiss, onEquip: undefined });
    expect(rootOf(container).getAttribute('aria-label')).toBe('Lootbox reveal: Port Silver Wing');

    fireEvent.click(screen.getByRole('button', { name: 'Equip Port Silver Wing' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('never auto-dismisses: 10 seconds of timers leave the reveal mounted', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const { container, onDismiss } = renderReveal();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(rootOf(container).getAttribute('data-reveal-phase')).toBe('rest');
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('LootboxReveal reduced motion (AC-9)', () => {
  it('maps the idle first render to rest under reduced motion before any effect runs', () => {
    const host = parseStaticMarkup(
      <LootboxReveal
        grant={grant()}
        appearance={{}}
        parts={{}}
        phase="idle"
        reducedMotion
        onDismiss={() => undefined}
      />,
    );
    const root = rootOf(host);

    expect(root.getAttribute('data-reveal-phase')).toBe('rest');
    expect(root.getAttribute('data-reduced-motion')).toBe('true');
  });

  it('maps the idle first render to charge when motion is allowed', () => {
    const host = parseStaticMarkup(
      <LootboxReveal
        grant={grant()}
        appearance={{}}
        parts={{}}
        phase="idle"
        onDismiss={() => undefined}
      />,
    );
    expect(rootOf(host).getAttribute('data-reveal-phase')).toBe('charge');
  });

  it('renders exactly one static frame and schedules no frame', () => {
    const harness = renderReveal({ phase: 'idle', reducedMotion: true });
    const root = rootOf(harness.container);

    expect(root.getAttribute('data-reveal-phase')).toBe('rest');
    expect(root.getAttribute('data-reduced-motion')).toBe('true');
    expect(harness.stage.updates).toEqual([[0, true]]);
    expect(harness.renderer.renders).toHaveLength(1);
    expect(harness.renderer.renders[0]?.scene).toBe(harness.stage.scene);
    expect(harness.renderer.renders[0]?.camera).toBe(harness.stage.camera);
    expect(requestFrame).not.toHaveBeenCalled();
    expect(harness.container.querySelector('[data-reveal-flash="true"]')).toBeNull();
    expect(harness.container.querySelector('.lootbox-reveal-card')?.textContent).toContain(
      'Port Silver Wing',
    );
  });
});

describe('LootboxReveal WebGL fallback (AC-10)', () => {
  it('falls back to the inline SVG when the renderer factory throws', () => {
    const createStage = vi.fn((): RevealStage => {
      throw new Error('the stage must not be built without a renderer');
    });
    const { container } = render(
      <LootboxReveal
        grant={grant({ slot: 'hull' })}
        appearance={{}}
        parts={{ 'wing-left-silver': 2 }}
        phase="rest"
        onDismiss={vi.fn((): void => undefined)}
        createRenderer={() => {
          throw new Error('WebGL unavailable');
        }}
        createStage={createStage}
      />,
    );
    const root = rootOf(container);

    expect(root.getAttribute('data-reveal-3d')).toBe('unavailable');
    expect(root.getAttribute('data-slot')).toBe('wing-left');
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
    expect(createStage).not.toHaveBeenCalled();

    const fallback = container.querySelector('svg.lootbox-fallback-ship');
    if (!(fallback instanceof SVGElement)) {
      throw new Error('fallback ship missing');
    }
    expect(attributesOf(fallback)).toEqual({
      class: 'lootbox-fallback-ship',
      'data-fallback-ship': 'true',
      'data-slot': 'wing-left',
      'aria-hidden': 'true',
      focusable: 'false',
      viewBox: '0 0 120 72',
    });
    expect(container.querySelectorAll('[data-fallback-ship="true"]')).toHaveLength(1);

    // The full card and controls stay readable/interactive next to the fallback.
    expect(container.querySelector('.lootbox-reveal-rarity')?.textContent).toBe('Rare');
    expect(container.querySelector('.lootbox-reveal-part')?.textContent).toBe('Port Silver Wing');
    expect(container.querySelector('.lootbox-reveal-slot')?.textContent).toBe('Port Wing');
    expect(container.querySelector('.lootbox-reveal-duplicate')?.textContent).toBe('New');
    expect(container.querySelector('.lootbox-reveal-owned')?.textContent).toBe('Owned ×2');
    expect(screen.getByRole('button', { name: 'Equip Port Silver Wing' })).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(screen.getByRole('button', { name: 'Dismiss lootbox reveal' })).toBeInstanceOf(
      HTMLButtonElement,
    );

    // No external reference, image or injected markup anywhere in the fallback/card.
    expect(container.querySelector('img, image, use')).toBeNull();
    expect(container.innerHTML).not.toContain('url(');
    expect(container.innerHTML).not.toContain('<img');
    expect(container.innerHTML).not.toContain('http');
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('falls back when the stage factory throws and disposes the created renderer once', () => {
    const renderer = fakeRenderer();
    const { container } = render(
      <LootboxReveal
        grant={grant()}
        appearance={{}}
        parts={{}}
        phase="rest"
        onDismiss={vi.fn((): void => undefined)}
        createRenderer={() => renderer.renderer}
        createStage={() => {
          throw new Error('stage build failed');
        }}
      />,
    );

    expect(rootOf(container).getAttribute('data-reveal-3d')).toBe('unavailable');
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
    expect(container.querySelector('svg[data-fallback-ship="true"]')?.getAttribute('data-slot')).toBe(
      'wing-left',
    );
    expect(renderer.disposeCalls()).toBe(1);
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('falls back when the real WebGLRenderer cannot create a context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(
      <LootboxReveal
        grant={grant()}
        appearance={{}}
        parts={{}}
        phase="rest"
        onDismiss={vi.fn((): void => undefined)}
      />,
    );

    expect(rootOf(container).getAttribute('data-reveal-3d')).toBe('unavailable');
    expect(container.querySelector('svg[data-fallback-ship="true"]')?.getAttribute('data-slot')).toBe(
      'wing-left',
    );
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
    expect(requestFrame).not.toHaveBeenCalled();
  });
});

describe('LootboxReveal shot cards (AC-31)', () => {
  it('renders the v3 shot slot, slot name, catalog name and staged shot entry', () => {
    const harness = renderReveal({
      grant: shotGrant({ sequence: 5 }),
      appearance: { shot: 'shot-default' },
      parts: { 'shot-kite-solar': 1 },
    });
    const root = rootOf(harness.container);

    expect(attributesOf(root)).toEqual({
      class: 'lootbox-reveal',
      role: 'group',
      'aria-live': 'off',
      'aria-label': 'Lootbox reveal: Solar Kite Bolt',
      'data-reveal-active': 'true',
      'data-reveal-phase': 'rest',
      'data-reveal-sequence': '5',
      'data-part-id': 'shot-kite-solar',
      'data-slot': 'shot',
      'data-rarity': 'epic',
      'data-duplicate': 'false',
      'data-owned-count': '1',
      'data-reveal-3d': 'ready',
      'data-reduced-motion': 'false',
    });
    expect(harness.container.querySelector('.lootbox-reveal-rarity')?.textContent).toBe('Epic');
    expect(harness.container.querySelector('.lootbox-reveal-part')?.textContent).toBe(
      'Solar Kite Bolt',
    );
    expect(harness.container.querySelector('.lootbox-reveal-slot')?.textContent).toBe('Shot');
    expect(harness.container.querySelector('.lootbox-reveal-duplicate')?.textContent).toBe('New');
    expect(harness.container.querySelector('.lootbox-reveal-owned')?.textContent).toBe('Owned ×1');
    expect(screen.getByRole('button', { name: 'Equip Solar Kite Bolt' }).hasAttribute('disabled')).toBe(
      false,
    );

    // Only the shot slot is staged; the catalog slot drives the appearance copy.
    expect(harness.createStage).toHaveBeenCalledTimes(1);
    expect(harness.createStage).toHaveBeenCalledWith({ shot: 'shot-kite-solar' }, harness.props.grant);
  });

  it('equips and dismisses a shot card through the unchanged callbacks', () => {
    const calls: string[] = [];
    const onEquip = vi.fn((partId: string): void => {
      calls.push(`equip:${partId}`);
    });
    const onDismiss = vi.fn((): void => {
      calls.push('dismiss');
    });
    renderReveal({ grant: shotGrant(), onEquip, onDismiss });

    fireEvent.click(screen.getByRole('button', { name: 'Equip Solar Kite Bolt' }));

    expect(onEquip).toHaveBeenNthCalledWith(1, 'shot-kite-solar');
    expect(calls).toEqual(['equip:shot-kite-solar', 'dismiss']);
  });

  it('disables Equip when the shot part is already equipped', () => {
    renderReveal({ grant: shotGrant(), appearance: { shot: 'shot-kite-solar' } });

    const equip = screen.getByRole('button', { name: 'Equipped' });
    expect(equip.hasAttribute('disabled')).toBe(true);
    expect(equip.hasAttribute('aria-label')).toBe(false);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Dismiss lootbox reveal' }),
    );
  });

  it('renders exactly one static frame under reduced motion without a flash', () => {
    const harness = renderReveal({ grant: shotGrant(), phase: 'idle', reducedMotion: true });
    const root = rootOf(harness.container);

    expect(root.getAttribute('data-reveal-phase')).toBe('rest');
    expect(root.getAttribute('data-reduced-motion')).toBe('true');
    expect(root.getAttribute('data-slot')).toBe('shot');
    expect(harness.stage.updates).toEqual([[0, true]]);
    expect(harness.renderer.renders).toHaveLength(1);
    expect(requestFrame).not.toHaveBeenCalled();
    expect(harness.container.querySelector('[data-reveal-flash="true"]')).toBeNull();
  });

  it('keeps the full shot card and controls when WebGL is unavailable', () => {
    const createStage = vi.fn((): RevealStage => {
      throw new Error('the stage must not be built without a renderer');
    });
    const onDismiss = vi.fn((): void => undefined);
    const { container } = render(
      <LootboxReveal
        grant={shotGrant({ slot: 'hull' })}
        appearance={{}}
        parts={{ 'shot-kite-solar': 2 }}
        phase="rest"
        onDismiss={onDismiss}
        createRenderer={() => {
          throw new Error('WebGL unavailable');
        }}
        createStage={createStage}
      />,
    );
    const root = rootOf(container);

    // The wire slot (`hull`) is ignored: the v3 catalog slot `shot` wins.
    expect(root.getAttribute('data-reveal-3d')).toBe('unavailable');
    expect(root.getAttribute('data-slot')).toBe('shot');
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
    expect(createStage).not.toHaveBeenCalled();

    const fallback = container.querySelector('svg.lootbox-fallback-ship');
    expect(fallback?.getAttribute('data-slot')).toBe('shot');
    expect(container.querySelector('.lootbox-reveal-part')?.textContent).toBe('Solar Kite Bolt');
    expect(container.querySelector('.lootbox-reveal-slot')?.textContent).toBe('Shot');
    expect(container.querySelector('.lootbox-reveal-owned')?.textContent).toBe('Owned ×2');
    expect(screen.getByRole('button', { name: 'Equip Solar Kite Bolt' })).toBeInstanceOf(
      HTMLButtonElement,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('renders the real stage at the 0.9 shot yaw with an unchanged ship', () => {
    const renderer = fakeRenderer();
    const { unmount } = render(
      <LootboxReveal
        grant={shotGrant()}
        appearance={{}}
        parts={{ 'shot-kite-solar': 1 }}
        phase="rest"
        onDismiss={vi.fn((): void => undefined)}
        createRenderer={() => renderer.renderer}
      />,
    );

    flushFrame(0);
    const rendered = renderer.renders[0];
    if (rendered === undefined) {
      throw new Error('no frame rendered');
    }
    const scene = rendered.scene as Scene;
    const model = scene.getObjectByName('cursor-ship-model');
    expect(scene.name).toBe('lootbox-reveal-scene');
    expect(model?.rotation.y).toBe(0.55);
    expect(model?.scale.x).toBe(1);

    let meshes = 0;
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        meshes += 1;
      }
    });
    // 21 ship meshes + the rarity ring: a shot grant adds no mesh (AC-31).
    expect(meshes).toBe(22);
    const hull = scene.getObjectByName('cursor-hull') as Mesh;
    expect((hull.material as MeshPhysicalMaterial).color.getHex()).toBe(0x8f9bad);

    // 420 ms: the charge phase has yawed the ship to the shot yaw and the hull is unstaged.
    flushFrame(420);
    expect(model?.rotation.y).toBe(0.9);
    expect((hull.material as MeshPhysicalMaterial).color.getHex()).toBe(0x8f9bad);

    // 1290 ms: the unchanged rest row keeps the shot yaw.
    flushFrame(1290);
    expect(model?.rotation.y).toBe(0.9);
    expect(hull.scale.toArray()).toEqual([1, 1, 1]);

    unmount();
    expect(renderer.disposeCalls()).toBe(1);
  });
});

describe('LootboxReveal loop, context and teardown (AC-12)', () => {
  it('renders the real reveal scene through the single context and throttles to 30 fps', () => {
    const renderer = fakeRenderer();
    const { container, unmount } = render(
      <LootboxReveal
        grant={grant()}
        appearance={{ hull: 'hull-gold' }}
        parts={{ 'wing-left-silver': 2 }}
        phase="rest"
        onDismiss={vi.fn((): void => undefined)}
        createRenderer={() => renderer.renderer}
      />,
    );

    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    expect(renderer.sizes).toEqual([[1, 1, false]]);
    expect(renderer.pixelRatios).toEqual([1]);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(renderer.renders).toHaveLength(0);

    flushFrame(0);
    expect(renderer.renders).toHaveLength(1);
    const rendered = renderer.renders[0];
    if (rendered === undefined) {
      throw new Error('no frame rendered');
    }
    const scene = rendered.scene as Scene;
    expect(scene.name).toBe('lootbox-reveal-scene');
    expect(scene.children.map((child) => child.name)).toEqual([
      'reveal-ambient',
      'reveal-key-light',
      'cursor-ship-model',
      'reveal-slot-ring',
    ]);
    expect(scene.getObjectByName('cursor-ship-model')?.rotation.y).toBe(0.55);

    // 16 ms since the first frame is under the 33.33 ms budget: no render.
    flushFrame(16);
    expect(renderer.renders).toHaveLength(1);

    // 34 ms crosses the budget: one frame with the exact pure-pose yaw for elapsed 34.
    flushFrame(34);
    expect(renderer.renders).toHaveLength(2);
    const expectedPose = revealStagePose(34, 'wing-left', false, createRevealStagePose());
    expect(scene.getObjectByName('cursor-ship-model')?.rotation.y).toBe(expectedPose.yawRad);

    unmount();
    expect(renderer.disposeCalls()).toBe(1);
    expect(scene.children).toHaveLength(0);
    expect(cancelFrame).toHaveBeenCalledWith(4);
  });

  it('renders at most 30 frames per second and measures elapsed from the first frame', () => {
    const harness = renderReveal();
    expect(harness.createRenderer).toHaveBeenCalledTimes(1);
    expect(harness.createStage).toHaveBeenCalledWith(
      { hull: 'hull-gold', 'wing-left': 'wing-left-silver' },
      harness.props.grant,
    );
    expect(harness.stage.updates).toEqual([]);
    expect(requestFrame).toHaveBeenCalledTimes(1);

    flushFrame(0);
    expect(harness.stage.updates).toEqual([[0, false]]);
    flushFrame(16);
    expect(harness.stage.updates).toEqual([[0, false]]);
    flushFrame(34);
    expect(harness.stage.updates).toEqual([
      [0, false],
      [34, false],
    ]);
    flushFrame(1000);
    expect(harness.stage.updates).toEqual([
      [0, false],
      [34, false],
      [1000, false],
    ]);
    expect(harness.renderer.renders).toHaveLength(3);
  });

  it('pauses while the tab is hidden and resumes on visibilitychange', () => {
    const harness = renderReveal();
    expect(requestFrame).toHaveBeenCalledTimes(1);

    // Hiding the tab cancels the pending frame instead of spinning.
    setDocumentHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(cancelFrame).toHaveBeenCalledWith(1);
    expect(harness.stage.updates).toEqual([]);
    expect(requestFrame).toHaveBeenCalledTimes(1);

    // Becoming visible resets the baseline and schedules exactly one frame.
    setDocumentHidden(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(requestFrame).toHaveBeenCalledTimes(2);
    flushFrame(100);
    expect(harness.stage.updates).toEqual([[0, false]]);
    expect(harness.renderer.renders).toHaveLength(1);

    // A frame that fires while hidden renders nothing and stops the loop.
    setDocumentHidden(true);
    flushFrame(200);
    expect(harness.stage.updates).toEqual([[0, false]]);
    expect(requestFrame).toHaveBeenCalledTimes(3);

    setDocumentHidden(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(requestFrame).toHaveBeenCalledTimes(4);
    flushFrame(300);
    expect(harness.stage.updates).toEqual([
      [0, false],
      [200, false],
    ]);
    expect(harness.renderer.renders).toHaveLength(2);
  });

  it('resizes the stage canvas through a ResizeObserver and disconnects it once', () => {
    const resizeCallbacks: ResizeObserverCallback[] = [];
    const observed: Element[] = [];
    const disconnects: number[] = [];
    class ResizeObserverStub {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe(target: Element): void {
        observed.push(target);
      }
      unobserve(): void {
        // The component never calls `unobserve`; disconnect covers teardown.
      }
      disconnect(): void {
        disconnects.push(1);
      }
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    const harness = renderReveal();

    const canvas = harness.container.querySelector('canvas');
    if (canvas === null) {
      throw new Error('reveal canvas missing');
    }
    expect(observed).toEqual([canvas]);
    expect(harness.renderer.sizes).toEqual([[1, 1, false]]);
    expect(harness.stage.camera.aspect).toBe(1);

    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 320 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 200 });
    const callback = resizeCallbacks[0];
    if (callback === undefined) {
      throw new Error('resize callback missing');
    }
    act(() => {
      callback([], {} as ResizeObserver);
    });

    expect(harness.renderer.sizes).toEqual([
      [1, 1, false],
      [320, 200, false],
    ]);
    expect(harness.stage.camera.aspect).toBe(320 / 200);
    expect(harness.stage.updateProjectionMatrix).toHaveBeenCalledTimes(2);
    expect(harness.stage.updateProjectionMatrix).toHaveBeenCalledWith();

    harness.unmount();
    expect(disconnects).toEqual([1]);
  });

  it('disposes the stage then the renderer exactly once on unmount', () => {
    const harness = renderReveal();
    expect(requestFrame).toHaveBeenCalledTimes(1);

    harness.unmount();

    expect(harness.stage.disposeCalls()).toBe(1);
    expect(harness.renderer.disposeCalls()).toBe(1);
    expect(cancelFrame).toHaveBeenCalledWith(1);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  it('keeps the reveal out of the App entry graph (deferred chunk)', () => {
    expect(APP_SOURCE).toContain("from './ui/DeferredSpaceshipCustomizationPanel'");
    expect(APP_SOURCE).not.toContain("'./ui/LootboxReveal'");
    expect(APP_SOURCE).not.toContain('"./ui/LootboxReveal"');
    expect(APP_SOURCE).not.toContain("'./ui/SpaceshipCustomizationPanel'");
    expect(APP_SOURCE).not.toContain("'./render/lootbox-reveal'");
  });
});
