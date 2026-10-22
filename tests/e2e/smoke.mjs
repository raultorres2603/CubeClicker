// CubeClicker — containerized smoke test (plan contract 12; feature `stack-selection` T6).
//
// Zero dependencies: Node built-ins only (global `fetch`, global `WebSocket`, timers), so it runs
// as-is on `docker.io/library/node:24-alpine` with no install step.
//
// Defaults target the compose network (`compose.smoke.yaml` mounts this directory read-only into
// the `smoke` service); every target and the readiness budget can be overridden from the
// environment (see the defaults below).
//
// Checks (in order):
//   1. backend  GET /healthz  → 200 + `{"status":"ok"}`
//   2. frontend GET /         → 200 + `text/html`
//   3. two concurrent WebSocket clients, each receiving the pinned `hello` envelope with a
//      parseable `serverTime` within 5s (the first frame on every connection)
//   4. two clients `join` → both `welcome`s report the same server id and `maxUsers 2`, the
//      roster grows from 1 (A's welcome) to 2 (B's welcome), and A also receives `memberJoined`
//   5. a third client `join`s → its `welcome.serverId` is the run's first server id + 1
//      (overflow with X = 2)
//   6. A's valid `explode` → `miniCubeRemoved` on A (ack) and B (broadcast)
//   7. closing B's socket → A receives `memberLeft { reason: 'left' }` after the grace window
//
// Checks 4–7 exercise the multiplayer hub. `compose.smoke.yaml` pins
// `MAX_USERS_PER_SERVER=2` and `RECONNECT_GRACE_MS=1000` for the smoke-run backend so the
// overflow and leave checks finish inside the smoke budget.
//
// Server ids are never reused (AC-3) and `compose run` reuses an already-running backend, so the
// placement checks assert the run's own id chain (the first welcome's id, then the next id for
// the overflow) instead of the literals 1/2. On a cold backend that chain is still 1 → 2. The run
// also drains its members through the grace window before exiting, so the next run starts from an
// empty registry (warm-backend idempotency; review finding F8).
//
// Readiness for (1) and (2) is polled within a bounded budget (`READY_TIMEOUT_MS`); the script
// prints one PASS/FAIL line per check and exits non-zero if any check failed.

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:8080';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://frontend:5173';
const WS_URL = process.env.WS_URL ?? 'ws://backend:8080/ws';
const READY_TIMEOUT_MS = Number(process.env.READY_TIMEOUT_MS ?? 30000);
const HELLO_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 500;
const REQUEST_TIMEOUT_MS = 3000;
/** Per-frame budget for the multiplayer checks (join/welcome/broadcast). */
const MULTIPLAYER_TIMEOUT_MS = 5000;
/** Leave budget: the smoke grace window is 1s, plus time for the timer and the broadcast. */
const MEMBER_LEFT_TIMEOUT_MS = 5000;
/** Lower bound proving the leave went through the grace window instead of firing instantly. */
const GRACE_LOWER_BOUND_MS = 900;
/**
 * End-of-run drain: the smoke backend's pinned grace window is 1000 ms, so waiting past it lets
 * this run's members expire before the script exits. The next run then starts from an empty
 * registry instead of joining the previous run's grace-retained members.
 */
const SMOKE_SETTLE_MS = 1500;

const results = [];

function record(ok, label, detail = '') {
  results.push({ ok, label });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Polls `url` until `validate` reports no problem, or the readiness budget runs out.
 * Returns `null` on success, otherwise the last observed problem as a string.
 */
async function pollUntilReady(url, validate) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastProblem = 'no attempt completed';

  for (;;) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      const problem = await validate(response);
      if (problem === null) {
        return null;
      }
      lastProblem = problem;
    } catch (error) {
      lastProblem = error instanceof Error ? error.message : String(error);
    }

    if (Date.now() >= deadline) {
      return lastProblem;
    }
    await delay(POLL_INTERVAL_MS);
  }
}

async function checkBackendHealth() {
  const problem = await pollUntilReady(BACKEND_URL + '/healthz', async (response) => {
    if (response.status !== 200) {
      return `expected 200, got ${response.status}`;
    }
    const body = await response.text();
    if (body !== '{"status":"ok"}') {
      return `expected body {"status":"ok"}, got ${JSON.stringify(body)}`;
    }
    return null;
  });

  record(problem === null, `backend ${BACKEND_URL}/healthz responds 200 with {"status":"ok"}`, problem ?? '');
}

async function checkFrontendServesHtml() {
  const problem = await pollUntilReady(FRONTEND_URL + '/', (response) => {
    if (response.status !== 200) {
      return `expected 200, got ${response.status}`;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return `expected text/html content-type, got ${JSON.stringify(contentType)}`;
    }
    return null;
  });

  record(problem === null, `frontend ${FRONTEND_URL}/ responds 200 with text/html`, problem ?? '');
}

/**
 * Opens one WebSocket client and resolves with `null` once the pinned `hello` envelope arrives
 * (parseable `serverTime`), or with the problem as a string. The socket is always closed.
 */
function receiveHello() {
  return new Promise((resolve) => {
    const socket = new WebSocket(WS_URL);
    let settled = false;

    const finish = (problem) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // already closed
      }
      resolve(problem);
    };

    const timer = setTimeout(() => {
      finish(`no hello within ${HELLO_TIMEOUT_MS}ms`);
    }, HELLO_TIMEOUT_MS);

    socket.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch (error) {
        finish(`hello is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      if (message?.type !== 'hello') {
        finish(`expected type "hello", got ${JSON.stringify(message?.type)}`);
        return;
      }
      if (typeof message.serverTime !== 'string' || Number.isNaN(Date.parse(message.serverTime))) {
        finish(`serverTime is not a parseable ISO-8601 timestamp: ${JSON.stringify(message.serverTime)}`);
        return;
      }
      finish(null);
    });

    socket.addEventListener('error', () => {
      finish('websocket error before hello');
    });

    socket.addEventListener('close', () => {
      finish('websocket closed before hello');
    });
  });
}

async function checkConcurrentWebSocketClients() {
  const problems = await Promise.all([receiveHello(), receiveHello()]);
  problems.forEach((problem, index) => {
    record(problem === null, `websocket client ${index + 1} received hello from ${WS_URL}`, problem ?? '');
  });
}

/** True for an ISO-8601 string `Date.parse` can read (the pinned `serverTime` contract). */
function isParseableTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function problemText(error) {
  return error instanceof Error ? error.message : String(error);
}

const JOIN_CHECK_LABEL =
  'multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined';
const OVERFLOW_CHECK_LABEL =
  'multiplayer overflow: the third client lands on the next server id (X = 2)';
const EXPLODE_CHECK_LABEL =
  "multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)";
const LEAVE_CHECK_LABEL =
  "multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window";

/**
 * One WebSocket connection with a small message queue, so a check can wait for one specific
 * frame without losing frames that arrived earlier (welcome, memberJoined, ...).
 */
class SmokeSocket {
  #queue = [];
  #waiters = [];
  #closed = false;

  constructor(label, url) {
    this.label = label;
    this.url = url;
    this.socket = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      let settled = false;
      let timer = null;

      const fail = (problem) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer !== null) {
          clearTimeout(timer);
        }
        this.close();
        reject(new Error(`${this.label}: ${problem}`));
      };

      timer = setTimeout(() => {
        fail(`websocket did not open within ${HELLO_TIMEOUT_MS}ms`);
      }, HELLO_TIMEOUT_MS);

      socket.addEventListener(
        'open',
        () => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        'error',
        () => {
          fail('websocket error before open');
        },
        { once: true },
      );
      socket.addEventListener('message', (event) => {
        this.#receive(event.data);
      });
      socket.addEventListener('close', () => {
        this.#rejectWaiters();
        fail('websocket closed before open');
      });
    });
  }

  next(timeoutMs) {
    if (this.#queue.length > 0) {
      return Promise.resolve(this.#queue.shift());
    }
    if (this.#closed) {
      return Promise.reject(new Error(`${this.label}: socket closed before the expected message`));
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const index = this.#waiters.indexOf(waiter);
        if (index !== -1) {
          this.#waiters.splice(index, 1);
        }
        reject(new Error(`${this.label}: no message within ${timeoutMs}ms`));
      }, timeoutMs);
      this.#waiters.push(waiter);
    });
  }

  send(message) {
    this.socket.send(JSON.stringify(message));
  }

  close() {
    try {
      this.socket?.close();
    } catch {
      // already closed
    }
  }

  #receive(data) {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch {
      message = { type: '__unparseable__', raw: String(data) };
    }
    const waiter = this.#waiters.shift();
    if (waiter === undefined) {
      this.#queue.push(message);
      return;
    }
    clearTimeout(waiter.timer);
    waiter.resolve(message);
  }

  #rejectWaiters() {
    this.#closed = true;
    for (const waiter of this.#waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`${this.label}: socket closed before the expected message`));
    }
  }
}

/** Opens a socket and completes the retained handshake: `hello` first, then `join`. */
async function connectAndJoin(label) {
  const client = new SmokeSocket(label, WS_URL);
  try {
    await client.open();
    const hello = await client.next(HELLO_TIMEOUT_MS);
    if (hello?.type !== 'hello' || !isParseableTimestamp(hello.serverTime)) {
      throw new Error(`${label}: expected the pinned hello first, got ${JSON.stringify(hello)}`);
    }
    client.send({ type: 'join' });
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
}

/**
 * Consumes frames until `predicate` matches, failing on a server `error` frame, a closed
 * socket, or the timeout. `expectation` names the awaited frame in failure output.
 */
async function waitForMessage(client, predicate, timeoutMs, expectation) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`${client.label}: timed out waiting for ${expectation}`);
    }
    const message = await client.next(remaining);
    if (predicate(message)) {
      return message;
    }
    if (message?.type === 'error') {
      throw new Error(
        `${client.label}: server error ${JSON.stringify(message.code)} while waiting for ${expectation}`,
      );
    }
  }
}

/** The exact pinned checks for one `welcome` (assignment, capacity, self-inclusive roster). */
function welcomeProblems(label, welcome, serverId, maxUsers, rosterSize) {
  const problems = [];
  if (welcome?.serverId !== serverId) {
    problems.push(`${label} welcome.serverId expected ${serverId}, got ${JSON.stringify(welcome?.serverId)}`);
  }
  if (welcome?.maxUsers !== maxUsers) {
    problems.push(`${label} welcome.maxUsers expected ${maxUsers}, got ${JSON.stringify(welcome?.maxUsers)}`);
  }
  if (welcome?.roster?.length !== rosterSize) {
    problems.push(
      `${label} welcome.roster expected ${rosterSize} member(s), got ${JSON.stringify(welcome?.roster?.length)}`,
    );
  }
  return problems;
}

/** The run-relative anchor: every server id must be a real id issued by this backend process. */
function serverIdProblems(label, welcome) {
  const serverId = welcome?.serverId;
  if (typeof serverId !== 'number' || !Number.isInteger(serverId) || serverId < 1) {
    return [`${label} welcome.serverId expected a positive integer, got ${JSON.stringify(serverId)}`];
  }
  return [];
}

/**
 * AC-26 end-to-end sequence against the smoke-run backend (X = 2, grace 1 s): join/roster,
 * overflow, an explode ack + broadcast, and a disconnect that expires through the grace window.
 * Every frame is server-authored; the script only asserts the concrete values it receives.
 */
async function checkMultiplayerFlow() {
  const sockets = [];
  let clientA = null;
  let clientB = null;
  let welcomeA = null;
  let welcomeB = null;
  let setupProblem = null;

  try {
    try {
      clientA = await connectAndJoin('client A');
      sockets.push(clientA);
      welcomeA = await waitForMessage(
        clientA,
        (message) => message.type === 'welcome',
        MULTIPLAYER_TIMEOUT_MS,
        'welcome',
      );

      clientB = await connectAndJoin('client B');
      sockets.push(clientB);
      welcomeB = await waitForMessage(
        clientB,
        (message) => message.type === 'welcome',
        MULTIPLAYER_TIMEOUT_MS,
        'welcome',
      );
      await waitForMessage(
        clientA,
        (message) =>
          message.type === 'memberJoined' && message.member?.playerId === welcomeB.playerId,
        MULTIPLAYER_TIMEOUT_MS,
        `memberJoined for ${welcomeB.playerId}`,
      );
    } catch (error) {
      setupProblem = problemText(error);
    }

    const setupComplete = setupProblem === null;

    if (setupComplete) {
      // Server ids are never reused, so the run anchors on its own first id (1 on a cold backend).
      const runServerId = welcomeA.serverId;
      const problems = [
        ...serverIdProblems('A', welcomeA),
        ...serverIdProblems('B', welcomeB),
        ...welcomeProblems('A', welcomeA, runServerId, 2, 1),
        ...welcomeProblems('B', welcomeB, runServerId, 2, 2),
      ];
      record(
        problems.length === 0,
        JOIN_CHECK_LABEL,
        problems.length === 0 ? `server ${runServerId}` : problems.join('; '),
      );
    } else {
      record(false, JOIN_CHECK_LABEL, setupProblem);
    }

    if (!setupComplete) {
      record(false, OVERFLOW_CHECK_LABEL, 'not run — the two-client join failed');
    } else {
      let problem = null;
      let overflowServerId = null;
      const expectedServerId = welcomeA.serverId + 1;
      try {
        const clientC = await connectAndJoin('client C');
        sockets.push(clientC);
        const welcomeC = await waitForMessage(
          clientC,
          (message) => message.type === 'welcome',
          MULTIPLAYER_TIMEOUT_MS,
          'welcome',
        );
        overflowServerId = welcomeC.serverId;
        if (welcomeC.serverId !== expectedServerId) {
          problem = `expected C welcome.serverId ${expectedServerId} (the run's first server ${welcomeA.serverId} + 1, overflow at X = 2), got ${JSON.stringify(welcomeC.serverId)}`;
        }
      } catch (error) {
        problem = problemText(error);
      }
      record(problem === null, OVERFLOW_CHECK_LABEL, problem ?? `server ${overflowServerId}`);
    }

    if (!setupComplete) {
      record(false, EXPLODE_CHECK_LABEL, 'not run — the two-client join failed');
    } else {
      const id = 'front:0:0';
      const level = welcomeA.self.levelIndex;
      let problem = null;
      try {
        clientA.send({ type: 'explode', id, level });
        await Promise.all([
          waitForMessage(
            clientA,
            (message) =>
              message.type === 'miniCubeRemoved' &&
              message.playerId === welcomeA.playerId &&
              message.id === id,
            MULTIPLAYER_TIMEOUT_MS,
            `miniCubeRemoved ${id} on A (ack)`,
          ),
          waitForMessage(
            clientB,
            (message) =>
              message.type === 'miniCubeRemoved' &&
              message.playerId === welcomeA.playerId &&
              message.id === id,
            MULTIPLAYER_TIMEOUT_MS,
            `miniCubeRemoved ${id} on B (broadcast)`,
          ),
        ]);
      } catch (error) {
        problem = problemText(error);
      }
      record(problem === null, EXPLODE_CHECK_LABEL, problem ?? '');
    }

    if (!setupComplete) {
      record(false, LEAVE_CHECK_LABEL, 'not run — the two-client join failed');
    } else {
      let problem = null;
      let elapsedMs = null;
      try {
        const closedAt = Date.now();
        clientB.close();
        const left = await waitForMessage(
          clientA,
          (message) => message.type === 'memberLeft' && message.playerId === welcomeB.playerId,
          MEMBER_LEFT_TIMEOUT_MS,
          `memberLeft for ${welcomeB.playerId}`,
        );
        elapsedMs = Date.now() - closedAt;
        if (left.reason !== 'left') {
          problem = `expected reason "left", got ${JSON.stringify(left.reason)}`;
        } else if (elapsedMs < GRACE_LOWER_BOUND_MS) {
          problem = `memberLeft arrived after ${elapsedMs}ms, before the 1000ms grace window`;
        }
      } catch (error) {
        problem = problemText(error);
      }
      record(problem === null, LEAVE_CHECK_LABEL, problem ?? `memberLeft(left) received after ${elapsedMs}ms`);
    }
  } finally {
    for (const socket of sockets) {
      socket.close();
    }
    if (sockets.length > 0) {
      // Drain this run's members through the pinned 1 s smoke grace window so the next run starts
      // from an empty registry (server ids keep increasing; the checks are run-relative).
      await delay(SMOKE_SETTLE_MS);
    }
  }
}

async function main() {
  console.log(`smoke: backend=${BACKEND_URL} frontend=${FRONTEND_URL} ws=${WS_URL} readyTimeoutMs=${READY_TIMEOUT_MS}`);

  await checkBackendHealth();
  await checkFrontendServesHtml();
  await checkConcurrentWebSocketClients();
  await checkMultiplayerFlow();

  const failures = results.filter((result) => !result.ok).length;
  if (failures === 0) {
    console.log(`SMOKE PASS (${results.length}/${results.length} checks)`);
    process.exitCode = 0;
  } else {
    console.log(`SMOKE FAIL (${results.length - failures}/${results.length} checks passed)`);
    process.exitCode = 1;
  }
}

await main();
