import type { ReactElement } from 'react';

import type { GameStats } from '../game/types';

export const HUD_BLINK_MS = 200;

export function Hud({
  stats,
  levelIndex,
  serverId,
  minimized = false,
  blinking = false,
  onToggleMinimize,
}: {
  stats: GameStats;
  levelIndex: number;
  serverId: number;
  minimized?: boolean;
  blinking?: boolean;
  onToggleMinimize?: () => void;
}): ReactElement {
  return (
    <section
      aria-label="Game statistics"
      {...(minimized ? { 'data-minimized': 'true' } : {})}
      {...(blinking ? { 'data-blinking': 'true' } : {})}
    >
      <p>
        Clicks: <span data-stat="clicks">{stats.clicks}</span>
      </p>
      <p>
        Faces destroyed: <span data-stat="faces-destroyed">{stats.facesDestroyed}</span>
      </p>
      <p>
        Coins <span data-stat="coins">{(stats.coins ?? 0).toFixed(2)}</span>
      </p>
      <p>
        Cube <span data-stat="cube">{levelIndex + 1}</span>
      </p>
      <p>
        Server <span data-stat="server">{serverId}</span>
      </p>
      {onToggleMinimize ? (
        <button
          type="button"
          aria-expanded={!minimized}
          aria-label="Toggle HUD"
          onClick={onToggleMinimize}
        />
      ) : null}
    </section>
  );
}
