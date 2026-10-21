import { describe, expect, it } from 'vitest';

import { loadGameConfig } from './config.js';
import { createGraceTracker, createPlayerRecord } from './players.js';
import { createServerRegistry } from './servers.js';

/** Pinned token shape: 32 lowercase hex chars (spec § Pinned constants, AC-6). */
const TOKEN_FORMAT = /^[0-9a-f]{32}$/;

describe('createPlayerRecord', () => {
  it('formats playerId and name from the same counter (1 → p1 / Player 1)', () => {
    const record = createPlayerRecord(1);

    expect(record.playerId).toBe('p1');
    expect(record.name).toBe('Player 1');
  });

  it('formats later counters identically in both fields (2 and 42)', () => {
    const second = createPlayerRecord(2);
    const fortySecond = createPlayerRecord(42);

    expect(second.playerId).toBe('p2');
    expect(second.name).toBe('Player 2');
    expect(fortySecond.playerId).toBe('p42');
    expect(fortySecond.name).toBe('Player 42');
  });

  it('issues a 32-character lowercase hex token', () => {
    const record = createPlayerRecord(7);

    expect(record.token).toMatch(TOKEN_FORMAT);
    expect(record.token).toHaveLength(32);
  });

  it('issues a distinct token to every record (100 joins)', () => {
    const tokens = Array.from({ length: 100 }, (_unused, index) =>
      createPlayerRecord(index + 1),
    ).map((record) => record.token);

    for (const token of tokens) {
      expect(token).toMatch(TOKEN_FORMAT);
    }
    expect(tokens).toHaveLength(100);
    expect(new Set(tokens).size).toBe(100);
  });

  it('keeps identity stable but the token fresh when a counter is reused', () => {
    const first = createPlayerRecord(5);
    const second = createPlayerRecord(5);

    expect(first.playerId).toBe('p5');
    expect(second.playerId).toBe('p5');
    expect(first.name).toBe('Player 5');
    expect(second.name).toBe('Player 5');
    expect(first.token).not.toBe(second.token);
    expect(first.token).toMatch(TOKEN_FORMAT);
    expect(second.token).toMatch(TOKEN_FORMAT);
  });
});

describe('createGraceTracker', () => {
  it('begins a window at exactly now + RECONNECT_GRACE_MS from config', () => {
    let nowMs = 1_700_000_000_000;
    const config = loadGameConfig({});
    const tracker = createGraceTracker({ graceMs: config.reconnectGraceMs, now: () => nowMs });

    tracker.begin('p1');
    expect(tracker.expiresAt('p1')).toBe(1_700_000_030_000);

    // The deadline is anchored at begin time; a later clock read does not move it.
    nowMs = 1_700_000_500_000;
    expect(tracker.expiresAt('p1')).toBe(1_700_000_030_000);
  });

  it('expires at exactly the deadline instant, not one millisecond before', () => {
    const nowMs = 0;
    const tracker = createGraceTracker({ graceMs: 30_000, now: () => nowMs });

    tracker.begin('p1');

    expect(tracker.expired('p1', 29_999)).toBe(false);
    expect(tracker.expired('p1', 30_000)).toBe(true);
    expect(tracker.expired('p1', 30_001)).toBe(true);
  });

  it('keeps each member’s window independent', () => {
    let nowMs = 0;
    const tracker = createGraceTracker({ graceMs: 30_000, now: () => nowMs });

    tracker.begin('p1');
    nowMs = 10;
    tracker.begin('p2');

    expect(tracker.expiresAt('p1')).toBe(30_000);
    expect(tracker.expiresAt('p2')).toBe(30_010);
    expect(tracker.expired('p1', 30_000)).toBe(true);
    expect(tracker.expired('p2', 30_000)).toBe(false);
    expect(tracker.expired('p2', 30_010)).toBe(true);
  });

  it('restarts a window from the new clock time on a second close', () => {
    let nowMs = 0;
    const tracker = createGraceTracker({ graceMs: 30_000, now: () => nowMs });

    tracker.begin('p1');
    nowMs = 5_000;
    tracker.begin('p1');

    expect(tracker.expiresAt('p1')).toBe(35_000);
    expect(tracker.expired('p1', 30_000)).toBe(false);
    expect(tracker.expired('p1', 35_000)).toBe(true);
  });

  it('drops the window on cancel; cancelling twice is harmless', () => {
    const nowMs = 0;
    const tracker = createGraceTracker({ graceMs: 30_000, now: () => nowMs });

    tracker.begin('p1');
    tracker.cancel('p1');
    expect(tracker.expiresAt('p1')).toBe(Number.POSITIVE_INFINITY);
    expect(tracker.expired('p1', 30_000)).toBe(false);

    tracker.cancel('p1');
    expect(tracker.expiresAt('p1')).toBe(Number.POSITIVE_INFINITY);
    expect(tracker.expired('p1', 30_000)).toBe(false);
  });

  it('reports unknown players as never expired and without a deadline', () => {
    const tracker = createGraceTracker({ graceMs: 30_000, now: () => 0 });

    expect(tracker.expiresAt('p9')).toBe(Number.POSITIVE_INFINITY);
    expect(tracker.expired('p9', 0)).toBe(false);
    expect(tracker.expired('p9', 1_000_000)).toBe(false);
  });

  it('honours the configured RECONNECT_GRACE_MS override', () => {
    const nowMs = 0;
    const config = loadGameConfig({ RECONNECT_GRACE_MS: '1000' });
    const tracker = createGraceTracker({ graceMs: config.reconnectGraceMs, now: () => nowMs });

    tracker.begin('p1');

    expect(tracker.expiresAt('p1')).toBe(1_000);
    expect(tracker.expired('p1', 999)).toBe(false);
    expect(tracker.expired('p1', 1_000)).toBe(true);
  });
});

describe('identity and grace composition', () => {
  it('carries a member through join, close grace and expiry removal', () => {
    const nowMs = 0;
    const config = loadGameConfig({ MAX_USERS_PER_SERVER: '2', RECONNECT_GRACE_MS: '1000' });
    const registry = createServerRegistry(config.maxUsersPerServer);
    const tracker = createGraceTracker({ graceMs: config.reconnectGraceMs, now: () => nowMs });

    const first = createPlayerRecord(1);
    const second = createPlayerRecord(2);

    expect(first.name).toBe('Player 1');
    expect(second.name).toBe('Player 2');
    expect(first.token).not.toBe(second.token);

    expect(registry.assign(first.playerId)).toEqual({ serverId: 1, slot: 1 });
    expect(registry.assign(second.playerId)).toEqual({ serverId: 1, slot: 2 });

    // The second socket closes: grace starts and membership is retained until it ends.
    tracker.begin(second.playerId);
    expect(tracker.expiresAt(second.playerId)).toBe(1_000);
    expect(registry.servers()).toEqual([{ id: 1, members: ['p1', 'p2'] }]);
    expect(tracker.expired(second.playerId, 999)).toBe(false);

    // At exactly the deadline the window ends; removal leaves the surviving member.
    expect(tracker.expired(second.playerId, 1_000)).toBe(true);
    expect(registry.removeMember(second.playerId)).toEqual({
      left: true,
      serverDestroyed: false,
    });
    tracker.cancel(second.playerId);
    expect(tracker.expired(second.playerId, 1_000)).toBe(false);
    expect(registry.servers()).toEqual([{ id: 1, members: ['p1'] }]);
  });
});
