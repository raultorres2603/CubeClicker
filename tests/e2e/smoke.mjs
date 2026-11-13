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
//   6b. A's two `explode` frames in one event-loop turn (`front:0:1`, `front:0:2`) → exactly
//       one `miniCubesRemoved` with both ids in order on A and B, and neither id in a single
//       `miniCubeRemoved` frame on either client (AC-26)
//   7. closing B's socket → A receives `memberLeft { reason: 'left' }` after the grace window
//   8. prod frontend readiness: a bounded poll of `PROD_FRONTEND_URL/` (`READY_TIMEOUT_MS`,
//      500 ms interval) runs before any prod header assertion and records its own PASS line
//   9. prod `/`: 200 + `text/html`, `cache-control: no-cache`, gzip + `vary: Accept-Encoding`,
//      gzip magic bytes, and exactly one module script pointing at the report entry
//  10. prod `/bundle-report.json`: 200, `no-cache`, gzip, with a lazy `three` chunk outside
//      `initial.files`, the pinned 150000/165000/300000 B budgets, and every measurement
//      within its budget (AC-1/AC-9 served-graph proof; the report is names/sizes only, Q-7)
//  11. prod entry and `three` chunks: 200, immutable cache, gzip, and the gunzipped bytes
//      match the report's raw byte counts
//  12. prod `/assets/missing.js` → 404 (never the shell); prod `/missing/route` → the gzip
//      SPA shell with `cache-control: no-cache`
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

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { gunzipSync } from 'node:zlib';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:8080';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://frontend:5173';
const PROD_FRONTEND_URL = process.env.PROD_FRONTEND_URL ?? 'http://frontend-prod:8080';
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
/** Settle after the batch arrives before the negative single-frame assertion (AC-26). */
const BURST_SETTLE_MS = 100;
/**
 * End-of-run drain: the smoke backend's pinned grace window is 1000 ms, so waiting past it lets
 * this run's members expire before the script exits. The next run then starts from an empty
 * registry instead of joining the previous run's grace-retained members.
 */
const SMOKE_SETTLE_MS = 1500;
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://mailpit:8025';
const MAILPIT_TIMEOUT_MS = 10000;
const AUTH_TIMEOUT_MS = 5000;
const AUTH_SETTLE_MS = 1500;
/** Hash-containing build assets may be cached for a year (AC-7/AC-9 exact value). */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
/** First two bytes of a gzip stream (`Content-Encoding: gzip` body proof). */
const GZIP_MAGIC = [0x1f, 0x8b];
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
async function pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
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

/**
 * Raw HTTP GET returning the exact response bytes and the lowercase header map, so gzip and
 * cache headers are observed on the wire (global `fetch` would transparently decompress and
 * normalize some headers). Sends `Accept-Encoding: gzip`, otherwise nginx may serve identity.
 */
function rawGet(url) {
  const target = new URL(url);
  const requestImpl = target.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const request = requestImpl(
      target,
      {
        method: 'GET',
        headers: {
          accept: '*/*',
          'accept-encoding': 'gzip',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error(`GET ${url} timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    request.on('error', reject);
    request.end();
  });
}

/** One response header as a string (repeated headers are joined). */
function headerValue(headers, name) {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value ?? '';
}

/** True when `bytes` starts with the gzip magic number. */
function hasGzipMagic(bytes) {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

/** Gunzips a response body, failing with a concrete byte count when it is not gzip. */
function gunzipBody(bytes, label) {
  if (!hasGzipMagic(bytes)) {
    throw new Error(
      `${label}: expected a gzip body (magic bytes 1f 8b), got ${bytes.length} raw bytes`,
    );
  }
  return gunzipSync(bytes);
}

/**
 * Bounded readiness poll of the prod frontend before any header assertion. `condition:
 * service_started` on the compose dependency guarantees the container started, not that nginx
 * already answers; this poll absorbs that race within the existing `READY_TIMEOUT_MS` budget.
 */
async function checkProdFrontendReady() {
  const url = PROD_FRONTEND_URL + '/';
  const problem = await pollUntilReady(url, async (response) => {
    if (response.status !== 200) {
      return `expected 200, got ${response.status}`;
    }
    const body = await response.text();
    if (!body.includes('id="root"')) {
      return `expected the SPA shell, got ${JSON.stringify(body.slice(0, 80))}`;
    }
    return null;
  });

  record(problem === null, `prod frontend ${url} is ready for delivery checks`, problem ?? '');
}

/**
 * Fetches the served build report and asserts the served chunk graph: the entry is a hashed
 * JS asset, a `three` chunk exists, and `initial.files` excludes it (AC-1/AC-9). Returns the
 * parsed report (or null when it could not be read), so the asset checks can reuse it.
 */
async function checkProdBundleReport() {
  const url = PROD_FRONTEND_URL + '/bundle-report.json';
  const problems = [];
  let report = null;
  let response = null;

  try {
    response = await rawGet(url);
  } catch (error) {
    record(false, `prod ${url} serves the build report with no-cache and gzip`, problemText(error));
    return null;
  }

  if (response.status !== 200) {
    problems.push(`expected 200, got ${response.status}`);
  }
  const contentType = headerValue(response.headers, 'content-type');
  if (!contentType.includes('application/json')) {
    problems.push(`expected application/json content-type, got ${JSON.stringify(contentType)}`);
  }
  const cacheControl = headerValue(response.headers, 'cache-control');
  if (cacheControl !== 'no-cache') {
    problems.push(`expected cache-control "no-cache", got ${JSON.stringify(cacheControl)}`);
  }
  const contentEncoding = headerValue(response.headers, 'content-encoding');
  if (contentEncoding !== 'gzip') {
    problems.push(`expected content-encoding "gzip", got ${JSON.stringify(contentEncoding)}`);
  }

  if (response.status === 200) {
    try {
      report = JSON.parse(gunzipBody(response.body, 'bundle-report.json').toString('utf8'));
    } catch (error) {
      problems.push(problemText(error));
    }
  }

  if (report !== null) {
    if (typeof report.entry?.file !== 'string' || !/^assets\/[^/]+\.js$/.test(report.entry.file)) {
      problems.push(`expected a hashed entry file in the report, got ${JSON.stringify(report.entry?.file)}`);
    }
    if (typeof report.three?.file !== 'string') {
      problems.push(`expected a three chunk in the report, got ${JSON.stringify(report.three)}`);
    } else {
      if (report.three.initial !== false) {
        problems.push(`expected three.initial false, got ${JSON.stringify(report.three.initial)}`);
      }
      if (Array.isArray(report.initial?.files) && report.initial.files.includes(report.three.file)) {
        problems.push(`expected initial.files to exclude ${report.three.file}, got ${JSON.stringify(report.initial.files)}`);
      }
    }

    const budgets = report.budgets ?? {};
    if (
      budgets.initialGzipBytes !== 150000 ||
      budgets.threeGzipBytes !== 165000 ||
      budgets.totalGzipBytes !== 300000
    ) {
      problems.push(
        `expected budgets 150000/165000/300000, got ${JSON.stringify(budgets)}`,
      );
    }
    for (const [scope, measured, budget] of [
      ['initial', report.initial?.gzipBytes, budgets.initialGzipBytes],
      ['three', report.three?.gzipBytes, budgets.threeGzipBytes],
      ['total', report.total?.gzipBytes, budgets.totalGzipBytes],
    ]) {
      if (typeof measured !== 'number' || typeof budget !== 'number') {
        problems.push(`expected a numeric ${scope} gzip measurement and budget, got ${JSON.stringify({ measured, budget })}`);
      } else if (measured > budget) {
        problems.push(`${scope} gzip ${measured} B exceeds the ${budget} B budget`);
      }
    }
  }

  record(
    problems.length === 0,
    `prod ${url} serves the build report with no-cache, gzip, and a lazy three chunk`,
    problems.length === 0 ? '' : problems.join('; '),
  );
  return report;
}

/**
 * The prod shell: gzip + immutable-free `no-cache`, exactly one module script, and that script
 * is the report's entry asset. The shell body is gunzipped before inspection.
 */
async function checkProdShell(report) {
  const url = PROD_FRONTEND_URL + '/';
  const problems = [];
  let response = null;

  try {
    response = await rawGet(url);
  } catch (error) {
    record(false, `prod ${url} serves the gzip app shell with no-cache`, problemText(error));
    return;
  }

  if (response.status !== 200) {
    problems.push(`expected 200, got ${response.status}`);
  }
  const contentType = headerValue(response.headers, 'content-type');
  if (!contentType.includes('text/html')) {
    problems.push(`expected text/html content-type, got ${JSON.stringify(contentType)}`);
  }
  const cacheControl = headerValue(response.headers, 'cache-control');
  if (cacheControl !== 'no-cache') {
    problems.push(`expected cache-control "no-cache", got ${JSON.stringify(cacheControl)}`);
  }
  const contentEncoding = headerValue(response.headers, 'content-encoding');
  if (contentEncoding !== 'gzip') {
    problems.push(`expected content-encoding "gzip", got ${JSON.stringify(contentEncoding)}`);
  }
  const vary = headerValue(response.headers, 'vary');
  if (!vary.toLowerCase().includes('accept-encoding')) {
    problems.push(`expected vary to include "Accept-Encoding", got ${JSON.stringify(vary)}`);
  }
  if (!hasGzipMagic(response.body)) {
    problems.push(`expected gzip magic bytes 1f 8b, got ${response.body.length} raw bytes`);
  } else {
    let html = '';
    try {
      html = gunzipBody(response.body, 'prod /').toString('utf8');
    } catch (error) {
      problems.push(problemText(error));
    }
    if (html !== '') {
      if (!/^<!doctype html>/i.test(html)) {
        problems.push(`expected a <!doctype html> shell, got ${JSON.stringify(html.slice(0, 40))}`);
      }
      if (!html.includes('id="root"')) {
        problems.push('expected the shell to contain id="root"');
      }
      const moduleScripts = [...html.matchAll(/<script\b[^>]*>/g)].filter((match) =>
        /\btype="module"/.test(match[0]),
      );
      if (moduleScripts.length !== 1) {
        problems.push(`expected exactly one <script type="module">, got ${moduleScripts.length}`);
      } else {
        const src = /\bsrc="([^"]+)"/.exec(moduleScripts[0][0])?.[1] ?? '';
        const expectedSrc = '/' + report.entry.file;
        if (src !== expectedSrc) {
          problems.push(`expected module src ${JSON.stringify(expectedSrc)}, got ${JSON.stringify(src)}`);
        }
      }
    }
  }

  record(
    problems.length === 0,
    `prod ${url} serves the gzip app shell with no-cache and the report entry script`,
    problems.length === 0 ? 'content-encoding gzip; cache-control no-cache' : problems.join('; '),
  );
}

/** A hashed JS asset: immutable cache, gzip, and the gunzipped byte count matches the report. */
async function checkProdAsset(label, file, expectedRawBytes) {
  const url = PROD_FRONTEND_URL + '/' + file;
  const problems = [];
  let response = null;

  try {
    response = await rawGet(url);
  } catch (error) {
    record(false, label, problemText(error));
    return;
  }

  if (response.status !== 200) {
    problems.push(`expected 200, got ${response.status}`);
  }
  const cacheControl = headerValue(response.headers, 'cache-control');
  if (cacheControl !== IMMUTABLE_CACHE_CONTROL) {
    problems.push(
      `expected cache-control ${JSON.stringify(IMMUTABLE_CACHE_CONTROL)}, got ${JSON.stringify(cacheControl)}`,
    );
  }
  const contentEncoding = headerValue(response.headers, 'content-encoding');
  if (contentEncoding !== 'gzip') {
    problems.push(`expected content-encoding "gzip", got ${JSON.stringify(contentEncoding)}`);
  }
  let gunzipped = null;
  try {
    gunzipped = gunzipBody(response.body, file);
  } catch (error) {
    problems.push(problemText(error));
  }
  if (gunzipped !== null && gunzipped.length !== expectedRawBytes) {
    problems.push(`expected ${expectedRawBytes} decompressed bytes, got ${gunzipped.length}`);
  }

  record(
    problems.length === 0,
    label,
    problems.length === 0 ? `content-encoding gzip; ${expectedRawBytes} B decompressed` : problems.join('; '),
  );
}

/** A missing hashed asset is a real 404 and is never answered with the SPA shell. */
async function checkProdMissingAsset() {
  const url = PROD_FRONTEND_URL + '/assets/missing.js';
  const problems = [];
  let response = null;

  try {
    response = await rawGet(url);
  } catch (error) {
    record(false, `prod ${url} returns 404 and never the app shell`, problemText(error));
    return;
  }

  if (response.status !== 404) {
    problems.push(`expected 404, got ${response.status}`);
  }
  const cacheControl = headerValue(response.headers, 'cache-control');
  if (cacheControl.includes('immutable') || cacheControl.includes('max-age=31536000')) {
    problems.push(`expected no long-cache header on a 404, got ${JSON.stringify(cacheControl)}`);
  }
  if (response.body.toString('utf8').includes('id="root"')) {
    problems.push('expected a 404 page, got the app shell');
  }

  record(
    problems.length === 0,
    `prod ${url} returns 404 and never the app shell`,
    problems.length === 0 ? 'status 404 without a long-cache header' : problems.join('; '),
  );
}

/** A client route falls back to the gzip app shell and revalidates (no-cache). */
async function checkProdSpaFallback() {
  const url = PROD_FRONTEND_URL + '/missing/route';
  const problems = [];
  let response = null;

  try {
    response = await rawGet(url);
  } catch (error) {
    record(false, `prod ${url} serves the gzip SPA shell with no-cache`, problemText(error));
    return;
  }

  if (response.status !== 200) {
    problems.push(`expected 200, got ${response.status}`);
  }
  const contentType = headerValue(response.headers, 'content-type');
  if (!contentType.includes('text/html')) {
    problems.push(`expected text/html content-type, got ${JSON.stringify(contentType)}`);
  }
  const cacheControl = headerValue(response.headers, 'cache-control');
  if (cacheControl !== 'no-cache') {
    problems.push(`expected cache-control "no-cache", got ${JSON.stringify(cacheControl)}`);
  }
  const contentEncoding = headerValue(response.headers, 'content-encoding');
  if (contentEncoding !== 'gzip') {
    problems.push(`expected content-encoding "gzip", got ${JSON.stringify(contentEncoding)}`);
  }
  if (!hasGzipMagic(response.body)) {
    problems.push(`expected gzip magic bytes 1f 8b, got ${response.body.length} raw bytes`);
  } else {
    try {
      const html = gunzipBody(response.body, 'prod /missing/route').toString('utf8');
      if (!html.includes('id="root"')) {
        problems.push('expected the SPA shell with id="root"');
      }
    } catch (error) {
      problems.push(problemText(error));
    }
  }

  record(
    problems.length === 0,
    `prod ${url} serves the gzip SPA shell with no-cache`,
    problems.length === 0 ? 'status 200; cache-control no-cache' : problems.join('; '),
  );
}

/** Runs the prod delivery checks after readiness and the served report resolve the entry. */
async function checkProdDelivery() {
  await checkProdFrontendReady();
  const report = await checkProdBundleReport();

  if (report === null) {
    record(false, 'prod hashed entry asset', 'not run — the build report could not be read');
    record(false, 'prod hashed three chunk', 'not run — the build report could not be read');
    record(false, 'prod app shell script', 'not run — the build report could not be read');
  } else {
    await checkProdShell(report);
    await checkProdAsset(
      `prod /${report.entry.file} is served gzip with immutable caching`,
      report.entry.file,
      report.entry.rawBytes,
    );
    await checkProdAsset(
      `prod /${report.three.file} is served gzip with immutable caching`,
      report.three.file,
      report.three.rawBytes,
    );
  }

  await checkProdMissingAsset();
  await checkProdSpaFallback();
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
const BURST_CHECK_LABEL =
  'multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)';
const BURST_SINGLE_FRAME_CHECK_LABEL =
  'multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B';
const LEAVE_CHECK_LABEL =
  "multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window";

/**
 * One WebSocket connection with a small message queue, so a check can wait for one specific
 * frame without losing frames that arrived earlier (welcome, memberJoined, ...).
 */
class SmokeSocket {
  #queue = [];
  #waiters = [];
  #history = [];
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

  /** Every parsed frame received on this socket, in arrival order (negative assertions). */
  get history() {
    return this.#history;
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
    this.#history.push(message);
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

    let explodeProblem = null;
    if (!setupComplete) {
      explodeProblem = 'not run — the two-client join failed';
      record(false, EXPLODE_CHECK_LABEL, explodeProblem);
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
      explodeProblem = problem;
      record(problem === null, EXPLODE_CHECK_LABEL, problem ?? '');
    }

    if (explodeProblem !== null) {
      record(false, BURST_CHECK_LABEL, 'not run — the single-click explode check failed');
      record(false, BURST_SINGLE_FRAME_CHECK_LABEL, 'not run — the single-click explode check failed');
    } else {
      // Both explodes leave in one event-loop turn, so the hub's 40 ms window must carry both
      // ids in acceptance order as one batch frame (AC-26).
      const burstIds = ['front:0:1', 'front:0:2'];
      const level = welcomeA.self.levelIndex;
      const matchesBurst = (message) =>
        message?.type === 'miniCubesRemoved' &&
        message.playerId === welcomeA.playerId &&
        Array.isArray(message.ids) &&
        message.ids.length === 2 &&
        message.ids[0] === burstIds[0] &&
        message.ids[1] === burstIds[1];
      let problem = null;
      try {
        clientA.send({ type: 'explode', id: burstIds[0], level });
        clientA.send({ type: 'explode', id: burstIds[1], level });
        await Promise.all([
          waitForMessage(
            clientA,
            matchesBurst,
            MULTIPLAYER_TIMEOUT_MS,
            `miniCubesRemoved [${burstIds.join(', ')}] on A (ack)`,
          ),
          waitForMessage(
            clientB,
            matchesBurst,
            MULTIPLAYER_TIMEOUT_MS,
            `miniCubesRemoved [${burstIds.join(', ')}] on B (broadcast)`,
          ),
        ]);
      } catch (error) {
        problem = problemText(error);
      }

      // Give a hypothetically split flush time to land, then pin exactly one batch per client.
      await delay(BURST_SETTLE_MS);
      const batchProblems = [];
      if (problem !== null) {
        batchProblems.push(problem);
      }
      for (const [socketLabel, client] of [
        ['A', clientA],
        ['B', clientB],
      ]) {
        const batches = client.history.filter(matchesBurst);
        if (batches.length !== 1) {
          batchProblems.push(
            `${socketLabel}: expected exactly one matching miniCubesRemoved, got ${batches.length}`,
          );
        }
      }
      record(batchProblems.length === 0, BURST_CHECK_LABEL, batchProblems.join('; '));

      const singleProblems = [];
      for (const [socketLabel, client] of [
        ['A', clientA],
        ['B', clientB],
      ]) {
        for (const message of client.history) {
          if (message?.type === 'miniCubeRemoved' && burstIds.includes(message.id)) {
            singleProblems.push(`${socketLabel}: ${JSON.stringify(message)}`);
          }
        }
      }
      record(
        singleProblems.length === 0,
        BURST_SINGLE_FRAME_CHECK_LABEL,
        singleProblems.join('; '),
      );
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

async function waitForMailpitMessage(recipient, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`no Mailpit message for ${recipient} within ${timeoutMs}ms`);
    }
    try {
      const response = await fetch(MAILPIT_URL + '/api/v1/messages', {
        signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining)),
      });
      if (response.ok) {
        const body = await response.json();
        const found = (body.messages ?? []).find((message) =>
          (message.To ?? []).some((to) => to.Address === recipient),
        );
        if (found) {
          return found;
        }
      }
    } catch {
      // Retry until the readiness budget runs out.
    }
    await delay(POLL_INTERVAL_MS);
  }
}

async function checkAuthFlow() {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const username = `smoke${suffix}`;
  const email = `smoke${suffix}@example.com`;
  const password = 'smokepassword12';

  let registerProblem = null;

  // Wait for Mailpit to be ready before issuing registration, so a slow Mailpit start
  // cannot surface as a false 500 from /auth/register (which sends the verification
  // email over SMTP). On failure, record the problem as the registration failure and
  // skip verify/login via the existing control flow; the guest check still runs.
  const mailpitReadyProblem = await pollUntilReady(MAILPIT_URL + '/', (response) => {
    if (response.status !== 200) {
      return `expected 200, got ${response.status}`;
    }
    return null;
  }, MAILPIT_TIMEOUT_MS);

  if (mailpitReadyProblem !== null) {
    registerProblem = `Mailpit not ready: ${mailpitReadyProblem}`;
  } else {
    try {
      const response = await fetch(BACKEND_URL + '/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      });
      if (response.status !== 202) {
        registerProblem = `expected 202, got ${response.status}: ${await response.text()}`;
      }
    } catch (error) {
      registerProblem = problemText(error);
    }
  }
  record(registerProblem === null, 'auth register: POST /auth/register returns 202', registerProblem ?? '');

  let verifyProblem = null;
  if (registerProblem === null) {
    try {
      const message = await waitForMailpitMessage(email, MAILPIT_TIMEOUT_MS);
      const detailResponse = await fetch(MAILPIT_URL + '/api/v1/message/' + message.ID, {
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      });
      if (!detailResponse.ok) {
        throw new Error(`Mailpit message fetch failed: ${detailResponse.status}`);
      }
      const detail = await detailResponse.json();
      const source = String(detail.Text ?? detail.HTML ?? '');
      const match = source.match(/token=([A-Za-z0-9]+)/);
      if (!match) {
        throw new Error('verification token not found in the email body');
      }
      const token = match[1];
      const verifyResponse = await fetch(BACKEND_URL + '/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      });
      if (verifyResponse.status !== 200) {
        verifyProblem = `expected 200, got ${verifyResponse.status}: ${await verifyResponse.text()}`;
      } else {
        const setCookie = verifyResponse.headers.get('set-cookie') ?? '';
        if (!setCookie.includes('session=')) {
          verifyProblem = 'verify response missing the session cookie';
        } else {
          const body = await verifyResponse.json();
          if (body?.user?.username !== username || body?.user?.verified !== true) {
            verifyProblem = `unexpected verify body: ${JSON.stringify(body)}`;
          }
        }
      }
    } catch (error) {
      verifyProblem = problemText(error);
    }
  } else {
    verifyProblem = 'not run — registration failed';
  }
  record(
    verifyProblem === null,
    'auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account',
    verifyProblem ?? '',
  );

  let loginProblem = null;
  if (registerProblem === null) {
    try {
      const loginResponse = await fetch(BACKEND_URL + '/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      });
      if (loginResponse.status !== 200) {
        loginProblem = `expected 200, got ${loginResponse.status}: ${await loginResponse.text()}`;
      } else {
        const setCookie = loginResponse.headers.get('set-cookie') ?? '';
        if (!setCookie.includes('session=')) {
          loginProblem = 'login response missing the session cookie';
        } else {
          const body = await loginResponse.json();
          if (body?.user?.username !== username || body?.user?.verified !== true) {
            loginProblem = `unexpected login body: ${JSON.stringify(body)}`;
          }
        }
      }
    } catch (error) {
      loginProblem = problemText(error);
    }
  } else {
    loginProblem = 'not run — registration failed';
  }
  record(loginProblem === null, 'auth login: POST /auth/login returns 200 with a session cookie', loginProblem ?? '');

  let guestProblem = null;
  const guestClient = new SmokeSocket('guest client', WS_URL);
  try {
    await guestClient.open();
    const hello = await guestClient.next(HELLO_TIMEOUT_MS);
    if (hello?.type !== 'hello' || !isParseableTimestamp(hello.serverTime)) {
      throw new Error(`expected the pinned hello first, got ${JSON.stringify(hello)}`);
    }
    guestClient.send({ type: 'join', mode: 'guest' });
    const welcome = await waitForMessage(
      guestClient,
      (message) => message.type === 'welcome',
      MULTIPLAYER_TIMEOUT_MS,
      'welcome',
    );
    if (welcome?.identity?.kind !== 'guest') {
      guestProblem = `expected identity.kind "guest", got ${JSON.stringify(welcome?.identity?.kind)}`;
    }
  } catch (error) {
    guestProblem = problemText(error);
  } finally {
    guestClient.close();
  }
  record(
    guestProblem === null,
    'auth guest: WebSocket join with mode "guest" yields a guest welcome',
    guestProblem ?? '',
  );

  if (guestProblem === null) {
    await delay(AUTH_SETTLE_MS);
  }
}

async function main() {
  console.log(
    `smoke: backend=${BACKEND_URL} frontend=${FRONTEND_URL} prodFrontend=${PROD_FRONTEND_URL} ws=${WS_URL} readyTimeoutMs=${READY_TIMEOUT_MS}`,
  );

  await checkBackendHealth();
  await checkFrontendServesHtml();
  await checkConcurrentWebSocketClients();
  await checkMultiplayerFlow();
  await checkAuthFlow();
  await checkProdDelivery();

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
