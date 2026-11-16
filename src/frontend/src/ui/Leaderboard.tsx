import type { ReactElement } from 'react';

import type { LeaderboardEntry, LeaderboardSnapshot } from '../multiplayer/protocol';

/**
 * The per-server live leaderboard panel (`server-live-leaderboard`, AC-20…AC-23, T4).
 *
 * The snapshot arrives already ranked by the server (cubes desc → clicks desc → slot
 * order), so this component never re-sorts: it renders the first five rows in wire order
 * and the server-wide totals verbatim. The panel is deliberately **not** a live region
 * (`aria-live="off"`, no `role="status"`/`alert`/`log`) so `.phase-announcement` stays the
 * shell's only polite region; a screen reader reads the landmark and the ordered list on
 * demand. There is no focusable control, no timestamp (the `at` clock is the server's) and
 * no coin column: guests and accounts compete on the same session counters.
 *
 * `data-reduced-motion` lets `game-view.css` disable the 160 ms row-entry animation for the
 * session preference independently of `prefers-reduced-motion`.
 */

/** How many server-ranked rows the panel shows (the wire snapshot is already capped at 5). */
export const LEADERBOARD_VISIBLE_COUNT = 5;

/** Count-aware noun: `0 cubes`, `1 cube`, `2 cubes` (plan § Pinned display text). */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The exact score text for one row: `2 cubes · 40 clicks`. */
export function leaderboardEntryText(entry: LeaderboardEntry): string {
  return `${pluralize(entry.cubesCompleted, 'cube', 'cubes')} · ${pluralize(
    entry.clicks,
    'click',
    'clicks',
  )}`;
}

/** The exact server-totals text: `Server totals: 2 cubes · 40 clicks · 3 faces`. */
export function leaderboardTotalsText(totals: LeaderboardSnapshot['totals']): string {
  return `Server totals: ${pluralize(totals.cubesCompleted, 'cube', 'cubes')} · ${pluralize(
    totals.clicks,
    'click',
    'clicks',
  )} · ${pluralize(totals.facesDestroyed, 'face', 'faces')}`;
}

export function Leaderboard({
  snapshot,
  reducedMotion = false,
}: {
  snapshot: LeaderboardSnapshot | null;
  reducedMotion?: boolean;
}): ReactElement | null {
  if (snapshot === null || snapshot.entries.length === 0) {
    return null;
  }

  return (
    <aside
      className="leaderboard"
      aria-label="Server leaderboard"
      aria-live="off"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-server-id={snapshot.serverId}
    >
      <h2 className="leaderboard-title">Leaderboard</h2>
      <ol className="leaderboard-list">
        {snapshot.entries.slice(0, LEADERBOARD_VISIBLE_COUNT).map((entry, index) => (
          <li key={entry.playerId} data-rank={index + 1} data-player-id={entry.playerId}>
            <span className="leaderboard-rank">#{index + 1}</span>
            <span className="leaderboard-name">{entry.name}</span>
            <span className="leaderboard-score">{leaderboardEntryText(entry)}</span>
          </li>
        ))}
      </ol>
      <p className="leaderboard-totals">{leaderboardTotalsText(snapshot.totals)}</p>
    </aside>
  );
}
