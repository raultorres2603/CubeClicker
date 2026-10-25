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
import { AuthMenu } from './ui/AuthMenu';
import { VerifyEmail } from './ui/VerifyEmail';
import './ui/app.css';

const PHASE_ANNOUNCEMENT: Record<Phase, string> = {
  intro: 'Click or press any key to skip',
  travel: 'Traveling to the next cube…',
  playing: '',
};

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

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function resolveTokenFromSearch(search: unknown): string | null {
  if (search === null || search === undefined) return null;
  if (typeof search === 'string') {
    try {
      const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
      const t = params.get('token');
      if (t !== null) return t;
    } catch {
      // ignore
    }
    const match = search.match(/[?&]token=([^&]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    return null;
  }
  if (typeof search === 'object') {
    const obj = search as Record<string, unknown>;
    for (const key of ['token', 'verifyToken', 'verificationToken', 'verify_token']) {
      const v = asString(obj[key]);
      if (v !== null) return v;
    }
    if (obj.search !== undefined) return resolveTokenFromSearch(obj.search);
    if (obj.query !== undefined) return resolveTokenFromSearch(obj.query);
  }
  return null;
}

function resolveTokenFromPath(path: unknown): string | null {
  const s = asString(path);
  if (s === null) return null;
  const qIndex = s.indexOf('?');
  if (qIndex >= 0) {
    const t = resolveTokenFromSearch(s.slice(qIndex));
    if (t !== null) return t;
  }
  const match = s.match(/verify\/([^/?#]+)/i);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

function resolveVerifyToken(props: Record<string, unknown>): string | null {
  for (const key of ['verifyToken', 'verificationToken', 'verify_token', 'token']) {
    const v = asString(props[key]);
    if (v !== null) return v;
  }
  if (props.verify && typeof props.verify === 'string') return props.verify as string;
  for (const key of ['path', 'pathname', 'route', 'location', 'url', 'href']) {
    const t = resolveTokenFromPath(props[key]);
    if (t !== null) return t;
  }
  for (const key of ['search', 'query']) {
    const t = resolveTokenFromSearch(props[key]);
    if (t !== null) return t;
  }
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token');
      if (t !== null) return t;
    } catch {
      // ignore
    }
  }
  return null;
}

function isVerifyRoute(props: Record<string, unknown>): boolean {
  for (const key of ['verify', 'verifyEmail', 'verifyRoute', 'isVerify', 'verifyPage', 'emailVerification', 'verifyEmailRoute']) {
    if (props[key] === true) return true;
    const v = asString(props[key]);
    if (v !== null && /verify/i.test(v)) return true;
  }
  for (const key of ['path', 'pathname', 'route', 'location', 'url', 'href']) {
    const v = asString(props[key]);
    if (v !== null && /verify/i.test(v)) return true;
  }
  if (typeof window !== 'undefined') {
    try {
      if (window.location.pathname.includes('verify')) return true;
      if (window.location.search.includes('token=')) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

function resolveApi(props: Record<string, unknown>): unknown {
  return props.api ?? props.authApi ?? props.authClient ?? props.client ?? null;
}

function resolveStore(props: Record<string, unknown>): unknown {
  return props.store ?? props.authStore ?? props.authState ?? null;
}

function initialChosen(props: Record<string, unknown>): boolean {
  if (props.chosen === true || props.hasChosen === true || props.authChosen === true || props.authResolved === true || props.resolved === true) {
    return true;
  }
  if (props.guest === true || props.isGuest === true || props.playedAsGuest === true || props.asGuest === true) {
    return true;
  }
  for (const key of ['authChoice', 'choice', 'authMode', 'mode', 'selectedAuth', 'auth']) {
    const v = asString(props[key]);
    if (v === 'guest') return true;
  }
  if (props.menuOpen === false || props.showMenu === false || props.showAuthMenu === false) return true;
  return false;
}

export function App(props: Record<string, unknown> = {}): ReactElement {
  const { session: injectedSession, ...rest } = props as { session?: OnlineGameSession } & Record<string, unknown>;

  const [chosen, setChosen] = useState<boolean>(() => initialChosen(rest));
  const [menuOpen, setMenuOpen] = useState<boolean>(() => !initialChosen(rest));

  const [session] = useState<OnlineGameSession>(
    () => injectedSession ?? createGameSession({ transport: createTransport() }),
  );

  const token = resolveVerifyToken(rest);
  const verify = isVerifyRoute(rest) || token !== null;

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
  const welcomed = world.serverId > 0;

  if (verify) {
    return (
      <main>
        <VerifyEmail token={token} api={resolveApi(rest) as any} store={resolveStore(rest) as any} />
      </main>
    );
  }

  const api = resolveApi(rest);
  const store = resolveStore(rest);

  return (
    <main>
      <GameCanvas session={session} />
      {welcomed ? (
        <Hud stats={snapshot.stats} levelIndex={snapshot.levelIndex} serverId={world.serverId} />
      ) : (
        <section aria-label="Game statistics">
          <p>
            Clicks: <span data-stat="clicks">{snapshot.stats.clicks}</span>
          </p>
          <p>
            Faces destroyed:{' '}
            <span data-stat="faces-destroyed">{snapshot.stats.facesDestroyed}</span>
          </p>
          <p>
            Cube <span data-stat="cube">{snapshot.levelIndex + 1}</span>
          </p>
        </section>
      )}
      <ConnectionBanner status={status} onRetry={session.retryConnection} />
      <UserPanel
        welcomed={welcomed}
        selfName={world.self.name}
        members={world.members}
        spectating={spectate.mode === 'viewing'}
        onSpectate={session.spectateMember}
        onReturn={session.returnToOwnCube}
      />
      {menuOpen && !chosen ? (
        <AuthMenu
          api={api as any}
          store={store as any}
          onPlayAsGuest={() => {
            setChosen(true);
            setMenuOpen(false);
          }}
          onGuest={() => {
            setChosen(true);
            setMenuOpen(false);
          }}
          onChoose={(mode) => {
            if (mode === 'guest') {
              setChosen(true);
              setMenuOpen(false);
            }
          }}
        />
      ) : null}
      <div className="phase-announcement" role="status" aria-live="polite">
        {announcementFor(snapshot, world, spectate)}
      </div>
    </main>
  );
}
