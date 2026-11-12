import { useEffect, useRef, type ReactElement } from 'react';

import type { GameSession } from '../game/session';

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
 */
export function GameCanvas({
  session,
  active,
}: {
  session: GameSession;
  active: boolean;
}): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      aria-label="Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube"
      style={{ touchAction: 'none' }}
    />
  );
}
