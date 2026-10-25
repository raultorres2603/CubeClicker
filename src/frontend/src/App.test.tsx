import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { createBoard } from './game/board';
import type { EngineSnapshot } from './game/engine';
import { CUBE_STYLES } from './game/progression';
import type { MultiplayerSnapshot, OnlineGameSession } from './game/session';
import { GRID_SIZE, type GameStats, type Phase } from './game/types';
import type { MemberState } from './multiplayer/protocol';
import type { WorldState } from './multiplayer/server-state';

/**
 * Integration test for the game shell (AC-1, AC-11, AC-14, AC-16, AC-18, AC-22, AC-23,
 * T14): the real `App`, `Hud`, `UserPanel`, `ConnectionBanner` and `GameCanvas` composed in
 * the workspace's node test environment.
 *
 * SSR executes the render path only; the canvas attach/dispose effect never runs (the
 * documented React residual, spec § Testing strategy). To pin the markup per phase /
 * connection / roster / spectate state without a DOM, the shell accepts an injected
 * `OnlineGameSession` — the same dependency-injection shape the session itself uses.
 */

const ARIA_LABEL =
  'Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube';

const BANNER_CONNECTING = '<div class="connection-banner">Connecting…</div>';
const BANNER_RETRYING = '<div class="connection-banner">Connection lost — retrying…</div>';
const BANNER_EXHAUSTED =
  '<div class="connection-banner">' +
  '<span>Connection lost</span>' +
  '<button type="button">Retry</button>' +
  '</div>';

const PANEL_CLOSED =
  '<div class="user-panel">' +
  '<button type="button" aria-expanded="false">Users on Server</button>' +
  '</div>';
const PANEL_CLOSED_WITH_RETURN =
  '<div class="user-panel">' +
  '<button type="button" aria-expanded="false">Users on Server</button>' +
  '<button type="button">Return to my cube</button>' +
  '</div>';

function snapshotFor(
  phase: Phase,
  stats: GameStats = { clicks: 0, facesDestroyed: 0 },
  levelIndex = 0,
  overrides: Partial<EngineSnapshot> = {},
): EngineSnapshot {
  return {
    phase,
    phaseProgress: phase === 'playing' ? 1 : 0,
    stats,
    levelIndex,
    style: CUBE_STYLES[levelIndex % CUBE_STYLES.length],
    orientation: { yawSteps: 0, pitchSteps: 0 },
    rotationFrom: null,
    rotationProgress: 1,
    board: createBoard(),
    gridSize: GRID_SIZE,
    travelDirection: null,
    travelKind: null,
    travelDestination: null,
    spectating: false,
    reducedMotion: false,
    ...overrides,
  };
}

function member(playerId: string, name: string, levelIndex: number): MemberState {
  return {
    playerId,
    name,
    position: { x: 24, y: 0 },
    levelIndex,
    gridSize: 3,
    styleId: 'obsidian-neon',
    removedIds: [],
    yawSteps: 0,
    pitchSteps: 0,
  };
}

function worldFor({
  serverId = 1,
  selfName = 'Player 1',
  members = [],
}: {
  serverId?: number;
  selfName?: string;
  members?: MemberState[];
} = {}): WorldState {
  return {
    serverId,
    maxUsers: 10,
    self: {
      playerId: 'p1',
      name: selfName,
      position: { x: 24, y: 0 },
      cube: { levelIndex: 0, gridSize: 3, styleId: 'obsidian-neon', removedIds: [], yawSteps: 0, pitchSteps: 0 },
    },
    members,
    pendingWorldSwap: null,
  };
}

function multiplayerFor(overrides: Partial<MultiplayerSnapshot> = {}): MultiplayerSnapshot {
  return {
    status: 'connected',
    world: worldFor(),
    spectate: { mode: 'none' },
    ...overrides,
  };
}

/** A session boundary fake: the shell only reads the two stores under SSR. */
function sessionFor(
  snapshot: EngineSnapshot,
  multiplayer: MultiplayerSnapshot,
): OnlineGameSession {
  return {
    attach: () => {},
    dispose: () => {},
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    getMultiplayerSnapshot: () => multiplayer,
    subscribeMultiplayer: () => () => {},
    spectateMember: () => false,
    returnToOwnCube: () => false,
    retryConnection: () => {},
    join: () => {},
  };
}

/** Counts exact occurrences of a literal in the rendered markup (live-region uniqueness). */
function occurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/** The shell markup with the store's server id, banner, panel and live-region copy filled in. */
function shellHtml({
  serverId,
  banner,
  panel = PANEL_CLOSED,
  regionText,
  stats = { clicks: 0, facesDestroyed: 0 },
  levelIndex = 0,
}: {
  serverId: number;
  banner: string;
  panel?: string;
  regionText: string;
  stats?: GameStats;
  levelIndex?: number;
}): string {
  // `serverId` doubles as the welcomed signal (F7): before the first `welcome` the shell
  // renders the stats without the server line and no users panel at all.
  const welcomed = serverId > 0;
  return (
    `<main><canvas tabindex="0" aria-label="${ARIA_LABEL}" style="touch-action:none"></canvas>` +
    '<section aria-label="Game statistics">' +
    `<p>Clicks: <span data-stat="clicks">${stats.clicks}</span></p>` +
    `<p>Faces destroyed: <span data-stat="faces-destroyed">${stats.facesDestroyed}</span></p>` +
    `<p>Cube <span data-stat="cube">${levelIndex + 1}</span></p>` +
    (welcomed ? `<p>Server <span data-stat="server">${serverId}</span></p>` : '') +
    '</section>' +
    banner +
    (welcomed ? panel : '') +
    `<div class="phase-announcement" role="status" aria-live="polite">${regionText}</div>` +
    '</main>'
  );
}

describe('App', () => {
  it('renders the full intro shell on first paint (default online session, no DOM)', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toBe(
      shellHtml({
        serverId: 0,
        banner: BANNER_CONNECTING,
        regionText: 'Click or press any key to skip',
      }),
    );
    // The default production session is online: it starts in `connecting` and has no
    // server assigned until the first `welcome` (spec § 9). Pre-welcome the shell shows no
    // `Server 0` line and no users panel (F7).
    expect(html).not.toContain('data-stat="server"');
    expect(html).not.toContain('Users on Server');
    expect(occurrences(html, '<section aria-label="Game statistics">')).toBe(1);
  });

  it('keeps the stats visible without a server line before the first welcome (F7)', () => {
    const html = renderToStaticMarkup(
      <App
        session={sessionFor(
          snapshotFor('playing', { clicks: 3, facesDestroyed: 1 }, 2),
          multiplayerFor({ world: worldFor({ serverId: 0, selfName: '' }) }),
        )}
      />,
    );

    expect(html).toBe(
      shellHtml({
        serverId: 0,
        banner: '',
        stats: { clicks: 3, facesDestroyed: 1 },
        levelIndex: 2,
        regionText: '',
      }),
    );
    expect(html).toContain('<p>Cube <span data-stat="cube">3</span></p>');
  });

  it('renders the travel phase copy in the same single live region', () => {
    const html = renderToStaticMarkup(
      <App
        session={sessionFor(
          snapshotFor('travel', undefined, 0, {
            travelKind: 'nextLevel',
            travelDestination: { x: 24, y: 0 },
          }),
          multiplayerFor(),
        )}
      />,
    );

    expect(html).toBe(
      shellHtml({ serverId: 1, banner: '', regionText: 'Traveling to the next cube…' }),
    );
  });

  it('announces a spectate flight with the target member name (AC-17)', () => {
    const world = worldFor({ members: [member('p2', 'Player 2', 1)] });
    const html = renderToStaticMarkup(
      <App
        session={sessionFor(
          snapshotFor('travel', undefined, 0, {
            travelKind: 'spectate',
            travelDestination: { x: 24, y: 0 },
          }),
          multiplayerFor({
            world,
            spectate: { mode: 'traveling', target: 'p2', destination: { x: 24, y: 0 } },
          }),
        )}
      />,
    );

    expect(html).toBe(
      shellHtml({
        serverId: 1,
        banner: '',
        // React escapes the apostrophe in text content; the announcement itself is
        // `Traveling to Player 2's cube…`.
        regionText: 'Traveling to Player 2&#x27;s cube…',
      }),
    );
  });

  it('announces the return flight with the pinned copy (AC-18)', () => {
    const html = renderToStaticMarkup(
      <App
        session={sessionFor(
          snapshotFor('travel', undefined, 0, {
            travelKind: 'return',
            travelDestination: { x: 0, y: 0 },
          }),
          multiplayerFor({
            spectate: { mode: 'returning', destination: { x: 0, y: 0 } },
          }),
        )}
      />,
    );

    expect(html).toBe(
      shellHtml({ serverId: 1, banner: '', regionText: 'Returning to your cube…' }),
    );
  });

  it('renders the playing phase with an empty live region that is still present', () => {
    const html = renderToStaticMarkup(
      <App session={sessionFor(snapshotFor('playing'), multiplayerFor())} />,
    );

    // AC-14: `playing` is empty text content — the element is neither removed nor hidden.
    expect(html).toBe(shellHtml({ serverId: 1, banner: '', regionText: '' }));
    expect(html).not.toContain('hidden');
    expect(occurrences(html, 'role="status"')).toBe(1);
  });

  it('binds the HUD to the engine snapshot and the server id to the multiplayer store (AC-11, AC-23)', () => {
    const snapshot = snapshotFor('playing', { clicks: 12, facesDestroyed: 4 }, 3);
    const html = renderToStaticMarkup(
      <App
        session={sessionFor(snapshot, multiplayerFor({ world: worldFor({ serverId: 7 }) }))}
      />,
    );

    expect(html).toContain('<p>Clicks: <span data-stat="clicks">12</span></p>');
    expect(html).toContain('<p>Faces destroyed: <span data-stat="faces-destroyed">4</span></p>');
    expect(html).toContain('<p>Cube <span data-stat="cube">4</span></p>');
    expect(html).toContain('<p>Server <span data-stat="server">7</span></p>');
    // Still exactly one live region in the shell (AC-14).
    expect(occurrences(html, 'aria-live=')).toBe(1);
  });

  it('renders Return to my cube in the shell exactly while spectating (AC-18)', () => {
    const world = worldFor({ members: [member('p2', 'Player 2', 1)] });
    const spectating = renderToStaticMarkup(
      <App
        session={sessionFor(
          snapshotFor('playing', undefined, 0, { spectating: true }),
          multiplayerFor({ world, spectate: { mode: 'viewing', target: 'p2' } }),
        )}
      />,
    );

    expect(spectating).toBe(
      shellHtml({
        serverId: 1,
        banner: '',
        panel: PANEL_CLOSED_WITH_RETURN,
        regionText: '',
      }),
    );

    const playing = renderToStaticMarkup(
      <App
        session={sessionFor(
          snapshotFor('playing'),
          multiplayerFor({ world, spectate: { mode: 'none' } }),
        )}
      />,
    );

    expect(playing).not.toContain('Return to my cube');
    expect(playing).toContain('aria-expanded="false">Users on Server</button>');
  });

  it('renders the pinned banner copy per transport status (AC-22)', () => {
    const retrying = renderToStaticMarkup(
      <App
        session={sessionFor(
          snapshotFor('playing'),
          multiplayerFor({ status: 'disconnected' }),
        )}
      />,
    );

    expect(retrying).toBe(shellHtml({ serverId: 1, banner: BANNER_RETRYING, regionText: '' }));

    const exhausted = renderToStaticMarkup(
      <App
        session={sessionFor(snapshotFor('playing'), multiplayerFor({ status: 'exhausted' }))}
      />,
    );

    expect(exhausted).toBe(
      shellHtml({ serverId: 1, banner: BANNER_EXHAUSTED, regionText: '' }),
    );
    expect(occurrences(exhausted, '<button type="button">Retry</button>')).toBe(1);
    // The banner never becomes a second live region.
    expect(occurrences(exhausted, 'aria-live=')).toBe(1);
    expect(occurrences(exhausted, 'role="status"')).toBe(1);
  });
});
