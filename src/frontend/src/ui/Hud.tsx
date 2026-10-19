import type { ReactElement } from 'react';

import type { GameStats } from '../game/types';

/**
 * Live session statistics (AC-1, AC-11, T14).
 *
 * Pure props — `App` reads the session snapshot and hands the values down, so this
 * component owns no subscription and renders identically under SSR.
 *
 * **Accessibility (AC-14):** neither counter is a live region. The shell renders exactly
 * one `role="status" aria-live="polite"` region (the phase announcement); keeping the
 * counters out of it means one predictable announcement stream instead of three
 * competing ones. Counter updates are therefore deliberately not announced — they stay
 * readable by navigating to the text.
 */
export function Hud({ stats, levelIndex }: { stats: GameStats; levelIndex: number }): ReactElement {
  return (
    <section aria-label="Game statistics">
      <p>
        Clicks: <span data-stat="clicks">{stats.clicks}</span>
      </p>
      <p>
        Faces destroyed: <span data-stat="faces-destroyed">{stats.facesDestroyed}</span>
      </p>
      <p>
        Cube <span data-stat="cube">{levelIndex + 1}</span>
      </p>
    </section>
  );
}
