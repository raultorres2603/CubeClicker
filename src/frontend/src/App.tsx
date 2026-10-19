import { useState, useSyncExternalStore, type ReactElement } from 'react';

import type { EngineSnapshot } from './game/engine';
import { createGameSession, type GameSession } from './game/session';
import type { Phase } from './game/types';
import { GameCanvas } from './ui/GameCanvas';
import { Hud } from './ui/Hud';
import './ui/app.css';

/**
 * Pinned phase copy (AC-14). This one live region is the only announcement source:
 * `intro` also serves as the visible skip hint, `travel` narrates the galaxy transition,
 * and `playing` is represented by empty text content — never by removing the element.
 */
const PHASE_ANNOUNCEMENT: Record<Phase, string> = {
  intro: 'Click or press any key to skip',
  travel: 'Traveling to the next cube…',
  playing: '',
};

/**
 * The game shell (AC-1, AC-11, AC-14, T14).
 *
 * One session per mount: the `useState` initializer runs once, so re-renders never build
 * another engine/scene and the subscription below is stable. `useSyncExternalStore`
 * reads the session snapshot — the engine keeps that reference stable until a value
 * changes (AC-11), so the shell re-renders only when stats/phase/level do (never per
 * frame). The same `getSnapshot` doubles as the server snapshot: rendering the shell has
 * no browser side effects, and the canvas effect is what attaches the runtime.
 *
 * `session` is an injection seam for SSR tests (this workspace has no DOM test
 * environment, plan D-5): production code omits it and gets the real browser session.
 */
export function App({ session: injectedSession }: { session?: GameSession } = {}): ReactElement {
  const [session] = useState<GameSession>(() => injectedSession ?? createGameSession());
  const snapshot: EngineSnapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  return (
    <main>
      <GameCanvas session={session} />
      <Hud stats={snapshot.stats} levelIndex={snapshot.levelIndex} />
      {/*
        The single live region (AC-14). Always rendered in every phase; the CSS-only
        treatment (app.css) keeps the empty `playing` state chrome-free without hiding
        the element from the accessibility tree.
      */}
      <div className="phase-announcement" role="status" aria-live="polite">
        {PHASE_ANNOUNCEMENT[snapshot.phase]}
      </div>
    </main>
  );
}
