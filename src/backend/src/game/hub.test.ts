import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGameConfig, type GameConfig } from './config.js';
import { allIds } from './cubes.js';
import { createGameHub, type GameHub, type Peer } from './hub.js';
import type { Position, ServerMessage } from './protocol.js';

/** A fake {@link Peer}: records sent frames and lets tests drive the transport events. */
class FakePeer implements Peer {
  readonly sent: string[] = [];
  pings = 0;
  closed = false;
  private readonly messageHandlers: Array<(arg?: unknown) => void> = [];
  private readonly closeHandlers: Array<() => void> = [];
  private readonly pongHandlers: Array<() => void> = [];
  private closeEmitted = false;

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.drop();
  }

  isOpen(): boolean {
    return !this.closed;
  }

  on(event: 'message' | 'close' | 'pong', handler: (arg?: unknown) => void): void {
    if (event === 'message') {
      this.messageHandlers.push(handler);
    } else if (event === 'close') {
      this.closeHandlers.push(handler as () => void);
    } else {
      this.pongHandlers.push(handler as () => void);
    }
  }

  ping(): void {
    this.pings += 1;
  }

  /** Delivers one client frame (string or the Buffer shape the `ws` transport produces). */
  receive(frame: string | Buffer): void {
    for (const handler of this.messageHandlers) {
      handler(frame);
    }
  }

  /** Answers one server ping. */
  pong(): void {
    for (const handler of this.pongHandlers) {
      handler();
    }
  }

  /** Simulates the peer going away (client drop, or the hub closing the socket). */
  drop(): void {
    if (this.closeEmitted) {
      return;
    }
    this.closed = true;
    this.closeEmitted = true;
    for (const handler of this.closeHandlers) {
      handler();
    }
  }

  messages(): ServerMessage[] {
    return this.sent.map((text) => JSON.parse(text) as ServerMessage);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

/** A deterministic hub plus the helpers every test needs. */
interface Harness {
  readonly config: GameConfig;
  readonly hub: GameHub;
  connect(): FakePeer;
  join(peer: FakePeer): void;
  advance(ms: number): void;
  advanceTimersOnly(ms: number): void;
  setNow(ms: number): void;
}

function createHarness(
  overrides: Partial<GameConfig> = {},
  draw: () => number = () => 0,
): Harness {
  const config: GameConfig = { ...loadGameConfig({}), ...overrides };
  let clock = 0;
  const hub = createGameHub({
    config,
    now: () => clock,
    random: () => draw,
    timers: { setInterval, clearInterval, setTimeout, clearTimeout },
  });
  return {
    config,
    hub,
    connect(): FakePeer {
      const peer = new FakePeer();
      hub.attach(peer);
      return peer;
    },
    join(peer: FakePeer): void {
      peer.receive(JSON.stringify({ type: 'join' }));
    },
    advance(ms: number): void {
      clock += ms;
      vi.advanceTimersByTime(ms);
    },
    advanceTimersOnly(ms: number): void {
      vi.advanceTimersByTime(ms);
    },
    setNow(ms: number): void {
      clock = ms;
    },
  };
}

type WelcomeMessage = Extract<ServerMessage, { type: 'welcome' }>;

/** The single message of `type` on a peer (fails the test when absent or duplicated). */
function onlyType<T extends ServerMessage['type']>(
  peer: FakePeer,
  type: T,
): Extract<ServerMessage, { type: T }> {
  const matches = peer
    .messages()
    .filter((message): message is Extract<ServerMessage, { type: T }> => message.type === type);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function welcomeOf(peer: FakePeer): WelcomeMessage {
  return onlyType(peer, 'welcome');
}

/** One cube's wire state; `LEVEL_0` is the first cube of every member (draw 0 → N = 3). */
interface CubeFields {
  levelIndex: number;
  gridSize: number;
  styleId: string;
  removedIds: string[];
}

const LEVEL_0: CubeFields = {
  levelIndex: 0,
  gridSize: 3,
  styleId: 'obsidian-neon',
  removedIds: [],
};

function memberOf(
  playerId: string,
  name: string,
  position: Position,
  cube: CubeFields = LEVEL_0,
): {
  playerId: string;
  name: string;
  position: Position;
  levelIndex: number;
  gridSize: number;
  styleId: string;
  removedIds: string[];
} {
  return { playerId, name, position, ...cube };
}

/** Pinned ring positions (T1 has the formula; these are the exact doubles the hub must send). */
const X2_SLOT_1: Position = { x: 7.639437268410976, y: 0 };
const X2_SLOT_2: Position = { x: -7.639437268410976, y: 9.355612398046502e-16 };
const X3_SLOT_1: Position = { x: 11.459155902616464, y: 0 };
const X3_SLOT_2: Position = { x: -5.7295779513082294, y: 9.923920117592258 };
const X3_SLOT_3: Position = { x: -5.729577951308237, y: -9.923920117592255 };

function explode(peer: FakePeer, id: string, level = 0): void {
  peer.receive(JSON.stringify({ type: 'explode', id, level }));
}

/** Removes a whole level inside the 30/s budget (a 1 s gap between 30-id batches). */
function removeLevel(harness: Harness, peer: FakePeer, ids: readonly string[], level = 0): void {
  ids.forEach((id, index) => {
    if (index > 0 && index % 30 === 0) {
      harness.advance(1000);
    }
    explode(peer, id, level);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('connection lifecycle', () => {
  it('attaches a socket without sending anything (hello belongs to the route) and counts it', () => {
    const harness = createHarness();
    const peer = harness.connect();

    expect(peer.messages()).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(1);

    harness.hub.close();
    expect(harness.hub.connectionCount()).toBe(0);
    harness.advance(60_000);
    expect(peer.pings).toBe(0);
  });

  it('clears pending grace timers on close (shutdown leaves no scheduled work)', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.drop();
    second.clear();

    harness.hub.close();
    harness.advanceTimersOnly(harness.config.reconnectGraceMs);

    expect(second.messages()).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(0);
  });

  it('answers not_joined to game messages before a successful join', () => {
    const harness = createHarness();
    const peer = harness.connect();

    explode(peer, 'front:0:0');
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    expect(peer.messages()).toEqual([
      { type: 'error', code: 'not_joined' },
      { type: 'error', code: 'not_joined' },
    ]);
  });

  it('answers bad_message for malformed, unknown and oversized frames', () => {
    const harness = createHarness();
    const peer = harness.connect();

    peer.receive('{');
    peer.receive(JSON.stringify({ type: 'dance' }));
    peer.receive(JSON.stringify({ type: 'explode', id: 'front:0:0' }));
    peer.receive('x'.repeat(1025));
    peer.receive(JSON.stringify(['join']));

    expect(peer.messages()).toEqual([
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
    ]);
  });

  it('joins with identity, slot 1 position, the first cube and a self-inclusive roster', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const peer = harness.connect();

    harness.join(peer);

    const welcome = welcomeOf(peer);
    expect(welcome.playerId).toBe('p1');
    expect(welcome.name).toBe('Player 1');
    expect(welcome.token).toMatch(/^[0-9a-f]{32}$/);
    expect(welcome.serverId).toBe(1);
    expect(welcome.maxUsers).toBe(2);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.self).toEqual(LEVEL_0);
    expect(welcome.roster).toEqual([memberOf('p1', 'Player 1', X2_SLOT_1)]);
    expect(peer.messages()).toHaveLength(1);
  });

  it('places the second member in slot 2 and broadcasts memberJoined to the others only', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();

    harness.join(second);

    const welcome = welcomeOf(second);
    expect(welcome.playerId).toBe('p2');
    expect(welcome.position).toEqual(X2_SLOT_2);
    expect(welcome.roster).toEqual([
      memberOf('p1', 'Player 1', X2_SLOT_1),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
    expect(first.messages().slice(1)).toEqual([
      { type: 'memberJoined', member: memberOf('p2', 'Player 2', X2_SLOT_2) },
    ]);
    expect(second.messages()).toHaveLength(1);
  });

  it('overflows into the next fresh server and keeps broadcasts server-scoped', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();

    // Buffer is the frame shape the real `ws` transport hands over.
    third.receive(Buffer.from(JSON.stringify({ type: 'join' })));

    const welcome = welcomeOf(third);
    expect(welcome.playerId).toBe('p3');
    expect(welcome.serverId).toBe(2);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.roster).toEqual([memberOf('p3', 'Player 3', X2_SLOT_1)]);
    // Server 1 heard nothing about the overflow (server-scoped broadcasts).
    expect(first.messages()).toHaveLength(2);
    expect(second.messages()).toHaveLength(1);
  });

  it('rejects a second join or rejoin on a joined connection with bad_message', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    const token = welcomeOf(peer).token;

    peer.receive(JSON.stringify({ type: 'join' }));
    peer.receive(JSON.stringify({ type: 'rejoin', token }));

    expect(peer.messages().slice(1)).toEqual([
      { type: 'error', code: 'bad_message' },
      { type: 'error', code: 'bad_message' },
    ]);
    expect(peer.messages()).toHaveLength(3);
  });
});

describe('reconnect grace', () => {
  it('keeps a disconnected member in the roster during the window (their slot stays taken)', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const firstMessageCount = first.messages().length;

    first.drop();

    expect(harness.hub.connectionCount()).toBe(1);
    expect(second.messages()).toHaveLength(1);
    expect(first.messages()).toHaveLength(firstMessageCount);
    expect(firstMessageCount).toBe(2);

    const third = harness.connect();
    harness.join(third);
    expect(welcomeOf(third).serverId).toBe(2);
  });

  it('removes the member at exactly the grace deadline and broadcasts memberLeft left', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.drop();
    second.clear();

    harness.advance(harness.config.reconnectGraceMs - 1);
    expect(second.messages()).toEqual([]);

    harness.advance(1);
    expect(second.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
    ]);

    // The freed slot is reusable, and the roster compresses to join order.
    const third = harness.connect();
    harness.join(third);
    const welcome = welcomeOf(third);
    expect(welcome.serverId).toBe(1);
    expect(welcome.position).toEqual(X2_SLOT_2);
    expect(welcome.roster).toEqual([
      memberOf('p2', 'Player 2', X2_SLOT_1),
      memberOf('p3', 'Player 3', X2_SLOT_2),
    ]);
  });

  it('destroys an emptied server at grace expiry and never reuses its id', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    expect(welcomeOf(first).serverId).toBe(1);

    first.drop();
    harness.advance(harness.config.reconnectGraceMs);

    const second = harness.connect();
    harness.join(second);
    const welcome = welcomeOf(second);
    expect(welcome.serverId).toBe(2);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.roster).toEqual([memberOf('p2', 'Player 2', X2_SLOT_1)]);
  });

  it('resumes the same identity, server and cube within the window without a roster change', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const token = welcomeOf(first).token;
    const second = harness.connect();
    harness.join(second);
    explode(first, 'front:0:0');
    first.drop();
    second.clear();
    first.clear();

    harness.advance(harness.config.reconnectGraceMs - 1);
    const resumed = harness.connect();
    resumed.receive(JSON.stringify({ type: 'rejoin', token }));

    const welcome = welcomeOf(resumed);
    expect(welcome.playerId).toBe('p1');
    expect(welcome.token).toBe(token);
    expect(welcome.serverId).toBe(1);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.self).toEqual({
      levelIndex: 0,
      gridSize: 3,
      styleId: 'obsidian-neon',
      removedIds: ['front:0:0'],
    });
    expect(welcome.roster).toEqual([
      memberOf('p1', 'Player 1', X2_SLOT_1, {
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
      }),
      memberOf('p2', 'Player 2', X2_SLOT_2),
    ]);
    // No membership change is visible to the others, and the grace timer was cancelled.
    expect(second.messages()).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(2);
    harness.advance(1);
    expect(second.messages()).toEqual([]);
  });

  it('fails a resume at exactly the deadline and finalises the removal', () => {    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const token = welcomeOf(first).token;
    const second = harness.connect();
    harness.join(second);
    first.drop();
    second.clear();

    harness.setNow(harness.config.reconnectGraceMs);
    const late = harness.connect();
    late.receive(JSON.stringify({ type: 'rejoin', token }));

    expect(late.messages()).toEqual([{ type: 'error', code: 'resume_failed' }]);
    expect(second.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
    ]);
    // The pending grace timer was cleared: no second memberLeft.
    harness.advanceTimersOnly(harness.config.reconnectGraceMs);
    expect(second.messages()).toHaveLength(1);
  });

  it('reschedules a grace timer that fires before the deadline instead of dropping the member', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.drop();
    second.clear();

    // The timer fires while the clock has not advanced: the member is still inside grace.
    harness.advanceTimersOnly(harness.config.reconnectGraceMs);
    expect(second.messages()).toEqual([]);

    // The rescheduled timer reaches the deadline and removes the member.
    harness.setNow(harness.config.reconnectGraceMs);
    harness.advanceTimersOnly(harness.config.reconnectGraceMs);
    expect(second.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
    ]);
  });

  it('answers resume_failed for an unknown token and then accepts a join on the same connection', () => {
    const harness = createHarness();
    const peer = harness.connect();

    peer.receive(JSON.stringify({ type: 'rejoin', token: '0'.repeat(32) }));
    expect(peer.messages()).toEqual([{ type: 'error', code: 'resume_failed' }]);

    harness.join(peer);
    expect(welcomeOf(peer).playerId).toBe('p1');
    expect(peer.messages()).toHaveLength(2);
  });

  it('refuses to resume an identity whose socket is still open', () => {
    const harness = createHarness();
    const first = harness.connect();
    harness.join(first);
    const token = welcomeOf(first).token;
    const intruder = harness.connect();

    intruder.receive(JSON.stringify({ type: 'rejoin', token }));

    expect(intruder.messages()).toEqual([{ type: 'error', code: 'resume_failed' }]);
    expect(first.messages()).toHaveLength(1);
    expect(harness.hub.connectionCount()).toBe(2);
  });

  it('drops broadcasts to a member in grace without disturbing active members', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const firstMessageCount = first.messages().length;
    first.drop();
    second.clear();

    explode(second, 'front:0:0');

    expect(second.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p2', id: 'front:0:0' },
    ]);
    expect(first.messages()).toHaveLength(firstMessageCount);
    expect(firstMessageCount).toBe(2);
  });
});

describe('heartbeat', () => {
  it('pings every 30 s and terminates at the second missed pong', () => {
    const harness = createHarness();
    const peer = harness.connect();

    harness.advance(30_000);
    expect(peer.pings).toBe(1);
    harness.advance(30_000);
    expect(peer.pings).toBe(2);
    expect(peer.closed).toBe(false);

    // The pings at 30 s and 60 s were both unanswered: the third tick terminates.
    harness.advance(30_000);
    expect(peer.pings).toBe(3);
    expect(peer.closed).toBe(true);
    expect(harness.hub.connectionCount()).toBe(0);
  });

  it('resets the missed-pong count on every pong', () => {
    const harness = createHarness();
    const peer = harness.connect();

    for (let tick = 0; tick < 4; tick += 1) {
      harness.advance(30_000);
      peer.pong();
    }

    expect(peer.pings).toBe(4);
    expect(peer.closed).toBe(false);
  });

  it('keeps a socket alive when a pong arrives after two missed pings', () => {
    const harness = createHarness();
    const peer = harness.connect();

    harness.advance(30_000);
    harness.advance(30_000);
    peer.pong();
    harness.advance(30_000);

    expect(peer.pings).toBe(3);
    expect(peer.closed).toBe(false);
  });

  it('closes sockets beyond the connection cap', () => {
    const harness = createHarness({ maxConnections: 2 });
    const first = harness.connect();
    const second = harness.connect();
    const rejected = harness.connect();

    expect(rejected.closed).toBe(true);
    expect(rejected.messages()).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(2);

    first.drop();
    expect(harness.hub.connectionCount()).toBe(1);
    const accepted = harness.connect();
    expect(accepted.closed).toBe(false);
    expect(harness.hub.connectionCount()).toBe(2);
    expect(second.closed).toBe(false);
  });
});

describe('explode broadcasts', () => {
  it('broadcasts a valid explode to every member of the server including the origin', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const other = harness.connect();
    harness.join(other);
    first.clear();
    second.clear();
    other.clear();

    explode(first, 'front:0:0');

    const expected = [{ type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' }] as const;
    expect(first.messages()).toEqual(expected);
    expect(second.messages()).toEqual(expected);
    expect(other.messages()).toEqual([]);
  });

  it('rejects unknown, removed and wrong-level clicks with invalid_click + stateSync to the origin only', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    explode(first, 'front:0:0');
    first.clear();
    second.clear();

    explode(first, 'front:0:0');
    expect(first.messages()).toEqual([
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
      },
    ]);
    expect(second.messages()).toEqual([]);

    first.clear();
    explode(first, 'front:9:9');
    explode(first, 'front:0:1', 1);
    expect(first.messages()).toEqual([
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
      },
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
      },
    ]);
    expect(second.messages()).toEqual([]);
  });

  it('drops an oversized frame even when the payload would be a valid click', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    peer.clear();

    peer.receive(
      JSON.stringify({ type: 'explode', id: 'front:0:0', level: 0, pad: 'x'.repeat(1100) }),
    );
    expect(peer.messages()).toEqual([{ type: 'error', code: 'bad_message' }]);

    peer.clear();
    explode(peer, 'front:0:0');
    expect(peer.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
    ]);
  });

  it('drops the 31st explode in a trailing second and reports rate_limited at most once per second', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    const ids = allIds(3);
    peer.clear();

    for (let index = 0; index < 30; index += 1) {
      explode(peer, ids[index]!);
    }
    expect(peer.messages().filter((message) => message.type === 'miniCubeRemoved')).toHaveLength(
      30,
    );

    peer.clear();
    explode(peer, ids[30]!);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'rate_limited' }]);

    peer.clear();
    explode(peer, ids[31]!);
    expect(peer.messages()).toEqual([]);

    // One millisecond before the window ends the attempt is still dropped silently.
    harness.advance(999);
    explode(peer, ids[31]!);
    expect(peer.messages()).toEqual([]);

    // Exactly one second after the window started, the quota is fresh again.
    harness.advance(1);
    explode(peer, ids[30]!);
    expect(peer.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: ids[30]! },
    ]);

    peer.clear();
    for (let index = 31; index < 54; index += 1) {
      explode(peer, ids[index]!);
    }
    for (let repeat = 0; repeat < 6; repeat += 1) {
      explode(peer, ids[53]!);
    }
    peer.clear();
    explode(peer, ids[53]!);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'rate_limited' }]);
  });
});

describe('cube completion', () => {
  it('advances a completed cube on the same server and announces levelAdvanced to all members', () => {
    const draws = [0, 0, 0.5];
    let drawIndex = 0;
    const harness = createHarness({ maxUsersPerServer: 2 }, () => draws[drawIndex++] ?? 0);
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    removeLevel(harness, first, allIds(3));
    first.clear();
    second.clear();

    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const expected = [
      {
        type: 'levelAdvanced',
        playerId: 'p1',
        levelIndex: 1,
        gridSize: 5,
        styleId: 'crimson-alloy',
        position: X2_SLOT_1,
        removedIds: [],
      },
    ] as const;
    expect(first.messages()).toEqual(expected);
    expect(second.messages()).toEqual(expected);

    // The fresh board is authoritative: a level-1 id is accepted.
    first.clear();
    explode(first, 'front:0:0', 1);
    expect(first.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' },
    ]);
  });

  it('rejects incomplete cubes and wrong levels with invalid_completion + stateSync to the origin', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    explode(peer, 'front:0:0');
    explode(peer, 'front:0:1');
    peer.clear();

    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    expect(peer.messages()).toEqual([
      { type: 'error', code: 'invalid_completion' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0', 'front:0:1'],
      },
    ]);

    peer.clear();
    peer.receive(JSON.stringify({ type: 'cubeCompleted', level: 3 }));
    expect(peer.messages()).toEqual([
      { type: 'error', code: 'invalid_completion' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0', 'front:0:1'],
      },
    ]);
  });

  it('merges a lone server-2 member into server 1 when they complete (X = 2, AC-11)', () => {
    const draws = [0, 0, 0, 0.5];
    let drawIndex = 0;
    const harness = createHarness({ maxUsersPerServer: 2 }, () => draws[drawIndex++] ?? 0);
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    const thirdToken = welcomeOf(third).token;
    expect(welcomeOf(third).serverId).toBe(2);

    // The lone server-1 member disconnected, and their grace expired exactly at the window.
    first.drop();
    second.clear();
    third.clear();
    harness.advance(harness.config.reconnectGraceMs);
    expect(second.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p1', reason: 'left' },
    ]);
    expect(third.messages()).toEqual([]);

    // The server-2 member finishes their cube: the planned move executes on completion.
    removeLevel(harness, third, allIds(3));
    second.clear();
    third.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const moved = memberOf('p3', 'Player 3', X2_SLOT_2, {
      levelIndex: 1,
      gridSize: 5,
      styleId: 'crimson-alloy',
      removedIds: [],
    });
    expect(third.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p3',
        name: 'Player 3',
        token: thirdToken,
        serverId: 1,
        maxUsers: 2,
        position: X2_SLOT_2,
        self: {
          levelIndex: 1,
          gridSize: 5,
          styleId: 'crimson-alloy',
          removedIds: [],
        },
        roster: [memberOf('p2', 'Player 2', X2_SLOT_1), moved],
      },
    ]);
    expect(second.messages()).toEqual([{ type: 'memberJoined', member: moved }]);

    // Server 2 was destroyed and its id is never reused: the next join creates server 3.
    const fourth = harness.connect();
    harness.join(fourth);
    const welcome = welcomeOf(fourth);
    expect(welcome.serverId).toBe(3);
    expect(welcome.roster).toEqual([memberOf('p4', 'Player 4', X2_SLOT_1)]);
  });

  it('announces memberLeft moved to the vacated server and memberJoined to the target', () => {
    const draws = [0, 0, 0, 0, 0, 0.5];
    let drawIndex = 0;
    const harness = createHarness({ maxUsersPerServer: 3 }, () => draws[drawIndex++] ?? 0);
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    const fourth = harness.connect();
    harness.join(fourth);
    const fifth = harness.connect();
    harness.join(fifth);
    expect(welcomeOf(fourth).serverId).toBe(2);
    expect(welcomeOf(fifth).serverId).toBe(2);
    const fourthToken = welcomeOf(fourth).token;

    // Freeing one slot on server 1 plans the server-2 slot holder onto it.
    second.drop();
    first.clear();
    third.clear();
    fourth.clear();
    fifth.clear();
    harness.advance(harness.config.reconnectGraceMs);
    expect(first.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p2', reason: 'left' },
    ]);
    expect(third.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p2', reason: 'left' },
    ]);
    expect(fourth.messages()).toEqual([]);
    expect(fifth.messages()).toEqual([]);

    fourth.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));
    // Not complete yet: nothing happens server-side.
    expect(fourth.messages()).toEqual([
      { type: 'error', code: 'invalid_completion' },
      {
        type: 'stateSync',
        playerId: 'p4',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: [],
      },
    ]);

    fourth.clear();
    fifth.clear();
    first.clear();
    third.clear();
    removeLevel(harness, fourth, allIds(3));
    fourth.clear();
    fifth.clear();
    first.clear();
    third.clear();
    fourth.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const moved = memberOf('p4', 'Player 4', X3_SLOT_3, {
      levelIndex: 1,
      gridSize: 5,
      styleId: 'crimson-alloy',
      removedIds: [],
    });
    expect(fourth.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p4',
        name: 'Player 4',
        token: fourthToken,
        serverId: 1,
        maxUsers: 3,
        position: X3_SLOT_3,
        self: {
          levelIndex: 1,
          gridSize: 5,
          styleId: 'crimson-alloy',
          removedIds: [],
        },
        roster: [
          memberOf('p1', 'Player 1', X3_SLOT_1),
          memberOf('p3', 'Player 3', X3_SLOT_2),
          moved,
        ],
      },
    ]);
    expect(fifth.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p4', reason: 'moved' },
    ]);
    expect(first.messages()).toEqual([{ type: 'memberJoined', member: moved }]);
    expect(third.messages()).toEqual([{ type: 'memberJoined', member: moved }]);
  });
});
