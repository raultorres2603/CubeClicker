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
//   4b. activity snapshot: A's `welcome.activity` is `[]` and B's `welcome.activity` carries
//      exactly A's accepted `memberJoined` event (serverId, playerId, name, positive id, finite at)
//   4c. appearance projection (remote-spaceship-customization AC-35): guest B's valid 11-slot
//      `setAppearance` yields exactly one `memberAppearance` on guest A with that exact record
//      (A's roster entry for B was `{}` first); an unknown slot key yields
//      `error bad_message` and no further frame
//   5. a third client `join`s → its `welcome.serverId` is the run's first server id + 1
//      (overflow with X = 2)
//   6. A's valid `explode` → `miniCubeRemoved` on A (ack) and B (broadcast)
//   6b. A's two `explode` frames in one event-loop turn (`front:0:1`, `front:0:2`) → exactly
//       one `miniCubesRemoved` with both ids in order on A and B, and neither id in a single
//       `miniCubeRemoved` frame on either client (AC-26)
//   6c. leaderboard: A's `welcome.leaderboard` is a one-entry zero snapshot; B's carries A
//       and B with zero counters/totals; after the three accepted explodes A receives a
//       coalesced `leaderboardUpdate` (1 s window) with A clicks >= 3, B clicks = 0, both
//       cubesCompleted = 0 and totals clicks >= 3 (`server-live-leaderboard`, AC-25)
//   7. closing B's socket → A receives `memberLeft { reason: 'left' }` after the grace window
//   7b. activity leave: A also receives the `activityEvent` `memberLeft` for B with B's name,
//      A's server id and an id newer than the `memberJoined` snapshot id (no extra wait)
//   7c. explicit leave: D joins the run's server in B's freed slot 2 and sends `leave` → A
//      receives `memberLeft { reason: 'left' }` in < 900 ms (no grace window); E then joins
//      in D's freed slot with `welcome.roster` exactly [A, E] in slot order
//   8. joined-state metrics: one client opens, reads `hello`, sends `join`, waits for
//      `welcome`, and while it is still joined a scrape of `BACKEND_URL/metrics` asserts the
//      Prometheus content type, the `# TYPE cubeclicker_ws_connections_open gauge` line, and
//      live samples (`connections_open` and `servers_active` >= 1, plus
//      `connections_total`, `messages_received_total{type="join"}` and
//      `frames_sent_total{type="hello"}` >= 3); the client then closes and the run settles
//   9. prod frontend readiness: a bounded poll of `PROD_FRONTEND_URL/` (`READY_TIMEOUT_MS`,
//      500 ms interval) runs before any prod header assertion and records its own PASS line
//  10. prod `/`: 200 + `text/html`, `cache-control: no-cache`, gzip + `vary: Accept-Encoding`,
//      gzip magic bytes, and exactly one module script pointing at the report entry
//  11. prod `/bundle-report.json`: 200, `no-cache`, gzip, with a lazy `three` chunk outside
//      `initial.files`, the pinned 150000/165000/300000 B budgets, and every measurement
//      within its budget (AC-1/AC-9 served-graph proof; the report is names/sizes only, Q-7)
//  12. prod entry and `three` chunks: 200, immutable cache, gzip, and the gunzipped bytes
//      match the report's raw byte counts
//  13. prod `/assets/missing.js` → 404 (never the shell); prod `/missing/route` → the gzip
//      SPA shell with `cache-control: no-cache`
//
// Checks 4–8 exercise the multiplayer hub. `compose.smoke.yaml` pins
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
 * AC-35 appearance check: the exact 11-slot v3 record guest B reports. Every id is a valid
 * generated catalog row (`<slot>-bulwark-crimson`, the T6 worst-case fixture), so the record
 * also exercises the longest accepted part ids.
 */
const FULL_APPEARANCE = {
  hull: 'hull-bulwark-crimson',
  nose: 'nose-bulwark-crimson',
  cockpit: 'cockpit-bulwark-crimson',
  'wing-left': 'wing-left-bulwark-crimson',
  'wing-right': 'wing-right-bulwark-crimson',
  'engine-left': 'engine-left-bulwark-crimson',
  'engine-right': 'engine-right-bulwark-crimson',
  'ignition-left': 'ignition-left-bulwark-crimson',
  'ignition-right': 'ignition-right-bulwark-crimson',
  'tail-fin': 'tail-fin-bulwark-crimson',
  shot: 'shot-bulwark-crimson',
};
/** Settle after a rejected setAppearance before pinning that nothing was broadcast (AC-35). */
const APPEARANCE_SETTLE_MS = 250;
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

/**
 * Reads one exact Prometheus sample from the scrape body. `sample` is the complete
 * name-plus-label key (for example `cubeclicker_servers_active` or
 * `cubeclicker_ws_messages_received_total{type="join"}`); the line must start with it
 * followed by a single space, so a longer metric name can never match. Returns the
 * numeric value, or `null` when the sample is absent or non-numeric.
 */
function readMetricSample(body, sample) {
  const prefix = `${sample} `;
  for (const line of body.split('\n')) {
    if (line.startsWith(prefix)) {
      const value = Number(line.slice(prefix.length));
      return Number.isFinite(value) ? value : null;
    }
  }
  return null;
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
const ACTIVITY_JOIN_CHECK_LABEL =
  "activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event";
const APPEARANCE_CHECK_LABEL =
  "appearance projection: guest B's 11-slot setAppearance yields exactly one memberAppearance on guest A, and an unknown slot key yields bad_message without a broadcast";
const ACTIVITY_LEAVE_CHECK_LABEL =
  "activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id";
const EXPLICIT_LEAVE_CHECK_LABEL =
  "multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window";
const SLOT_REUSE_CHECK_LABEL =
  "multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E]";
const LEADERBOARD_JOIN_CHECK_LABEL =
  "leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals";
const LEADERBOARD_UPDATE_CHECK_LABEL =
  'leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3';
const METRICS_CHECK_LABEL =
  'metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters';

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

/**
 * The exact slot-ordered roster: one entry per expected member, in the given order, with the
 * server-issued `playerId` and `name` (slot-2 reuse proof for AC-22).
 */
function rosterProblems(label, roster, expected) {
  const problems = [];
  if (!Array.isArray(roster)) {
    return [`${label} welcome.roster expected an array, got ${JSON.stringify(roster)}`];
  }
  if (roster.length !== expected.length) {
    problems.push(
      `${label} welcome.roster expected ${expected.length} member(s), got ${JSON.stringify(roster.length)}`,
    );
  }
  expected.forEach((member, index) => {
    if (roster[index]?.playerId !== member.playerId) {
      problems.push(
        `${label} welcome.roster[${index}].playerId expected ${JSON.stringify(member.playerId)}, got ${JSON.stringify(roster[index]?.playerId)}`,
      );
    }
    if (roster[index]?.name !== member.name) {
      problems.push(
        `${label} welcome.roster[${index}].name expected ${JSON.stringify(member.name)}, got ${JSON.stringify(roster[index]?.name)}`,
      );
    }
  });
  return problems;
}

/**
 * Exact equality for one appearance record: a plain object with exactly the expected
 * slot→part-id entries and no extra keys (no wildcard match).
 */
function appearanceProblems(label, appearance, expected) {
  if (appearance === null || typeof appearance !== 'object' || Array.isArray(appearance)) {
    return [`${label} expected an appearance object, got ${JSON.stringify(appearance)}`];
  }
  const problems = [];
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(appearance);
  if (actualKeys.length !== expectedKeys.length) {
    problems.push(
      `${label} expected ${expectedKeys.length} entries, got ${JSON.stringify(actualKeys)}`,
    );
  }
  for (const key of expectedKeys) {
    if (appearance[key] !== expected[key]) {
      problems.push(
        `${label}.${key} expected ${JSON.stringify(expected[key])}, got ${JSON.stringify(appearance[key])}`,
      );
    }
  }
  for (const key of actualKeys) {
    if (!Object.hasOwn(expected, key)) {
      problems.push(`${label} carries unexpected slot ${JSON.stringify(key)}`);
    }
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
 * Exact per-field checks for one leaderboard entry (`server-live-leaderboard`, AC-25): the
 * server-issued `playerId`/`name` and the session counters as sent. Reads only the four
 * documented fields, so a leaked extra field never satisfies a check by accident.
 */
function leaderboardEntryProblems(label, entry, expected) {
  const problems = [];
  if (entry?.playerId !== expected.playerId) {
    problems.push(
      `${label}.playerId expected ${JSON.stringify(expected.playerId)}, got ${JSON.stringify(entry?.playerId)}`,
    );
  }
  if (entry?.name !== expected.name) {
    problems.push(`${label}.name expected ${JSON.stringify(expected.name)}, got ${JSON.stringify(entry?.name)}`);
  }
  if (entry?.cubesCompleted !== expected.cubesCompleted) {
    problems.push(
      `${label}.cubesCompleted expected ${expected.cubesCompleted}, got ${JSON.stringify(entry?.cubesCompleted)}`,
    );
  }
  if (entry?.clicks !== expected.clicks) {
    problems.push(`${label}.clicks expected ${expected.clicks}, got ${JSON.stringify(entry?.clicks)}`);
  }
  return problems;
}

/**
 * The pinned zero totals of a fresh server: every member has just joined and no accepted
 * action has incremented a counter yet.
 */
function zeroLeaderboardTotalsProblems(label, totals) {
  const problems = [];
  for (const key of ['cubesCompleted', 'clicks', 'facesDestroyed']) {
    if (totals?.[key] !== 0) {
      problems.push(`${label}.${key} expected 0, got ${JSON.stringify(totals?.[key])}`);
    }
  }
  return problems;
}

/**
 * The exact welcome snapshot contract: an object on the run's server, a finite `at`, the
 * expected entries in server order (zero counters at join) and zero totals.
 */
function welcomeLeaderboardProblems(label, leaderboard, serverId, expectedEntries) {
  if (leaderboard === null || typeof leaderboard !== 'object' || Array.isArray(leaderboard)) {
    return [`${label} welcome.leaderboard expected an object, got ${JSON.stringify(leaderboard)}`];
  }
  const problems = [];
  if (leaderboard.serverId !== serverId) {
    problems.push(
      `${label} welcome.leaderboard.serverId expected ${serverId}, got ${JSON.stringify(leaderboard.serverId)}`,
    );
  }
  if (typeof leaderboard.at !== 'number' || !Number.isFinite(leaderboard.at)) {
    problems.push(
      `${label} welcome.leaderboard.at expected a finite number, got ${JSON.stringify(leaderboard.at)}`,
    );
  }
  if (!Array.isArray(leaderboard.entries) || leaderboard.entries.length !== expectedEntries.length) {
    problems.push(
      `${label} welcome.leaderboard.entries expected ${expectedEntries.length}, got ${JSON.stringify(leaderboard.entries)}`,
    );
  } else {
    expectedEntries.forEach((expected, index) => {
      problems.push(
        ...leaderboardEntryProblems(
          `${label} welcome.leaderboard.entries[${index}]`,
          leaderboard.entries[index],
          expected,
        ),
      );
    });
  }
  problems.push(...zeroLeaderboardTotalsProblems(`${label} welcome.leaderboard.totals`, leaderboard.totals));
  return problems;
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
  let memberJoinedB = null;
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
      memberJoinedB = await waitForMessage(
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

    // Activity snapshot: A's fresh server starts with an empty ring; B's welcome is built
    // after A's accepted `memberJoined` event, so it carries exactly that one event. B's own
    // join candidate is either outside the 1 s window (accepted after the snapshot) or
    // dropped by it — neither path changes B's snapshot.
    let joinActivityId = null;
    if (!setupComplete) {
      record(false, ACTIVITY_JOIN_CHECK_LABEL, 'not run — the two-client join failed');
    } else {
      const problems = [];
      if (!Array.isArray(welcomeA.activity) || welcomeA.activity.length !== 0) {
        problems.push(
          `A welcome.activity expected an empty array, got ${JSON.stringify(welcomeA.activity)}`,
        );
      }
      const ring = welcomeB.activity;
      if (!Array.isArray(ring) || ring.length !== 1) {
        problems.push(
          `B welcome.activity expected exactly one event (A's memberJoined), got ${JSON.stringify(ring)}`,
        );
      } else {
        const [joined] = ring;
        if (joined.type !== 'memberJoined') {
          problems.push(
            `B welcome.activity[0].type expected "memberJoined", got ${JSON.stringify(joined.type)}`,
          );
        }
        if (joined.serverId !== welcomeA.serverId) {
          problems.push(
            `B welcome.activity[0].serverId expected ${welcomeA.serverId}, got ${JSON.stringify(joined.serverId)}`,
          );
        }
        if (joined.playerId !== welcomeA.playerId) {
          problems.push(
            `B welcome.activity[0].playerId expected ${JSON.stringify(welcomeA.playerId)}, got ${JSON.stringify(joined.playerId)}`,
          );
        }
        if (joined.name !== welcomeA.name) {
          problems.push(
            `B welcome.activity[0].name expected ${JSON.stringify(welcomeA.name)}, got ${JSON.stringify(joined.name)}`,
          );
        }
        if (typeof joined.id !== 'number' || !Number.isInteger(joined.id) || joined.id < 1) {
          problems.push(
            `B welcome.activity[0].id expected a positive integer, got ${JSON.stringify(joined.id)}`,
          );
        } else {
          joinActivityId = joined.id;
        }
        if (typeof joined.at !== 'number' || !Number.isFinite(joined.at)) {
          problems.push(
            `B welcome.activity[0].at expected a finite number, got ${JSON.stringify(joined.at)}`,
          );
        }
      }
      record(
        problems.length === 0,
        ACTIVITY_JOIN_CHECK_LABEL,
        problems.length === 0
          ? `server ${welcomeA.serverId}; memberJoined id ${joinActivityId} for ${welcomeA.playerId}`
          : problems.join('; '),
      );
    }

    // Public appearance projection (remote-spaceship-customization AC-35): A's roster entry for
    // guest B starts `{}` (the T6 projection always populates the optional field), B's one valid
    // 11-slot report reaches A exactly once with the same record, and a frame with an unknown
    // slot key is rejected with `bad_message` without a broadcast.
    if (!setupComplete) {
      record(false, APPEARANCE_CHECK_LABEL, 'not run — the two-client join failed');
    } else {
      const problems = [];
      if (welcomeA.identity?.kind !== 'guest') {
        problems.push(`A identity.kind expected "guest", got ${JSON.stringify(welcomeA.identity?.kind)}`);
      }
      if (welcomeB.identity?.kind !== 'guest') {
        problems.push(`B identity.kind expected "guest", got ${JSON.stringify(welcomeB.identity?.kind)}`);
      }
      problems.push(
        ...appearanceProblems(
          'A memberJoined for B appearance',
          memberJoinedB?.member?.appearance,
          {},
        ),
      );

      let detail = '';
      try {
        clientB.send({ type: 'setAppearance', appearance: FULL_APPEARANCE });
        const appearanceFrame = await waitForMessage(
          clientA,
          (message) =>
            message.type === 'memberAppearance' && message.playerId === welcomeB.playerId,
          MULTIPLAYER_TIMEOUT_MS,
          `memberAppearance for ${welcomeB.playerId}`,
        );
        problems.push(
          ...appearanceProblems(
            'A memberAppearance for B appearance',
            appearanceFrame.appearance,
            FULL_APPEARANCE,
          ),
        );

        // Unknown slot key: the codec rejects the whole frame, so B gets exactly bad_message.
        clientB.send({ type: 'setAppearance', appearance: { spoiler: 'hull-obsidian' } });
        await waitForMessage(
          clientB,
          (message) => message.type === 'error' && message.code === 'bad_message',
          MULTIPLAYER_TIMEOUT_MS,
          'error bad_message for an unknown slot key',
        );

        // Any broadcast caused by the rejected frame would land inside this settle. A must still
        // hold exactly the one accepted frame, and no other memberAppearance may have leaked.
        await delay(APPEARANCE_SETTLE_MS);
        const frames = clientA.history.filter((message) => message.type === 'memberAppearance');
        if (frames.length !== 1) {
          problems.push(
            `A expected exactly one memberAppearance in total, got ${frames.length}: ${JSON.stringify(frames)}`,
          );
        }
        detail = `playerId ${welcomeB.playerId}; 11 slots; unknown slot key rejected with bad_message; ${frames.length} memberAppearance frame(s) seen by A`;
      } catch (error) {
        problems.push(problemText(error));
      }
      record(
        problems.length === 0,
        APPEARANCE_CHECK_LABEL,
        problems.length === 0 ? detail : problems.join('; '),
      );
    }

    // Leaderboard snapshot at join (`server-live-leaderboard`, AC-25): A is alone and sees
    // itself with zero counters; B's welcome includes the same zero counters for both.
    if (!setupComplete) {
      record(false, LEADERBOARD_JOIN_CHECK_LABEL, 'not run — the two-client join failed');
    } else {
      const problems = [
        ...welcomeLeaderboardProblems('A', welcomeA.leaderboard, welcomeA.serverId, [
          { playerId: welcomeA.playerId, name: welcomeA.name, cubesCompleted: 0, clicks: 0 },
        ]),
        ...welcomeLeaderboardProblems('B', welcomeB.leaderboard, welcomeA.serverId, [
          { playerId: welcomeA.playerId, name: welcomeA.name, cubesCompleted: 0, clicks: 0 },
          { playerId: welcomeB.playerId, name: welcomeB.name, cubesCompleted: 0, clicks: 0 },
        ]),
      ];
      record(
        problems.length === 0,
        LEADERBOARD_JOIN_CHECK_LABEL,
        problems.length === 0 ? `server ${welcomeA.serverId}` : problems.join('; '),
      );
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

    // Coalesced leaderboard update (`server-live-leaderboard`, AC-25): the single accepted
    // explode and the two-id burst land in the hub's 1 s window. Scan A's history first and
    // otherwise wait inside the existing multiplayer budget; the predicate is the full AC
    // (serverId, both entries, totals), so a frame carrying the single click cannot satisfy it.
    if (!setupComplete) {
      record(false, LEADERBOARD_UPDATE_CHECK_LABEL, 'not run — the two-client join failed');
    } else if (explodeProblem !== null) {
      record(false, LEADERBOARD_UPDATE_CHECK_LABEL, 'not run — the explode check failed');
    } else {
      const matchesCoalescedLeaderboard = (message) => {
        if (message?.type !== 'leaderboardUpdate') {
          return false;
        }
        const leaderboard = message.leaderboard;
        if (leaderboard?.serverId !== welcomeA.serverId) {
          return false;
        }
        const entries = Array.isArray(leaderboard.entries) ? leaderboard.entries : [];
        if (entries.length !== 2) {
          return false;
        }
        const entryA = entries.find((entry) => entry.playerId === welcomeA.playerId);
        const entryB = entries.find((entry) => entry.playerId === welcomeB.playerId);
        return (
          entryA !== undefined &&
          entryA.clicks >= 3 &&
          entryA.cubesCompleted === 0 &&
          entryB !== undefined &&
          entryB.clicks === 0 &&
          entryB.cubesCompleted === 0 &&
          leaderboard.totals?.clicks >= 3 &&
          leaderboard.totals?.cubesCompleted === 0
        );
      };

      let update = null;
      let updateProblem = null;
      try {
        update =
          clientA.history.find(matchesCoalescedLeaderboard) ??
          (await waitForMessage(
            clientA,
            matchesCoalescedLeaderboard,
            MULTIPLAYER_TIMEOUT_MS,
            'coalesced leaderboardUpdate with A clicks >= 3',
          ));
      } catch (error) {
        const observed = clientA.history
          .filter((message) => message?.type === 'leaderboardUpdate')
          .map((message) => JSON.stringify(message.leaderboard));
        updateProblem = `${problemText(error)}; observed leaderboard frames: ${
          observed.length === 0 ? 'none' : observed.join(' | ')
        }`;
      }

      let detail = '';
      if (update !== null) {
        const leaderboard = update.leaderboard;
        const entries = Array.isArray(leaderboard.entries) ? leaderboard.entries : [];
        const entryA = entries.find((entry) => entry.playerId === welcomeA.playerId);
        const entryB = entries.find((entry) => entry.playerId === welcomeB.playerId);
        const problems = [];
        if (leaderboard.serverId !== welcomeA.serverId) {
          problems.push(
            `serverId expected ${welcomeA.serverId}, got ${JSON.stringify(leaderboard.serverId)}`,
          );
        }
        if (typeof leaderboard.at !== 'number' || !Number.isFinite(leaderboard.at)) {
          problems.push(`at expected a finite number, got ${JSON.stringify(leaderboard.at)}`);
        }
        if (entries.length !== 2) {
          problems.push(`entries expected A and B (2), got ${JSON.stringify(entries)}`);
        }
        if (entryA === undefined) {
          problems.push(`A entry expected playerId ${JSON.stringify(welcomeA.playerId)}, got none`);
        } else {
          if (entryA.clicks < 3) {
            problems.push(`A clicks expected >= 3, got ${JSON.stringify(entryA.clicks)}`);
          }
          if (entryA.cubesCompleted !== 0) {
            problems.push(`A cubesCompleted expected 0, got ${JSON.stringify(entryA.cubesCompleted)}`);
          }
        }
        if (entryB === undefined) {
          problems.push(`B entry expected playerId ${JSON.stringify(welcomeB.playerId)}, got none`);
        } else {
          if (entryB.clicks !== 0) {
            problems.push(`B clicks expected 0, got ${JSON.stringify(entryB.clicks)}`);
          }
          if (entryB.cubesCompleted !== 0) {
            problems.push(`B cubesCompleted expected 0, got ${JSON.stringify(entryB.cubesCompleted)}`);
          }
        }
        if (!(leaderboard.totals?.clicks >= 3)) {
          problems.push(`totals.clicks expected >= 3, got ${JSON.stringify(leaderboard.totals?.clicks)}`);
        }
        if (leaderboard.totals?.cubesCompleted !== 0) {
          problems.push(
            `totals.cubesCompleted expected 0, got ${JSON.stringify(leaderboard.totals?.cubesCompleted)}`,
          );
        }
        updateProblem = problems.length === 0 ? null : problems.join('; ');
        detail = `A clicks ${entryA?.clicks}, B clicks ${entryB?.clicks}, totals clicks ${leaderboard.totals?.clicks}`;
      }
      record(updateProblem === null, LEADERBOARD_UPDATE_CHECK_LABEL, updateProblem ?? detail);
    }

    if (!setupComplete) {
      record(false, LEAVE_CHECK_LABEL, 'not run — the two-client join failed');
      record(false, ACTIVITY_LEAVE_CHECK_LABEL, 'not run — the two-client join failed');
    } else {
      let problem = null;
      let elapsedMs = null;
      // Baseline for the activity frame: only frames received after B's close can prove the
      // live leave event (the earlier `memberJoined` activity frame is already in history).
      const activityStart = clientA.history.length;
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

      // The feed frame is broadcast right after the protocol `memberLeft`; the predicate skips
      // every other frame and matches only B's leave, so an earlier activity frame (or any
      // interleaved broadcast) can never satisfy it.
      const matchesLeaveActivity = (message) =>
        message?.type === 'activityEvent' &&
        message.event?.type === 'memberLeft' &&
        message.event.playerId === welcomeB.playerId;
      let activityProblem = null;
      let activityId = null;
      try {
        // Prefer the already-received frame (the leave wait above may have consumed it), then
        // wait inside the same existing grace budget — the check adds no new wait of its own.
        const activity =
          clientA.history.slice(activityStart).find(matchesLeaveActivity) ??
          (await waitForMessage(
            clientA,
            matchesLeaveActivity,
            MEMBER_LEFT_TIMEOUT_MS,
            `activityEvent memberLeft for ${welcomeB.playerId}`,
          ));
        const event = activity.event;
        activityId = event.id;
        const problems = [];
        if (event.name !== welcomeB.name) {
          problems.push(
            `event.name expected ${JSON.stringify(welcomeB.name)}, got ${JSON.stringify(event.name)}`,
          );
        }
        if (event.serverId !== welcomeA.serverId) {
          problems.push(
            `event.serverId expected ${welcomeA.serverId}, got ${JSON.stringify(event.serverId)}`,
          );
        }
        if (
          typeof event.id !== 'number' ||
          !Number.isInteger(event.id) ||
          joinActivityId === null ||
          event.id <= joinActivityId
        ) {
          problems.push(
            `event.id expected an integer > ${JSON.stringify(joinActivityId)}, got ${JSON.stringify(event.id)}`,
          );
        }
        activityProblem = problems.length === 0 ? null : problems.join('; ');
      } catch (error) {
        activityProblem = problemText(error);
      }
      record(
        activityProblem === null,
        ACTIVITY_LEAVE_CHECK_LABEL,
        activityProblem ?? `memberLeft id ${activityId} for ${welcomeB.playerId}`,
      );

      // Explicit leave (AC-22): B's grace expiry freed slot 2, so D joins the run's server in
      // B's old slot. D's `leave` is finalized immediately, so A must see `memberLeft(left)`
      // well inside the grace window; E then joins D's freed slot.
      if (problem !== null) {
        record(false, EXPLICIT_LEAVE_CHECK_LABEL, 'not run — the abrupt-close grace check failed');
        record(false, SLOT_REUSE_CHECK_LABEL, 'not run — the abrupt-close grace check failed');
      } else {
        let explicitLeaveProblem = null;
        let leaveElapsedMs = null;
        let welcomeD = null;
        let clientD = null;
        try {
          clientD = await connectAndJoin('client D');
          sockets.push(clientD);
          welcomeD = await waitForMessage(
            clientD,
            (message) => message.type === 'welcome',
            MULTIPLAYER_TIMEOUT_MS,
            'welcome',
          );
          const problems = [
            ...serverIdProblems('D', welcomeD),
            ...welcomeProblems('D', welcomeD, welcomeA.serverId, 2, 2),
            ...rosterProblems('D', welcomeD.roster, [
              { playerId: welcomeA.playerId, name: welcomeA.name },
              { playerId: welcomeD.playerId, name: welcomeD.name },
            ]),
          ];
          // A kept slot 1, so D takes B's old slot 2: the slot position must match B's.
          if (
            welcomeD.position?.x !== welcomeB.position?.x ||
            welcomeD.position?.y !== welcomeB.position?.y
          ) {
            problems.push(
              `D welcome.position expected B's slot-2 position ${JSON.stringify(welcomeB.position)}, got ${JSON.stringify(welcomeD.position)}`,
            );
          }
          explicitLeaveProblem = problems.length === 0 ? null : problems.join('; ');
        } catch (error) {
          explicitLeaveProblem = problemText(error);
        }

        if (explicitLeaveProblem === null) {
          try {
            const leaveSentAt = Date.now();
            clientD.send({ type: 'leave' });
            const left = await waitForMessage(
              clientA,
              (message) => message.type === 'memberLeft' && message.playerId === welcomeD.playerId,
              MEMBER_LEFT_TIMEOUT_MS,
              `memberLeft for ${welcomeD.playerId}`,
            );
            leaveElapsedMs = Date.now() - leaveSentAt;
            if (left.reason !== 'left') {
              explicitLeaveProblem = `expected reason "left", got ${JSON.stringify(left.reason)}`;
            } else if (leaveElapsedMs >= GRACE_LOWER_BOUND_MS) {
              explicitLeaveProblem = `memberLeft arrived after ${leaveElapsedMs}ms, not inside the immediate-leave budget (< ${GRACE_LOWER_BOUND_MS}ms)`;
            }
          } catch (error) {
            explicitLeaveProblem = problemText(error);
          }
        }
        record(
          explicitLeaveProblem === null,
          EXPLICIT_LEAVE_CHECK_LABEL,
          explicitLeaveProblem ?? `memberLeft(left) received after ${leaveElapsedMs}ms`,
        );

        if (explicitLeaveProblem !== null) {
          record(false, SLOT_REUSE_CHECK_LABEL, 'not run — the explicit-leave check failed');
        } else {
          let slotReuseProblem = null;
          let welcomeE = null;
          try {
            const clientE = await connectAndJoin('client E');
            sockets.push(clientE);
            welcomeE = await waitForMessage(
              clientE,
              (message) => message.type === 'welcome',
              MULTIPLAYER_TIMEOUT_MS,
              'welcome',
            );
            const problems = [
              ...serverIdProblems('E', welcomeE),
              ...welcomeProblems('E', welcomeE, welcomeA.serverId, 2, 2),
              ...rosterProblems('E', welcomeE.roster, [
                { playerId: welcomeA.playerId, name: welcomeA.name },
                { playerId: welcomeE.playerId, name: welcomeE.name },
              ]),
            ];
            if (
              welcomeE.position?.x !== welcomeD.position?.x ||
              welcomeE.position?.y !== welcomeD.position?.y
            ) {
              problems.push(
                `E welcome.position expected D's freed slot-2 position ${JSON.stringify(welcomeD.position)}, got ${JSON.stringify(welcomeE.position)}`,
              );
            }
            slotReuseProblem = problems.length === 0 ? null : problems.join('; ');
          } catch (error) {
            slotReuseProblem = problemText(error);
          }
          record(
            slotReuseProblem === null,
            SLOT_REUSE_CHECK_LABEL,
            slotReuseProblem ?? `server ${welcomeE?.serverId}; roster [A, E] in D's freed slot 2`,
          );
        }
      }
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

/**
 * AC-9 joined-state scrape: one client joins, and while it is still a member the script
 * fetches the internal Prometheus endpoint over the compose network. The assertions are
 * the live values a joined client produces (the earlier checks already supplied the
 * cumulative connections/joins/hello frames), and the client closes and settles so the
 * registry drains before the run exits.
 */
async function checkMetrics() {
  const client = new SmokeSocket('metrics client', WS_URL);
  let problem = null;
  try {
    await client.open();
    const hello = await client.next(HELLO_TIMEOUT_MS);
    if (hello?.type !== 'hello' || !isParseableTimestamp(hello.serverTime)) {
      throw new Error(`expected the pinned hello first, got ${JSON.stringify(hello)}`);
    }
    client.send({ type: 'join' });
    await waitForMessage(
      client,
      (message) => message.type === 'welcome',
      MULTIPLAYER_TIMEOUT_MS,
      'welcome',
    );

    const response = await rawGet(BACKEND_URL + '/metrics');
    const problems = [];
    if (response.status !== 200) {
      problems.push(`expected 200, got ${response.status}`);
    }
    const contentType = headerValue(response.headers, 'content-type');
    if (contentType !== 'text/plain; version=0.0.4; charset=utf-8') {
      problems.push(`expected the Prometheus content type, got ${JSON.stringify(contentType)}`);
    }
    const body = response.body.toString('utf8');
    if (!body.split('\n').includes('# TYPE cubeclicker_ws_connections_open gauge')) {
      problems.push('expected the "# TYPE cubeclicker_ws_connections_open gauge" line');
    }

    const expectedSamples = [
      ['cubeclicker_ws_connections_open', 1],
      ['cubeclicker_servers_active', 1],
      ['cubeclicker_ws_connections_total', 3],
      ['cubeclicker_ws_messages_received_total{type="join"}', 3],
      ['cubeclicker_ws_frames_sent_total{type="hello"}', 3],
    ];
    const samples = [];
    for (const [sample, minimum] of expectedSamples) {
      const value = readMetricSample(body, sample);
      samples.push(`${sample}=${value === null ? 'missing' : value}`);
      if (value === null) {
        problems.push(`sample ${sample} is missing`);
      } else if (value < minimum) {
        problems.push(`${sample} expected >= ${minimum}, got ${value}`);
      }
    }

    problem = problems.length === 0 ? null : problems.join('; ');
    record(problems.length === 0, METRICS_CHECK_LABEL, problem ?? samples.join(' '));
  } catch (error) {
    problem = problemText(error);
    record(false, METRICS_CHECK_LABEL, problem);
  } finally {
    client.close();
    await delay(SMOKE_SETTLE_MS);
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
  await checkMetrics();
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
