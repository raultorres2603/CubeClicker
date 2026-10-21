/**
 * Keyboard → engine event mapping (T11).
 *
 * A pure table lookup: no DOM, no listeners — the session (T13) attaches the key
 * listener and forwards `KeyboardEvent.key` plus the current phase.
 *
 * **Phase policy** (plan § Input interfaces, spec § Loading / § Rotation):
 *
 * - `intro` — **any** key is `introSkip` (the visible hint is "Click or press any key
 *   to skip"), unknown keys included;
 * - `travel` — every key is `null` (input is ignored for the whole transition);
 * - `playing` — the pinned table below; anything else is `null`.
 *
 * The `playing` table (plan § Input interfaces, AC-3):
 *
 * | key | event |
 * | --- | --- |
 * | `w` / `W` | `rotate` `pitch +1` |
 * | `a` / `A` | `rotate` `yaw -1` |
 * | `s` / `S` | `rotate` `pitch -1` |
 * | `d` / `D` | `rotate` `yaw +1` |
 * | `ArrowLeft` | `rotate` `yaw -1` |
 * | `ArrowRight` | `rotate` `yaw +1` |
 * | `ArrowUp` | `rotate` `pitch +1` |
 * | `ArrowDown` | `rotate` `pitch -1` |
 *
 * W/A/S/D mean the same four rotation steps as the arrows (W = `ArrowUp`, A =
 * `ArrowLeft`, S = `ArrowDown`, D = `ArrowRight`), so either muscle memory rotates the
 * cube. Case-insensitivity is a lookup rule, not extra table rows: single-character
 * keys are lowercased and looked up again when the raw key is absent. Arrow names are
 * multi-character and matched exactly, never case-folded, so `ARROWLEFT`/`arrowleft`
 * stay `null` (cube-game-frontend AC-7's exactness contract).
 *
 * `Enter`, space and every other unbound key map to `null`: the keyboard mini-cube
 * selection cursor stays removed (cube-visual-polish AC-6) and is not reintroduced by
 * the WASD rows. `ArrowUp` is `pitch +1` — the `top` face arrives at the front, the
 * same rotation `gestures.ts` produces for a *downward* drag: the keys are the view-tilt
 * reading of the cube, the pointer is content-follows-finger. Both directions are pinned
 * by the plan's tables.
 *
 * The table holds shared immutable event objects (the engine only reads them), so
 * mapping a key allocates nothing.
 */

import type { GameEvent } from '../game/engine';
import type { Phase } from '../game/types';

/** The one event the `intro` phase produces, for any key at all. */
const INTRO_SKIP: GameEvent = { type: 'introSkip' };

/** Every key the `playing` phase reacts to, by `KeyboardEvent.key`. */
const PLAYING_KEY_EVENTS: ReadonlyMap<string, GameEvent> = new Map<string, GameEvent>([
  ['w', { type: 'rotate', axis: 'pitch', direction: 1 }],
  ['a', { type: 'rotate', axis: 'yaw', direction: -1 }],
  ['s', { type: 'rotate', axis: 'pitch', direction: -1 }],
  ['d', { type: 'rotate', axis: 'yaw', direction: 1 }],
  ['ArrowLeft', { type: 'rotate', axis: 'yaw', direction: -1 }],
  ['ArrowRight', { type: 'rotate', axis: 'yaw', direction: 1 }],
  ['ArrowUp', { type: 'rotate', axis: 'pitch', direction: 1 }],
  ['ArrowDown', { type: 'rotate', axis: 'pitch', direction: -1 }],
]);

/**
 * Maps one key press to the engine event it means in `phase`, or `null` when the
 * phase ignores keys or the key is not bound in this phase.
 */
export function mapKey(key: string, phase: Phase): GameEvent | null {
  if (phase === 'intro') {
    return INTRO_SKIP;
  }
  if (phase === 'travel') {
    return null;
  }
  const direct = PLAYING_KEY_EVENTS.get(key);
  if (direct !== undefined) {
    return direct;
  }
  // Case-insensitivity for the letter keys only: a single character is retried
  // lowercased, while named keys (`ArrowLeft`, `Enter`, …) are matched exactly.
  if (key.length === 1) {
    return PLAYING_KEY_EVENTS.get(key.toLowerCase()) ?? null;
  }
  return null;
}
