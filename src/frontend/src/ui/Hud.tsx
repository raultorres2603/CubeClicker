import type { ReactElement } from 'react';

import type { GameStats } from '../game/types';

export function Hud({
  stats,
  levelIndex,
  serverId,
  minimized = false,
  onToggleMinimize,
}: {
  stats: GameStats;
  levelIndex: number;
  serverId: number;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}): ReactElement {
  return (
    <section
      aria-label="Game statistics"
      {...(minimized ? { 'data-minimized': 'true' } : {})}
    >
      <p>
        Clicks: <span data-stat="clicks">{stats.clicks}</span>
      </p>
      <p>
        Faces destroyed: <span data-stat="faces-destroyed">{stats.facesDestroyed}</span>
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
