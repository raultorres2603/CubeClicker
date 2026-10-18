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
//      parseable `serverTime` within 5s
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

async function main() {
  console.log(`smoke: backend=${BACKEND_URL} frontend=${FRONTEND_URL} ws=${WS_URL} readyTimeoutMs=${READY_TIMEOUT_MS}`);

  await checkBackendHealth();
  await checkFrontendServesHtml();
  await checkConcurrentWebSocketClients();

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
