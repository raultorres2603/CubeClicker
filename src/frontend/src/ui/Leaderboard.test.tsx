import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { LeaderboardSnapshot } from '../multiplayer/protocol';
import {
  LEADERBOARD_VISIBLE_COUNT,
  Leaderboard,
  leaderboardEntryText,
  leaderboardTotalsText,
  pluralize,
} from './Leaderboard';

/**
 * Leaderboard panel integration tests through React SSR (`server-live-leaderboard`,
 * AC-20…AC-22, T4).
 *
 * The server owns the ranking, so the fixtures below use an already-ranked snapshot; the
 * component must render it verbatim (no re-sort, no recomputed totals). The exact markup
 * pins the single non-live landmark, the five-row cap, the pluralized text and the
 * reduced-motion hook the stylesheet keys on.
 */

const SNAPSHOT: LeaderboardSnapshot = {
  serverId: 1,
  at: 1000,
  entries: [
    { playerId: 'p2', name: 'Player 2', cubesCompleted: 2, clicks: 40 },
    { playerId: 'p1', name: 'Player 1', cubesCompleted: 1, clicks: 1 },
    { playerId: 'p3', name: 'Player 3', cubesCompleted: 0, clicks: 0 },
  ],
  totals: { cubesCompleted: 3, clicks: 41, facesDestroyed: 3 },
};

describe('Leaderboard', () => {
  it('renders exactly the server-ranked rows and totals with the pinned accessible markup (AC-20)', () => {
    const html = renderToStaticMarkup(<Leaderboard snapshot={SNAPSHOT} />);

    expect(html).toBe(
      '<aside class="leaderboard" aria-label="Server leaderboard" aria-live="off" data-reduced-motion="false" data-server-id="1">' +
        '<h2 class="leaderboard-title">Leaderboard</h2>' +
        '<ol class="leaderboard-list">' +
        '<li data-rank="1" data-player-id="p2">' +
        '<span class="leaderboard-rank">#1</span>' +
        '<span class="leaderboard-name">Player 2</span>' +
        '<span class="leaderboard-score">2 cubes · 40 clicks</span>' +
        '</li>' +
        '<li data-rank="2" data-player-id="p1">' +
        '<span class="leaderboard-rank">#2</span>' +
        '<span class="leaderboard-name">Player 1</span>' +
        '<span class="leaderboard-score">1 cube · 1 click</span>' +
        '</li>' +
        '<li data-rank="3" data-player-id="p3">' +
        '<span class="leaderboard-rank">#3</span>' +
        '<span class="leaderboard-name">Player 3</span>' +
        '<span class="leaderboard-score">0 cubes · 0 clicks</span>' +
        '</li>' +
        '</ol>' +
        '<p class="leaderboard-totals">Server totals: 3 cubes · 41 clicks · 3 faces</p>' +
        '</aside>',
    );
  });

  it('pluralizes 0, 1 and 2 exactly (AC-20)', () => {
    expect(pluralize(0, 'cube', 'cubes')).toBe('0 cubes');
    expect(pluralize(1, 'cube', 'cubes')).toBe('1 cube');
    expect(pluralize(2, 'click', 'clicks')).toBe('2 clicks');

    expect(leaderboardEntryText({ playerId: 'p1', name: 'Player 1', cubesCompleted: 2, clicks: 40 })).toBe(
      '2 cubes · 40 clicks',
    );
    expect(leaderboardEntryText({ playerId: 'p1', name: 'Player 1', cubesCompleted: 1, clicks: 1 })).toBe(
      '1 cube · 1 click',
    );
    expect(leaderboardEntryText({ playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 0 })).toBe(
      '0 cubes · 0 clicks',
    );

    expect(leaderboardTotalsText({ cubesCompleted: 2, clicks: 40, facesDestroyed: 3 })).toBe(
      'Server totals: 2 cubes · 40 clicks · 3 faces',
    );
    expect(leaderboardTotalsText({ cubesCompleted: 1, clicks: 1, facesDestroyed: 1 })).toBe(
      'Server totals: 1 cube · 1 click · 1 face',
    );
    expect(leaderboardTotalsText({ cubesCompleted: 0, clicks: 0, facesDestroyed: 0 })).toBe(
      'Server totals: 0 cubes · 0 clicks · 0 faces',
    );
  });

  it('caps the list at the five server-ranked entries (AC-20)', () => {
    const six: LeaderboardSnapshot = {
      serverId: 4,
      at: 2000,
      entries: Array.from({ length: 6 }, (_, index) => ({
        playerId: `p${index + 1}`,
        name: `Player ${index + 1}`,
        cubesCompleted: 6 - index,
        clicks: 0,
      })),
      totals: { cubesCompleted: 21, clicks: 0, facesDestroyed: 0 },
    };

    const html = renderToStaticMarkup(<Leaderboard snapshot={six} />);

    expect(LEADERBOARD_VISIBLE_COUNT).toBe(5);
    expect([...html.matchAll(/data-player-id="([^"]+)"/g)].map((match) => match[1])).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
    ]);
    expect([...html.matchAll(/data-rank="(\d+)"/g)].map((match) => match[1])).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    expect(html).not.toContain('data-player-id="p6"');
    expect(html).toContain('<p class="leaderboard-totals">Server totals: 21 cubes · 0 clicks · 0 faces</p>');
  });

  it('never re-sorts the server order (AC-20)', () => {
    // Deliberately "unsorted" by cubes: the server's slot/click tie-break order must win.
    const wireOrder: LeaderboardSnapshot = {
      serverId: 1,
      at: 1000,
      entries: [
        { playerId: 'p1', name: 'Player 1', cubesCompleted: 1, clicks: 200 },
        { playerId: 'p2', name: 'Player 2', cubesCompleted: 9, clicks: 0 },
      ],
      totals: { cubesCompleted: 10, clicks: 200, facesDestroyed: 0 },
    };

    const html = renderToStaticMarkup(<Leaderboard snapshot={wireOrder} />);

    expect([...html.matchAll(/data-player-id="([^"]+)"/g)].map((match) => match[1])).toEqual([
      'p1',
      'p2',
    ]);
  });

  it('renders nothing for a null snapshot or an empty server (AC-20)', () => {
    expect(Leaderboard({ snapshot: null })).toBeNull();
    expect(renderToStaticMarkup(<Leaderboard snapshot={null} />)).toBe('');

    const empty: LeaderboardSnapshot = {
      serverId: 1,
      at: 1000,
      entries: [],
      totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
    };
    expect(Leaderboard({ snapshot: empty })).toBeNull();
    expect(renderToStaticMarkup(<Leaderboard snapshot={empty} />)).toBe('');
  });

  it('contributes no live region, focusable control, timestamp or coin column (AC-20, AC-21)', () => {
    const html = renderToStaticMarkup(<Leaderboard snapshot={SNAPSHOT} />);

    expect(html).toContain('aria-live="off"');
    expect(html).not.toContain('aria-live="polite"');
    expect(html).not.toContain('aria-live="assertive"');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="log"');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('<time');
    expect(html).not.toContain('1000');
    expect(html).not.toMatch(/coin/i);
  });

  it('exposes the reduced-motion variant on the root (AC-22)', () => {
    expect(renderToStaticMarkup(<Leaderboard snapshot={SNAPSHOT} reducedMotion />)).toContain(
      '<aside class="leaderboard" aria-label="Server leaderboard" aria-live="off" data-reduced-motion="true" data-server-id="1">',
    );
    expect(
      renderToStaticMarkup(<Leaderboard snapshot={SNAPSHOT} reducedMotion={false} />),
    ).toContain(
      '<aside class="leaderboard" aria-label="Server leaderboard" aria-live="off" data-reduced-motion="false" data-server-id="1">',
    );
  });

  it('renders guests and accounts from exactly the same server-issued fields (AC-20)', () => {
    const guest: LeaderboardSnapshot = {
      serverId: 1,
      at: 1000,
      entries: [{ playerId: 'p2', name: 'Player 2', cubesCompleted: 1, clicks: 7 }],
      totals: { cubesCompleted: 1, clicks: 7, facesDestroyed: 1 },
    };
    const account: LeaderboardSnapshot = {
      ...guest,
      entries: [{ playerId: 'p2', name: 'alice', cubesCompleted: 1, clicks: 7 }],
    };

    const guestHtml = renderToStaticMarkup(<Leaderboard snapshot={guest} />);
    const accountHtml = renderToStaticMarkup(<Leaderboard snapshot={account} />);

    expect(guestHtml.replace('Player 2', 'alice')).toBe(accountHtml);
    expect(accountHtml).not.toContain('accountId');
    expect(accountHtml).not.toContain('@');
  });
});
