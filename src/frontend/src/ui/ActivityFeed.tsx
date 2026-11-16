import type { ReactElement } from 'react';

import type { ActivityEvent } from '../multiplayer/protocol';

/**
 * The server activity ticker (live-activity-feed, AC-19…AC-22, T4).
 *
 * A non-interactive complementary landmark showing the five newest accepted events of the
 * current server, newest first (the reducer keeps the feed newest-first, so the slice takes
 * the head). It is deliberately **not** a live region: `aria-live="off"` and no
 * `role="status"`/`alert`/`log`, so the shell keeps exactly one polite region
 * (`.phase-announcement`) and the feed never competes with gameplay announcements.
 *
 * The copy is built from server-issued fields only and renders as text (React escapes it);
 * no timestamp is shown because the event clock is the server clock, not the client's.
 * The title carries one decorative `gf-live-dot` (`aria-hidden`, `data-live-dot`) so the
 * rail reads as live without adding any accessible semantics.
 * `data-reduced-motion` lets `game-view.css` disable the 160 ms entry animation for the
 * session preference independently of `prefers-reduced-motion`.
 */

/** How many newest events the ticker shows (the ring keeps up to 20). */
export const ACTIVITY_VISIBLE_COUNT = 5;

/** Pinned fast-clear duration format: `2500 → "2.5s"`, `999 → "1.0s"`, `0 → "0.0s"`. */
export function formatActivitySeconds(elapsedMs: number): string {
  return (elapsedMs / 1000).toFixed(1) + 's';
}

/** The exact sentence for one event (plan § Pinned display text). */
export function activityText(event: ActivityEvent): string {
  switch (event.type) {
    case 'cubeCleared':
      return `${event.name} cleared Cube ${event.level}`;
    case 'fastClear':
      return `${event.name} fast-cleared Cube ${event.level} in ${formatActivitySeconds(
        event.elapsedMs,
      )}`;
    case 'levelMilestone':
      return `${event.name} completed ${event.level} cubes`;
    case 'epicLoot':
      return `${event.name} unboxed an epic part`;
    case 'memberJoined':
      return `${event.name} joined`;
    case 'memberLeft':
      return `${event.name} left`;
  }
}

export function ActivityFeed({
  events,
  reducedMotion = false,
}: {
  events: readonly ActivityEvent[];
  reducedMotion?: boolean;
}): ReactElement | null {
  if (events.length === 0) {
    return null;
  }

  return (
    <aside
      className="activity-feed"
      aria-label="Server activity"
      aria-live="off"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <h2 className="activity-feed-title">
        <span className="gf-live-dot" data-live-dot="true" aria-hidden="true" />
        Server activity
      </h2>
      <ol className="activity-feed-list">
        {events.slice(0, ACTIVITY_VISIBLE_COUNT).map((event) => (
          <li key={event.id} data-event-type={event.type} data-event-id={event.id}>
            <span className="activity-feed-text">{activityText(event)}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
