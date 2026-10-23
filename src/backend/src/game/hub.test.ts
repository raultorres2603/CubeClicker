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
  yawSteps = 0,
  pitchSteps = 0,
): {
  playerId: string;
  name: string;
  position: Position;
  levelIndex: number;
  gridSize: number;
  styleId: string;
  removedIds: string[];
  yawSteps: number;
  pitchSteps: number;
} {
  return { playerId, name, position, ...cube, yawSteps, pitchSteps };
}

/** Pinned ring positions (T1 has the formula; these are the exact doubles the hub must send). */
const X2_SLOT_1: Position = { x: 7.639437268410976, y: 0 };
const X2_SLOT_2: Position = { x: -7.639437268410976, y: 9.355612398046502e-16 };
const X3_SLOT_1: Position = { x: 11.459155902616464, y: 0 };
const X3_SLOT_2: Position = { x: -5.7295779513082294, y: 9.923920117592258 };
const X3_SLOT_3: Position = { x: -5.729577951308237, y: -9.923920117592255 };
const X4_SLOT_1: Position = { x: 15.278874536821952, y: 0 };
const X4_SLOT_2: Position = { x: 9.355612398046502e-16, y: 15.278874536821952 };
const X4_SLOT_3: Position = { x: -15.278874536821952, y: 1.8711224796093003e-15 };

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
    expect(welcome.self).toEqual({ ...LEVEL_0, yawSteps: 0, pitchSteps: 0 });
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

    // p1's slot 1 is reusable; p2 keeps slot 2 (positions never shuffle).
    const third = harness.connect();
    harness.join(third);
    const welcome = welcomeOf(third);
    expect(welcome.serverId).toBe(1);
    expect(welcome.position).toEqual(X2_SLOT_1);
    expect(welcome.roster).toEqual([
      memberOf('p3', 'Player 3', X2_SLOT_1),
      memberOf('p2', 'Player 2', X2_SLOT_2),
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
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(welcome.roster).toEqual([
      memberOf('p1', 'Player 1', X2_SLOT_1, {
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
        yawSteps: 0,
        pitchSteps: 0,
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

  it('closes sockets beyond the connection cap and reports capacity', () => {
    const harness = createHarness({ maxConnections: 2 });
    expect(harness.hub.hasCapacity()).toBe(true);
    const first = harness.connect();
    const second = harness.connect();
    expect(harness.hub.hasCapacity()).toBe(false);
    const rejected = harness.connect();

    expect(rejected.closed).toBe(true);
    expect(rejected.messages()).toEqual([]);
    expect(harness.hub.connectionCount()).toBe(2);

    first.drop();
    expect(harness.hub.connectionCount()).toBe(1);
    expect(harness.hub.hasCapacity()).toBe(true);
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
        yawSteps: 0,
        pitchSteps: 0,
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
        yawSteps: 0,
        pitchSteps: 0,
      },
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: ['front:0:0'],
        yawSteps: 0,
        pitchSteps: 0,
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

  it('drops the 31st explode in a trailing second and keeps the window closed until it ages out', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    const ids = allIds(3);
    peer.clear();

    for (let index = 0; index < 30; index += 1) {
      explode(peer, ids[index]!);
    }
    expect(peer.messages()).toEqual(
      ids.slice(0, 30).map((id) => ({ type: 'miniCubeRemoved', playerId: 'p1', id })),
    );

    peer.clear();
    explode(peer, ids[30]!);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'rate_limited' }]);

    peer.clear();
    explode(peer, ids[31]!);
    expect(peer.messages()).toEqual([]);

    // 999 ms after the first admitted attempt all 30 are still inside the trailing second.
    harness.advance(999);
    explode(peer, ids[31]!);
    expect(peer.messages()).toEqual([]);

    // At exactly +1000 ms the t = 0 attempts are outside (now − 1000, now]: quota is fresh.
    harness.advance(1);
    explode(peer, ids[30]!);
    expect(peer.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: ids[30]! },
    ]);
  });

  it('keeps the window closed for a burst that a fixed one-second window would admit (F4)', () => {
    const harness = createHarness();
    const peer = harness.connect();
    harness.join(peer);
    const ids = allIds(3);
    harness.advance(900);
    peer.clear();

    for (let index = 0; index < 30; index += 1) {
      explode(peer, ids[index]!);
    }
    expect(peer.messages()).toHaveLength(30);

    // A fixed window anchored at join time (t = 0) would reset at t = 1000 and accept this
    // click. The trailing window still contains the 30 attempts from t = 900 → dropped.
    peer.clear();
    harness.advance(100);
    explode(peer, ids[30]!);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'rate_limited' }]);

    // Still inside the burst's trailing second at 999 ms after it.
    peer.clear();
    harness.advance(899);
    explode(peer, ids[30]!);
    expect(peer.messages()).toEqual([]);

    // The burst ages out exactly one second after it was admitted.
    harness.advance(1);
    explode(peer, ids[30]!);
    expect(peer.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: ids[30]! },
    ]);
  });

  it('reports rate_limited at most once per trailing second (F4)', () => {
    const harness = createHarness({ clickRateLimitPerSecond: 2 });
    const peer = harness.connect();
    harness.join(peer);
    const ids = allIds(3);
    peer.clear();

    explode(peer, ids[0]!);
    explode(peer, ids[1]!);
    expect(peer.messages()).toHaveLength(2);

    peer.clear();
    explode(peer, ids[2]!);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'rate_limited' }]);

    // Dropped attempts inside the same second never repeat the error.
    peer.clear();
    harness.advance(400);
    explode(peer, ids[2]!);
    harness.advance(599);
    explode(peer, ids[2]!);
    expect(peer.messages()).toEqual([]);

    // At +1000 ms the first two attempts age out: two are admitted, the third reports again.
    harness.advance(1);
    explode(peer, ids[2]!);
    explode(peer, ids[3]!);
    expect(peer.messages()).toEqual([
      { type: 'miniCubeRemoved', playerId: 'p1', id: ids[2]! },
      { type: 'miniCubeRemoved', playerId: 'p1', id: ids[3]! },
    ]);

    peer.clear();
    explode(peer, ids[4]!);
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
        yawSteps: 0,
        pitchSteps: 0,
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
        yawSteps: 0,
        pitchSteps: 0,
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

    const moved = memberOf('p3', 'Player 3', X2_SLOT_1, {
      levelIndex: 1,
      gridSize: 5,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(third.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p3',
        name: 'Player 3',
        token: thirdToken,
        serverId: 1,
        maxUsers: 2,
        position: X2_SLOT_1,
        self: {
          levelIndex: 1,
          gridSize: 5,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        // The freed slot 1 is the lowest free slot; p2 keeps slot 2 (stable positions).
        roster: [moved, memberOf('p2', 'Player 2', X2_SLOT_2)],
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
        yawSteps: 0,
        pitchSteps: 0,
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

    const moved = memberOf('p4', 'Player 4', X3_SLOT_2, {
      levelIndex: 1,
      gridSize: 5,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(fourth.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p4',
        name: 'Player 4',
        token: fourthToken,
        serverId: 1,
        maxUsers: 3,
        position: X3_SLOT_2,
        self: {
          levelIndex: 1,
          gridSize: 5,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        // p2's vacated slot 2 is the lowest free slot; p1/p3 keep slots 1/3.
        roster: [
          memberOf('p1', 'Player 1', X3_SLOT_1),
          moved,
          memberOf('p3', 'Player 3', X3_SLOT_3),
        ],
      },
    ]);
    expect(fifth.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p4', reason: 'moved' },
    ]);
    expect(first.messages()).toEqual([{ type: 'memberJoined', member: moved }]);
    expect(third.messages()).toEqual([{ type: 'memberJoined', member: moved }]);
  });

  it('re-plans after every executed move so three servers pack completely (X = 2, AC-10, F3)', () => {
    const harness = createHarness({ maxUsersPerServer: 2 }); // draw 0 → every cube is 3×3
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

    // Initial packing: [1: p1, p2] [2: p3, p4] [3: p5].
    expect(welcomeOf(first).serverId).toBe(1);
    expect(welcomeOf(first).position).toEqual(X2_SLOT_1);
    expect(welcomeOf(second).position).toEqual(X2_SLOT_2);
    expect(welcomeOf(third).serverId).toBe(2);
    expect(welcomeOf(third).position).toEqual(X2_SLOT_1);
    expect(welcomeOf(fourth).serverId).toBe(2);
    expect(welcomeOf(fourth).position).toEqual(X2_SLOT_2);
    expect(welcomeOf(fifth).serverId).toBe(3);
    expect(welcomeOf(fifth).position).toEqual(X2_SLOT_1);
    const thirdToken = welcomeOf(third).token;
    const fifthToken = welcomeOf(fifth).token;

    // p1's grace expires: the plan names only p3 (the single free server-1 slot). Nothing
    // moves yet — p3 moves only when their own cube completes.
    first.drop();
    second.clear();
    third.clear();
    fourth.clear();
    fifth.clear();
    harness.advance(harness.config.reconnectGraceMs);
    expect(second.messages()).toEqual([{ type: 'memberLeft', playerId: 'p1', reason: 'left' }]);
    expect(third.messages()).toEqual([]);
    expect(fourth.messages()).toEqual([]);
    expect(fifth.messages()).toEqual([]);

    // p3 completes: the planned move executes into server 1's freed slot 1.
    removeLevel(harness, third, allIds(3));
    second.clear();
    third.clear();
    fourth.clear();
    fifth.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const movedThird = memberOf('p3', 'Player 3', X2_SLOT_1, {
      levelIndex: 1,
      gridSize: 3,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(third.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p3',
        name: 'Player 3',
        token: thirdToken,
        serverId: 1,
        maxUsers: 2,
        position: X2_SLOT_1,
        self: {
          levelIndex: 1,
          gridSize: 3,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        roster: [movedThird, memberOf('p2', 'Player 2', X2_SLOT_2)],
      },
    ]);
    expect(second.messages()).toEqual([{ type: 'memberJoined', member: movedThird }]);
    expect(fourth.messages()).toEqual([
      { type: 'memberLeft', playerId: 'p3', reason: 'moved' },
    ]);
    expect(fifth.messages()).toEqual([]);

    // The move re-planned the remaining donors immediately: p5 (server 3) now targets the
    // hole p3 left on server 2; p4 has no strictly lower capacity and stays put.
    removeLevel(harness, fifth, allIds(3));
    second.clear();
    third.clear();
    fourth.clear();
    fifth.clear();
    fifth.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const movedFifth = memberOf('p5', 'Player 5', X2_SLOT_1, {
      levelIndex: 1,
      gridSize: 3,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(fifth.messages()).toEqual([
      {
        type: 'worldEntered',
        playerId: 'p5',
        name: 'Player 5',
        token: fifthToken,
        serverId: 2,
        maxUsers: 2,
        position: X2_SLOT_1,
        self: {
          levelIndex: 1,
          gridSize: 3,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        roster: [movedFifth, memberOf('p4', 'Player 4', X2_SLOT_2)],
      },
    ]);
    expect(fourth.messages()).toEqual([{ type: 'memberJoined', member: movedFifth }]);
    // Server-scoped: the server-1 members hear nothing about the server-2 move.
    expect(second.messages()).toEqual([]);
    expect(third.messages()).toEqual([]);

    // Servers 1 and 2 are full and server 3 was destroyed: the next join gets fresh id 4.
    const sixth = harness.connect();
    harness.join(sixth);
    const sixthWelcome = welcomeOf(sixth);
    expect(sixthWelcome.serverId).toBe(4);
    expect(sixthWelcome.position).toEqual(X2_SLOT_1);
    expect(sixthWelcome.roster).toEqual([memberOf('p6', 'Player 6', X2_SLOT_1)]);
  });
});

describe('stable slots (T1b)', () => {
  it('keeps the surviving members’ positions when a member’s grace expires (X = 4)', () => {
    const harness = createHarness({ maxUsersPerServer: 4 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    expect(welcomeOf(first).position).toEqual(X4_SLOT_1);
    expect(welcomeOf(second).position).toEqual(X4_SLOT_2);
    expect(welcomeOf(third).position).toEqual(X4_SLOT_3);

    // p2 (slot 2) disconnects and their grace expires exactly at the window.
    second.drop();
    first.clear();
    third.clear();
    harness.advance(harness.config.reconnectGraceMs);
    expect(first.messages()).toEqual([{ type: 'memberLeft', playerId: 'p2', reason: 'left' }]);
    expect(third.messages()).toEqual([{ type: 'memberLeft', playerId: 'p2', reason: 'left' }]);

    // p3 completes: their position is still slot 3 — the vacated slot 2 did not shift them.
    removeLevel(harness, third, allIds(3));
    first.clear();
    third.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const expected = [
      {
        type: 'levelAdvanced',
        playerId: 'p3',
        levelIndex: 1,
        gridSize: 3,
        styleId: 'crimson-alloy',
        position: X4_SLOT_3,
        removedIds: [],
      },
    ] as const;
    expect(first.messages()).toEqual(expected);
    expect(third.messages()).toEqual(expected);
  });

  it('places a new join in the vacated slot and leaves the other members’ positions unchanged', () => {
    const harness = createHarness({ maxUsersPerServer: 4 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    second.drop();
    harness.advance(harness.config.reconnectGraceMs);
    first.clear();
    third.clear();

    const fourth = harness.connect();
    harness.join(fourth);

    const welcome = welcomeOf(fourth);
    expect(welcome.playerId).toBe('p4');
    expect(welcome.position).toEqual(X4_SLOT_2);
    // Slot order, holes skipped: p1 slot 1, the new member slot 2, p3 still slot 3.
    expect(welcome.roster).toEqual([
      memberOf('p1', 'Player 1', X4_SLOT_1),
      memberOf('p4', 'Player 4', X4_SLOT_2),
      memberOf('p3', 'Player 3', X4_SLOT_3),
    ]);
    expect(third.messages()).toEqual([
      { type: 'memberJoined', member: memberOf('p4', 'Player 4', X4_SLOT_2) },
    ]);
  });
describe('orientation storage and rotate (T2)', () => {
  function rotate(peer, yawSteps, pitchSteps) {
    peer.receive(JSON.stringify({ type: 'rotate', yawSteps, pitchSteps }));
  }

  it('initialises member orientation to (0, 0) on join', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const peer = harness.connect();
    harness.join(peer);
    const welcome = welcomeOf(peer);
    expect(welcome.self.yawSteps).toBe(0);
    expect(welcome.self.pitchSteps).toBe(0);
    expect(welcome.roster[0].yawSteps).toBe(0);
    expect(welcome.roster[0].pitchSteps).toBe(0);
  });

  it('answers not_joined for rotate before a successful join', () => {
    const harness = createHarness();
    const peer = harness.connect();
    peer.clear();
    rotate(peer, 1, 0);
    expect(peer.messages()).toEqual([{ type: 'error', code: 'not_joined' }]);
  });

  it('clamps yaw/pitch, updates storage and broadcasts cubeRotated to others only', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    rotate(first, 5, 5);
    expect(first.messages()).toEqual([]);
    expect(second.messages()).toEqual([
      { type: 'cubeRotated', playerId: 'p1', yawSteps: 1, pitchSteps: 1 },
    ]);

    first.clear();
    first.receive(JSON.stringify({ type: 'explode', id: 'front:9:9', level: 0 }));
    expect(first.messages()).toEqual([
      { type: 'error', code: 'invalid_click' },
      {
        type: 'stateSync',
        playerId: 'p1',
        levelIndex: 0,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: [],
        yawSteps: 1,
        pitchSteps: 1,
      },
    ]);
  });

  it('clamps negative yaw and pitch to the pinned ranges', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    rotate(first, -1, -5);
    expect(second.messages()).toEqual([
      { type: 'cubeRotated', playerId: 'p1', yawSteps: 3, pitchSteps: -1 },
    ]);
  });

  it('drops the 21st rotate in a trailing second silently and resets after 1000 ms', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    first.clear();
    second.clear();

    for (let index = 0; index < 20; index += 1) {
      rotate(first, 0, 0);
    }
    expect(second.messages()).toHaveLength(20);
    second.clear();

    rotate(first, 1, 0);
    expect(first.messages()).toEqual([]);
    expect(second.messages()).toEqual([]);

    harness.advance(999);
    rotate(first, 1, 0);
    expect(second.messages()).toEqual([]);

    harness.advance(1);
    rotate(first, 1, 0);
    expect(second.messages()).toEqual([
      { type: 'cubeRotated', playerId: 'p1', yawSteps: 1, pitchSteps: 0 },
    ]);
  });

  it('drops an oversized rotate frame as bad_message', () => {
    const harness = createHarness({ maxUsersPerServer: 2 });
    const peer = harness.connect();
    harness.join(peer);
    peer.clear();
    peer.receive(
      JSON.stringify({ type: 'rotate', yawSteps: 1, pitchSteps: 0, pad: 'x'.repeat(1100) }),
    );
    expect(peer.messages()).toEqual([{ type: 'error', code: 'bad_message' }]);
  });

  it('resets orientation to (0, 0) on a same-server level advance', () => {
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

    rotate(first, 2, 1);
    second.clear();
    first.clear();
    first.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    first.clear();
    first.receive(JSON.stringify({ type: 'explode', id: 'front:9:9', level: 1 }));
    const sync = first.messages().find((m) => m.type === 'stateSync');
    expect(sync).toBeDefined();
    expect(sync.yawSteps).toBe(0);
    expect(sync.pitchSteps).toBe(0);
  });

  it('resets orientation to (0, 0) on a server move', () => {
    const draws = [0, 0, 0, 0, 0, 0.5];
    let drawIndex = 0;
    const harness = createHarness({ maxUsersPerServer: 2 }, () => draws[drawIndex++] ?? 0);
    const first = harness.connect();
    harness.join(first);
    const second = harness.connect();
    harness.join(second);
    const third = harness.connect();
    harness.join(third);
    expect(welcomeOf(third).serverId).toBe(2);

    rotate(third, 2, -1);
    first.drop();
    second.clear();
    third.clear();
    harness.advance(harness.config.reconnectGraceMs);
    removeLevel(harness, third, allIds(3));
    second.clear();
    third.clear();
    third.receive(JSON.stringify({ type: 'cubeCompleted', level: 0 }));

    const joined = second.messages().find((m) => m.type === 'memberJoined');
    expect(joined).toBeDefined();
    expect(joined.member.yawSteps).toBe(0);
    expect(joined.member.pitchSteps).toBe(0);
  });
});

});
