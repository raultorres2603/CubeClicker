import type { ReactElement } from 'react';

import type { GameStats } from '../game/types';
import { CoinIcon, CubeIcon, CubeLevelIcon, CursorIcon, ServerIcon } from './icons';

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
      className="hud-panel"
      {...(minimized ? { 'data-minimized': 'true' } : {})}
      {...(blinking ? { 'data-blinking': 'true' } : {})}
    >
      <p className="hud-row" data-row="clicks">
        <CursorIcon />
        Clicks: <span data-stat="clicks">{stats.clicks}</span>
      </p>
      <p className="hud-row" data-row="faces-destroyed">
        <CubeIcon />
        Faces destroyed: <span data-stat="faces-destroyed">{stats.facesDestroyed}</span>
      </p>
      <p className="hud-row" data-row="coins">
        <CoinIcon />
        Coins <span data-stat="coins">{(stats.coins ?? 0).toFixed(2)}</span>
      </p>
      <p className="hud-row" data-row="cube">
        <CubeLevelIcon />
        Cube <span data-stat="cube">{levelIndex + 1}</span>
      </p>
      <p className="hud-row" data-row="server">
        <ServerIcon />
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
