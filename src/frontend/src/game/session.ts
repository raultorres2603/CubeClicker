/**
 * Game session (T13) — the browser boundary the UI drives.
 *
 * Layer: session (`game/session.ts`). It owns the whole runtime lifecycle: environment
 * resolution, the engine, the scene view, the renderer adapter, the event listeners and
 * the frame loop. Every environment value arrives through {@link SessionEnvironment}, so
 * the module itself reads no host globals and the whole wiring is testable with a fake
 * environment (the default environment is assembled in `browser-env.ts`).
 *
 * **Ownership.** The engine owns the game state (plan § Data flow); the scene owns the
 * three.js objects; the session owns the *loop* and the *connections* between them:
 *
 * 1. input listeners (pointer on the canvas, keys on the key target) → `input/**` →
 *    `engine.dispatch`,
 * 2. the scheduler's frame → `engine.advance(dt)` → drain intents → `scene.applyIntents`
 *    → `scene.applySnapshot` → `scene.update` → `renderer.render` → reschedule,
 * 3. the motion / visibility / resize sources → live motion switching, loop pause and
 *    viewport refresh.
 *
 * **Phase policy for pointer input** (plan § session contract; `gestures.ts` is
 * phase-agnostic and classifies only): during `intro` a tap skips and a drag does
 * nothing; while `playing` a tap picks the current front face through
 * `pickMiniCube(sceneView.camera, sceneView.cubeView, frontFace(snapshot.orientation), …)`
 * (a hit explodes that mini-cube, a miss or a non-front-face hit does nothing) and a drag
 * rotates one step; `travel` ignores pointer input entirely. Both scene handles are read
 * from the live scene view at pick time — `cubeView` through the rebuild-aware accessor,
 * so a `levelChanged` rebuild can never leave the pick with a disposed handle.
 *
 * **three.js surface.** The only reference to three.js here is the type-only
 * `RendererAdapter` signature the plan pins; the session never imports or constructs it.
 *
 * **Lifecycle.** `attach` is idempotent and `dispose` is idempotent; disposing cancels the
 * pending frame, removes every listener it added, unsubscribes every source, disposes the
 * renderer and the scene, and leaves no callback that could render again. A session that
 * was disposed may be attached again (a fresh renderer/scene cycle for the same engine
 * state), which keeps the component contract valid when a host mounts the same session
 * instance twice.
 */

import type { PerspectiveCamera, Scene } from 'three';

import { classifyPointer, type PointerGesture } from '../input/gestures';
import { mapKey } from '../input/keyboard';
import { pickMiniCube } from '../render/picking';
import { createSceneView, type SceneView } from '../render/scene';
import { browserEnvironment } from '../browser-env';
import { PIXEL_RATIO_CAP } from './effects';
import { createEngine, type EngineSnapshot, type GameEngine, type GameEvent } from './engine';
import { frontFace } from './rotation';

/** The drawing surface the session listens on and sizes. */
export interface CanvasLike {
  addEventListener(type: string, handler: (event: unknown) => void): void;
  removeEventListener(type: string, handler: (event: unknown) => void): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  width: number;
  height: number;
}

/** The only frame source the loop may use (the default wraps the refresh callback). */
export interface FrameScheduler {
  schedule(cb: (nowMs: number) => void): number;
  cancel(handle: number): void;
}

/** `prefers-reduced-motion` reader: the current value plus live changes. */
export interface MotionSource {
  matches(): boolean;
  subscribe(cb: (reduced: boolean) => void): () => void;
}

/** Tab visibility reader: the current value plus live changes. */
export interface VisibilitySource {
  isHidden(): boolean;
  subscribe(cb: (hidden: boolean) => void): () => void;
}

/** Surface-size reader: fires whenever the element's box changes. */
export interface ResizeSource {
  subscribe(cb: () => void): () => void;
}

/** The narrow renderer surface the session drives (three's `WebGLRenderer` fits it). */
export interface RendererAdapter {
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

/** Everything the session needs from the host, injectable end to end. */
export interface SessionEnvironment {
  canvas: CanvasLike;
  keyTarget: {
    addEventListener(type: string, handler: (event: unknown) => void): void;
    removeEventListener(type: string, handler: (event: unknown) => void): void;
  };
  scheduler: FrameScheduler;
  motion: MotionSource;
  visibility: VisibilitySource;
  resize: ResizeSource;
  rendererFactory: (canvas: CanvasLike) => RendererAdapter;
  now(): number;
  random(): number;
  devicePixelRatio(): number;
}

/** The runtime handle the UI holds. */
export interface GameSession {
  /** Resolves the environment, starts the engine and the frame loop; idempotent. */
  attach(canvas: CanvasLike): void;
  /** Stops the loop, releases the renderer and the scene, removes every listener; idempotent. */
  dispose(): void;
  /** The engine snapshot passthrough (the React store reads this). */
  getSnapshot(): EngineSnapshot;
  /** Subscribes to snapshot changes; the returned function unsubscribes. */
  subscribe(listener: () => void): () => void;
}

/** Construction options; the environment and the engine are both injectable. */
export interface GameSessionOptions {
  env?: SessionEnvironment;
  engine?: GameEngine;
}

/** One press, in client coordinates (the canvas origin is subtracted when it is classified). */
interface PressPosition {
  x: number;
  y: number;
}

/**
 * Creates one game session. Nothing is attached until {@link GameSession.attach} is
 * called; the engine (injected or created here) exists from this point on, so
 * `getSnapshot`/`subscribe` are safe to use before the first attach.
 */
export function createGameSession(options: GameSessionOptions = {}): GameSession {
  const providedEnv = options.env;
  const engine = options.engine ?? createEngine();

  /** True between a successful `attach` and its `dispose`. */
  let active = false;
  /** Releases everything the current attach cycle created; `null` while detached. */
  let teardown: (() => void) | null = null;
  const unsubscribers: Array<() => void> = [];
  const listeners = new Set<() => void>();
  /** The snapshot the listeners were last told about (identity = "nothing changed"). */
  let publishedSnapshot: EngineSnapshot | null = null;

  /** Notifies subscribers when the snapshot changed — the referential-stability contract. */
  function publish(snapshot: EngineSnapshot): void {
    if (snapshot === publishedSnapshot) {
      return;
    }
    publishedSnapshot = snapshot;
    for (const listener of listeners) {
      listener();
    }
  }

  function dispatchAndPublish(event: GameEvent): void {
    engine.dispatch(event);
    publish(engine.getSnapshot());
  }

  return {
    attach(target: CanvasLike): void {
      if (active) {
        return;
      }
      active = true;

      const env = providedEnv ?? browserEnvironment(target);
      const view = createSceneView({ style: engine.getSnapshot().style, random: env.random });
      const adapter: RendererAdapter = env.rendererFactory(target);

      let frameHandle: number | null = null;
      /** Frame time the next delta is measured from (a rewind never produces a negative dt). */
      let frameBaselineMs = env.now();
      let hidden = env.visibility.isHidden();
      let press: PressPosition | null = null;

      /** Pushes the container size, the capped pixel ratio and the camera aspect. */
      function applyViewport(): void {
        const rect = target.getBoundingClientRect();
        adapter.setPixelRatio(Math.min(env.devicePixelRatio(), PIXEL_RATIO_CAP));
        adapter.setSize(rect.width, rect.height);
        // Before the first layout the box is empty; a 1:1 aspect keeps the projection valid.
        view.camera.aspect = rect.height > 0 ? rect.width / rect.height : 1;
        view.camera.updateProjectionMatrix();
      }

      function scheduleFrame(): void {
        if (hidden || frameHandle !== null) {
          return;
        }
        frameHandle = env.scheduler.schedule(onFrame);
      }

      /** One frame: time → intents → snapshot → render, then the next frame. */
      function onFrame(nowMs: number): void {
        frameHandle = null;
        if (!active) {
          // A callback that escaped `cancel`: the session is gone and must not render.
          return;
        }
        const dtMs = Math.max(0, nowMs - frameBaselineMs);
        frameBaselineMs = nowMs;
        engine.advance(dtMs);
        view.applyIntents(engine.drainIntents(), nowMs);
        const snapshot = engine.getSnapshot();
        view.applySnapshot(snapshot, nowMs);
        view.update(dtMs);
        adapter.render(view.scene, view.camera);
        publish(snapshot);
        scheduleFrame();
      }

      function onPointerDown(event: unknown): void {
        const { clientX, clientY } = event as { clientX: number; clientY: number };
        press = { x: clientX, y: clientY };
      }

      /** Classifies the gesture at release: pointer events are the single input path. */
      function onPointerUp(event: unknown): void {
        const start = press;
        press = null;
        if (start === null) {
          return;
        }
        const { clientX, clientY } = event as { clientX: number; clientY: number };
        const rect = target.getBoundingClientRect();
        dispatchGesture(
          classifyPointer(
            { x: start.x - rect.left, y: start.y - rect.top },
            { x: clientX - rect.left, y: clientY - rect.top },
            { width: rect.width, height: rect.height },
          ),
        );
      }

      function onPointerCancel(): void {
        press = null;
      }

      /** The phase policy: what one classified gesture means right now. */
      function dispatchGesture(gesture: PointerGesture): void {
        if (gesture === null) {
          return;
        }
        const snapshot = engine.getSnapshot();
        if (snapshot.phase === 'intro') {
          // A click during the intro only ever skips it — never picks, never explodes.
          if (gesture.kind === 'tap') {
            dispatchAndPublish({ type: 'introSkip' });
          }
          return;
        }
        if (snapshot.phase === 'travel') {
          return;
        }
        if (gesture.kind === 'drag') {
          dispatchAndPublish({ type: 'rotate', axis: gesture.axis, direction: gesture.direction });
          return;
        }
        // Front-face gate: only the current front face is pickable (a hit on any other
        // face, a miss and a hidden instance all come back as `null`).
        const id = pickMiniCube(
          view.camera,
          view.cubeView,
          frontFace(snapshot.orientation),
          gesture.ndcX,
          gesture.ndcY,
        );
        if (id !== null) {
          dispatchAndPublish({ type: 'explodeMiniCube', id });
        }
      }

      function onKeyDown(event: unknown): void {
        const { key } = event as { key: string };
        const mapped = mapKey(key, engine.getSnapshot().phase);
        if (mapped !== null) {
          dispatchAndPublish(mapped);
        }
      }

      function onMotionChange(reduced: boolean): void {
        engine.setReducedMotion(reduced);
        publish(engine.getSnapshot());
      }

      /** Hidden tabs stop the loop; becoming visible resumes it without a time jump. */
      function onVisibilityChange(isHidden: boolean): void {
        if (!active) {
          return;
        }
        hidden = isHidden;
        if (hidden) {
          if (frameHandle !== null) {
            env.scheduler.cancel(frameHandle);
            frameHandle = null;
          }
          return;
        }
        frameBaselineMs = env.now();
        scheduleFrame();
      }

      function onResize(): void {
        applyViewport();
      }

      // Motion is applied before the first frame so the starting profile is the current one.
      engine.setReducedMotion(env.motion.matches());
      applyViewport();
      target.addEventListener('pointerdown', onPointerDown);
      target.addEventListener('pointerup', onPointerUp);
      target.addEventListener('pointercancel', onPointerCancel);
      env.keyTarget.addEventListener('keydown', onKeyDown);
      unsubscribers.push(env.motion.subscribe(onMotionChange));
      unsubscribers.push(env.visibility.subscribe(onVisibilityChange));
      unsubscribers.push(env.resize.subscribe(onResize));
      scheduleFrame();

      teardown = (): void => {
        if (frameHandle !== null) {
          env.scheduler.cancel(frameHandle);
          frameHandle = null;
        }
        target.removeEventListener('pointerdown', onPointerDown);
        target.removeEventListener('pointerup', onPointerUp);
        target.removeEventListener('pointercancel', onPointerCancel);
        env.keyTarget.removeEventListener('keydown', onKeyDown);
        for (const unsubscribe of unsubscribers.splice(0)) {
          unsubscribe();
        }
        adapter.dispose();
        view.dispose();
      };
    },

    dispose(): void {
      if (!active) {
        return;
      }
      active = false;
      teardown?.();
      teardown = null;
    },

    getSnapshot(): EngineSnapshot {
      return engine.getSnapshot();
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
