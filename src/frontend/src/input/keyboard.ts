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
 * The `playing` table (plan § Input interfaces, AC-7/AC-6):
 *
 * | key | event |
 * | --- | --- |
 * | `ArrowLeft` | `rotate` `yaw -1` |
 * | `ArrowRight` | `rotate` `yaw +1` |
 * | `ArrowUp` | `rotate` `pitch +1` |
 * | `ArrowDown` | `rotate` `pitch -1` |
 *
 * Those four arrow rows are the whole `playing` table: the keyboard mini-cube selection
 * feature was removed (spec AC-6, Option B), so `w`/`a`/`s`/`d`/`Enter`/space have no
 * binding and map to `null` like any other unbound key. Arrow names are matched exactly
 * (never case-folded). `ArrowUp` is `pitch +1` — the `top` face arrives at the front, the
 * same rotation `gestures.ts` produces for a *downward* drag: the arrows are the view-tilt
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
  return PLAYING_KEY_EVENTS.get(key) ?? null;
}
