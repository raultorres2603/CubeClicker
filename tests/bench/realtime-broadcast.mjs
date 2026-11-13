#!/usr/bin/env node
/**
 * Real-time broadcast benchmark — dependency-free Node 24 evidence script
 * (feature `realtime-broadcast-batching`, AC-24/AC-25).
 *
 * Two modes, selected with `--mode`:
 *
 *   node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json
 *     Drives the real hub (real registry, real protocol codec, the in-memory economy
 *     repository, fake peers and a manual clock/scheduler) through ten joins and 100
 *     accepted clicks. Reports encodes per broadcast, registry snapshots per broadcast,
 *     removal/economy frames per 100 clicks, database credits per 100 clicks, the largest
 *     removal frame and the total frames on the clicker. `encodeCallsPerBroadcast` is the
 *     removal-frame encode count divided by the removal broadcasts observed on the clicker
 *     (the ten-recipient server broadcast AC-25 pins: baseline 10, target 1); every counter is
 *     reset after the ten joins and their setup frames, so only the 100-click burst is measured.
 *
 *   node tests/bench/realtime-broadcast.mjs --mode wire --json
 *     Opens real WebSocket clients against a running backend (`--ws`, then `--url`, then
 *     `BACKEND_WS_URL`, default `ws://localhost:8080/ws`), joins every client, then sends the
 *     same four bursts of 25 clicks from the first client. Reports removal frames per 100
 *     clicks per recipient and the p95 click-to-removal receipt latency (`performance.now`
 *     on the client). Plain Node 24: no dependency, no `tsx` needed. Flags: `--clients`,
 *     `--clicks`, `--burst`, `--interval-ms`, `--baseline`, `--max-p95-delta-ms`, `--json`;
 *     the documented commands use the pinned defaults.
 *
 * The load shape is pinned by the spec: 100 clicks as four bursts of 25, 1.1 s apart, so
 * each burst stays inside the accepted 30/s trailing window. In-process, the clicker is an
 * account (to include economy frames) and the other nine members are guests; on the wire,
 * the clients are guests (economy coalescing is proven in-process). Wire mode fails when fewer
 * than all requested clicks are acknowledged within 5 s.
 *
 * Evidence only: the script is not part of the CI gate (Q-4). It exits non-zero on a
 * malformed mode, an unreachable/failing backend, an incomplete join, fewer than 100
 * accepted clicks, or a `--baseline` p95 overrun.
 */

import { parseArgs } from 'node:util';

/** Server message types the encode counter attributes to the protocol codec. */
const SERVER_MESSAGE_TYPES = new Set([
  'hello',
  'welcome',
  'worldEntered',
  'memberJoined',
  'memberLeft',
  'cubeRotated',
  'miniCubeRemoved',
  'miniCubesRemoved',
  'levelAdvanced',
  'stateSync',
  'economyUpdate',
  'upgradesUpdate',
  'customizationUpdate',
  'lootboxOpened',
  'error',
]);

/** The two removal frame shapes a batch flush can produce. */
const REMOVAL_MESSAGE_TYPES = new Set(['miniCubeRemoved', 'miniCubesRemoved']);

/**
 * The canonical mini-cube id generator: `face:row:col`, faces in the server's stable order,
 * rows then columns ascending (mirrors `src/backend/src/game/cubes.ts` `allIds`). Kept local
 * so wire mode stays dependency-free (no TS import); in-process uses the same ids.
 */
const FACE_IDS = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/** Grid edge the in-process run pins (draw 0.999 → N = 3 + ⌊0.999·5⌋ = 7). */
const IN_PROCESS_GRID_SIZE = 7;
const MEMBERS = 10;
const BURSTS = 4;
const CLICKS_PER_BURST = 25;
const CLICK_COUNT = BURSTS * CLICKS_PER_BURST;
const BURST_GAP_MS = 1100;
const FINAL_SETTLE_MS = 500;
const DEFAULT_WS_URL = 'ws://localhost:8080/ws';

function allIds(gridSize) {
  const ids = [];
  for (const faceId of FACE_IDS) {
    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        ids.push(`${faceId}:${row}:${col}`);
      }
    }
  }
  return ids;
}

/** Resolves on the next macrotask, draining every pending promise microtask first. */
function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** p95 by the nearest-rank method (index = ceil(0.95·n) − 1); `null` for an empty sample. */
function percentile95(samples) {
  if (samples.length === 0) {
    return null;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[index];
}

/** A raw count expressed per 100 clicks (the pinned metric unit; 1:1 for the default load). */
function per100(count, clicks) {
  return round((count * 100) / clicks, 2);
}

function positiveIntegerOption(raw, name, fallback) {
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
}

/**
 * The load shape: defaults are the pinned 100 clicks as four bursts of 25, 1.1 s apart.
 * Overrides must stay honest: whole clicks per burst, at most 30 (the accepted trailing-second
 * cap), and at least a 1000 ms gap so a burst never spills into the previous rate window.
 */
function resolveLoadShape() {
  const clicks = positiveIntegerOption(options.clicks, '--clicks', CLICK_COUNT);
  const bursts = positiveIntegerOption(options.burst, '--burst', BURSTS);
  const intervalMs = positiveIntegerOption(options['interval-ms'], '--interval-ms', BURST_GAP_MS);
  if (clicks % bursts !== 0) {
    throw new Error(`--clicks (${clicks}) must be divisible by --burst (${bursts})`);
  }
  const clicksPerBurst = clicks / bursts;
  if (clicksPerBurst > 30) {
    throw new Error(
      `--clicks/--burst yields ${clicksPerBurst} clicks per burst, above the accepted 30/s cap`,
    );
  }
  if (intervalMs < 1000) {
    throw new Error(
      `--interval-ms must be at least 1000 to stay inside the trailing rate window, got ${intervalMs}`,
    );
  }
  return { clicks, bursts, clicksPerBurst, intervalMs };
}

function median(samples) {
  if (samples.length === 0) {
    return null;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The `miniCubeRemoved`/`miniCubesRemoved` ids carried by one decoded frame. */
function removalIdsOf(frame) {
  if (frame.type === 'miniCubeRemoved') {
    return [frame.id];
  }
  if (frame.type === 'miniCubesRemoved') {
    return frame.ids;
  }
  return [];
}

// ---------------------------------------------------------------------------------------
// In-process mode
// ---------------------------------------------------------------------------------------

/** A manual clock plus scheduler: deterministic timers, no real sleeps, no wall clock. */
function createManualTimers() {
  let now = 0;
  let nextHandle = 1;
  const scheduled = new Map();

  function schedule(callback, delayMs, repeat) {
    const wait = Number.isFinite(delayMs) ? Math.max(0, Number(delayMs)) : 0;
    const handle = nextHandle;
    nextHandle += 1;
    scheduled.set(handle, {
      handle,
      dueAt: now + (repeat ? Math.max(1, wait) : wait),
      wait,
      repeat,
      callback,
    });
    return handle;
  }

  const timers = {
    setTimeout: (callback, delayMs) => schedule(callback, delayMs, false),
    clearTimeout: (handle) => {
      scheduled.delete(handle);
    },
    setInterval: (callback, delayMs) => schedule(callback, delayMs, true),
    clearInterval: (handle) => {
      scheduled.delete(handle);
    },
  };

  function advance(ms) {
    const target = now + ms;
    for (;;) {
      let next = null;
      for (const timer of scheduled.values()) {
        if (timer.dueAt > target) {
          continue;
        }
        if (
          next === null ||
          timer.dueAt < next.dueAt ||
          (timer.dueAt === next.dueAt && timer.handle < next.handle)
        ) {
          next = timer;
        }
      }
      if (next === null) {
        break;
      }
      now = next.dueAt;
      if (next.repeat) {
        next.dueAt = now + next.wait;
      } else {
        scheduled.delete(next.handle);
      }
      next.callback();
    }
    now = target;
  }

  return { timers, advance, now: () => now };
}

/** Counts protocol encodes by wrapping `JSON.stringify` for the duration of the run. */
function createEncodeCounter() {
  const original = JSON.stringify;
  const state = { total: 0, removal: 0, byType: new Map() };
  JSON.stringify = function countedStringify(value, ...rest) {
    if (
      value !== null &&
      typeof value === 'object' &&
      typeof value.type === 'string' &&
      SERVER_MESSAGE_TYPES.has(value.type)
    ) {
      state.total += 1;
      state.byType.set(value.type, (state.byType.get(value.type) ?? 0) + 1);
      if (REMOVAL_MESSAGE_TYPES.has(value.type)) {
        state.removal += 1;
      }
    }
    return original.call(JSON, value, ...rest);
  };
  return {
    state,
    reset() {
      state.total = 0;
      state.removal = 0;
      state.byType.clear();
    },
    restore() {
      JSON.stringify = original;
    },
  };
}

/** A fake hub peer: records the text frames the hub sends and drives transport events. */
class BenchPeer {
  constructor() {
    this.sent = [];
    this.closed = false;
    this.closeEmitted = false;
    this.messageHandlers = [];
    this.closeHandlers = [];
    this.pongHandlers = [];
  }

  send(text) {
    if (this.closed) {
      throw new Error('peer.send after close');
    }
    this.sent.push(text);
  }

  close() {
    this.drop();
  }

  isOpen() {
    return !this.closed;
  }

  on(event, handler) {
    if (event === 'message') {
      this.messageHandlers.push(handler);
    } else if (event === 'close') {
      this.closeHandlers.push(handler);
    } else {
      this.pongHandlers.push(handler);
    }
  }

  ping() {}

  receive(frame) {
    for (const handler of this.messageHandlers) {
      handler(frame);
    }
  }

  pong() {
    for (const handler of this.pongHandlers) {
      handler();
    }
  }

  drop() {
    if (this.closeEmitted) {
      return;
    }
    this.closed = true;
    this.closeEmitted = true;
    for (const handler of this.closeHandlers) {
      handler();
    }
  }

  frames() {
    return this.sent.map((text) => JSON.parse(text));
  }

  clear() {
    this.sent.length = 0;
  }
}

/** A registry proxy that counts `servers()` snapshots and delegates every rule. */
function createCountingRegistry(inner) {
  const state = { snapshots: 0 };
  const registry = {
    serverCount: () => inner.serverCount(),
    servers: () => {
      state.snapshots += 1;
      return inner.servers();
    },
    assign: (playerId) => inner.assign(playerId),
    removeMember: (playerId) => inner.removeMember(playerId),
    moveMember: (playerId, targetServerId) => inner.moveMember(playerId, targetServerId),
    plan: () => inner.plan(),
    locationOf: (playerId) => inner.locationOf(playerId),
    forEachMember: (serverId, visit) => inner.forEachMember(serverId, visit),
  };
  return { registry, state };
}

/**
 * Counts economy writes through `creditWithRevision` when the repository has it (the
 * shipped revision-aware API) and falls back to `credit` on the pre-revision baseline.
 * Either way the count is normalized to one write per accepted click.
 */
function countEconomyWrites(repository) {
  const state = {
    writes: 0,
    method: typeof repository.creditWithRevision === 'function' ? 'creditWithRevision' : 'credit',
  };
  const original = repository[state.method].bind(repository);
  repository[state.method] = (...args) => {
    state.writes += 1;
    return original(...args);
  };
  return state;
}

/** Records the removal ids received by one peer, in receive order (frame text + time). */
function removalEvents(peer) {
  const events = [];
  for (const text of peer.sent) {
    const frame = JSON.parse(text);
    if (REMOVAL_MESSAGE_TYPES.has(frame.type)) {
      events.push({ frame, bytes: Buffer.byteLength(text, 'utf8') });
    }
  }
  return events;
}

/**
 * Matches removal ids to the sent click ids in acceptance order. A batch preserves the order
 * of acceptance and a single id arrives as its own frame, so the k-th received id is the k-th
 * accepted click; the resync keeps the count honest if a frame is ever missing.
 */
function matchAcceptedClicks(sentClicks, removalIds) {
  let expected = 0;
  let accepted = 0;
  for (const id of removalIds) {
    if (expected < sentClicks.length && sentClicks[expected] === id) {
      accepted += 1;
      expected += 1;
      continue;
    }
    const found = sentClicks.indexOf(id, expected);
    if (found !== -1) {
      accepted += 1;
      expected = found + 1;
    }
  }
  return accepted;
}

/**
 * Recomputes the wire-mode statistics from the current frame history (safe to call
 * repeatedly while acks are still arriving): removal ids are matched to clicks in acceptance
 * order (ids repeat across levels, so order is the only stable key), each click's receipt
 * time comes from its frame, and every per-recipient frame count is recomputed from scratch.
 */
function collectWireStats(clients, clicks) {
  for (const click of clicks) {
    click.receivedAt = null;
  }
  let expected = 0;
  let accepted = 0;
  const removalFramesByRecipient = [];
  const totalFramesByRecipient = [];
  let maxRemovalFrameBytes = 0;

  for (const client of clients) {
    let removalFrames = 0;
    for (const entry of client.frames) {
      if (!REMOVAL_MESSAGE_TYPES.has(entry.frame.type)) {
        continue;
      }
      removalFrames += 1;
      maxRemovalFrameBytes = Math.max(
        maxRemovalFrameBytes,
        Buffer.byteLength(entry.text, 'utf8'),
      );
      for (const id of removalIdsOf(entry.frame)) {
        if (expected < clicks.length && clicks[expected].id === id) {
          clicks[expected].receivedAt = entry.at;
          accepted += 1;
          expected += 1;
          continue;
        }
        const found = clicks.findIndex(
          (click, index) => index >= expected && click.receivedAt === null && click.id === id,
        );
        if (found !== -1) {
          clicks[found].receivedAt = entry.at;
          accepted += 1;
          expected = found + 1;
        }
      }
    }
    removalFramesByRecipient.push(removalFrames);
    totalFramesByRecipient.push(client.frames.length);
  }

  const latencies = clicks
    .filter((click) => click.receivedAt !== null)
    .map((click) => click.receivedAt - click.sentAt);
  const frameTypes = {};
  for (const entry of clients[0].frames) {
    frameTypes[entry.frame.type] = (frameTypes[entry.frame.type] ?? 0) + 1;
  }

  return {
    accepted,
    removalFramesByRecipient,
    totalFramesByRecipient,
    maxRemovalFrameBytes,
    latencies,
    frameTypes,
  };
}

async function runInProcess() {
  const load = resolveLoadShape();
  // Real modules: the hub, its registry, the protocol codec (via the hub), and the
  // in-memory repository. `tsx` is only needed to import the TypeScript sources.
  const { createGameHub } = await import('../../src/backend/src/game/hub.ts');
  const { createServerRegistry } = await import('../../src/backend/src/game/servers.ts');
  const { InMemoryEconomyRepository } = await import(
    '../../src/backend/src/auth/economy-repository.ts'
  );
  const { loadGameConfig } = await import('../../src/backend/src/game/config.ts');

  const manual = createManualTimers();
  const encode = createEncodeCounter();
  const config = loadGameConfig({});
  const innerRegistry = createServerRegistry(config.maxUsersPerServer);
  const { registry, state: registryState } = createCountingRegistry(innerRegistry);
  const repository = new InMemoryEconomyRepository({ now: manual.now });
  const writeState = countEconomyWrites(repository);

  let hub = null;
  try {
    hub = createGameHub({
      config,
      now: manual.now,
      // 0.999 → every drawn cube is N = 7 (294 ids), so 100 clicks fit on one board.
      random: () => () => 0.999,
      timers: manual.timers,
      economy: repository,
      registry,
    });

    // Ten joined members: the clicker is an account, the other nine are guests.
    const peers = [];
    for (let index = 0; index < MEMBERS; index += 1) {
      const peer = new BenchPeer();
      const session =
        index === 0 ? { userId: 'bench', username: 'bench', verified: true } : null;
      hub.attach(peer, session);
      peer.receive(JSON.stringify({ type: 'join' }));
      peers.push(peer);
      await tick();
      const welcome = peer.frames().find((frame) => frame.type === 'welcome');
      if (welcome === undefined) {
        throw new Error(`join ${index} produced no welcome frame`);
      }
    }

    const clicker = peers[0];
    const clickerWelcome = clicker.frames().find((frame) => frame.type === 'welcome');
    const gridSize = clickerWelcome.self.gridSize;
    const level = clickerWelcome.self.levelIndex;
    if (gridSize !== IN_PROCESS_GRID_SIZE) {
      throw new Error(`expected the pinned N=${IN_PROCESS_GRID_SIZE} cube, got N=${gridSize}`);
    }
    const ids = allIds(gridSize);
    if (ids.length < load.clicks) {
      throw new Error(
        `board holds ${ids.length} ids, fewer than the requested ${load.clicks} clicks`,
      );
    }

    // The registry seam only exists after T3 wires `HubDeps.registry`; before that the hub
    // creates its own registry and the injected proxy never receives an assignment.
    const registrySeamUsed = innerRegistry.serverCount() === 1;
    const setupFrameCounts = peers.map((peer) => peer.sent.length);

    // Reset every counter after the ten joins/welcome setup: the measured window is only the
    // 100-click burst.
    encode.reset();
    registryState.snapshots = 0;
    writeState.writes = 0;
    for (const peer of peers) {
      peer.clear();
    }

    const sentClicks = [];
    for (let burst = 0; burst < load.bursts; burst += 1) {
      for (let index = 0; index < load.clicksPerBurst; index += 1) {
        const id = ids[sentClicks.length];
        sentClicks.push(id);
        clicker.receive(JSON.stringify({ type: 'explode', id, level }));
      }
      // Let the credit promises resolve, then the removal window (40 ms) and the economy
      // cadence (250 ms). At baseline neither timer exists, so the advances are inert.
      await tick();
      manual.advance(40);
      await tick();
      manual.advance(250);
      await tick();
      manual.advance(load.intervalMs - 290);
      await tick();
    }
    // One last settle window for any trailing batch/economy flush.
    await tick();
    manual.advance(FINAL_SETTLE_MS);
    await tick();

    const clickerRemovals = removalEvents(clicker);
    const removalIds = clickerRemovals.flatMap((event) => removalIdsOf(event.frame));
    const acceptedClicks = matchAcceptedClicks(sentClicks, removalIds);

    let maxRemovalFrameBytes = 0;
    for (const peer of peers) {
      for (const event of removalEvents(peer)) {
        maxRemovalFrameBytes = Math.max(maxRemovalFrameBytes, event.bytes);
      }
    }

    const clickerRemovalFrameCount = clickerRemovals.length;
    const economyFrames = clicker
      .frames()
      .filter((frame) => frame.type === 'economyUpdate').length;
    const totalFrames = clicker.sent.length;
    const encodeCallsPerBroadcast =
      clickerRemovalFrameCount === 0
        ? null
        : round(encode.state.removal / clickerRemovalFrameCount, 2);
    const registrySnapshotsPerBroadcast =
      registrySeamUsed && clickerRemovalFrameCount > 0
        ? round(registryState.snapshots / clickerRemovalFrameCount, 2)
        : null;

    const result = {
      mode: 'in-process',
      ok: acceptedClicks === load.clicks,
      members: MEMBERS,
      clicks: load.clicks,
      acceptedClicks,
      bursts: load.bursts,
      clicksPerBurst: load.clicksPerBurst,
      burstGapMs: load.intervalMs,
      gridSize,
      countersResetAfterSetup: true,
      setupFrames: setupFrameCounts,
      encodeCallsPerBroadcast,
      registrySnapshotsPerBroadcast,
      registrySnapshots: registrySeamUsed ? registryState.snapshots : null,
      removalFramesPer100Clicks: per100(clickerRemovalFrameCount, load.clicks),
      economyFramesPer100Clicks: per100(economyFrames, load.clicks),
      dbCreditsPer100Clicks: per100(writeState.writes, load.clicks),
      maxRemovalFrameBytes,
      removalEncodesInWindow: encode.state.removal,
      totalEncodesInWindow: encode.state.total,
      removalBroadcastFramesOnClicker: clickerRemovalFrameCount,
      totalFramesPer100Clicks: per100(totalFrames, load.clicks),
      economyWriteMethod: writeState.method,
    };
    if (!registrySeamUsed) {
      result.registrySnapshotSource =
        'static baseline: HubDeps.registry seam lands in T3; 2 servers() copies per accepted click (broadcast + locationOf)';
    }
    return result;
  } finally {
    encode.restore();
    if (hub !== null) {
      hub.close();
    }
  }
}

// ---------------------------------------------------------------------------------------
// Wire mode
// ---------------------------------------------------------------------------------------

/** Derives the HTTP health URL from the WebSocket URL. */
function healthUrlOf(url) {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
  parsed.pathname = '/healthz';
  parsed.search = '';
  return parsed;
}

async function assertBackendReachable(url) {
  const target = healthUrlOf(url);
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`GET ${target.pathname} returned ${response.status}`);
    }
  } catch (error) {
    throw new Error(`backend not reachable at ${url}: ${error.message}`);
  }
}

function frameText(data) {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }
  return String(data);
}

/** One real WebSocket client: frame history, waiters and always-on listeners. */
function connectClient(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client = { socket, frames: [], waiters: [], listeners: [], opened: false, closed: false };
    const timer = setTimeout(() => {
      reject(new Error(`WebSocket ${url} did not open within 10000 ms`));
    }, 10000);

    socket.addEventListener('open', () => {
      clearTimeout(timer);
      client.opened = true;
      resolve(client);
    });
    socket.addEventListener('error', () => {
      if (!client.opened) {
        clearTimeout(timer);
        reject(new Error(`WebSocket ${url} failed to connect`));
      }
    });
    socket.addEventListener('close', () => {
      client.closed = true;
    });
    socket.addEventListener('message', (event) => {
      let frame;
      try {
        frame = JSON.parse(frameText(event.data));
      } catch {
        frame = { type: '__malformed__', raw: frameText(event.data) };
      }
      const entry = { frame, at: performance.now(), text: frameText(event.data) };
      client.frames.push(entry);
      for (const listener of client.listeners.slice()) {
        listener(entry);
      }
      for (const waiter of client.waiters.slice()) {
        waiter(entry);
      }
    });
  });
}

function waitForFrame(client, predicate, timeoutMs = 10000) {
  const existing = client.frames.find((entry) => predicate(entry.frame));
  if (existing !== undefined) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out after ${timeoutMs} ms waiting for a frame`));
    }, timeoutMs);
    function waiter(entry) {
      if (predicate(entry.frame)) {
        cleanup();
        resolve(entry);
      }
    }
    function cleanup() {
      clearTimeout(timer);
      const index = client.waiters.indexOf(waiter);
      if (index !== -1) {
        client.waiters.splice(index, 1);
      }
    }
    client.waiters.push(waiter);
  });
}

async function runWire() {
  const load = resolveLoadShape();
  const clientCount = positiveIntegerOption(options.clients, '--clients', 2);
  const url = String(options.ws ?? options.url ?? process.env.BACKEND_WS_URL ?? DEFAULT_WS_URL);
  await assertBackendReachable(url);

  const clients = await Promise.all(
    Array.from({ length: clientCount }, () => connectClient(url)),
  );
  const closeAll = () => {
    for (const client of clients) {
      if (!client.closed) {
        client.socket.close();
      }
    }
  };

  try {
    for (const client of clients) {
      client.socket.send(JSON.stringify({ type: 'join' }));
    }
    const welcomes = await Promise.all(
      clients.map((client) => waitForFrame(client, (frame) => frame.type === 'welcome')),
    );

    const clicker = clients[0];
    const clickerWelcome = welcomes[0].frame;
    const board = {
      levelIndex: clickerWelcome.self.levelIndex,
      gridSize: clickerWelcome.self.gridSize,
      ids: allIds(clickerWelcome.self.gridSize),
      cursor: 0,
    };
    let completionPending = null;

    // Track the clicker's authoritative board across completions/moves.
    clicker.listeners.push((entry) => {
      const frame = entry.frame;
      if (frame.type === 'levelAdvanced') {
        board.levelIndex = frame.levelIndex;
        board.gridSize = frame.gridSize;
        board.ids = allIds(frame.gridSize);
        board.cursor = 0;
      } else if (frame.type === 'worldEntered') {
        board.levelIndex = frame.self.levelIndex;
        board.gridSize = frame.self.gridSize;
        board.ids = allIds(frame.gridSize);
        board.cursor = 0;
      } else if (frame.type === 'error' && completionPending !== null) {
        completionPending.reject(
          new Error(`cubeCompleted rejected with error ${frame.code}`),
        );
        completionPending = null;
      }
      if (completionPending !== null && board.levelIndex > completionPending.level) {
        completionPending.resolve();
        completionPending = null;
      }
    });

    function waitForBoardAdvance(level) {
      if (board.levelIndex > level) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (completionPending !== null) {
            completionPending = null;
          }
          reject(new Error(`board did not advance past level ${level} within 5000 ms`));
        }, 5000);
        completionPending = {
          level,
          resolve: () => {
            clearTimeout(timer);
            resolve();
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        };
      });
    }

    const setupFrames = clients.map((client) => client.frames.length);

    // Let any trailing setup broadcast (a `memberJoined` for the last join) land, then drop
    // the setup frames: the measured window starts after every client's welcome.
    await delay(100);
    for (const client of clients) {
      client.frames.length = 0;
    }

    const clicks = [];
    async function clickOnce() {
      if (board.cursor >= board.ids.length) {
        // The board is exhausted: complete it (in order after the last accepted explode) and
        // wait for the server's authoritative next board. Repeated as needed for overrides
        // above 100 clicks; the default run needs at most one completion.
        const completedLevel = board.levelIndex;
        clicker.socket.send(JSON.stringify({ type: 'cubeCompleted', level: completedLevel }));
        await waitForBoardAdvance(completedLevel);
      }
      const id = board.ids[board.cursor];
      board.cursor += 1;
      const sentAt = performance.now();
      clicks.push({ id, sentAt, receivedAt: null });
      clicker.socket.send(
        JSON.stringify({ type: 'explode', id, level: board.levelIndex }),
      );
    }

    for (let burst = 0; burst < load.bursts; burst += 1) {
      for (let index = 0; index < load.clicksPerBurst; index += 1) {
        await clickOnce();
      }
      if (burst < load.bursts - 1) {
        await delay(load.intervalMs);
      }
    }

    // The plan's ack bar: every click must be acknowledged within 5 s of the last burst.
    const ackStartedAt = performance.now();
    let stats = collectWireStats(clients, clicks);
    while (
      stats.accepted < clicks.length &&
      performance.now() - ackStartedAt < 5000
    ) {
      await delay(25);
      stats = collectWireStats(clients, clicks);
    }
    // One short settle so trailing non-removal frames (a completion's levelAdvanced) show up
    // in the diagnostic counts without affecting any measured latency.
    await delay(50);
    stats = collectWireStats(clients, clicks);

    const p95AckLatencyMs = percentile95(stats.latencies);
    const errors = clicker.frames
      .filter((entry) => entry.frame.type === 'error')
      .map((entry) => entry.frame.code);

    let baselineComparison = null;
    let baselineExceeded = false;
    if (options.baseline !== undefined) {
      const raw = await import('node:fs/promises').then((fs) =>
        fs.readFile(String(options.baseline), 'utf8'),
      );
      const parsed = JSON.parse(raw);
      const runs = Array.isArray(parsed) ? parsed : [parsed];
      const baselineP95 = median(
        runs
          .map((run) => run.p95AckLatencyMs)
          .filter((value) => typeof value === 'number' && Number.isFinite(value)),
      );
      const maxDelta = Number.parseFloat(String(options['max-p95-delta-ms']));
      if (baselineP95 === null) {
        throw new Error(`--baseline ${options.baseline} carries no p95AckLatencyMs`);
      }
      if (!Number.isFinite(maxDelta) || maxDelta < 0) {
        throw new Error(
          `--max-p95-delta-ms must be a non-negative number, got "${options['max-p95-delta-ms']}"`,
        );
      }
      baselineExceeded = p95AckLatencyMs !== null && p95AckLatencyMs > baselineP95 + maxDelta;
      baselineComparison = {
        baselineP95AckLatencyMs: round(baselineP95, 2),
        maxP95DeltaMs: maxDelta,
        withinTolerance: !baselineExceeded,
      };
    }

    return {
      mode: 'wire',
      ok: stats.accepted === load.clicks && !baselineExceeded,
      url,
      clients: clientCount,
      clicks: load.clicks,
      acceptedClicks: stats.accepted,
      bursts: load.bursts,
      clicksPerBurst: load.clicksPerBurst,
      burstGapMs: load.intervalMs,
      countersResetAfterSetup: true,
      setupFrames,
      p95AckLatencyMs: p95AckLatencyMs === null ? null : round(p95AckLatencyMs, 2),
      removalFramesPer100Clicks: per100(stats.removalFramesByRecipient[0] ?? 0, load.clicks),
      removalFramesPerRecipient: stats.removalFramesByRecipient,
      totalFramesPerRecipient: stats.totalFramesByRecipient,
      frameTypes: stats.frameTypes,
      maxRemovalFrameBytes: stats.maxRemovalFrameBytes,
      errors,
      baselineComparison,
    };
  } finally {
    closeAll();
  }
}

// ---------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------

let options;
try {
  ({ values: options } = parseArgs({
    options: {
      mode: { type: 'string' },
      json: { type: 'boolean', default: false },
      clients: { type: 'string' },
      clicks: { type: 'string' },
      burst: { type: 'string' },
      'interval-ms': { type: 'string' },
      ws: { type: 'string' },
      url: { type: 'string' },
      baseline: { type: 'string' },
      'max-p95-delta-ms': { type: 'string', default: '60' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  }));
} catch (error) {
  console.error(`realtime-broadcast: ${error.message}`);
  process.exit(1);
}

if (options.help) {
  console.log(`Usage:
  node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json
  node tests/bench/realtime-broadcast.mjs --mode wire --json [--clients 2] [--ws ws://localhost:8080/ws]
       [--clicks 100] [--burst 4] [--interval-ms 1100]
       [--baseline baseline.json] [--max-p95-delta-ms 60]

The wire URL resolves from --ws, then --url, then BACKEND_WS_URL, then ${DEFAULT_WS_URL}.
The client count defaults to 2; every documented command uses the pinned 100-click load shape.`);
  process.exit(0);
}

const mode = options.mode;
if (mode !== 'in-process' && mode !== 'wire') {
  const message = `--mode must be "in-process" or "wire", got "${mode ?? ''}"`;
  if (options.json) {
    console.log(JSON.stringify({ mode: mode ?? null, ok: false, error: message }));
  } else {
    console.error(`realtime-broadcast: ${message}`);
  }
  process.exit(1);
}

let result;
try {
  result = mode === 'in-process' ? await runInProcess() : await runWire();
} catch (error) {
  if (options.json) {
    console.log(JSON.stringify({ mode, ok: false, error: error.message }));
  } else {
    console.error(`realtime-broadcast: ${error.message}`);
  }
  process.exit(1);
}

if (options.json) {
  console.log(JSON.stringify(result));
} else {
  console.log(`realtime-broadcast [${result.mode}] ok=${result.ok}`);
  for (const [key, value] of Object.entries(result)) {
    if (key === 'mode' || key === 'ok') {
      continue;
    }
    console.log(`  ${key}: ${JSON.stringify(value)}`);
  }
}

if (!result.ok) {
  process.exit(1);
}
