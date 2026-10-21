/**
 * Pointer gesture classification (T11).
 *
 * Pure function over plain numbers: no DOM, no listeners, no globals — the session
 * (T13) owns the Pointer Events, converts `clientX`/`clientY` into rect-relative
 * positions and applies the phase policy. This module only answers *what did the
 * player do?*: a `tap` (with the NDC position to pick with), a `drag` (ignored by the
 * session — pointer rotation was removed; the `axis`/`direction` payload remains the
 * classification contract), or `null` (an unclassifiable gesture, see below).
 *
 * **Threshold (AC-6).** Judged on the Euclidean pointer travel between the press and
 * the current position. Travel **up to and including** {@link TAP_DRAG_THRESHOLD_PX}
 * (40 px; imported from `game/effects.ts`, never redefined here) is a `tap`; strictly
 * beyond it is a `drag`. The boundary cases are pinned by test: 39 px → tap,
 * 40 px → tap, 41 px → drag. The doc comment beside the constant in `effects.ts`
 * states the same inclusive form (plan-r3 correction of the mismatch the T11 build
 * log flagged).
 *
 * **Direction sign convention (classification only — the session ignores drags).** The
 * payload keeps the predecessor's frame so the classification contract is unchanged.
 * `direction` is the sign of the gesture's displacement along the dominant axis, which
 * would make grabbed content follow the pointer:
 *
 * - drag towards the player's right (`dx > 0`) → `yaw +1`, i.e. `+90°` about `+Y`,
 *   which slides the front face to the player's right;
 * - drag downwards (`dy > 0` in screen coordinates) → `pitch +1`, i.e. `+90°` about
 *   `+X`, which slides the front face downwards as the `top` face tilts in.
 *
 * Dominant axis: the larger of `|dx|`/`|dy|`; an exact tie takes the horizontal
 * (`yaw`) axis so the choice is deterministic. Both components of a diagonal drag
 * stay within one rotation step, per AC-6 ("one step per gesture").
 *
 * **NDC.** `ndcX = x / width * 2 - 1` and `ndcY = 1 - y / height * 2`, computed from
 * the gesture's *current* (release) position and from positions already relative to
 * the rect's top-left corner (`rect` carries only `width`/`height`, so the session
 * subtracts the rect origin). `[-1, 1]` holds for pointers inside the rect; a pointer
 * that left the rect maps beyond `±1` and is deliberately not clamped, so a pick
 * there misses the cube instead of snapping to an edge.
 *
 * **`null`.** A `tap` needs a non-degenerate rect: with `width`/`height` ≤ 0 the NDC
 * position is undefined (and a real session can hit this before first layout), so the
 * gesture is `null` and the session dispatches nothing. A `drag` needs no rect and is
 * still classified; so is a zero-travel press/release (travel 0 ≤ threshold → tap).
 */

import { TAP_DRAG_THRESHOLD_PX } from '../game/effects';
import type { Axis } from '../game/rotation';

/**
 * What one pointer gesture means. `null` = nothing the engine can act on (see the
 * module doc's `null` section).
 */
export type PointerGesture =
  | { kind: 'tap'; ndcX: number; ndcY: number }
  | { kind: 'drag'; axis: Axis; direction: -1 | 1 }
  | null;

/**
 * Classifies one pointer gesture from its press position (`start`), its current
 * position (`current`) and the surface it happened on (`rect`). Both positions are
 * rect-relative; phase-agnostic (the session applies the phase policy).
 */
export function classifyPointer(
  start: { x: number; y: number },
  current: { x: number; y: number },
  rect: { width: number; height: number },
): PointerGesture {
  const dx = current.x - start.x;
  const dy = current.y - start.y;

  if (Math.hypot(dx, dy) <= TAP_DRAG_THRESHOLD_PX) {
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      kind: 'tap',
      ndcX: (current.x / rect.width) * 2 - 1,
      ndcY: 1 - (current.y / rect.height) * 2,
    };
  }

  // Beyond the threshold both components cannot be zero, so the sign is always ±1.
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { kind: 'drag', axis: 'yaw', direction: dx > 0 ? 1 : -1 };
  }
  return { kind: 'drag', axis: 'pitch', direction: dy > 0 ? 1 : -1 };
}
