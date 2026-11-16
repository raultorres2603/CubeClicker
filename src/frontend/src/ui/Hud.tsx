import type { ReactElement } from 'react';

import type { GameStats } from '../game/types';
import { CoinIcon, CubeIcon, CursorIcon, KeyIcon, LootboxIcon, ServerIcon } from './icons';

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

/**
 * The gameplay HUD (AC-19): a Neon Forge panel with a header/level chip, a three-chip
 * resource strip (`Coins`/`Keys`/`Lootboxes`) and three stat rows (`clicks`,
 * `faces-destroyed`, `server`). It is not a live region; the accepted `blinking` prop
 * drives `data-blinking` and the optional 24 px minimize control stays last.
 *
 * Minimized (`data-minimized="true"`) keeps the header and the resource strip rendered;
 * `game-view.css` hides only `.hud-grid`. The pre-welcome stats section is owned by `App`
 * and stays a plain `<section aria-label="Game statistics">` with its three rows.
 */
export function Hud({
  stats,
  levelIndex,
  serverId,
  keys = 0,
  lootboxes = 0,
  minimized = false,
  blinking = false,
  coinPops = [],
  onToggleMinimize,
}: {
  stats: GameStats;
  levelIndex: number;
  serverId: number;
  /** Lootbox keys from `snapshot.customization` (AC-19); defaults to 0. */
  keys?: number;
  /** Lootboxes from `snapshot.customization` (AC-19); defaults to 0. */
  lootboxes?: number;
  minimized?: boolean;
  blinking?: boolean;
  /** Up to `MOTION.coinMaxConcurrent` coin gains; oldest dropped by the owner (AC-39). */
  coinPops?: readonly HudCoinPop[];
  onToggleMinimize?: () => void;
}): ReactElement {
  const coins = (stats.coins ?? 0).toFixed(2);

  return (
    <section
      aria-label="Game statistics"
      className="hud-panel"
      {...(minimized ? { 'data-minimized': 'true' } : {})}
      {...(blinking ? { 'data-blinking': 'true' } : {})}
    >
      <div className="hud-header">
        <h2 className="hud-title">Pilot status</h2>
        <span className="hud-level" data-stat="cube">
          Cube {levelIndex + 1}
        </span>
      </div>
      <div className="hud-resources" role="group" aria-label="Resources">
        <span data-resource="coins">
          <CoinIcon />Coins{' '}
          <span className="hud-resource-value" data-stat="coins">
            {coins}
          </span>
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
        </span>
        <span data-resource="keys">
          <KeyIcon />Keys{' '}
          <span className="hud-resource-value" data-stat="keys">
            {keys}
          </span>
        </span>
        <span data-resource="lootboxes">
          <LootboxIcon />Lootboxes{' '}
          <span className="hud-resource-value" data-stat="lootboxes">
            {lootboxes}
          </span>
        </span>
      </div>
      <div className="hud-grid">
        <p className="hud-row" data-row="clicks">
          <CursorIcon />Clicks: <span data-stat="clicks">{stats.clicks}</span>
        </p>
        <p className="hud-row" data-row="faces-destroyed">
          <CubeIcon />Faces destroyed:{' '}
          <span data-stat="faces-destroyed">{stats.facesDestroyed}</span>
        </p>
        <p className="hud-row" data-row="server">
          <ServerIcon />Server <span data-stat="server">{serverId}</span>
        </p>
      </div>
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
