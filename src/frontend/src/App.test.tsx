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
import type { ActivityEvent, MemberState } from './multiplayer/protocol';
import type { LeaderboardSnapshot } from './multiplayer/protocol';
import type { WorldState } from './multiplayer/server-state';
import { submitAuthForm, type AuthFormStore } from './ui/AuthForms';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
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

const BANNER_CONNECTING =
  '<div class="connection-banner" data-status="connecting">' +
  '<span class="connection-dot" data-connection-dot="true" aria-hidden="true"></span>' +
  'Connecting…</div>';
const BANNER_RETRYING =
  '<div class="connection-banner" data-status="disconnected">' +
  '<span class="connection-dot" data-connection-dot="true" aria-hidden="true"></span>' +
  'Connection lost — retrying…</div>';
const BANNER_EXHAUSTED =
  '<div class="connection-banner" data-status="exhausted">' +
  '<span class="connection-dot" data-connection-dot="true" aria-hidden="true"></span>' +
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
const KEY_ICON =
  ICON_PREFIX +
  'key' +
  ICON_SUFFIX +
  '<circle cx="8" cy="8" r="4.2"></circle>' +
  '<path d="M11 11l8 8M16.2 16.2l2.2-2.2M18.7 18.7l2-2"></path>' +
  '</svg>';
const LOOTBOX_ICON =
  ICON_PREFIX +
  'lootbox' +
  ICON_SUFFIX +
  '<path d="M3.5 8.5h17v11.2h-17z"></path>' +
  '<path d="M3.5 8.5l2.4-4.2h12.2l2.4 4.2M10.2 8.5v11.2M13.8 8.5v11.2"></path>' +
  '<path d="M9.4 8.5h5.2v3.1H9.4z"></path>' +
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

/** The `Users on Server` badge: group icon, decorative live dot, label and count (AC-24). */
function usersBadge(count: number): string {
  return (
    '<button type="button" class="users-badge" aria-expanded="false">' +
    GROUP_ICON +
    '<span class="gf-live-dot" data-live-dot="true" aria-hidden="true"></span>' +
    'Users on Server' +
    `<span class="users-count" data-count="${count}" aria-hidden="true">${count}</span>` +
    '</button>'
  );
}

/** The closed user panel; `memberCount` excludes the self row (`members.length + 1`). */
function userPanel({ memberCount = 0, returnButton = false }: {
  memberCount?: number;
  returnButton?: boolean;
} = {}): string {
  return (
    '<div class="user-panel">' +
    usersBadge(memberCount + 1) +
    (returnButton ? '<button type="button">Return to my cube</button>' : '') +
    '</div>'
  );
}

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
  activity = [],
  leaderboard = null,
}: {
  serverId?: number;
  selfName?: string;
  members?: MemberState[];
  activity?: ActivityEvent[];
  leaderboard?: LeaderboardSnapshot | null;
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
    activity,
    leaderboard,
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

/** The shell's game canvas, or a concrete failure when the canvas is missing. */
function canvasElement(): HTMLCanvasElement {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas');
  if (canvas === null) {
    throw new Error('App did not render the game canvas');
  }
  return canvas;
}

/**
 * Exact AC-19 HUD markup for the welcomed shell: header + level chip, the three-chip
 * `Resources` group, the three stat rows and the 24 px toggle last.
 */
function hudMarkup({
  clicks,
  facesDestroyed,
  coins,
  cube,
  server,
  keys = 0,
  lootboxes = 0,
}: {
  clicks: number;
  facesDestroyed: number;
  coins: string;
  cube: number;
  server: number;
  keys?: number;
  lootboxes?: number;
}): string {
  return (
    '<section aria-label="Game statistics" class="hud-panel">' +
    '<div class="hud-header">' +
    '<h2 class="hud-title">Pilot status</h2>' +
    `<span class="hud-level" data-stat="cube">Cube ${cube}</span>` +
    '</div>' +
    '<div class="hud-resources" role="group" aria-label="Resources">' +
    `<span data-resource="coins">${COIN_ICON}Coins <span class="hud-resource-value" data-stat="coins">${coins}</span></span>` +
    `<span data-resource="keys">${KEY_ICON}Keys <span class="hud-resource-value" data-stat="keys">${keys}</span></span>` +
    `<span data-resource="lootboxes">${LOOTBOX_ICON}Lootboxes <span class="hud-resource-value" data-stat="lootboxes">${lootboxes}</span></span>` +
    '</div>' +
    '<div class="hud-grid">' +
    `<p class="hud-row" data-row="clicks">${CURSOR_ICON}Clicks: <span data-stat="clicks">${clicks}</span></p>` +
    `<p class="hud-row" data-row="faces-destroyed">${CUBE_ICON}Faces destroyed: <span data-stat="faces-destroyed">${facesDestroyed}</span></p>` +
    `<p class="hud-row" data-row="server">${SERVER_ICON}Server <span data-stat="server">${server}</span></p>` +
    '</div>' +
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

const UPGRADE_MAX_LEVEL: Record<UpgradeRowId, number> = {
  mini_cube_value: 10,
  cube_value: 10,
  speed_window: 5,
};

const UPGRADE_ROW_ICONS: Record<UpgradeRowId, string> = {
  mini_cube_value: UPGRADE_CLICK_ICON,
  cube_value: UPGRADE_CUBE_ICON,
  speed_window: UPGRADE_SPEED_ICON,
};

/** Exact upgrades panel markup for the zero state rendered by the shell (T9, AC-20). */
function upgradesPanel(mode: 'guest' | 'account', coins: number): string {
  const rows = ZERO_UPGRADE_ROWS.map((row) => {
    const affordable = coins >= row.cost;
    const pips =
      '<span class="upgrade-pips" aria-hidden="true">' +
      '<span class="upgrade-pip" data-filled="false"></span>'.repeat(UPGRADE_MAX_LEVEL[row.id]) +
      '</span>';
    return (
      `<li class="upgrade-row" data-upgrade="${row.id}" data-affordable="${affordable ? 'true' : 'false'}">` +
      UPGRADE_ROW_ICONS[row.id] +
      `<span data-name="true">${row.name}</span>` +
      `<span data-level="true">${row.level}</span>` +
      `<span data-effect="true">${row.effect}</span>` +
      DIAMOND_ICON +
      `<span data-cost="true">${row.cost}</span>` +
      pips +
      `<button type="button" class="upgrade-buy" aria-label="Buy"${affordable ? '' : ' disabled=""'}></button>` +
      '</li>'
    );
  }).join('');
  return (
    `<section aria-label="Upgrades" class="upgrades-panel" data-mode="${mode}">` +
    '<h2 class="upgrades-title">Upgrades</h2>' +
    `<p class="upgrades-balance" data-coins="${coins.toFixed(2)}">Coins ${coins.toFixed(2)}</p>` +
    `<ul>${rows}</ul>` +
    '</section>'
  );
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
  regionText,
  stats = { clicks: 0, facesDestroyed: 0 },
  levelIndex = 0,
  memberCount = 0,
  returnButton = false,
  reducedMotion = false,
}: {
  serverId: number;
  banner: string;
  regionText: string;
  stats?: GameStats;
  levelIndex?: number;
  memberCount?: number;
  returnButton?: boolean;
  reducedMotion?: boolean;
}): string {
  // `serverId` doubles as the welcomed signal (F7): before the first `welcome` the shell
  // renders the stats without the server line and no users panel at all.
  const welcomed = serverId > 0;
  const coins = stats.coins ?? 0;
  return (
    '<main data-customization-open="false" data-reduced-motion="' +
    (reducedMotion ? 'true' : 'false') +
    '">' +
    `<canvas tabindex="0" aria-label="${ARIA_LABEL}" style="touch-action:none"></canvas>` +
    '<div class="game-ambience" aria-hidden="true" data-reduced-motion="' +
    (reducedMotion ? 'true' : 'false') +
    '"></div>' +
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
    (welcomed ? userPanel({ memberCount, returnButton }) : '') +
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

  it('keeps the accepted pre-welcome stats rows and no HUD chrome before the first welcome (AC-19)', () => {
    const html = renderToStaticMarkup(
      <App hasChosen
        session={sessionFor(
          snapshotFor('playing', { clicks: 5, facesDestroyed: 2 }, 2),
          multiplayerFor({ world: worldFor({ serverId: 0, selfName: '' }) }),
        )}
      />,
    );

    expect(html).toContain(
      '<section aria-label="Game statistics">' +
        '<p>Clicks: <span data-stat="clicks">5</span></p>' +
        '<p>Faces destroyed: <span data-stat="faces-destroyed">2</span></p>' +
        '<p>Cube <span data-stat="cube">3</span></p>' +
        '</section>',
    );
    expect(occurrences(html, '<p>')).toBe(3);
    expect(html).not.toContain('hud-panel');
    expect(html).not.toContain('hud-header');
    expect(html).not.toContain('hud-resources');
    expect(html).not.toContain('hud-grid');
    expect(html).not.toContain('hud-level');
    expect(html).not.toContain('Pilot status');
    expect(html).not.toContain('Toggle HUD');
    expect(occurrences(html, 'data-stat="clicks"')).toBe(1);
    expect(occurrences(html, 'data-stat="faces-destroyed"')).toBe(1);
    expect(occurrences(html, 'data-stat="cube"')).toBe(1);
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
        memberCount: 1,
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
      `<span class="hud-level" data-stat="cube">Cube 4</span>`,
    );
    expect(html).toContain(
      `<p class="hud-row" data-row="clicks">${CURSOR_ICON}Clicks: <span data-stat="clicks">12</span></p>`,
    );
    expect(html).toContain(
      `<p class="hud-row" data-row="faces-destroyed">${CUBE_ICON}Faces destroyed: <span data-stat="faces-destroyed">4</span></p>`,
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
        memberCount: 1,
        returnButton: true,
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
    expect(playing).toContain(usersBadge(2));
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

  it('toggles the HUD minimized state from the welcomed branch (AC-6, AC-19)', async () => {
    render(<App hasChosen session={sessionFor(snapshotFor('playing'), multiplayerFor())} />);
    const toggle = screen.getByRole('button', { name: 'Toggle HUD' });
    const section = screen.getByLabelText('Game statistics');

    // AC-19: header + resources always stay rendered; the grid collapses via CSS only.
    expect(section.querySelector('.hud-header .hud-title')?.textContent).toBe('Pilot status');
    expect(screen.getByRole('group', { name: 'Resources' })).toBe(
      section.querySelector('.hud-resources'),
    );
    expect(section.querySelector('.hud-grid')).not.toBeNull();
    expect(section.getAttribute('data-minimized')).toBeNull();
    await userEvent.click(toggle);
    const minimized = screen.getByLabelText('Game statistics');
    expect(minimized.getAttribute('data-minimized')).toBe('true');
    expect(minimized.querySelector('.hud-header .hud-title')?.textContent).toBe('Pilot status');
    expect(minimized.querySelector('.hud-resources')).not.toBeNull();
    expect(minimized.querySelector('.hud-grid')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Toggle HUD' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Toggle HUD' }));
    expect(screen.getByLabelText('Game statistics').getAttribute('data-minimized')).toBeNull();
    expect(screen.getByRole('button', { name: 'Toggle HUD' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('binds the HUD resource strip to snapshot.customization keys and lootboxes (AC-19)', () => {
    const html = renderToStaticMarkup(
      <App hasChosen
        session={sessionFor(
          snapshotFor('playing', { clicks: 7, facesDestroyed: 2, coins: 12.5 }, 4, {
            customization: { lootboxes: 3, keys: 2, parts: {}, appearance: {} },
          }),
          multiplayerFor(),
        )}
      />,
    );

    expect(html).toContain(
      `<span data-resource="coins">${COIN_ICON}Coins <span class="hud-resource-value" data-stat="coins">12.50</span></span>`,
    );
    expect(html).toContain(
      `<span data-resource="keys">${KEY_ICON}Keys <span class="hud-resource-value" data-stat="keys">2</span></span>`,
    );
    expect(html).toContain(
      `<span data-resource="lootboxes">${LOOTBOX_ICON}Lootboxes <span class="hud-resource-value" data-stat="lootboxes">3</span></span>`,
    );
    expect(html).toContain('<h2 class="hud-title">Pilot status</h2>');
    expect(html).toContain('<span class="hud-level" data-stat="cube">Cube 5</span>');
    // No data-stat value appears twice in the HUD (AC-19).
    expect(occurrences(html, 'data-stat="cube"')).toBe(1);
    expect(occurrences(html, 'data-stat="coins"')).toBe(1);
    expect(occurrences(html, 'data-stat="keys"')).toBe(1);
    expect(occurrences(html, 'data-stat="lootboxes"')).toBe(1);
  });

  it('drives data-customization-open from the customization toggle (AC-7, AC-18)', async () => {
    render(<App hasChosen session={sessionFor(snapshotFor('playing'), multiplayerFor())} />);
    const main = screen.getByRole('main');
    const toggle = screen.getByRole('button', { name: 'Spaceship customization' });

    expect(main.getAttribute('data-customization-open')).toBe('false');
    expect(main.getAttribute('data-reduced-motion')).toBe('false');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(0);

    await userEvent.click(toggle);

    expect(main.getAttribute('data-customization-open')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Spaceship customization' }).getAttribute('aria-expanded'),
    ).toBe('true');
    // The panel is loaded through a dynamic import (AC-4): wait for its resolved state.
    expect((await screen.findByRole('button', { name: 'Open lootbox' })).tagName).toBe('BUTTON');
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('button', { name: 'Spaceship customization' }),
    );

    expect(main.getAttribute('data-customization-open')).toBe('false');
    expect(
      screen.getByRole('button', { name: 'Spaceship customization' }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Open lootbox' })).toBeNull();
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

describe('App — server activity ticker (AC-19…AC-21)', () => {
  const FEED: ActivityEvent[] = [
    {
      id: 5,
      at: 5000,
      serverId: 1,
      type: 'fastClear',
      playerId: 'p2',
      name: 'Player 2',
      level: 4,
      elapsedMs: 2500,
    },
    {
      id: 4,
      at: 4000,
      serverId: 1,
      type: 'cubeCleared',
      playerId: 'p1',
      name: 'Player 1',
      level: 3,
    },
  ];

  it('renders the ticker in the welcomed shell and keeps one live region (AC-19, AC-20)', () => {
    const html = renderToStaticMarkup(
      <App
        hasChosen
        session={sessionFor(
          snapshotFor('playing'),
          multiplayerFor({ world: worldFor({ activity: FEED }) }),
        )}
      />,
    );

    expect(html).toContain(
      '<aside class="activity-feed" aria-label="Server activity" aria-live="off" data-reduced-motion="false">',
    );
    expect(html).toContain(
      '<h2 class="activity-feed-title"><span class="gf-live-dot" data-live-dot="true" aria-hidden="true"></span>Server activity</h2>',
    );
    expect(html).toContain(
      '<li data-event-type="fastClear" data-event-id="5"><span class="activity-feed-text">Player 2 fast-cleared Cube 4 in 2.5s</span></li>',
    );
    expect(html).toContain(
      '<li data-event-type="cubeCleared" data-event-id="4"><span class="activity-feed-text">Player 1 cleared Cube 3</span></li>',
    );
    expect(occurrences(html, 'class="activity-feed"')).toBe(1);
    expect(occurrences(html, 'aria-live="polite"')).toBe(1);
    expect(occurrences(html, 'aria-live="assertive"')).toBe(0);
    expect(occurrences(html, 'role="status"')).toBe(1);
    expect(occurrences(html, 'role="alert"')).toBe(0);
    expect(occurrences(html, 'role="log"')).toBe(0);
  });

  it('marks the ticker reduced under the session reduced-motion preference (AC-21)', () => {
    const html = renderToStaticMarkup(
      <App
        hasChosen
        session={sessionFor(
          snapshotFor('playing', undefined, 0, { reducedMotion: true }),
          multiplayerFor({ world: worldFor({ activity: FEED }) }),
        )}
      />,
    );

    expect(html).toContain(
      '<aside class="activity-feed" aria-label="Server activity" aria-live="off" data-reduced-motion="true">',
    );
  });

  it('renders no ticker before the first welcome (AC-19, AC-20)', () => {
    const html = renderToStaticMarkup(
      <App
        hasChosen
        session={sessionFor(
          snapshotFor('playing'),
          multiplayerFor({
            world: worldFor({ serverId: 0, selfName: '', activity: FEED }),
          }),
        )}
      />,
    );

    expect(html).not.toContain('class="activity-feed"');
    expect(html).not.toContain('Server activity');
    expect(occurrences(html, 'aria-live="polite"')).toBe(1);
  });
});

describe('App — server leaderboard (AC-20, AC-21)', () => {
  const LEADERBOARD: LeaderboardSnapshot = {
    serverId: 1,
    at: 1000,
    entries: [
      { playerId: 'p2', name: 'Player 2', cubesCompleted: 2, clicks: 40 },
      { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 3 },
    ],
    totals: { cubesCompleted: 2, clicks: 43, facesDestroyed: 3 },
  };

  const FEED: ActivityEvent[] = [
    {
      id: 7,
      at: 7000,
      serverId: 1,
      type: 'memberJoined',
      playerId: 'p2',
      name: 'Player 2',
    },
  ];

  it('renders the populated panel beside the ticker in the welcomed shell and keeps one live region (AC-20, AC-21)', () => {
    const html = renderToStaticMarkup(
      <App
        hasChosen
        session={sessionFor(
          snapshotFor('playing'),
          multiplayerFor({ world: worldFor({ activity: FEED, leaderboard: LEADERBOARD }) }),
        )}
      />,
    );

    expect(html).toContain(
      '<aside class="leaderboard" aria-label="Server leaderboard" aria-live="off" data-reduced-motion="false" data-server-id="1">' +
        '<h2 class="leaderboard-title"><span class="gf-live-dot" data-live-dot="true" aria-hidden="true"></span>Leaderboard</h2>' +
        '<ol class="leaderboard-list">' +
        '<li data-rank="1" data-player-id="p2">' +
        '<span class="leaderboard-medal" data-medal="1" aria-hidden="true"></span>' +
        '<span class="leaderboard-rank">#1</span>' +
        '<span class="leaderboard-name">Player 2</span>' +
        '<span class="leaderboard-score">2 cubes · 40 clicks</span>' +
        '<span class="leaderboard-bar" data-bar="1" aria-hidden="true"></span>' +
        '</li>' +
        '<li data-rank="2" data-player-id="p1">' +
        '<span class="leaderboard-medal" data-medal="2" aria-hidden="true"></span>' +
        '<span class="leaderboard-rank">#2</span>' +
        '<span class="leaderboard-name">Player 1</span>' +
        '<span class="leaderboard-score">0 cubes · 3 clicks</span>' +
        '<span class="leaderboard-bar" data-bar="2" aria-hidden="true"></span>' +
        '</li>' +
        '</ol>' +
        '<p class="leaderboard-totals">Server totals: 2 cubes · 43 clicks · 3 faces</p>' +
        '</aside>',
    );
    expect(occurrences(html, 'class="leaderboard"')).toBe(1);
    // The ticker stays first and the rail follows it, before the user panel.
    expect(html.indexOf('class="activity-feed"')).toBeLessThan(html.indexOf('class="leaderboard"'));
    expect(html.indexOf('class="leaderboard"')).toBeLessThan(html.indexOf('class="user-panel"'));
    // AC-21: the ticker and the leaderboard are the only `aria-live="off"` landmarks and the
    // shell still has exactly one polite live region (`.phase-announcement`); no
    // status/alert/log competes.
    expect(occurrences(html, 'aria-live="polite"')).toBe(1);
    expect(occurrences(html, 'aria-live="assertive"')).toBe(0);
    expect(occurrences(html, 'aria-live="off"')).toBe(2);
    expect(occurrences(html, 'role="status"')).toBe(1);
    expect(occurrences(html, 'role="alert"')).toBe(0);
    expect(occurrences(html, 'role="log"')).toBe(0);
  });

  it('renders no panel before the first welcome (AC-20)', () => {
    const html = renderToStaticMarkup(
      <App
        hasChosen
        session={sessionFor(
          snapshotFor('playing'),
          multiplayerFor({
            world: worldFor({ serverId: 0, selfName: '', leaderboard: LEADERBOARD }),
          }),
        )}
      />,
    );

    expect(html).not.toContain('class="leaderboard"');
    expect(html).not.toContain('Server leaderboard');
    expect(occurrences(html, 'aria-live="polite"')).toBe(1);
  });

  it('renders no panel for an empty server snapshot (AC-20)', () => {
    const html = renderToStaticMarkup(
      <App
        hasChosen
        session={sessionFor(
          snapshotFor('playing'),
          multiplayerFor({
            world: worldFor({
              leaderboard: {
                serverId: 1,
                at: 1000,
                entries: [],
                totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
              },
            }),
          }),
        )}
      />,
    );

    expect(html).not.toContain('class="leaderboard"');
  });

  it('passes the session reduced-motion preference to the panel (AC-22)', () => {
    const html = renderToStaticMarkup(
      <App
        hasChosen
        session={sessionFor(
          snapshotFor('playing', undefined, 0, { reducedMotion: true }),
          multiplayerFor({ world: worldFor({ leaderboard: LEADERBOARD }) }),
        )}
      />,
    );

    expect(html).toContain(
      '<aside class="leaderboard" aria-label="Server leaderboard" aria-live="off" data-reduced-motion="true" data-server-id="1">',
    );
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
  function introSession(
    join: ReturnType<typeof vi.fn>,
    retryConnection: ReturnType<typeof vi.fn>,
    attach: ReturnType<typeof vi.fn> = vi.fn(),
  ): OnlineGameSession {
    return sessionFor(
      snapshotFor('intro'),
      multiplayerFor({ world: worldFor({ serverId: 0, selfName: '' }) }),
      { join, retryConnection, attach },
    );
  }

  it('does not attach while the guest menu or the login form is open (AC-1, AC-13)', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const attach = vi.fn();
    const session = introSession(join, retryConnection, attach);
    render(<App session={session} />);
    const user = userEvent.setup();

    expect(attach).toHaveBeenCalledTimes(0);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Login',
      'Register',
      'Play as guest',
    ]);

    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Welcome back' }).textContent).toBe('Welcome back');
    expect(attach).toHaveBeenCalledTimes(0);
    expect(join).toHaveBeenCalledTimes(0);
    expect(retryConnection).toHaveBeenCalledTimes(0);
  });

  it('clicking the rendered Play as guest button joins as guest and unmounts the menu', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const attach = vi.fn();
    const session = introSession(join, retryConnection, attach);
    render(<App session={session} />);
    const user = userEvent.setup();

    expect(attach).toHaveBeenCalledTimes(0);

    await user.click(screen.getByRole('button', { name: 'Play as guest' }));
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    expect(join).toHaveBeenCalledWith('guest');
    expect(retryConnection).toHaveBeenCalledTimes(0);
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith(canvasElement());
    expect(join.mock.invocationCallOrder[0]).toBeLessThan(attach.mock.invocationCallOrder[0]);
    expect(screen.queryByRole('button', { name: 'Play as guest' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Register' })).toBeNull();
  });

  it('drives the rendered login form submit and joins as account after reconnect', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const attach = vi.fn();
    const session = introSession(join, retryConnection, attach);
    const login = vi.fn(async () => undefined);
    const store = authStoreFor({ email: 'alice@example.com', verified: true }, { login, register: vi.fn() });
    render(<App session={session} store={store} />);
    const user = userEvent.setup();

    expect(attach).toHaveBeenCalledTimes(0);

    await user.click(screen.getByRole('button', { name: 'Login' }));
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({ username: 'alice', password: 'correct horse battery' });
    expect(retryConnection).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledWith('account');
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith(canvasElement());
    expect(login.mock.invocationCallOrder[0]).toBeLessThan(retryConnection.mock.invocationCallOrder[0]);
    expect(retryConnection.mock.invocationCallOrder[0]).toBeLessThan(join.mock.invocationCallOrder[0]);
    expect(join.mock.invocationCallOrder[0]).toBeLessThan(attach.mock.invocationCallOrder[0]);
    expect(screen.queryByRole('button', { name: 'Play as guest' })).toBeNull();
  });

  it('does not attach on the verification-pending screen or after Back to login (AC-3)', async () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const attach = vi.fn();
    const session = introSession(join, retryConnection, attach);
    const register = vi.fn(async () => ({ message: 'verification email sent' }));
    const store = authStoreFor(null, { register, login: vi.fn() });
    render(<App session={session} store={store} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Register' }));
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await screen.findByText('Check your email to verify your account.');
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'correct horse battery',
    });
    expect(join).toHaveBeenCalledTimes(0);
    expect(retryConnection).toHaveBeenCalledTimes(0);
    expect(attach).toHaveBeenCalledTimes(0);

    await user.click(screen.getByRole('button', { name: 'Back to login' }));

    expect(screen.getByRole('heading', { name: 'Welcome back' }).textContent).toBe('Welcome back');
    expect(attach).toHaveBeenCalledTimes(0);
    expect(join).toHaveBeenCalledTimes(0);
  });

  it('attaches once on mount when the gate starts closed (AC-4)', () => {
    const join = vi.fn();
    const retryConnection = vi.fn();
    const attach = vi.fn();
    const session = introSession(join, retryConnection, attach);

    render(<App chosen session={session} />);

    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith(canvasElement());
    expect(join).toHaveBeenCalledTimes(0);
    expect(retryConnection).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('dialog')).toBeNull();
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

  it('passes pendingLootboxOpen to the panel and disables Open lootbox while pending', async () => {
    render(
      <App
        hasChosen
        customizationOpen
        session={panelSession(CUSTOMIZATION, { pending: true })}
      />,
    );

    const open = await screen.findByRole<HTMLButtonElement>('button', { name: 'Open lootbox' });
    expect(open.disabled).toBe(true);
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(1);
  });

  it('enables Open lootbox when the open is not pending', async () => {
    render(
      <App
        hasChosen
        customizationOpen
        session={panelSession(CUSTOMIZATION, { pending: false })}
      />,
    );

    const open = await screen.findByRole<HTMLButtonElement>('button', { name: 'Open lootbox' });
    expect(open.disabled).toBe(false);
  });

  it('passes the last grant into the reveal region and dismisses it through the session', async () => {
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

    const region = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('.lootbox-reveal[data-reveal-active="true"]');
      if (element === null) {
        throw new Error('lootbox reveal region not rendered yet');
      }
      return element;
    });
    expect(region.getAttribute('data-part-id')).toBe('wing-left-silver');
    expect(region.getAttribute('data-slot')).toBe('wing-left');
    expect(region.getAttribute('data-rarity')).toBe('rare');
    expect(region.getAttribute('data-duplicate')).toBe('false');
    expect(region.textContent).toContain('Port Silver Wing');
    expect(region.textContent).toContain('Rare');
    expect(region.textContent).toContain('New');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }));
    expect(dismissLootboxReveal).toHaveBeenCalledTimes(1);
  });

  it('routes panel equip and unequip controls to the session commands', async () => {
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

    // The Wings row is only mounted on its tab, so activate it before the equip click; the
    // Unequip Hull control stays on the default Frame tab.
    fireEvent.click(await screen.findByRole('button', { name: 'Unequip Hull' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Wings, 1 of 244 parts owned' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Equip Port Silver Wing' }));

    expect(equipPart).toHaveBeenCalledTimes(1);
    expect(equipPart).toHaveBeenCalledWith('wing-left-silver');
    expect(unequipPart).toHaveBeenCalledTimes(1);
    expect(unequipPart).toHaveBeenCalledWith('hull');
  });
});

describe('App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31)', () => {
  const CUSTOMIZATION: CustomizationState = {
    lootboxes: 1,
    keys: 1,
    parts: { 'wing-left-silver': 1 },
    appearance: {},
  };

  const GRANT: LootboxGrant = {
    partId: 'wing-left-silver',
    slot: 'wing-left',
    rarity: 'rare',
    duplicate: false,
    sequence: 1,
  };

  function revealSnapshot(
    grant: LootboxGrant | null,
    customization: CustomizationState = CUSTOMIZATION,
  ): EngineSnapshot {
    return snapshotFor('playing', { clicks: 0, facesDestroyed: 0, coins: 0 }, 0, {
      customization,
      lastLootboxGrant: grant,
    });
  }

  /** The reveal root while it is mounted; a concrete failure when it never mounts. */
  async function revealingReveal(): Promise<HTMLElement> {
    return waitFor(() => {
      const element = document.querySelector<HTMLElement>('.lootbox-reveal[data-reveal-active="true"]');
      if (element === null) {
        throw new Error('lootbox reveal region not rendered yet');
      }
      return element;
    });
  }

  it('renders the reveal on the opener tab and never on a second tab that only adopted the parts (AC-2)', async () => {
    const opener = render(
      <App
        hasChosen
        customizationOpen
        session={sessionFor(revealSnapshot(GRANT), multiplayerFor())}
      />,
    );
    const revealRoot = await revealingReveal();

    expect(revealRoot.getAttribute('data-part-id')).toBe('wing-left-silver');
    expect(revealRoot.getAttribute('data-slot')).toBe('wing-left');
    expect(revealRoot.getAttribute('data-rarity')).toBe('rare');
    expect(revealRoot.getAttribute('role')).toBe('group');
    expect(revealRoot.getAttribute('aria-live')).toBe('off');
    expect(revealRoot.getAttribute('aria-label')).toBe('Lootbox reveal: Port Silver Wing');
    expect(revealRoot.getAttribute('data-reveal-sequence')).toBe('1');
    expect(revealRoot.getAttribute('data-reveal-active')).toBe('true');
    expect(revealRoot.textContent).toContain('Port Silver Wing');
    expect(
      document.querySelector('.customization-panel')?.getAttribute('data-reveal-active'),
    ).toBe('true');
    opener.unmount();

    // The same account's second tab receives only `customizationUpdate`: the absolute
    // parts/appearance are adopted but `lastLootboxGrant` stays `null`, so no reveal
    // renders even though the part is owned in that tab (AC-2).
    render(
      <App
        hasChosen
        customizationOpen
        session={sessionFor(revealSnapshot(null), multiplayerFor())}
      />,
    );
    const open = await screen.findByRole('button', { name: 'Open lootbox' });
    expect(open.textContent).toBe('Open lootbox');
    expect(document.querySelector('.customization-panel')?.getAttribute('data-reveal-active')).toBe(
      'false',
    );
    expect(document.querySelectorAll('.lootbox-reveal')).toHaveLength(0);
    // The tabbed panel mounts only the default tab's two rows: 2 rows x 3 classic variants.
    expect(document.querySelectorAll('.customization-panel .customization-variant')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: 'Dismiss lootbox reveal' })).toBeNull();
  });

  it('drops a mid-reveal when the transport leaves connected: the session clears the grant and publishes the snapshot (AC-11)', async () => {
    const { session, setSnapshot, setMultiplayer } = mutableSession(
      revealSnapshot(GRANT),
      multiplayerFor(),
    );
    render(<App hasChosen customizationOpen session={session} />);
    await revealingReveal();

    // `OnlineGameSession.handleStatus` (T4) clears the grant and publishes the engine
    // snapshot before the status publish; the shell keeps no local grant copy, so the
    // reveal cannot survive the status change.
    act(() => {
      setSnapshot(revealSnapshot(null));
      setMultiplayer(multiplayerFor({ status: 'disconnected' }));
    });

    expect(document.querySelectorAll('.lootbox-reveal')).toHaveLength(0);
    expect(document.querySelector('[data-reveal-active="true"]')).toBeNull();
    const panel = document.querySelector('.customization-panel');
    expect(panel?.getAttribute('data-reveal-active')).toBe('false');
    const open = await screen.findByRole('button', { name: 'Open lootbox' });
    expect(open.textContent).toBe('Open lootbox');
    expect(document.querySelector('.connection-banner')?.getAttribute('data-status')).toBe(
      'disconnected',
    );
  });

  it('treats a toggle-click close as a dismissal and never restores focus to the absent Open lootbox (AC-13)', async () => {
    const dismissLootboxReveal = vi.fn();
    const { session, setSnapshot } = mutableSession(revealSnapshot(GRANT), multiplayerFor());
    render(
      <App
        hasChosen
        customizationOpen
        session={{ ...session, dismissLootboxReveal }}
      />,
    );
    await revealingReveal();
    const toggle = screen.getByRole('button', { name: 'Spaceship customization' });
    toggle.focus();

    await userEvent.click(toggle);

    // Panel close is a dismissal: the panel's unmount-only cleanup called it once.
    expect(dismissLootboxReveal).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(0);
    expect(document.querySelectorAll('.lootbox-reveal')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Open lootbox' })).toBeNull();
    // No focus restoration to the absent `Open lootbox`: the activator keeps focus.
    expect(document.activeElement).toBe(toggle);

    // The session cleared the grant on dismissal; reopening renders the normal panel.
    act(() => {
      setSnapshot(revealSnapshot(null));
    });
    await userEvent.click(toggle);
    const open = await screen.findByRole('button', { name: 'Open lootbox' });
    expect(open.textContent).toBe('Open lootbox');
    expect(document.querySelectorAll('.lootbox-reveal')).toHaveLength(0);
    expect(
      screen.getByRole('button', { name: 'Spaceship customization' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('renders one decorative ambience layer and keeps the reveal non-modal (AC-27)', async () => {
    render(
      <App
        hasChosen
        customizationOpen
        session={sessionFor(revealSnapshot(GRANT), multiplayerFor())}
      />,
    );
    await revealingReveal();
    const main = screen.getByRole('main');
    const layers = Array.from(main.children).filter((child) =>
      child.classList.contains('game-ambience'),
    );
    const toggle = screen.getByRole('button', { name: 'Spaceship customization' });

    expect(layers).toHaveLength(1);
    expect(layers[0].tagName).toBe('DIV');
    expect(layers[0].getAttribute('aria-hidden')).toBe('true');
    expect(layers[0].getAttribute('data-reduced-motion')).toBe('false');
    // No scrim and no `data-reveal-active` on `<main>`: the game stays interactive.
    expect(main.hasAttribute('data-reveal-active')).toBe(false);
    expect(document.querySelectorAll('.scrim, .reveal-scrim')).toHaveLength(0);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(1);

    // The toggle above the spotlight is still clickable while revealing.
    await userEvent.click(toggle);
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(0);
  });

  it('marks the ambience reduced under the session reduced-motion preference (AC-27)', () => {
    const html = renderToStaticMarkup(
      <App
        hasChosen
        session={sessionFor(
          snapshotFor('playing', undefined, 0, { reducedMotion: true }),
          multiplayerFor(),
        )}
      />,
    );

    expect(html).toContain(
      '<div class="game-ambience" aria-hidden="true" data-reduced-motion="true"></div>',
    );
    expect(html).toContain('<main data-customization-open="false" data-reduced-motion="true">');
    expect(occurrences(html, 'class="game-ambience"')).toBe(1);
  });

  it('propagates the session reduced-motion marker to the shell main (AC-31)', () => {
    const { session, setSnapshot } = mutableSession(
      snapshotFor('playing'),
      multiplayerFor(),
    );
    render(<App hasChosen session={session} />);
    const main = screen.getByRole('main');

    expect(main.getAttribute('data-reduced-motion')).toBe('false');

    act(() => {
      setSnapshot(snapshotFor('playing', undefined, 0, { reducedMotion: true }));
    });

    expect(main.getAttribute('data-reduced-motion')).toBe('true');
    expect(main.getAttribute('data-customization-open')).toBe('false');
  });

  it('keeps exactly one polite live region in the settled welcomed shell (AC-31)', () => {
    render(<App hasChosen session={sessionFor(snapshotFor('playing'), multiplayerFor())} />);
    const statuses = screen.getAllByRole('status');

    expect(statuses).toHaveLength(1);
    expect(statuses[0].getAttribute('class')).toBe('phase-announcement');
    expect(statuses[0].getAttribute('aria-live')).toBe('polite');
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(document.querySelectorAll('[aria-live="assertive"]')).toHaveLength(0);
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(document.querySelectorAll('[role="log"]')).toHaveLength(0);
  });

  it('keeps exactly one polite live region once the customization chunk resolves (AC-31)', async () => {
    render(
      <App
        hasChosen
        customizationOpen
        session={sessionFor(revealSnapshot(null), multiplayerFor())}
      />,
    );
    const open = await screen.findByRole('button', { name: 'Open lootbox' });

    expect(open.textContent).toBe('Open lootbox');
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(document.querySelectorAll('.lootbox-reveal')).toHaveLength(0);
  });

  it('adds no live region while the reveal is mounted (AC-31)', async () => {
    render(
      <App
        hasChosen
        customizationOpen
        session={sessionFor(revealSnapshot(GRANT), multiplayerFor())}
      />,
    );
    await revealingReveal();
    const revealRoot = document.querySelector('.lootbox-reveal');

    expect(revealRoot?.getAttribute('role')).toBe('group');
    expect(revealRoot?.getAttribute('aria-live')).toBe('off');
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(document.querySelectorAll('[aria-live="assertive"]')).toHaveLength(0);
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });

  it('keeps the gameplay headings real h2 elements and the panel aria-labels (AC-29)', async () => {
    render(
      <App
        hasChosen
        customizationOpen
        session={sessionFor(revealSnapshot(null), multiplayerFor())}
      />,
    );
    await screen.findByRole('button', { name: 'Open lootbox' });

    expect(screen.getByRole('heading', { level: 2, name: 'Pilot status' }).getAttribute('class')).toBe(
      'hud-title',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Spaceship hangar' }).getAttribute('class'),
    ).toBe('customization-title');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Upgrades' }).getAttribute('class'),
    ).toBe('upgrades-title');
    expect(screen.getByRole('region', { name: 'Game statistics' })).toBe(
      document.querySelector('.hud-panel'),
    );
    expect(document.querySelector('.customization-panel')?.getAttribute('aria-label')).toBe(
      'Spaceship customization',
    );
    expect(document.querySelector('.upgrades-panel')?.getAttribute('aria-label')).toBe('Upgrades');
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

  it('renders no perf overlay and never polls the session when VITE_PERF_OVERLAY is unset (AC-19)', () => {
    const getPerfStats = vi.fn(() => ({ frameMs: 16.7, tier: 'high' as const, drawCalls: 42, triangles: 1000 }));
    const measureRtt = vi.fn(() => Promise.resolve(24));
    const session = sessionFor(snapshotFor('playing'), multiplayerFor(), {
      getPerfStats,
      measureRtt,
    });

    render(<App hasChosen session={session} />);

    expect(screen.queryByTestId('perf-overlay')).toBeNull();
    expect(getPerfStats).not.toHaveBeenCalled();
    expect(measureRtt).not.toHaveBeenCalled();
  });

  it('renders the dev overlay with its exact labels when VITE_PERF_OVERLAY is true (AC-20)', async () => {
    vi.stubEnv('VITE_PERF_OVERLAY', 'true');
    const getPerfStats = vi.fn(() => ({ frameMs: 16.7, tier: 'high' as const, drawCalls: 42, triangles: 1000 }));
    const measureRtt = vi.fn(() => Promise.resolve(24));
    const session = sessionFor(snapshotFor('playing'), multiplayerFor(), {
      getPerfStats,
      measureRtt,
    });

    render(<App hasChosen session={session} />);

    const overlay = await screen.findByTestId('perf-overlay');
    await waitFor(() => {
      expect(overlay.textContent).toBe(
        'Frame 16.7 ms' + 'Quality high' + 'Draw calls 42' + 'Triangles 1000' + 'WS RTT 24 ms',
      );
    });

    expect(overlay.tagName).toBe('ASIDE');
    expect(overlay.getAttribute('aria-live')).toBe('off');
    expect(getPerfStats).toHaveBeenCalledTimes(1);
    expect(measureRtt).toHaveBeenCalledTimes(1);
  });
});
