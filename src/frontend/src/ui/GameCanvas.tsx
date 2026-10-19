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
 * unmount. SSR never executes the effect (no DOM), which is the documented React
 * residual (spec § Testing strategy).
 */
export function GameCanvas({ session }: { session: GameSession }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    session.attach(canvas);
    return () => {
      session.dispose();
    };
  }, [session]);

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      aria-label="Game canvas: drag or press arrow keys to rotate, W A S D to select a mini-cube, Enter or Space to explode it"
      style={{ touchAction: 'none' }}
    />
  );
}
