import type { ReactElement } from 'react';

import type { GameStats } from '../game/types';
import { CoinIcon, CubeIcon, CubeLevelIcon, CursorIcon, ServerIcon } from './icons';

export const HUD_BLINK_MS = 200;

/**
 * One transient `+<delta>` coin popup (AC-39). `id` is client-owned and only keys the DOM
 * entry; the numeric HUD value is the authoritative display and updates in the same frame.
 */
export interface HudCoinPop {
  id: number;
  amount: number;
}

/** The pinned popup label: a plus sign and the delta to two decimals (AC-39). */
export function formatCoinPop(amount: number): string {
  return `+${amount.toFixed(2)}`;
}

export function Hud({
  stats,
  levelIndex,
  serverId,
  minimized = false,
  blinking = false,
  coinPops = [],
  onToggleMinimize,
}: {
  stats: GameStats;
  levelIndex: number;
  serverId: number;
  minimized?: boolean;
  blinking?: boolean;
  /** Up to `MOTION.coinMaxConcurrent` coin gains; oldest dropped by the owner (AC-39). */
  coinPops?: readonly HudCoinPop[];
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
        {coinPops.length > 0 ? (
          <span className="hud-coin-pops" aria-hidden="true" data-coin-pops="true">
            {coinPops.map((pop) => (
              <span
                key={pop.id}
                className="hud-coin-pop"
                data-coin-pop={pop.id}
                data-amount={pop.amount}
              >
                {formatCoinPop(pop.amount)}
              </span>
            ))}
          </span>
        ) : null}
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
