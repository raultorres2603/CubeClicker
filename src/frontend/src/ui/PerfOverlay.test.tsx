/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PerfStats } from '../perf/overlay';
import { PerfOverlay, PERF_RTT_POLL_MS, PERF_STATS_POLL_MS, type PerfOverlaySession } from './PerfOverlay';

/**
 * Integration tier for the dev overlay (AC-20): the real component in jsdom against a fake
 * session boundary. Fake timers advance the 250 ms stats poll and the 1000 ms RTT poll
 * deterministically, and the unmount assertion proves the intervals are released.
 */

const FIRST_STATS: PerfStats = { frameMs: 16.7, tier: 'high', drawCalls: 42, triangles: 1000 };
const SECOND_STATS: PerfStats = { frameMs: 20.5, tier: 'medium', drawCalls: 31, triangles: 800 };

interface FakePerfSession extends PerfOverlaySession {
  getPerfStats: ReturnType<typeof vi.fn>;
  measureRtt: ReturnType<typeof vi.fn>;
}

function createFakeSession(): FakePerfSession {
  return {
    getPerfStats: vi.fn(() => FIRST_STATS),
    measureRtt: vi.fn(() => Promise.resolve(24)),
  };
}

function overlayText(): string {
  return screen.getByTestId('perf-overlay').textContent ?? '';
}

const SAMPLE_TEXT =
  'Frame 16.7 ms' + 'Quality high' + 'Draw calls 42' + 'Triangles 1000' + 'WS RTT 24 ms';

const EMPTY_TEXT = 'Frame —' + 'Quality —' + 'Draw calls —' + 'Triangles —' + 'WS RTT —';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PerfOverlay', () => {
  it('renders the five exact labels inside the non-live aside (AC-20)', async () => {
    vi.useFakeTimers();
    const session = createFakeSession();

    await act(async () => {
      render(<PerfOverlay session={session} />);
    });

    const overlay = screen.getByTestId('perf-overlay');
    expect(overlay.tagName).toBe('ASIDE');
    expect(overlay.getAttribute('aria-live')).toBe('off');
    expect(overlayText()).toBe(SAMPLE_TEXT);
    expect(session.getPerfStats).toHaveBeenCalledTimes(1);
    expect(session.measureRtt).toHaveBeenCalledTimes(1);
  });

  it('refreshes the stats after 250 ms and the RTT after 1000 ms (AC-20)', async () => {
    vi.useFakeTimers();
    const session = createFakeSession();
    let stats: PerfStats = FIRST_STATS;
    session.getPerfStats.mockImplementation(() => stats);
    let rtt: number | null = 24;
    session.measureRtt.mockImplementation(() => Promise.resolve(rtt));

    await act(async () => {
      render(<PerfOverlay session={session} />);
    });
    expect(overlayText()).toBe(SAMPLE_TEXT);

    stats = SECOND_STATS;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PERF_STATS_POLL_MS);
    });

    expect(overlayText()).toBe(
      'Frame 20.5 ms' + 'Quality medium' + 'Draw calls 31' + 'Triangles 800' + 'WS RTT 24 ms',
    );
    expect(session.measureRtt).toHaveBeenCalledTimes(1);

    rtt = 31;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PERF_RTT_POLL_MS - PERF_STATS_POLL_MS);
    });

    expect(overlayText()).toBe(
      'Frame 20.5 ms' + 'Quality medium' + 'Draw calls 31' + 'Triangles 800' + 'WS RTT 31 ms',
    );
    expect(session.measureRtt).toHaveBeenCalledTimes(2);
  });

  it('renders the placeholders when the session has no stats and no RTT (AC-20)', async () => {
    vi.useFakeTimers();
    const session = createFakeSession();
    session.getPerfStats.mockImplementation(() => null);
    session.measureRtt.mockImplementation(() => Promise.resolve(null));

    await act(async () => {
      render(<PerfOverlay session={session} />);
    });

    expect(overlayText()).toBe(EMPTY_TEXT);
  });

  it('clears both polls on unmount (AC-20 cleanup)', async () => {
    vi.useFakeTimers();
    const session = createFakeSession();
    let unmount: (() => void) | null = null;

    await act(async () => {
      unmount = render(<PerfOverlay session={session} />).unmount;
    });
    const statsCalls = session.getPerfStats.mock.calls.length;
    const rttCalls = session.measureRtt.mock.calls.length;

    act(() => {
      unmount?.();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PERF_RTT_POLL_MS * 3);
    });

    expect(session.getPerfStats).toHaveBeenCalledTimes(statsCalls);
    expect(session.measureRtt).toHaveBeenCalledTimes(rttCalls);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('polls nothing when the session omits the optional methods', async () => {
    vi.useFakeTimers();
    const session: PerfOverlaySession = {};

    await act(async () => {
      render(<PerfOverlay session={session} />);
    });

    expect(overlayText()).toBe(EMPTY_TEXT);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PERF_RTT_POLL_MS * 2);
    });

    expect(overlayText()).toBe(EMPTY_TEXT);
  });
});
