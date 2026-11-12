import { useEffect, useRef, useSyncExternalStore, type ReactElement } from 'react';

import type { GameSession, RuntimeStatus } from '../game/session';

/**
 * Module-level fallbacks for sessions that predate the runtime-status seam (existing test
 * fakes). A session without the optional store is treated as already ready, so the canvas
 * contract is unchanged for it and no status chrome is rendered.
 */
const NOOP_UNSUBSCRIBE = (): void => {};

function subscribeRuntimeNoop(): () => void {
  return NOOP_UNSUBSCRIBE;
}

function getRuntimeStatusReady(): RuntimeStatus {
  return 'ready';
}

/**
 * The game's drawing surface (AC-1, AC-13, T14).
 *
 * The canvas is focusable (`tabIndex={0}`) so keyboard players have a visible focus
 * target; the session listens for keys on the window, but the focus ring is what tells a
 * keyboard player where play happens. `touchAction: 'none'` (AC-13) stops the browser
 * from consuming drags as scroll/zoom gestures, keeping Pointer Events the single input
 * path.
 *
 * The effect is deliberately thin: the session owns the runtime and its whole lifecycle;
 * this component only starts it against the real canvas element and disposes it on
 * unmount or when it goes inactive. The `active` gate keeps the canvas mounted (layout
 * and SSR markup unchanged) while the renderer, the scene and the rAF loop wait for the
 * auth gate to close (AC-1, AC-3, AC-4, AC-13). SSR never executes the effect (no DOM),
 * which is the documented React residual (spec § Testing strategy).
 *
 * The runtime-environment status (AC-2) is read through the same external-store pattern
 * the shell uses for the engine: a pending dynamic import renders the pinned loading
 * status, a rejected one renders the pinned alert with a retry that re-attaches the
 * session. Both are `active`-gated, so the menu never shows game chrome, and the
 * `<canvas>` element itself is never conditionally rendered.
 */
export function GameCanvas({
  session,
  active,
}: {
  session: GameSession;
  active: boolean;
}): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeStatus = useSyncExternalStore(
    session.subscribeRuntime ?? subscribeRuntimeNoop,
    session.getRuntimeStatus ?? getRuntimeStatusReady,
    session.getRuntimeStatus ?? getRuntimeStatusReady,
  );

  useEffect(() => {
    if (!active) {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    session.attach(canvas);
    return () => {
      session.dispose();
    };
  }, [session, active]);

  const retry = (): void => {
    const canvas = canvasRef.current;
    if (canvas !== null) {
      session.attach(canvas);
    }
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube"
        style={{ touchAction: 'none' }}
      />
      {active && runtimeStatus === 'loading' ? (
        <p className="game-runtime-status" role="status">
          Loading the game…
        </p>
      ) : null}
      {active && runtimeStatus === 'error' ? (
        <div className="game-runtime-error" role="alert">
          The game could not be loaded.{' '}
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}
    </>
  );
}
