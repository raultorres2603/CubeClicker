/**
 * Dev-only performance overlay flag (T4; spec AC-19, AC-24).
 *
 * Layer: `perf/**` — the build-time switch and the frame-stat shape the overlay renders.
 * The module is pure and dependency-free (one type-only import): no session import, no
 * DOM, no timers, no three.js. `App` reads {@link isPerfOverlayEnabled} and renders
 * `ui/PerfOverlay` only when it is `true`; the session's `measureRtt` stays flag-agnostic,
 * so the gate is asserted at the App boundary (AC-19).
 *
 * The flag is strict: only the exact string `'true'` enables the overlay. `undefined`,
 * `''`, `'1'`, `'TRUE'` and `'yes'` stay off, so a typo can never ship debug UI. Vite
 * inlines `import.meta.env.VITE_PERF_OVERLAY` at build time: the production build leaves
 * it unset and renders nothing (AC-24); enabling the overlay in local development takes a
 * dev-server restart, not a runtime toggle.
 */

import type { QualityTier } from '../render/quality';

/** The environment variable that enables the dev overlay (default `false`). */
export const PERF_OVERLAY_ENV_VAR = 'VITE_PERF_OVERLAY';

/**
 * The latest frame values the overlay renders.
 *
 * `session.getPerfStats()` fills it from the frame loop (frame delta, the current quality
 * tier, and the renderer adapter's `renderer.info.render` calls/triangles).
 */
export interface PerfStats {
  /** The frame delta in milliseconds, as measured by the session loop. */
  frameMs: number;
  /** The current adaptive quality tier. */
  tier: QualityTier;
  /** `renderer.info.render.calls` for the frame (composer passes included). */
  drawCalls: number;
  /** `renderer.info.render.triangles` for the frame. */
  triangles: number;
}

/**
 * True only for `VITE_PERF_OVERLAY === 'true'`.
 *
 * `env` defaults to Vite's `import.meta.env`; callers inject an explicit record in tests.
 */
export function isPerfOverlayEnabled(
  env: Record<string, unknown> = import.meta.env as unknown as Record<string, unknown>,
): boolean {
  return env[PERF_OVERLAY_ENV_VAR] === 'true';
}
