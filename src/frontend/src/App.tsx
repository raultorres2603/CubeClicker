import { useState, useSyncExternalStore, type ReactElement } from 'react';

import { createAuthApi, type AuthApi } from './auth/api';
import { createAuthStore, type AuthStore } from './auth/store';
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
import { VerificationPending } from './ui/VerificationPending';
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

/** The intro gate's two rendered states: the choice overlay or gameplay. */
export type AuthGateView = 'menu' | 'closed';

/** The default view `AuthMenu` mounts with after the pending screen is dismissed. */
export type AuthMenuDefaultView = 'menu' | 'login';

export interface AuthGateSnapshot {
  view: AuthGateView;
  pendingEmail: string | null;
  menuDefaultView: AuthMenuDefaultView;
}

/**
 * The intro auth gate: the small state machine between the cinematic and the game.
 *
 * Why it lives outside React: a selection is an irreversible game-start action. The
 * gate makes each transition idempotent (a double click cannot join twice) and keeps
 * the join/reconnect side effects in one testable place. React subscribes through
 * `useSyncExternalStore`, exactly like the session and auth stores.
 */
export interface AuthGate {
  getSnapshot(): AuthGateSnapshot;
  subscribe(listener: () => void): () => void;
  /** `Play as guest`: join the current socket as an unauthenticated player. */
  playAsGuest(): void;
  /**
   * A verified login succeeded. The account is carried by the HTTP session cookie,
   * and the server resolves it at the WebSocket *upgrade*; the socket opened before
   * login therefore has no account. Reconnect (so the upgrade presents the new
   * cookie) and then choose account mode on the fresh socket.
   */
  loginSucceeded(): void;
  /** Registration or an unverified login: show "check your email" and never join. */
  verificationRequired(email: string): void;
  /** Dismiss the pending screen straight into the login form. */
  backToLogin(): void;
}

export interface AuthGateOptions {
  session: Pick<OnlineGameSession, 'join' | 'retryConnection'>;
  initiallyClosed?: boolean;
}

export function createAuthGate({
  session,
  initiallyClosed = false,
}: AuthGateOptions): AuthGate {
  let snapshot: AuthGateSnapshot = {
    view: initiallyClosed ? 'closed' : 'menu',
    pendingEmail: null,
    menuDefaultView: 'menu',
  };
  const listeners = new Set<() => void>();

  function publish(next: AuthGateSnapshot): void {
    if (
      snapshot.view === next.view &&
      snapshot.pendingEmail === next.pendingEmail &&
      snapshot.menuDefaultView === next.menuDefaultView
    ) {
      return;
    }
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function closed(): boolean {
    return snapshot.view === 'closed';
  }

  return {
    getSnapshot(): AuthGateSnapshot {
      return snapshot;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    playAsGuest(): void {
      if (closed()) {
        return;
      }
      // transport.join records the mode until the socket's `hello` arrives, so this is
      // safe even when the menu is clicked before the connection has opened.
      session.join('guest');
      publish({ view: 'closed', pendingEmail: null, menuDefaultView: 'menu' });
    },

    loginSucceeded(): void {
      if (closed()) {
        return;
      }
      session.retryConnection();
      session.join('account');
      publish({ view: 'closed', pendingEmail: null, menuDefaultView: 'menu' });
    },

    verificationRequired(email: string): void {
      if (closed()) {
        return;
      }
      publish({ view: 'menu', pendingEmail: email, menuDefaultView: 'menu' });
    },

    backToLogin(): void {
      publish({ view: 'menu', pendingEmail: null, menuDefaultView: 'login' });
    },
  };
}

function resolveGate(props: Record<string, unknown>): AuthGate | null {
  const candidate = props.gate ?? props.authGate;
  if (
    candidate !== null &&
    candidate !== undefined &&
    typeof candidate === 'object' &&
    typeof (candidate as { getSnapshot?: unknown }).getSnapshot === 'function' &&
    typeof (candidate as { subscribe?: unknown }).subscribe === 'function'
  ) {
    return candidate as AuthGate;
  }
  return null;
}

function isAuthApi(value: unknown): value is AuthApi {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false;
  }
  const api = value as { login?: unknown; register?: unknown; me?: unknown };
  return (
    typeof api.login === 'function' &&
    typeof api.register === 'function' &&
    typeof api.me === 'function'
  );
}

function isAuthStore(value: unknown): value is AuthStore {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false;
  }
  const store = value as { login?: unknown; register?: unknown };
  return typeof store.login === 'function' && typeof store.register === 'function';
}

export function App(props: Record<string, unknown> = {}): ReactElement {
  const { session: injectedSession, ...rest } = props as { session?: OnlineGameSession } & Record<string, unknown>;

  const [session] = useState<OnlineGameSession>(
    () => injectedSession ?? createGameSession({ transport: createTransport() }),
  );

  const suppliedApi = resolveApi(rest);
  const suppliedStore = resolveStore(rest);
  const suppliedStoreApi =
    suppliedStore !== null && typeof suppliedStore === 'object'
      ? (suppliedStore as { api?: unknown }).api
      : null;

  // The shell is the composition point for auth: default clients are created here when
  // the host (tests) does not inject them, and the same instances drive AuthMenu/AuthForms.
  const [api] = useState<AuthApi>(() => {
    if (isAuthApi(suppliedApi)) {
      return suppliedApi;
    }
    if (isAuthApi(suppliedStoreApi)) {
      return suppliedStoreApi;
    }
    return createAuthApi();
  });
  const [store] = useState<AuthStore>(() => {
    if (isAuthStore(suppliedStore)) {
      return suppliedStore;
    }
    return createAuthStore({ api });
  });

  const [gate] = useState<AuthGate>(() => {
    const injectedGate = resolveGate(rest);
    return injectedGate ?? createAuthGate({ session, initiallyClosed: initialChosen(rest) });
  });

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
  const gateState = useSyncExternalStore(gate.subscribe, gate.getSnapshot, gate.getSnapshot);
  const welcomed = world.serverId > 0;

  if (verify) {
    return (
      <main>
        <VerifyEmail token={token} api={api} store={store} />
        <p className="verify-email-continue">
          <a href="/">Continue to login</a>
        </p>
      </main>
    );
  }

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
      {gateState.view === 'menu' ? (
        gateState.pendingEmail !== null ? (
          <div
            className="auth-menu auth-pending"
            role="dialog"
            aria-modal="true"
            aria-label="Verify your email"
          >
            <section className="auth-panel">
              <VerificationPending
                email={gateState.pendingEmail}
                onResend={
                  typeof store.resend === 'function'
                    ? (email: string) => store.resend(email)
                    : undefined
                }
              />
              <button
                className="auth-button auth-button-secondary"
                type="button"
                onClick={gate.backToLogin}
              >
                Back to login
              </button>
            </section>
          </div>
        ) : (
          <AuthMenu
            key={gateState.menuDefaultView}
            defaultView={gateState.menuDefaultView}
            api={api}
            store={store}
            onPlayAsGuest={gate.playAsGuest}
            onLoginSuccess={gate.loginSucceeded}
            onRegisterSuccess={(data) => gate.verificationRequired(data.email ?? '')}
            onVerificationRequired={gate.verificationRequired}
          />
        )
      ) : null}
      <div className="phase-announcement" role="status" aria-live="polite">
        {announcementFor(snapshot, world, spectate)}
      </div>
    </main>
  );
}
