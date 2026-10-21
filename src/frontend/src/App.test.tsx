import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { createBoard } from './game/board';
import type { EngineSnapshot } from './game/engine';
import { CUBE_STYLES } from './game/progression';
import type { GameSession } from './game/session';
import { GRID_SIZE, type GameStats, type Phase } from './game/types';

/**
 * Integration test for the game shell (AC-1, AC-11, AC-14): the real `App`, `Hud` and
 * `GameCanvas` composed in the workspace's node test environment.
 *
 * SSR executes the render path only; the canvas attach/dispose effect never runs (the
 * documented React residual, spec § Testing strategy). To pin the markup per phase
 * without a DOM, the shell accepts an injected session — the same dependency-injection
 * shape the session itself uses for its environment.
 */

const ARIA_LABEL =
  'Game canvas: click a mini-cube to explode it; drag or press the arrow keys to rotate the cube';

function snapshotFor(
  phase: Phase,
  stats: GameStats = { clicks: 0, facesDestroyed: 0 },
  levelIndex = 0,
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
    reducedMotion: false,
  };
}

/** A session boundary fake: the shell only reads `getSnapshot`/`subscribe` under SSR. */
function sessionFor(snapshot: EngineSnapshot): GameSession {
  return {
    attach: () => {},
    dispose: () => {},
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  };
}

/** Counts exact occurrences of a literal in the rendered markup (live-region uniqueness). */
function occurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/** The shell markup with the phase region's pinned text content filled in. */
function shellHtml(regionText: string): string {
  return (
    `<main><canvas tabindex="0" aria-label="${ARIA_LABEL}" style="touch-action:none"></canvas>` +
    '<section aria-label="Game statistics">' +
    '<p>Clicks: <span data-stat="clicks">0</span></p>' +
    '<p>Faces destroyed: <span data-stat="faces-destroyed">0</span></p>' +
    '<p>Cube <span data-stat="cube">1</span></p>' +
    '</section>' +
    `<div class="phase-announcement" role="status" aria-live="polite">${regionText}</div>` +
    '</main>'
  );
}

describe('App', () => {
  it('renders the full intro shell on first paint (default session, no DOM)', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toBe(shellHtml('Click or press any key to skip'));
  });

  it('renders the travel phase copy in the same single live region', () => {
    const html = renderToStaticMarkup(<App session={sessionFor(snapshotFor('travel'))} />);

    expect(html).toBe(shellHtml('Traveling to the next cube…'));
  });

  it('renders the playing phase with an empty live region that is still present', () => {
    const html = renderToStaticMarkup(<App session={sessionFor(snapshotFor('playing'))} />);

    // AC-14: `playing` is empty text content — the element is neither removed nor hidden.
    expect(html).toBe(shellHtml(''));
    expect(html).not.toContain('hidden');
    expect(occurrences(html, 'role="status"')).toBe(1);
  });

  it('binds the HUD to the session snapshot values (AC-11)', () => {
    const snapshot = snapshotFor('playing', { clicks: 12, facesDestroyed: 4 }, 3);
    const html = renderToStaticMarkup(<App session={sessionFor(snapshot)} />);

    expect(html).toContain('<p>Clicks: <span data-stat="clicks">12</span></p>');
    expect(html).toContain('<p>Faces destroyed: <span data-stat="faces-destroyed">4</span></p>');
    expect(html).toContain('<p>Cube <span data-stat="cube">4</span></p>');
    // Still exactly one live region in the shell (AC-14).
    expect(occurrences(html, 'aria-live=')).toBe(1);
  });
});
