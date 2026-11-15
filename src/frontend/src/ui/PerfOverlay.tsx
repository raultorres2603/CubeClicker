/**
 * Dev-only performance overlay (T4; spec AC-19, AC-20, AC-24).
 *
 * Layer: `ui/**` — a small presentational component that polls the injected session. It is
 * rendered by `App` only when `isPerfOverlayEnabled()` is `true`; with the flag unset the
 * component never mounts, so no interval runs and no diagnostic ping is sent.
 *
 * Polling: stats (frame time, tier, draw calls, triangles) every {@link PERF_STATS_POLL_MS}
 * and the WebSocket RTT every {@link PERF_RTT_POLL_MS}, matching the backend's 1 Hz
 * diagnostic ping limit. Both intervals are cleaned up on unmount, and an RTT measurement
 * still in flight is never overlapped. The markup is a plain `<aside>` with inline styles
 * only: no CSS file, no dependency and no Three.js import (AC-24).
 */

import { useEffect, useState, type ReactElement } from 'react';

import type { OnlineGameSession } from '../game/session';
import type { PerfStats } from '../perf/overlay';

/** Stats refresh cadence: four reads per second (AC-20). */
export const PERF_STATS_POLL_MS = 250;

/** RTT refresh cadence: one diagnostic ping per second (AC-20, AC-23 1 Hz limit). */
export const PERF_RTT_POLL_MS = 1000;

/** The session surface the overlay reads; both methods are optional on `GameSession`. */
export type PerfOverlaySession = Pick<OnlineGameSession, 'getPerfStats' | 'measureRtt'>;

export interface PerfOverlayProps {
  session: PerfOverlaySession;
}

const OVERLAY_STYLE = {
  position: 'fixed',
  top: 8,
  right: 8,
  zIndex: 10,
  display: 'grid',
  gap: 2,
  padding: '6px 8px',
  background: 'rgba(0, 0, 0, 0.72)',
  border: '1px solid rgba(255, 255, 255, 0.24)',
  borderRadius: 4,
  color: '#ffffff',
  font: '11px/1.4 monospace',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
} as const;

/** The rendered overlay: five exact rows, with `—` placeholders before the first sample. */
export function PerfOverlay({ session }: PerfOverlayProps): ReactElement {
  const [stats, setStats] = useState<PerfStats | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const readStats = (): void => {
      const next = session.getPerfStats?.() ?? null;
      if (!cancelled) {
        setStats(next);
      }
    };
    readStats();
    const statsTimer = setInterval(readStats, PERF_STATS_POLL_MS);

    let measuring = false;
    const readRtt = (): void => {
      const measureRtt = session.measureRtt;
      if (cancelled || measuring || typeof measureRtt !== 'function') {
        return;
      }
      measuring = true;
      void measureRtt
        .call(session)
        .then((value) => {
          measuring = false;
          if (!cancelled) {
            setRtt(value);
          }
        })
        .catch(() => {
          // A failed measurement is not an overlay error: the previous value stays visible.
          measuring = false;
        });
    };
    readRtt();
    const rttTimer = setInterval(readRtt, PERF_RTT_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(statsTimer);
      clearInterval(rttTimer);
    };
  }, [session]);

  return (
    <aside data-testid="perf-overlay" aria-live="off" style={OVERLAY_STYLE}>
      <div>{stats === null ? 'Frame —' : `Frame ${stats.frameMs} ms`}</div>
      <div>{stats === null ? 'Quality —' : `Quality ${stats.tier}`}</div>
      <div>{stats === null ? 'Draw calls —' : `Draw calls ${stats.drawCalls}`}</div>
      <div>{stats === null ? 'Triangles —' : `Triangles ${stats.triangles}`}</div>
      <div>{rtt === null ? 'WS RTT —' : `WS RTT ${rtt} ms`}</div>
    </aside>
  );
}
