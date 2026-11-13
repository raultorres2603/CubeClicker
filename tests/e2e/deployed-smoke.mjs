// CubeClicker deployed-environment smoke (plan contract 9; feature `vercel-fly-neon-deployment` T4).
//
// Zero dependencies: Node 24 built-ins and globals only (`fetch`, `WebSocket`,
// `AbortSignal`), so it runs from a stock `node:24-alpine` container with no install step.
//
// Environment (the `SMOKE_*` names are the pinned contract; the `DEPLOYED_*` aliases are
// accepted so operators can use either spelling):
//   SMOKE_FRONTEND_URL / DEPLOYED_FRONTEND_URL  public frontend base, e.g. https://app.example.com
//   SMOKE_API_URL      / DEPLOYED_API_URL       public backend base,   e.g. https://api.example.com
//   SMOKE_WS_URL       / DEPLOYED_WS_URL        backend WebSocket URL, e.g. wss://api.example.com/ws
//   SMOKE_ORIGIN       / DEPLOYED_FRONTEND_ORIGIN  exact browser Origin allowed by CORS/WS
//   SMOKE_TIMEOUT_MS   / DEPLOYED_TIMEOUT_MS    per-check budget, default 10000
//
// No credentials, cookies, tokens or destructive state: the only game action is a guest
// join plus one level-0 explode on that guest's own cube, which the server validates
// authoritatively. `tests/e2e/smoke.mjs` remains the local containerized suite.
//
// Checks, in order (fail-fast: the first failure prints FAIL and exits 1):
//   1. backend  GET  <api>/healthz -> 200 + {"status":"ok"}
//   2. CORS     OPTIONS <api>/auth/login from the allowed Origin -> 204 + exact allow headers
//   3. CORS     OPTIONS <api>/auth/login from a disallowed Origin -> 403 without an allow header
//   4. frontend GET  <frontend>/ -> 200 + text/html + cache-control no-cache + the SPA shell
//   5. frontend GET  <frontend>/deep/link -> 200 + text/html + the SPA shell (rewrite fallback)
//   6. frontend GET  <frontend>/assets/does-not-exist.js -> 404, never the SPA shell
//   7. WebSocket wss:// with the allowed Origin -> hello, guest join/welcome, explode ack
//   8. WebSocket wss:// with a disallowed Origin -> close 1008 and no hello
//
// Node's global WebSocket accepts a non-standard `{ headers }` init object (undici's
// `WebSocketInit`); browsers do not, but this script is Node-only and an explicit
// `Origin` is the only way to prove the upgrade allowlist without a raw frame codec.

const DEFAULT_TIMEOUT_MS = 10000;
const DISALLOWED_ORIGIN = 'https://disallowed.invalid';
const HEALTH_BODY = '{"status":"ok"}';
const CORS_ALLOW_METHODS = 'GET,POST,OPTIONS';
const CORS_ALLOW_HEADERS = 'Content-Type,Accept';
const CORS_MAX_AGE = '600';

const results = [];

function problemText(error) {
  return error instanceof Error ? error.message : String(error);
}

function record(ok, label, detail) {
  results.push({ ok });
  const suffix = detail === undefined || detail === '' ? '' : ` — ${detail}`;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${suffix}`);
}

function readInput(smokeName, deployedName) {
  const raw = process.env[smokeName] ?? process.env[deployedName];
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  return raw.trim();
}

function parseUrl(name, raw, allowedProtocols) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} is not a valid URL: ${JSON.stringify(raw)}`);
  }
  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(
      `${name} must use ${allowedProtocols.join(' or ')}, got ${JSON.stringify(url.protocol)}`,
    );
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error(`${name} must not contain credentials`);
  }
  return url;
}

function parseHttpBase(name, raw) {
  const url = parseUrl(name, raw, ['http:', 'https:']);
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error(`${name} must be a base URL without a path, got ${JSON.stringify(raw)}`);
  }
  if (url.search !== '' || url.hash !== '') {
    throw new Error(`${name} must not contain a query or fragment, got ${JSON.stringify(raw)}`);
  }
  return url.origin;
}

function parseWsUrl(name, raw) {
  return parseUrl(name, raw, ['ws:', 'wss:']).href;
}

function parseOrigin(name, raw) {
  const url = parseUrl(name, raw, ['http:', 'https:']);
  if (url.origin !== raw) {
    throw new Error(`${name} must be an exact origin (no path or trailing slash), got ${JSON.stringify(raw)}`);
  }
  return raw;
}

function parseTimeout(raw) {
  if (raw === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`SMOKE_TIMEOUT_MS must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}

function loadConfig() {
  const missing = [];
  const frontendRaw = readInput('SMOKE_FRONTEND_URL', 'DEPLOYED_FRONTEND_URL');
  if (frontendRaw === undefined) missing.push('SMOKE_FRONTEND_URL (or DEPLOYED_FRONTEND_URL)');
  const apiRaw = readInput('SMOKE_API_URL', 'DEPLOYED_API_URL');
  if (apiRaw === undefined) missing.push('SMOKE_API_URL (or DEPLOYED_API_URL)');
  const wsRaw = readInput('SMOKE_WS_URL', 'DEPLOYED_WS_URL');
  if (wsRaw === undefined) missing.push('SMOKE_WS_URL (or DEPLOYED_WS_URL)');
  const originRaw = readInput('SMOKE_ORIGIN', 'DEPLOYED_FRONTEND_ORIGIN');
  if (originRaw === undefined) missing.push('SMOKE_ORIGIN (or DEPLOYED_FRONTEND_ORIGIN)');
  if (missing.length > 0) {
    throw new Error(`missing required environment variable(s): ${missing.join(', ')}`);
  }

  const frontend = parseHttpBase('SMOKE_FRONTEND_URL', frontendRaw);
  const api = parseHttpBase('SMOKE_API_URL', apiRaw);
  const ws = parseWsUrl('SMOKE_WS_URL', wsRaw);
  const origin = parseOrigin('SMOKE_ORIGIN', originRaw);
  const timeoutMs = parseTimeout(readInput('SMOKE_TIMEOUT_MS', 'DEPLOYED_TIMEOUT_MS'));

  const frontendScheme = new URL(frontend).protocol;
  if (frontendScheme === 'https:') {
    if (new URL(api).protocol !== 'https:') {
      throw new Error('SMOKE_API_URL must use https:// when the frontend is https://');
    }
    if (new URL(ws).protocol !== 'wss:') {
      throw new Error('SMOKE_WS_URL must use wss:// when the frontend is https://');
    }
  }

  return { frontend, api, ws, origin, timeoutMs };
}

async function request(url, init, timeoutMs) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new Error(`${init?.method ?? 'GET'} ${url} failed: ${problemText(error)}`);
  }
}

function header(response, name) {
  return response.headers.get(name) ?? '';
}

function assertStatus(response, expected, url) {
  if (response.status !== expected) {
    throw new Error(`${url}: expected status ${expected}, got ${response.status}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(actual, expected, label) {
  if (!actual.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function checkBackendHealth(config) {
  const url = `${config.api}/healthz`;
  const response = await request(url, undefined, config.timeoutMs);
  assertStatus(response, 200, url);
  const body = await response.text();
  assertEqual(body, HEALTH_BODY, `${url} body`);
  return `200 ${HEALTH_BODY}`;
}

async function checkAllowedPreflight(config) {
  const url = `${config.api}/auth/login`;
  const response = await request(
    url,
    {
      method: 'OPTIONS',
      headers: {
        Origin: config.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    },
    config.timeoutMs,
  );
  assertStatus(response, 204, `${url} preflight`);
  assertEqual(header(response, 'access-control-allow-origin'), config.origin, `${url} allow-origin`);
  assertEqual(header(response, 'access-control-allow-credentials'), 'true', `${url} allow-credentials`);
  assertEqual(header(response, 'access-control-allow-methods'), CORS_ALLOW_METHODS, `${url} allow-methods`);
  assertEqual(header(response, 'access-control-allow-headers'), CORS_ALLOW_HEADERS, `${url} allow-headers`);
  assertEqual(header(response, 'access-control-max-age'), CORS_MAX_AGE, `${url} max-age`);
  assertIncludes(header(response, 'vary'), 'origin', `${url} vary`);
  return `204; access-control-allow-origin ${config.origin}`;
}

async function checkDisallowedPreflight(config) {
  const url = `${config.api}/auth/login`;
  const response = await request(
    url,
    {
      method: 'OPTIONS',
      headers: {
        Origin: DISALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    },
    config.timeoutMs,
  );
  assertStatus(response, 403, `${url} disallowed preflight`);
  assertEqual(header(response, 'access-control-allow-origin'), '', `${url} disallowed allow-origin`);
  assertIncludes(header(response, 'vary'), 'origin', `${url} disallowed vary`);
  const body = await response.text();
  assertEqual(
    body,
    '{"message":"origin not allowed","code":"origin_not_allowed"}',
    `${url} disallowed body`,
  );
  return `403 origin_not_allowed without access-control-allow-origin`;
}

async function checkFrontendShell(config) {
  const url = `${config.frontend}/`;
  const response = await request(url, undefined, config.timeoutMs);
  assertStatus(response, 200, url);
  assertIncludes(header(response, 'content-type'), 'text/html', `${url} content-type`);
  assertIncludes(header(response, 'cache-control'), 'no-cache', `${url} cache-control`);
  const body = await response.text();
  assertIncludes(body, '<div id="root">', `${url} body`);
  return `200 text/html; cache-control ${header(response, 'cache-control')}`;
}

async function checkFrontendDeepLink(config) {
  const url = `${config.frontend}/deep/link`;
  const response = await request(url, undefined, config.timeoutMs);
  assertStatus(response, 200, url);
  assertIncludes(header(response, 'content-type'), 'text/html', `${url} content-type`);
  const body = await response.text();
  assertIncludes(body, '<div id="root">', `${url} body`);
  return '200 text/html SPA fallback';
}

async function checkFrontendMissingAsset(config) {
  const url = `${config.frontend}/assets/does-not-exist.js`;
  const response = await request(url, undefined, config.timeoutMs);
  assertStatus(response, 404, url);
  const body = await response.text();
  if (body.includes('<div id="root">')) {
    throw new Error(`${url}: expected a real 404, got the SPA shell`);
  }
  return '404 without the SPA shell';
}

/**
 * One Node WebSocket with a small message queue, so a frame that arrives before a waiter
 * is registered (the server sends `hello` immediately) is never lost.
 */
class SocketClient {
  #queue = [];
  #waiters = [];
  #messages = [];
  #closed = null;
  #closeWaiters = [];
  #opened = false;
  #errored = false;

  constructor(url, origin) {
    this.url = url;
    this.socket = new WebSocket(url, { headers: { Origin: origin } });
    this.socket.addEventListener('message', (event) => {
      this.#receive(event.data);
    });
    this.socket.addEventListener('error', () => {
      this.#errored = true;
    });
    this.socket.addEventListener('close', (event) => {
      this.#onClose({ code: event.code, reason: event.reason });
    });
  }

  get messages() {
    return this.#messages;
  }

  open(timeoutMs) {
    if (this.#opened) {
      return Promise.resolve();
    }
    if (this.#closed !== null) {
      return Promise.reject(
        new Error(
          `WebSocket ${this.url} closed before open (code ${this.#closed.code}${this.#closed.reason ? `: ${this.#closed.reason}` : ''})`,
        ),
      );
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.removeEventListener('open', onOpen);
        this.socket.removeEventListener('error', onError);
        this.socket.removeEventListener('close', onClose);
      };
      const finish = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error === null) {
          this.#opened = true;
          resolve();
        } else {
          reject(error);
        }
      };
      const timer = setTimeout(() => {
        finish(new Error(`WebSocket ${this.url} did not open within ${timeoutMs}ms`));
        this.close();
      }, timeoutMs);
      const onOpen = () => finish(null);
      const onError = () => {
        finish(new Error(`WebSocket ${this.url} errored before open`));
      };
      const onClose = (event) => {
        finish(
          new Error(
            `WebSocket ${this.url} closed before open (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`,
          ),
        );
      };
      this.socket.addEventListener('open', onOpen);
      this.socket.addEventListener('error', onError);
      this.socket.addEventListener('close', onClose);
    });
  }

  next(timeoutMs) {
    if (this.#queue.length > 0) {
      return Promise.resolve(this.#queue.shift());
    }
    if (this.#closed !== null) {
      return Promise.reject(
        new Error(`WebSocket ${this.url} closed before the expected message (code ${this.#closed.code})`),
      );
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const index = this.#waiters.indexOf(waiter);
        if (index !== -1) {
          this.#waiters.splice(index, 1);
        }
        reject(new Error(`WebSocket ${this.url} received no message within ${timeoutMs}ms`));
      }, timeoutMs);
      this.#waiters.push(waiter);
    });
  }

  send(message) {
    this.socket.send(JSON.stringify(message));
  }

  waitForClose(timeoutMs) {
    if (this.#closed !== null) {
      return Promise.resolve(this.#closed);
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const index = this.#closeWaiters.indexOf(waiter);
        if (index !== -1) {
          this.#closeWaiters.splice(index, 1);
        }
        const suffix = this.#errored ? ' (the socket reported an error)' : '';
        reject(new Error(`WebSocket ${this.url} did not close within ${timeoutMs}ms${suffix}`));
      }, timeoutMs);
      this.#closeWaiters.push(waiter);
    });
  }

  close() {
    try {
      this.socket.close();
    } catch {
      // Already closed or closing; nothing to do.
    }
  }

  async closeAndWait(timeoutMs) {
    const closed = this.waitForClose(timeoutMs).catch(() => null);
    this.close();
    await closed;
  }

  #receive(data) {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch {
      message = { type: '__unparseable__', raw: String(data).slice(0, 200) };
    }
    this.#messages.push(message);
    const waiter = this.#waiters.shift();
    if (waiter === undefined) {
      this.#queue.push(message);
      return;
    }
    clearTimeout(waiter.timer);
    waiter.resolve(message);
  }

  #onClose(closed) {
    this.#closed = closed;
    for (const waiter of this.#waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(
        new Error(`WebSocket ${this.url} closed before the expected message (code ${closed.code})`),
      );
    }
    for (const waiter of this.#closeWaiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.resolve(closed);
    }
  }
}

function isParseableTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

async function waitForMessage(client, predicate, timeoutMs, expectation) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`timed out after ${timeoutMs}ms waiting for ${expectation}`);
    }
    const message = await client.next(remaining);
    if (message?.type === 'error') {
      throw new Error(
        `server error ${JSON.stringify(message.code)} while waiting for ${expectation}${message.detail ? `: ${message.detail}` : ''}`,
      );
    }
    if (predicate(message)) {
      return message;
    }
  }
}

function isRemovalFor(message, id) {
  if (message?.type === 'miniCubeRemoved') {
    return message.id === id;
  }
  if (message?.type === 'miniCubesRemoved') {
    return Array.isArray(message.ids) && message.ids.includes(id);
  }
  return false;
}

async function checkWebSocketRoundTrip(config) {
  const client = new SocketClient(config.ws, config.origin);
  try {
    await client.open(config.timeoutMs);
    const hello = await waitForMessage(client, (message) => message?.type === 'hello', config.timeoutMs, 'hello');
    if (!isParseableTimestamp(hello.serverTime)) {
      throw new Error(`hello.serverTime is not a parseable ISO-8601 timestamp: ${JSON.stringify(hello.serverTime)}`);
    }

    client.send({ type: 'join', mode: 'guest' });
    const welcome = await waitForMessage(client, (message) => message?.type === 'welcome', config.timeoutMs, 'welcome');
    if (!Number.isInteger(welcome.serverId) || welcome.serverId < 1) {
      throw new Error(`welcome.serverId expected a positive integer, got ${JSON.stringify(welcome.serverId)}`);
    }
    if (welcome.identity?.kind !== 'guest') {
      throw new Error(`welcome.identity.kind expected "guest", got ${JSON.stringify(welcome.identity?.kind)}`);
    }

    client.send({ type: 'explode', id: 'front:0:0', level: 0 });
    const removal = await waitForMessage(
      client,
      (message) => isRemovalFor(message, 'front:0:0'),
      config.timeoutMs,
      'miniCubeRemoved/miniCubesRemoved front:0:0',
    );
    if (removal.playerId !== welcome.playerId) {
      throw new Error(
        `removal.playerId expected the joined guest ${JSON.stringify(welcome.playerId)}, got ${JSON.stringify(removal.playerId)}`,
      );
    }

    await client.closeAndWait(config.timeoutMs);
    return `hello -> welcome server ${welcome.serverId} -> ${removal.type} front:0:0`;
  } finally {
    client.close();
  }
}

async function checkWebSocketOriginGuard(config) {
  const client = new SocketClient(config.ws, DISALLOWED_ORIGIN);
  try {
    const closed = await client.waitForClose(config.timeoutMs);
    if (closed.code !== 1008) {
      throw new Error(
        `disallowed Origin expected close code 1008, got ${closed.code}${closed.reason ? ` (${closed.reason})` : ''}`,
      );
    }
    if (client.messages.length > 0) {
      throw new Error(
        `disallowed Origin expected no frames before close 1008, got ${JSON.stringify(client.messages)}`,
      );
    }
    return 'close 1008 without hello';
  } finally {
    client.close();
  }
}

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    record(false, 'configuration', problemText(error));
    process.exitCode = 1;
    return;
  }

  console.log(
    `deployed smoke: frontend=${config.frontend} api=${config.api} ws=${config.ws} origin=${config.origin} timeoutMs=${config.timeoutMs}`,
  );

  const checks = [
    ['backend /healthz returns 200 with {"status":"ok"}', () => checkBackendHealth(config)],
    [`CORS preflight from ${config.origin} is allowed`, () => checkAllowedPreflight(config)],
    [`CORS preflight from ${DISALLOWED_ORIGIN} is rejected`, () => checkDisallowedPreflight(config)],
    ['frontend / serves the SPA shell with no-cache', () => checkFrontendShell(config)],
    ['frontend /deep/link serves the SPA fallback', () => checkFrontendDeepLink(config)],
    ['frontend /assets/does-not-exist.js is a real 404', () => checkFrontendMissingAsset(config)],
    [
      `WebSocket at ${config.ws} accepts Origin ${config.origin}: hello, guest join, explode`,
      () => checkWebSocketRoundTrip(config),
    ],
    ['WebSocket rejects a disallowed Origin with close 1008', () => checkWebSocketOriginGuard(config)],
  ];

  for (const [label, check] of checks) {
    try {
      const detail = await check();
      record(true, label, detail);
    } catch (error) {
      record(false, label, problemText(error));
      process.exitCode = 1;
      console.log(`DEPLOYED SMOKE FAIL (${results.filter((result) => result.ok).length}/${checks.length} checks passed)`);
      return;
    }
  }

  console.log(`DEPLOYED SMOKE PASS (${checks.length}/${checks.length} checks)`);
  process.exitCode = 0;
}

await main();
