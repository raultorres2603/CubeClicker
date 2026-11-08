/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App, REDUCED_MOTION_COIN_POP_MS, createAuthGate } from './App';
import { createBoard } from './game/board';
import type { EngineSnapshot } from './game/engine';
import { MOTION } from './game/motion';
import { CUBE_STYLES } from './game/progression';
import type { MultiplayerSnapshot, OnlineGameSession } from './game/session';
import { GRID_SIZE, type CustomizationState, type GameStats, type LootboxGrant, type Phase } from './game/types';
import type { MemberState } from './multiplayer/protocol';
import type { WorldState } from './multiplayer/server-state';
import { submitAuthForm, type AuthFormStore } from './ui/AuthForms';

afterEach(() => {
  cleanup();
});

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

const ICON_PREFIX = '<svg aria-hidden="true" data-icon="';
const ICON_SUFFIX =
  '" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round"' +
  ' stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">';

/** Exact icon markup for the five HUD rows (T4, AC-4). */
const CURSOR_ICON =
  ICON_PREFIX +
  'cursor' +
  ICON_SUFFIX +
  '<path d="M5.5 3.2l14 7.6-6.3 1.6-2.9 6.4z" fill="currentColor" stroke-width="1.1"></path>' +
  '</svg>';
const CUBE_ICON =
  ICON_PREFIX +
  'cube' +
  ICON_SUFFIX +
  '<path d="M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2z"></path>' +
  '<path d="M4 7.2l8 4.4 8-4.4M12 11.6v9.6"></path>' +
  '</svg>';
const COIN_ICON =
  ICON_PREFIX +
  'coin' +
  ICON_SUFFIX +
  '<circle cx="12" cy="12" r="8.75"></circle>' +
  '<path d="M12 7.4l1.12 3.06 3.25.12-2.56 2.01.89 3.13L12 13.9l-2.7 1.82.89-3.13-2.56-2.01 3.25-.12z" fill="currentColor" stroke-width="1"></path>' +
  '</svg>';
const CUBE_LEVEL_ICON =
  ICON_PREFIX +
  'cube-level' +
  ICON_SUFFIX +
  '<path d="M9 3.6l6.4 3.3v6.9L9 17.1l-6.4-3.3V6.9z"></path>' +
  '<path d="M2.6 6.9L9 10.2l6.4-3.3M9 10.2v6.9"></path>' +
  '<path d="M18.2 12.2V5.4M15.4 8.2l2.8-2.8 2.8 2.8"></path>' +
  '</svg>';
const SERVER_ICON =
  ICON_PREFIX +
  'server' +
  ICON_SUFFIX +
  '<rect x="3.5" y="4" width="17" height="6" rx="1.8"></rect>' +
  '<rect x="3.5" y="14" width="17" height="6" rx="1.8"></rect>' +
  '<circle cx="7" cy="7" r="0.9" fill="currentColor" stroke="none"></circle>' +
  '<circle cx="7" cy="17" r="0.9" fill="currentColor" stroke="none"></circle>' +
  '<path d="M11 7h6M11 17h6"></path>' +
  '</svg>';

/** Exact Users-on-Server badge icon (T5, AC-5). */
const GROUP_ICON =
  ICON_PREFIX +
  'group' +
  ICON_SUFFIX +
  '<circle cx="9" cy="8" r="3.1"></circle>' +
  '<path d="M3.4 20.2a5.6 5.6 0 0111.2 0"></path>' +
  '<circle cx="17.3" cy="9.2" r="2.3"></circle>' +
  '<path d="M14.9 14.9a4.3 4.3 0 015.7 4.1"></path>' +
  '</svg>';

/** Exact gear + ship icons in the customization toggle (T7, AC-7). */
const GEAR_ICON =
  ICON_PREFIX +
  'gear' +
  ICON_SUFFIX +
  '<path d="M12 3.2l2.49 2.79 3.73-.21-.21 3.73L20.8 12l-2.79 2.49.21 3.73-3.73-.21L12 20.8l-2.49-2.79-3.73.21.21-3.73L3.2 12l2.79-2.49-.21-3.73 3.73.21z"></path>' +
  '<circle cx="12" cy="12" r="3.2"></circle>' +
  '</svg>';
const SHIP_ICON =
  ICON_PREFIX +
  'ship' +
  ICON_SUFFIX +
  '<path d="M12 2.6c2.7 2.5 4.1 5.8 4.1 9.3l2.7 3.4-3.2-.7a6.2 6.2 0 01-7.2 0l-3.2.7 2.7-3.4c0-3.5 1.4-6.8 4.1-9.3z"></path>' +
  '<circle cx="12" cy="8.8" r="1.5"></circle>' +
  '<path d="M10 18.7l2 2.7 2-2.7"></path>' +
  '</svg>';

/** Exact per-row icons and the cost diamond in the upgrades panel (T6, AC-6). */
const UPGRADE_CLICK_ICON =
  ICON_PREFIX +
  'upgrade-click' +
  ICON_SUFFIX +
  '<path d="M6 3.2l10.4 5.7-4.4 1.1-2 4.6z" fill="currentColor" stroke-width="1.1"></path>' +
  '<path d="M17.4 14.6v6.2M14.3 17.7h6.2"></path>' +
  '</svg>';
const UPGRADE_CUBE_ICON =
  ICON_PREFIX +
  'upgrade-cube' +
  ICON_SUFFIX +
  '<path d="M8.4 3.4l6 3.2v6.8l-6 3.2-6-3.2V6.6z"></path>' +
  '<path d="M2.4 6.6L8.4 9.8l6-3.2M8.4 9.8v6.8"></path>' +
  '<path d="M18.6 13v6.6M15.3 16.3h6.6"></path>' +
  '</svg>';
const UPGRADE_SPEED_ICON =
  ICON_PREFIX +
  'upgrade-speed' +
  ICON_SUFFIX +
  '<path d="M13.2 2.6L4.8 14.1h6.1L10.8 21.4l8.4-11.5h-6.1z" fill="currentColor" stroke-width="1.1"></path>' +
  '</svg>';
const DIAMOND_ICON =
  ICON_PREFIX +
  'diamond' +
  ICON_SUFFIX +
  '<path d="M7.2 3.4h9.6l3.8 5.4L12 20.8 3.4 8.8z"></path>' +
  '<path d="M3.4 8.8h17.2M7.2 3.4L12 8.8l4.8-5.4M12 20.8V8.8"></path>' +
  '</svg>';

const USERS_BADGE_CLOSED =
  '<button type="button" class="users-badge" aria-expanded="false">' +
  GROUP_ICON +
  'Users on Server</button>';

const PANEL_CLOSED = '<div class="user-panel">' + USERS_BADGE_CLOSED + '</div>';
const PANEL_CLOSED_WITH_RETURN =
  '<div class="user-panel">' +
  USERS_BADGE_CLOSED +
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
      economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
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
  overrides: Partial<OnlineGameSession> = {},
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
    purchaseUpgrade: () => {},
    openLootbox: () => {},
    equipPart: () => {},
    setPointerTarget: () => {},
    ...overrides,
  };
}

/** A session fake whose snapshot can be advanced in tests, notifying subscribers. */
function mutableSession(
  initialSnapshot: EngineSnapshot,
  initialMultiplayer: MultiplayerSnapshot,
): {
  session: OnlineGameSession;
  setSnapshot: (next: EngineSnapshot) => void;
  setMultiplayer: (next: MultiplayerSnapshot) => void;
} {
  let snapshot = initialSnapshot;
  let multiplayer = initialMultiplayer;
  const snapListeners = new Set<() => void>();
  const mpListeners = new Set<() => void>();
  const session: OnlineGameSession = {
    attach: () => {},
    dispose: () => {},
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      snapListeners.add(listener);
      return () => {
        snapListeners.delete(listener);
      };
    },
    getMultiplayerSnapshot: () => multiplayer,
    subscribeMultiplayer: (listener) => {
      mpListeners.add(listener);
      return () => {
        mpListeners.delete(listener);
      };
    },
    spectateMember: () => false,
    returnToOwnCube: () => false,
    retryConnection: () => {},
    join: () => {},
    purchaseUpgrade: () => {},
    openLootbox: () => {},
    equipPart: () => {},
    setPointerTarget: () => {},
  };
  return {
    session,
    setSnapshot: (next) => {
      snapshot = next;
      for (const listener of snapListeners) listener();
    },
    setMultiplayer: (next) => {
      multiplayer = next;
      for (const listener of mpListeners) listener();
    },
  };
}

/** A store fake carrying the server-authoritative user a login response would set. */
function authStoreFor(
  user: { email?: string; verified?: boolean } | null,
  calls: {
    login?: AuthFormStore['login'];
    register?: AuthFormStore['register'];
  } = {},
): AuthFormStore {
  return {
    user,
    login: calls.login,
    register: calls.register,
  };
}

/** Counts exact occurrences of a literal in the rendered markup (live-region uniqueness). */
function occurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/** Exact HUD markup for the welcomed shell (T4): five icon rows, toggle last. */
function hudMarkup({
  clicks,
  facesDestroyed,
  coins,
  cube,
  server,
}: {
  clicks: number;
  facesDestroyed: number;
  coins: string;
  cube: number;
  server: number;
}): string {
  return (
    '<section aria-label="Game statistics" class="hud-panel">' +
    `<p class="hud-row" data-row="clicks">${CURSOR_ICON}Clicks: <span data-stat="clicks">${clicks}</span></p>` +
    `<p class="hud-row" data-row="faces-destroyed">${CUBE_ICON}Faces destroyed: <span data-stat="faces-destroyed">${facesDestroyed}</span></p>` +
    `<p class="hud-row" data-row="coins">${COIN_ICON}Coins <span data-stat="coins">${coins}</span></p>` +
    `<p class="hud-row" data-row="cube">${CUBE_LEVEL_ICON}Cube <span data-stat="cube">${cube}</span></p>` +
    `<p class="hud-row" data-row="server">${SERVER_ICON}Server <span data-stat="server">${server}</span></p>` +
    '<button type="button" aria-expanded="true" aria-label="Toggle HUD"></button>' +
    '</section>'
  );
}

type UpgradeRowId = 'mini_cube_value' | 'cube_value' | 'speed_window';

interface UpgradeRowFixture {
  id: UpgradeRowId;
  name: string;
  level: string;
  effect: string;
  cost: number;
}

const ZERO_UPGRADE_ROWS: readonly UpgradeRowFixture[] = [
  {
    id: 'mini_cube_value',
    name: 'Click Power',
    level: '0/10',
    effect: '+10% coins per mini-cube',
    cost: 10,
  },
  {
    id: 'cube_value',
    name: 'Cube Bonus',
    level: '0/10',
    effect: '+10% coins per cube',
    cost: 50,
  },
  {
    id: 'speed_window',
    name: 'Quick Hands',
    level: '0/5',
    effect: '+2s speed-bonus window',
    cost: 25,
  },
];

const UPGRADE_ROW_ICONS: Record<UpgradeRowId, string> = {
  mini_cube_value: UPGRADE_CLICK_ICON,
  cube_value: UPGRADE_CUBE_ICON,
  speed_window: UPGRADE_SPEED_ICON,
};

/** Exact upgrades panel markup for the zero state rendered by the shell (T6). */
function upgradesPanel(mode: 'guest' | 'account', coins: number): string {
  const rows = ZERO_UPGRADE_ROWS.map((row) => {
    const enabled = coins >= row.cost;
    return (
      `<li class="upgrade-row" data-upgrade="${row.id}">` +
      UPGRADE_ROW_ICONS[row.id] +
      `<span data-name="true">${row.name}</span>` +
      `<span data-level="true">${row.level}</span>` +
      `<span data-effect="true">${row.effect}</span>` +
      DIAMOND_ICON +
      `<span data-cost="true">${row.cost}</span>` +
      `<button type="button" class="upgrade-buy" aria-label="Buy"${enabled ? '' : ' disabled=""'}></button>` +
      '</li>'
    );
  }).join('');
  return `<section aria-label="Upgrades" class="upgrades-panel" data-mode="${mode}"><ul>${rows}</ul></section>`;
}

/** Exact CustomizationToggle markup for the welcomed shell (T7). */
function customizationToggle(open: boolean): string {
  return (
    `<button type="button" class="customization-toggle" aria-expanded="${open}">` +
    GEAR_ICON +
    SHIP_ICON +
    'Spaceship customization</button>'
  );
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
  const coins = stats.coins ?? 0;
  return (
    '<main data-customization-open="false">' +
    `<canvas tabindex="0" aria-label="${ARIA_LABEL}" style="touch-action:none"></canvas>` +
    (welcomed
      ? hudMarkup({
          clicks: stats.clicks,
          facesDestroyed: stats.facesDestroyed,
          coins: coins.toFixed(2),
          cube: levelIndex + 1,
          server: serverId,
        })
      : '<section aria-label="Game statistics">' +
        `<p>Clicks: <span data-stat="clicks">${stats.clicks}</span></p>` +
        `<p>Faces destroyed: <span data-stat="faces-destroyed">${stats.facesDestroyed}</span></p>` +
        `<p>Cube <span data-stat="cube">${levelIndex + 1}</span></p>` +
        '</section>') +
    banner +
    (welcomed ? panel : '') +
    (welcomed ? upgradesPanel('guest', coins) : '') +
    (welcomed ? customizationToggle(false) : '') +
    `<div class="phase-announcement" role="status" aria-live="polite">${regionText}</div>` +
    '</main>'
  );
}

describe('App', () => {
  it('imports the gameplay stylesheet immediately after app.css (AC-2)', () => {
    // Vitest runs a jsdom test file with an http-style module URL, so read through the
    // workspace cwd (the frontend package root) instead of `import.meta.url`.
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain("import './ui/app.css';\nimport './ui/game-view.css';");
  });

  it('renders the auth menu with its three choices before a choice, over the canvas', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('<canvas');
    expect(html).toContain(
      '<div class="auth-menu" role="dialog" aria-modal="true" aria-labelledby="auth-menu-title">',
    );
    expect(html).toContain('<div class="auth-menu-actions">');
    expect(html).toContain('class="auth-button auth-button-primary"');
    expect(html).toContain('>Login</button>');
    expect(html).toContain('>Register</button>');
    expect(html).toContain('>Play as guest</button>');
    // The canvas is behind the overlay, so it is present but not the interactive layer.
    expect(html.indexOf('<canvas')).toBeLessThan(html.indexOf('class="auth-menu"'));
  });

  it('renders the verification route with a way back to the login menu', () => {
    const html = renderToStaticMarkup(<App verifyToken="token-123" />);

    expect(html).toContain('<div class="verify-email">');
    expect(html).toContain('Verifying your email…');
    expect(html).toContain('<a href="/">Continue to login</a>');
    expect(html).not.toContain('class="auth-menu"');
  });

  it('keeps the email-verification shell free of the game-shell state attribute (AC-18)', () => {
    const html = renderToStaticMarkup(<App verifyToken="token-123" />);

    expect(html).not.toContain('data-customization-open');
  });

  it('renders the full intro shell on first paint (default online session, no DOM)', () => {
    const html = renderToStaticMarkup(<App hasChosen />);

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
      <App hasChosen
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
      <App hasChosen
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
      <App hasChosen
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
      <App hasChosen
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
      <App hasChosen session={sessionFor(snapshotFor('playing'), multiplayerFor())} />,
    );

    // AC-14: `playing` is empty text content — the element is neither removed nor hidden.
    expect(html).toBe(shellHtml({ serverId: 1, banner: '', regionText: '' }));
    expect(html).toContain(
      '<div class="phase-announcement" role="status" aria-live="polite"></div></main>',
    );
    expect(occurrences(html, 'role="status"')).toBe(1);
  });

  it('binds the HUD to the engine snapshot and the server id to the multiplayer store (AC-11, AC-23)', () => {
    const snapshot = snapshotFor('playing', { clicks: 12, facesDestroyed: 4 }, 3);
    const html = renderToStaticMarkup(
      <App hasChosen
        session={sessionFor(snapshot, multiplayerFor({ world: worldFor({ serverId: 7 }) }))}
      />,
    );

    expect(html).toContain(
      `<p class="hud-row" data-row="clicks">${CURSOR_ICON}Clicks: <span data-stat="clicks">12</span></p>`,
    );
    expect(html).toContain(
      `<p class="hud-row" data-row="faces-destroyed">${CUBE_ICON}Faces destroyed: <span data-stat="faces-destroyed">4</span></p>`,
    );
    expect(html).toContain(
      `<p class="hud-row" data-row="cube">${CUBE_LEVEL_ICON}Cube <span data-stat="cube">4</span></p>`,
    );
    expect(html).toContain(
      `<p class="hud-row" data-row="server">${SERVER_ICON}Server <span data-stat="server">7</span></p>`,
    );
    // Still exactly one live region in the shell (AC-14).
    expect(occurrences(html, 'aria-live=')).toBe(1);
  });

  it('renders Return to my cube in the shell exactly while spectating (AC-18)', () => {
    const world = worldFor({ members: [member('p2', 'Player 2', 1)] });
    const spectating = renderToStaticMarkup(
      <App hasChosen
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
      <App hasChosen
        session={sessionFor(
          snapshotFor('playing'),
          multiplayerFor({ world, spectate: { mode: 'none' } }),
        )}
      />,
    );

    expect(playing).not.toContain('Return to my cube');
    expect(playing).toContain(USERS_BADGE_CLOSED);
  });

  it('renders the pinned banner copy per transport status (AC-22)', () => {
    const retrying = renderToStaticMarkup(
      <App hasChosen
        session={sessionFor(
          snapshotFor('playing'),
          multiplayerFor({ status: 'disconnected' }),
        )}
      />,
    );

    expect(retrying).toBe(shellHtml({ serverId: 1, banner: BANNER_RETRYING, regionText: '' }));

    const exhausted = renderToStaticMarkup(
      <App hasChosen
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

  it('toggles the HUD minimized state from the welcomed branch (AC-6)', async () => {
    render(<App hasChosen session={sessionFor(snapshotFor('playing'), multiplayerFor())} />);
    const toggle = screen.getByRole('button', { name: 'Toggle HUD' });
    const section = screen.getByLabelText('Game statistics');

    expect(section.getAttribute('data-minimized')).toBeNull();
    await userEvent.click(toggle);
    expect(screen.getByLabelText('Game statistics').getAttribute('data-minimized')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Toggle HUD' }));
    expect(screen.getByLabelText('Game statistics').getAttribute('data-minimized')).toBeNull();
  });

  it('drives data-customization-open from the customization toggle (AC-7, AC-18)', async () => {
    render(<App hasChosen session={sessionFor(snapshotFor('playing'), multiplayerFor())} />);
    const main = screen.getByRole('main');
    const toggle = screen.getByRole('button', { name: 'Spaceship customization' });

    expect(main.getAttribute('data-customization-open')).toBe('false');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(0);

    await userEvent.click(toggle);

    expect(main.getAttribute('data-customization-open')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Spaceship customization' }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('button', { name: 'Spaceship customization' }),
    );

    expect(main.getAttribute('data-customization-open')).toBe('false');
    expect(
      screen.getByRole('button', { name: 'Spaceship customization' }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(0);
  });

  it('blinks the welcomed HUD when clicks increase (AC-5)', async () => {
    vi.useFakeTimers();
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', { clicks: 0, facesDestroyed: 0 }, 0),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);
    const section = screen.getByLabelText('Game statistics');

    expect(section.getAttribute('data-blinking')).toBeNull();

    act(() => {
      setSnapshot(snapshotFor('playing', { clicks: 1, facesDestroyed: 0 }, 0));
    });

    // Flush the commit effect so the blink flips on synchronously.
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Game statistics').getAttribute('data-blinking')).toBe('true');

    // The single HUD_BLINK_MS (200 ms) timer clears the blink.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Game statistics').getAttribute('data-blinking')).toBeNull();

    vi.useRealTimers();
  });

  it('does not blink the welcomed HUD under reduced motion (AC-6)', async () => {
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', { clicks: 0, facesDestroyed: 0 }, 0, { reducedMotion: true }),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);
    const section = screen.getByLabelText('Game statistics');

    act(() => {
      setSnapshot(snapshotFor('playing', { clicks: 1, facesDestroyed: 0 }, 0, { reducedMotion: true }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(section.getAttribute('data-blinking')).toBeNull();
  });

  it('leaves the pre-welcome stats section without a blink (AC-5)', () => {
    const html = renderToStaticMarkup(
      <App hasChosen session={sessionFor(snapshotFor('playing', { clicks: 5, facesDestroyed: 0 }, 0), multiplayerFor({ world: worldFor({ serverId: 0, selfName: '' }) }))} />,
    );
    expect(html).not.toContain('data-blinking');
  });
});

describe('App — auth choice starts the game', () => {
  const loginData = {
    username: 'alice',
    email: '',
    password: 'correct horse battery',
  };
  const registerData = {
    username: 'alice',
    email: 'alice@example.com',
    password: 'correct horse battery',
  };

  function introSession(join: ReturnType<typeof vi.fn>, retryConnection: ReturnType<typeof vi.fn>): OnlineGameSession {
    return sessionFor(
      snapshotFor('intro'),
      multiplayerFor({ world: worldFor({ serverId: 0, selfName: '' }) }),
      { join, retryConnection },
    );
  }

  it('joins as a guest exactly once (even on a double click) and closes the menu', () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const session = introSession(join, retryConnection);
    const gate = createAuthGate({ session });

    // The button's onClick is `gate.playAsGuest`; a rapid double click must not join twice.
    gate.playAsGuest();
    gate.playAsGuest();

    expect(join).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledWith('guest');
    expect(retryConnection).toHaveBeenCalledTimes(0);
    expect(gate.getSnapshot()).toEqual({
      view: 'closed',
      pendingEmail: null,
      menuDefaultView: 'menu',
    });

    const html = renderToStaticMarkup(<App gate={gate} session={session} />);
    expect(html).toContain('<canvas');
    expect(html).not.toContain('class="auth-menu"');
    expect(html).not.toContain('Play as guest');
  });

  it('logs in through the store, reconnects for the session cookie, then joins as an account', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const session = introSession(join, retryConnection);
    const gate = createAuthGate({ session });
    const login = vi.fn(async () => undefined);
    const store = authStoreFor(
      { email: 'alice@example.com', verified: true },
      { login },
    );

    const result = await submitAuthForm({
      mode: 'login',
      data: loginData,
      store,
      onLoginSuccess: gate.loginSucceeded,
    });

    expect(result).toEqual({
      outcome: 'success',
      mode: 'login',
      user: { email: 'alice@example.com', verified: true },
    });
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({
      username: 'alice',
      password: 'correct horse battery',
    });
    expect(retryConnection).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledWith('account');
    // The HTTP login must finish before the socket reconnects, and account mode must be
    // chosen on the reconnected socket (the cookie is resolved at the WS upgrade).
    expect(login.mock.invocationCallOrder[0]).toBeLessThan(
      retryConnection.mock.invocationCallOrder[0],
    );
    expect(retryConnection.mock.invocationCallOrder[0]).toBeLessThan(
      join.mock.invocationCallOrder[0],
    );
    expect(gate.getSnapshot()).toEqual({
      view: 'closed',
      pendingEmail: null,
      menuDefaultView: 'menu',
    });

    const html = renderToStaticMarkup(<App gate={gate} session={session} />);
    expect(html).not.toContain('class="auth-menu"');
  });

  it('shows the form error and does not join when login fails', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const session = introSession(join, retryConnection);
    const gate = createAuthGate({ session });
    const login = vi.fn(async () => {
      throw new Error('invalid credentials');
    });
    const store = authStoreFor(null, { login });

    const result = await submitAuthForm({
      mode: 'login',
      data: loginData,
      store,
      onLoginSuccess: gate.loginSucceeded,
    });

    expect(result).toEqual({ outcome: 'error', message: 'invalid credentials' });
    expect(join).toHaveBeenCalledTimes(0);
    expect(retryConnection).toHaveBeenCalledTimes(0);
    expect(gate.getSnapshot()).toEqual({
      view: 'menu',
      pendingEmail: null,
      menuDefaultView: 'menu',
    });
  });

  it('registers, shows verification-pending, never joins, and returns to login on dismiss', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const session = introSession(join, retryConnection);
    const gate = createAuthGate({ session });
    const register = vi.fn(async () => ({ message: 'verification email sent' }));
    const store = authStoreFor(null, { register });

    const result = await submitAuthForm({
      mode: 'register',
      data: registerData,
      store,
      onRegisterSuccess: (data) => gate.verificationRequired(data.email),
    });

    expect(result).toEqual({ outcome: 'success', mode: 'register' });
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'correct horse battery',
    });
    expect(join).toHaveBeenCalledTimes(0);
    expect(retryConnection).toHaveBeenCalledTimes(0);
    expect(gate.getSnapshot()).toEqual({
      view: 'menu',
      pendingEmail: 'alice@example.com',
      menuDefaultView: 'menu',
    });

    const pending = renderToStaticMarkup(<App gate={gate} session={session} />);
    expect(pending).toContain('aria-label="Verify your email"');
    expect(pending).toContain('Verify your email');
    expect(pending).toContain('Check your email to verify your account.');
    expect(pending).toContain('alice@example.com');
    expect(pending).toContain('Back to login');
    expect(pending).not.toContain('Play as guest');

    gate.backToLogin();
    expect(gate.getSnapshot()).toEqual({
      view: 'menu',
      pendingEmail: null,
      menuDefaultView: 'login',
    });
    const loginForm = renderToStaticMarkup(<App gate={gate} session={session} />);
    expect(loginForm).toContain('class="auth-forms"');
    expect(loginForm).toContain('Welcome back');
    expect(loginForm).toContain('name="username"');
    expect(loginForm).toContain('name="password"');
    expect(loginForm).not.toContain('Play as guest');
  });

  it('routes an unverified login to verification-pending without joining', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const session = introSession(join, retryConnection);
    const gate = createAuthGate({ session });
    const login = vi.fn(async () => undefined);
    const store = authStoreFor(
      { email: 'alice@example.com', verified: false },
      { login },
    );

    const result = await submitAuthForm({
      mode: 'login',
      data: loginData,
      store,
      onLoginSuccess: gate.loginSucceeded,
      onVerificationRequired: gate.verificationRequired,
    });

    expect(result).toEqual({ outcome: 'verification', email: 'alice@example.com' });
    expect(login).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledTimes(0);
    expect(retryConnection).toHaveBeenCalledTimes(0);
    expect(gate.getSnapshot()).toEqual({
      view: 'menu',
      pendingEmail: 'alice@example.com',
      menuDefaultView: 'menu',
    });

    const html = renderToStaticMarkup(<App gate={gate} session={session} />);
    expect(html).toContain('Check your email to verify your account.');
    expect(html).not.toContain('Play as guest');
  });
});

describe('App — auth interaction', () => {
  function introSession(join: ReturnType<typeof vi.fn>, retryConnection: ReturnType<typeof vi.fn>): OnlineGameSession {
    return sessionFor(
      snapshotFor('intro'),
      multiplayerFor({ world: worldFor({ serverId: 0, selfName: '' }) }),
      { join, retryConnection },
    );
  }

  it('clicking the rendered Play as guest button joins as guest and unmounts the menu', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const session = introSession(join, retryConnection);
    render(<App session={session} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Play as guest' }));
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    expect(join).toHaveBeenCalledWith('guest');
    expect(retryConnection).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('button', { name: 'Play as guest' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Register' })).toBeNull();
  });

  it('drives the rendered login form submit and joins as account after reconnect', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const session = introSession(join, retryConnection);
    const login = vi.fn(async () => undefined);
    const store = authStoreFor({ email: 'alice@example.com', verified: true }, { login, register: vi.fn() });
    render(<App session={session} store={store} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({ username: 'alice', password: 'correct horse battery' });
    expect(retryConnection).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledWith('account');
    expect(login.mock.invocationCallOrder[0]).toBeLessThan(retryConnection.mock.invocationCallOrder[0]);
    expect(retryConnection.mock.invocationCallOrder[0]).toBeLessThan(join.mock.invocationCallOrder[0]);
    expect(screen.queryByRole('button', { name: 'Play as guest' })).toBeNull();
  });

  it('shows the error text and does not join when rendered login fails', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const session = introSession(join, retryConnection);
    const login = vi.fn(async () => {
      throw new Error('invalid credentials');
    });
    const store = authStoreFor(null, { login, register: vi.fn() });
    render(<App session={session} store={store} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('invalid credentials');
    expect(join).toHaveBeenCalledTimes(0);
    expect(retryConnection).toHaveBeenCalledTimes(0);
  });
});

describe('App — customization panel integration (AC-29, AC-32, AC-43)', () => {
  const CUSTOMIZATION: CustomizationState = {
    lootboxes: 1,
    keys: 1,
    parts: { 'hull-gold': 1, 'wing-left-silver': 1 },
    appearance: { hull: 'hull-gold' },
  };

  function panelSession(
    customization: CustomizationState,
    overrides: {
      grant?: LootboxGrant | null;
      pending?: boolean;
      sessionOverrides?: Partial<OnlineGameSession>;
    } = {},
  ): OnlineGameSession {
    return sessionFor(
      snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins: 0 }, 0, {
        customization,
        lastLootboxGrant: overrides.grant ?? null,
      }),
      multiplayerFor({ pendingLootboxOpen: overrides.pending ?? false }),
      overrides.sessionOverrides,
    );
  }

  it('passes pendingLootboxOpen to the panel and disables Open lootbox while pending', () => {
    render(
      <App
        hasChosen
        customizationOpen
        session={panelSession(CUSTOMIZATION, { pending: true })}
      />,
    );

    const open = screen.getByRole('button', { name: 'Open lootbox' }) as HTMLButtonElement;
    expect(open.disabled).toBe(true);
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(1);
  });

  it('enables Open lootbox when the open is not pending', () => {
    render(
      <App
        hasChosen
        customizationOpen
        session={panelSession(CUSTOMIZATION, { pending: false })}
      />,
    );

    const open = screen.getByRole('button', { name: 'Open lootbox' }) as HTMLButtonElement;
    expect(open.disabled).toBe(false);
  });

  it('passes the last grant into the reveal region and dismisses it through the session', () => {
    const dismissLootboxReveal = vi.fn();
    render(
      <App
        hasChosen
        customizationOpen
        session={panelSession(CUSTOMIZATION, {
          grant: {
            partId: 'wing-left-silver',
            slot: 'wing-left',
            rarity: 'rare',
            duplicate: false,
            sequence: 5,
          },
          sessionOverrides: { dismissLootboxReveal },
        })}
      />,
    );

    const region = document.querySelector<HTMLElement>('[data-reveal-active="true"]');
    expect(region?.getAttribute('data-part-id')).toBe('wing-left-silver');
    expect(region?.getAttribute('data-slot')).toBe('wing-left');
    expect(region?.getAttribute('data-rarity')).toBe('rare');
    expect(region?.getAttribute('data-duplicate')).toBe('false');
    expect(region?.textContent).toContain('Port Silver Wing');
    expect(region?.textContent).toContain('Rare');
    expect(region?.textContent).toContain('New');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }));
    expect(dismissLootboxReveal).toHaveBeenCalledTimes(1);
  });

  it('routes panel equip and unequip controls to the session commands', () => {
    const equipPart = vi.fn();
    const unequipPart = vi.fn();
    render(
      <App
        hasChosen
        customizationOpen
        session={panelSession(CUSTOMIZATION, {
          sessionOverrides: { equipPart, unequipPart },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Equip Port Silver Wing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unequip Hull' }));

    expect(equipPart).toHaveBeenCalledTimes(1);
    expect(equipPart).toHaveBeenCalledWith('wing-left-silver');
    expect(unequipPart).toHaveBeenCalledTimes(1);
    expect(unequipPart).toHaveBeenCalledWith('hull');
  });
});

describe('App — coin pop queue (AC-39)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function coinsSection(): HTMLElement {
    return screen.getByLabelText('Game statistics');
  }

  function pops(): string[] {
    return Array.from(coinsSection().querySelectorAll('[data-coin-pop]')).map(
      (pop) => pop.textContent ?? '',
    );
  }

  it('renders one popup per gain with the same-frame numeric value and no HUD pulse', async () => {
    vi.useFakeTimers();
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins: 0 }),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);

    expect(coinsSection().querySelector('[data-stat="coins"]')?.textContent).toBe('0.00');

    act(() => {
      setSnapshot(snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins: 0.5 }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(coinsSection().querySelector('[data-stat="coins"]')?.textContent).toBe('0.50');
    expect(pops()).toEqual(['+0.50']);
    expect(coinsSection().getAttribute('data-blinking')).toBeNull();
  });

  it('keeps a popup for 1100 ms', async () => {
    vi.useFakeTimers();
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins: 0 }),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);
    act(() => {
      setSnapshot(snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins: 0.5 }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(pops()).toEqual(['+0.50']);

    act(() => {
      vi.advanceTimersByTime(1099);
    });
    expect(pops()).toEqual(['+0.50']);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(pops()).toEqual([]);
  });

  it('keeps at most three popups and drops the oldest first', async () => {
    vi.useFakeTimers();
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins: 0 }),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);

    for (const coins of [0.1, 0.3, 0.6, 1.0]) {
      act(() => {
        setSnapshot(snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins }));
      });
      await act(async () => {
        await Promise.resolve();
      });
    }

    expect(pops()).toEqual(['+0.20', '+0.30', '+0.40']);
    expect(MOTION.coinMaxConcurrent).toBe(3);
  });

  it('uses the static 600 ms lifetime under reduced motion', async () => {
    vi.useFakeTimers();
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins: 0 }, 0, {
        reducedMotion: true,
      }),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);
    act(() => {
      setSnapshot(
        snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins: 0.5 }, 0, {
          reducedMotion: true,
        }),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(pops()).toEqual(['+0.50']);

    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(pops()).toEqual(['+0.50']);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(pops()).toEqual([]);
    expect(REDUCED_MOTION_COIN_POP_MS).toBe(600);
  });
});

describe('App — level banner and upgrade pulse (AC-40, AC-43)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows LevelCompleteBanner for exactly 1600 ms after a level increase', async () => {
    vi.useFakeTimers();
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', undefined, 0),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);

    expect(document.querySelector('[data-level-complete="true"]')).toBeNull();

    act(() => {
      setSnapshot(snapshotFor('playing', undefined, 1));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('[data-level-complete="true"]')).not.toBeNull();
    expect(document.querySelector('.level-banner-title')?.textContent).toBe('LEVEL COMPLETE');
    expect(document.querySelector('.level-banner-level')?.textContent).toBe('Cube 2');
    expect(document.querySelectorAll('[data-ray="gold"]')).toHaveLength(16);
    expect(document.querySelectorAll('[data-ray="cyan"]')).toHaveLength(8);
    expect(document.querySelectorAll('[data-ring]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-star]')).toHaveLength(12);
    expect(document.querySelectorAll('[data-coin]')).toHaveLength(20);

    act(() => {
      vi.advanceTimersByTime(1599);
    });
    expect(document.querySelector('[data-level-complete="true"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(document.querySelector('[data-level-complete="true"]')).toBeNull();
    expect(MOTION.bannerHoldMs).toBe(1600);
  });

  it('marks the banner reduced under reduced motion', async () => {
    vi.useFakeTimers();
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', undefined, 0, { reducedMotion: true }),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);

    act(() => {
      setSnapshot(snapshotFor('playing', undefined, 1, { reducedMotion: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      document
        .querySelector('[data-level-complete="true"]')
        ?.getAttribute('data-reduced-motion'),
    ).toBe('true');
  });

  it('restarts the banner hold when another level completes while it is visible', async () => {
    vi.useFakeTimers();
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', undefined, 0),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);

    act(() => {
      setSnapshot(snapshotFor('playing', undefined, 1));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.querySelector('.level-banner-level')?.textContent).toBe('Cube 2');

    act(() => {
      setSnapshot(snapshotFor('playing', undefined, 2));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('.level-banner-level')?.textContent).toBe('Cube 3');
    act(() => {
      vi.advanceTimersByTime(1599);
    });
    expect(document.querySelector('[data-level-complete="true"]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(document.querySelector('[data-level-complete="true"]')).toBeNull();
  });

  it('pulses the upgraded row for 260 ms without pulsing the panel', async () => {
    vi.useFakeTimers();
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing', undefined, 0, { upgrades: {} }),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);
    const row = (): HTMLElement | null =>
      document.querySelector<HTMLElement>('li[data-upgrade="mini_cube_value"]');

    expect(row()?.getAttribute('data-purchased')).toBeNull();

    act(() => {
      setSnapshot(
        snapshotFor('playing', undefined, 0, { upgrades: { mini_cube_value: 1 } }),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(row()?.getAttribute('data-purchased')).toBe('true');
    expect(document.querySelector('.upgrades-panel')?.hasAttribute('data-purchased')).toBe(false);

    act(() => {
      vi.advanceTimersByTime(259);
    });
    expect(row()?.getAttribute('data-purchased')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(row()?.getAttribute('data-purchased')).toBeNull();
  });
});
