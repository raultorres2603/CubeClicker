/**
 * The spectate state machine (T7).
 *
 * Pure and DOM-free: a tiny status record plus the transitions the session drives. It owns
 * *which* cube the camera is on (none / flying to a member / viewing a member / flying
 * home) and nothing else — positions always come from the server, the flight itself is the
 * engine/scene's (spec § 6, § 9: camera and spectate state are client-local by design).
 *
 * Pinned rules implemented here:
 * - one travel at a time: a `requestTravel` (or `requestReturn`) issued while a travel is in
 *   flight is refused with `false` and leaves the status untouched (AC-17);
 * - `arrive()` is the flight landing: a member flight enters `viewing`, a return flight ends
 *   at `none`; calling it in a resting mode is a no-op (same reference);
 * - `onMemberLeft(playerId)` reports (and ends) the auto-return when the *viewed or
 *   travelled* member leaves (AC-19 a/b). It cannot itself start the return flight: the
 *   controller holds no own position, so it answers `true` and drops to `none`, and the
 *   session — which knows the own cube's position — dispatches the `return` travel;
 * - `arrivedHome()`/`reset()` force the resting `none` mode (reconnect view reset, AC-19 d).
 */

import type { Position } from './protocol';

export type { Position };

/** Where the spectator view is right now. */
export type SpectateStatus =
  | { mode: 'none' }
  | { mode: 'traveling'; target: string; destination: Position }
  | { mode: 'viewing'; target: string }
  | { mode: 'returning'; destination: Position };

/** The machine's handle: status read plus the transitions the session calls. */
export interface SpectateController {
  get(): SpectateStatus;
  /** Starts a member flight; `false` (no change) while another travel is in flight. */
  requestTravel(targetId: string, destination: Position): boolean;
  /** A member flight landed: `traveling` → `viewing`; a return flight landed: → `none`. */
  arrive(): void;
  /** Starts the flight home from `viewing`; `false` in every other mode. */
  requestReturn(ownPosition: Position): boolean;
  /** Forces the resting `none` mode (idempotent). */
  arrivedHome(): void;
  /** `true` (and drops to `none`) when the viewed/travelled member left; else `false`. */
  onMemberLeft(playerId: string): boolean;
  /** Clears every spectate state (reconnect); idempotent. */
  reset(): void;
}

/** Creates one spectate machine, resting at `none` (no view yet). */
export function createSpectateController(): SpectateController {
  let status: SpectateStatus = { mode: 'none' };

  return {
    get(): SpectateStatus {
      return status;
    },

    requestTravel(targetId: string, destination: Position): boolean {
      if (status.mode === 'traveling' || status.mode === 'returning') {
        return false;
      }
      status = {
        mode: 'traveling',
        target: targetId,
        destination: { x: destination.x, y: destination.y },
      };
      return true;
    },

    arrive(): void {
      if (status.mode === 'traveling') {
        status = { mode: 'viewing', target: status.target };
        return;
      }
      if (status.mode === 'returning') {
        status = { mode: 'none' };
      }
    },

    requestReturn(ownPosition: Position): boolean {
      if (status.mode !== 'viewing') {
        return false;
      }
      status = { mode: 'returning', destination: { x: ownPosition.x, y: ownPosition.y } };
      return true;
    },

    arrivedHome(): void {
      if (status.mode !== 'none') {
        status = { mode: 'none' };
      }
    },

    onMemberLeft(playerId: string): boolean {
      if (
        (status.mode === 'viewing' || status.mode === 'traveling') &&
        status.target === playerId
      ) {
        status = { mode: 'none' };
        return true;
      }
      return false;
    },

    reset(): void {
      if (status.mode !== 'none') {
        status = { mode: 'none' };
      }
    },
  };
}
