import { useState, useSyncExternalStore, type ReactElement } from 'react';

import type { EngineSnapshot } from './game/engine';
import { createGameSession, type OnlineGameSession } from './game/session';
import type { Phase } from './game/types';
import type { WorldState } from './multiplayer/server-state';
import type { SpectateStatus } from './multiplayer/spectate';
import { createTransport } from './multiplayer/transport';
import { ConnectionBanner } from './ui/ConnectionBanner';
import { GameCanvas } from './ui/GameCanvas';
import { Hud } from './ui/Hud';
import { UserPanel } from './ui/UserPanel';
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
 * The single live region's text (AC-14/AC-17, T14).
 *
 * The engine snapshot's `travelKind` is the authority for what a flight is: a camera-only
 * `spectate` flight to a member, a `return` flight home, or the level advance (including
 * the online pre-data hold, which keeps the generic travel copy). The member name comes
 * from the authoritative world roster; if the target left mid-flight the roster no longer
 * has it and the generic travel copy is used until the auto-return flight starts.
 */
function announcementFor(
  snapshot: EngineSnapshot,
  world: WorldState,
  spectate: SpectateStatus,
): string {
  if (snapshot.travelKind === 'spectate' && spectate.mode === 'traveling') {
    const target = world.members.find((member) => member.playerId === spectate.target);
    if (target !== undefined) {
      return `Traveling to ${target.name}'s cube…`;
    }
  }
  if (snapshot.travelKind === 'return') {
    return 'Returning to your cube…';
  }
  return PHASE_ANNOUNCEMENT[snapshot.phase];
}

/**
 * The game shell (AC-1, AC-11, AC-14, AC-16, AC-18, AC-22, AC-23, T14).
 *
 * One session per mount: the `useState` initializer runs once, so re-renders never build
 * another engine/scene/transport and the subscriptions below are stable. The shell reads
 * two stores:
 * - the session's engine snapshot (`stats`, phase, level) — the engine keeps that
 *   reference stable until a value changes, so the shell does not re-render per frame;
 * - the multiplayer store (transport status, authoritative world, spectate mode) — also
 *   referentially stable per change.
 *
 * Production is online-only (spec § 9): the default session is created with a real
 * `createTransport()`. The transport touches no socket until the canvas effect attaches
 * the session, so server rendering stays side-effect-free. `session` is an injection seam
 * for SSR tests (this workspace has no DOM test environment, plan D-5); tests pass a fake
 * `OnlineGameSession`.
 */
export function App({ session: injectedSession }: { session?: OnlineGameSession } = {}): ReactElement {
  const [session] = useState<OnlineGameSession>(
    () => injectedSession ?? createGameSession({ transport: createTransport() }),
  );
  const snapshot: EngineSnapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const { status, world, spectate } = useSyncExternalStore(
    session.subscribeMultiplayer,
    session.getMultiplayerSnapshot,
    session.getMultiplayerSnapshot,
  );

  return (
    <main>
      <GameCanvas session={session} />
      <Hud stats={snapshot.stats} levelIndex={snapshot.levelIndex} serverId={world.serverId} />
      <ConnectionBanner status={status} onRetry={session.retryConnection} />
      <UserPanel
        selfName={world.self.name}
        members={world.members}
        spectating={spectate.mode === 'viewing'}
        onSpectate={session.spectateMember}
        onReturn={session.returnToOwnCube}
      />
      {/*
        The single live region (AC-14, AC-17). Always rendered in every phase; the
        CSS-only treatment (app.css) keeps the empty `playing` state chrome-free without
        hiding the element from the accessibility tree.
      */}
      <div className="phase-announcement" role="status" aria-live="polite">
        {announcementFor(snapshot, world, spectate)}
      </div>
    </main>
  );
}
