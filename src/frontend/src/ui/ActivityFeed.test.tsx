import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ActivityEvent } from '../multiplayer/protocol';
import {
  ACTIVITY_VISIBLE_COUNT,
  ActivityFeed,
  activityText,
  formatActivitySeconds,
} from './ActivityFeed';

/**
 * Activity ticker integration tests through React SSR (live-activity-feed, AC-19…AC-22, T4).
 *
 * The workspace renders components with `renderToStaticMarkup`, so the pinned evidence is the
 * exact markup each feed produces. `events` arrive newest-first from `WorldState.activity`; the
 * fixtures below use ids 6…1 in that order, so the slice, the order and the 5-visible cap are
 * observable in one render.
 */

/** The full six-type ring, newest first: every text variant is in the newest five except the sixth. */
const FEED: readonly ActivityEvent[] = [
  {
    id: 6,
    at: 6000,
    serverId: 1,
    type: 'fastClear',
    playerId: 'p1',
    name: 'Player 1',
    level: 4,
    elapsedMs: 2500,
  },
  {
    id: 5,
    at: 5000,
    serverId: 1,
    type: 'cubeCleared',
    playerId: 'p1',
    name: 'Player 1',
    level: 3,
  },
  {
    id: 4,
    at: 4000,
    serverId: 1,
    type: 'levelMilestone',
    playerId: 'p1',
    name: 'Player 1',
    level: 5,
  },
  {
    id: 3,
    at: 3000,
    serverId: 1,
    type: 'epicLoot',
    playerId: 'p1',
    name: 'Player 1',
    partId: 'hull-gold',
  },
  {
    id: 2,
    at: 2000,
    serverId: 1,
    type: 'memberJoined',
    playerId: 'p1',
    name: 'Player 1',
  },
  {
    id: 1,
    at: 1000,
    serverId: 1,
    type: 'memberLeft',
    playerId: 'p1',
    name: 'Player 1',
  },
];

describe('ActivityFeed', () => {
  it('renders exactly the five newest events with the pinned accessible markup (AC-19)', () => {
    const html = renderToStaticMarkup(<ActivityFeed events={FEED} />);

    expect(html).toBe(
      '<aside class="activity-feed" aria-label="Server activity" aria-live="off" data-reduced-motion="false">' +
        '<h2 class="activity-feed-title">Server activity</h2>' +
        '<ol class="activity-feed-list">' +
        '<li data-event-type="fastClear" data-event-id="6">' +
        '<span class="activity-feed-text">Player 1 fast-cleared Cube 4 in 2.5s</span>' +
        '</li>' +
        '<li data-event-type="cubeCleared" data-event-id="5">' +
        '<span class="activity-feed-text">Player 1 cleared Cube 3</span>' +
        '</li>' +
        '<li data-event-type="levelMilestone" data-event-id="4">' +
        '<span class="activity-feed-text">Player 1 completed 5 cubes</span>' +
        '</li>' +
        '<li data-event-type="epicLoot" data-event-id="3">' +
        '<span class="activity-feed-text">Player 1 unboxed an epic part</span>' +
        '</li>' +
        '<li data-event-type="memberJoined" data-event-id="2">' +
        '<span class="activity-feed-text">Player 1 joined</span>' +
        '</li>' +
        '</ol>' +
        '</aside>',
    );
  });

  it('pins the exact sentence for every event type (AC-19)', () => {
    expect(activityText(FEED[0])).toBe('Player 1 fast-cleared Cube 4 in 2.5s');
    expect(activityText(FEED[1])).toBe('Player 1 cleared Cube 3');
    expect(activityText(FEED[2])).toBe('Player 1 completed 5 cubes');
    expect(activityText(FEED[3])).toBe('Player 1 unboxed an epic part');
    expect(activityText(FEED[4])).toBe('Player 1 joined');
    expect(activityText(FEED[5])).toBe('Player 1 left');
  });

  it('formats the fast-clear duration with one decimal and a trailing s (AC-19)', () => {
    expect(formatActivitySeconds(2500)).toBe('2.5s');
    expect(formatActivitySeconds(999)).toBe('1.0s');
    expect(formatActivitySeconds(0)).toBe('0.0s');
  });

  it('shows at most the five newest events in newest-first order (AC-19)', () => {
    const ring: ActivityEvent[] = Array.from({ length: 8 }, (_, index) => ({
      id: 8 - index,
      at: 8000 - index * 1000,
      serverId: 1,
      type: 'cubeCleared',
      playerId: 'p1',
      name: 'Player 1',
      level: 8 - index,
    }));

    const html = renderToStaticMarkup(<ActivityFeed events={ring} />);

    expect(ACTIVITY_VISIBLE_COUNT).toBe(5);
    expect([...html.matchAll(/data-event-id="(\d+)"/g)].map((match) => match[1])).toEqual([
      '8',
      '7',
      '6',
      '5',
      '4',
    ]);
    expect(html).not.toContain('data-event-id="3"');
  });

  it('renders nothing for an empty feed (AC-19)', () => {
    expect(ActivityFeed({ events: [] })).toBeNull();
    expect(renderToStaticMarkup(<ActivityFeed events={[]} />)).toBe('');
  });

  it('contributes no live-region semantics and no focusable control (AC-20)', () => {
    const html = renderToStaticMarkup(<ActivityFeed events={FEED} />);

    expect(html).toContain('aria-live="off"');
    expect(html).not.toContain('aria-live="polite"');
    expect(html).not.toContain('aria-live="assertive"');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="log"');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('tabindex');
  });

  it('exposes the reduced-motion variant on the root and defaults to false (AC-21)', () => {
    expect(renderToStaticMarkup(<ActivityFeed events={FEED} reducedMotion />)).toContain(
      '<aside class="activity-feed" aria-label="Server activity" aria-live="off" data-reduced-motion="true">',
    );
    expect(renderToStaticMarkup(<ActivityFeed events={FEED} reducedMotion={false} />)).toContain(
      '<aside class="activity-feed" aria-label="Server activity" aria-live="off" data-reduced-motion="false">',
    );
  });
});
