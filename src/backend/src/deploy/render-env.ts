/**
 * Deployment Brevo guard and Render env-var sync (T1, AC-7/AC-8).
 *
 * The GitHub Environment is the deployment source of truth for eleven names.
 * The first nine (`SYNC_CATALOG`: the seven accepted SMTP names then the two
 * email-transport names) are the deployment contract and the only names this
 * module writes to Render; the last two (`RENDER_WIRING`) are pipeline wiring
 * that is validated but never written to the service:
 *   - `RENDER_SERVICE_ID` is only the URL path coordinate.
 *   - `RENDER_API_KEY` is only the `authorization` header.
 *
 * Everything here is pure or injected: `syncRenderEnv` receives a `FetchLike`
 * and a line logger, so the guards and the sync are testable with no network,
 * no timers and no live credentials. Failure output never contains a value:
 * transport errors pass through `redactValues`, the email-transport guard
 * echoes only the rejected non-secret `EMAIL_TRANSPORT` value, and only the
 * Render `code` of a failed response body is ever printed.
 */

import { DEFAULT_SMTP_FROM, parseEmailSender } from '../auth/config.js';

/** The seven accepted SMTP names, pinned order, with their GitHub classification. */
export const SMTP_CATALOG = [
  { key: 'SMTP_HOST', source: 'variable' },
  { key: 'SMTP_PORT', source: 'variable' },
  { key: 'SMTP_SECURE', source: 'variable' },
  { key: 'SMTP_CONNECTION_TIMEOUT_MS', source: 'variable' },
  { key: 'SMTP_FROM', source: 'variable' },
  { key: 'SMTP_USER', source: 'secret' },
  { key: 'SMTP_PASS', source: 'secret' },
] as const;

/** The two Brevo HTTPS API names, pinned order, with their GitHub classification. */
export const EMAIL_CATALOG = [
  { key: 'EMAIL_TRANSPORT', source: 'variable' },
  { key: 'BREVO_API_KEY', source: 'secret' },
] as const;

/** The nine-name sync catalog: `SMTP_CATALOG` then `EMAIL_CATALOG`. */
export const SYNC_CATALOG = [...SMTP_CATALOG, ...EMAIL_CATALOG] as const;

/** The two Render-wiring names: validated, never synced to the service. */
export const RENDER_WIRING = [
  { key: 'RENDER_SERVICE_ID', source: 'variable' },
  { key: 'RENDER_API_KEY', source: 'secret' },
] as const;

/** The eleven-name validation catalog: `SYNC_CATALOG` then `RENDER_WIRING`. */
export const CATALOG = [...SYNC_CATALOG, ...RENDER_WIRING] as const;

/** The nine-key sync payload. The two wiring names are not part of it. */
export type SyncKey = (typeof SYNC_CATALOG)[number]['key'];
export type SyncValues = Record<SyncKey, string>;

/** A value containing this sentinel is a placeholder, not configuration. */
export const PLACEHOLDER_TOKEN = 'CHANGEME';

/** Per-request timeout the CLI applies to the real fetch (AC-5(b)). */
export const RENDER_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Ports the Render free plan blocks for outbound SMTP (in force since
 * 2025-09-26). A deployed free web service cannot reach any of them.
 */
export const BLOCKED_RENDER_FREE_SMTP_PORTS: readonly number[] = [25, 465, 587];

/** The local Mailpit SMTP port; never reachable from a deployed service. */
export const LOCAL_MAILPIT_PORT = 1025;

/** Brevo's alternate STARTTLS port, reachable from the Render free plan. */
export const RENDER_FREE_SMTP_PORT = 2525;

/** `true` exactly when `value` contains the literal `CHANGEME` (case-sensitive). */
export function isPlaceholder(value: string): boolean {
  return value.includes(PLACEHOLDER_TOKEN);
}

/** Outcome of classifying the eleven-name catalog against an environment object. */
export interface DeployEnvSuccess {
  ok: true;
  values: Record<string, string>;
}

export interface DeployEnvFailure {
  ok: false;
  missing: string[];
  placeholders: string[];
}

export type DeployEnvValidation = DeployEnvSuccess | DeployEnvFailure;

/**
 * Classifies every name in `CATALOG` as `missing` (empty or whitespace-only),
 * `placeholder` (contains `CHANGEME`) or `ok`, preserving catalog order in both
 * lists. `ok: true` requires all eleven names to be `ok`; the success payload
 * keeps the raw configured values (no silent trimming).
 */
export function validateDeployEnv(
  env: Record<string, string | undefined>,
): DeployEnvValidation {
  const missing: string[] = [];
  const placeholders: string[] = [];
  const values: Record<string, string> = {};

  for (const { key } of CATALOG) {
    const value = env[key];
    if (value === undefined || value.trim() === '') {
      missing.push(key);
    } else if (isPlaceholder(value)) {
      placeholders.push(key);
    } else {
      values[key] = value;
    }
  }

  if (missing.length > 0 || placeholders.length > 0) {
    return { ok: false, missing, placeholders };
  }
  return { ok: true, values };
}

/**
 * Renders the pinned AC-4 failure block. `Missing:` precedes `Placeholder:`;
 * each list line appears only when its list is non-empty. The remediation lines
 * carry names only, so a failure can never echo a configured value.
 */
export function formatGuardFailure(
  environment: string,
  result: DeployEnvFailure,
): string {
  const count = result.missing.length + result.placeholders.length;
  const lines = [
    `Deploy blocked: the '${environment}' environment has ${count} unset or placeholder value(s).`,
  ];
  if (result.missing.length > 0) {
    lines.push(`  Missing: ${result.missing.join(', ')}`);
  }
  if (result.placeholders.length > 0) {
    lines.push(`  Placeholder: ${result.placeholders.join(', ')}`);
  }
  lines.push(
    'Remediation (names only; never paste a value into a command argument):',
    `  variables: gh variable set <NAME> --env ${environment} --repo raultorres2603/CubeClicker`,
    `  secrets:   gh secret set <NAME> --env ${environment} --repo raultorres2603/CubeClicker`,
    'Runbook: README.md § Deployment Brevo runbook',
  );
  return lines.join('\n');
}

/**
 * The five deployed email-transport failure kinds (AC-7(c)). Each carries the
 * minimum needed to render the pinned block: the two transport blocks echo the
 * rejected non-secret `EMAIL_TRANSPORT` value; the other three echo nothing.
 */
export type EmailTransportFailure =
  | { ok: false; reason: 'deployed_requires_api'; transport: string }
  | { ok: false; reason: 'unsupported_transport'; transport: string }
  | { ok: false; reason: 'smtp_key_reused' }
  | { ok: false; reason: 'local_sender' }
  | { ok: false; reason: 'invalid_sender' };

/** The environments whose verification email must use the Brevo HTTPS API. */
const DEPLOYED_ENVIRONMENTS: readonly string[] = ['development', 'production'];

/**
 * Strict deployed email-transport guard (AC-7(c)). Applies only when
 * `TARGET_ENVIRONMENT` is `development` or `production`; every other value is
 * the local/CLI path and passes. The deployed transport must be exactly
 * `brevo-api` (unset/empty resolves to the runtime default `smtp`, which is
 * rejected), the API key must not be the Brevo SMTP key or the configured
 * `SMTP_PASS`, and `SMTP_FROM` must parse and must not be the local Mailpit
 * default in any accepted form.
 *
 * Presence and `CHANGEME` are the catalog's job (the guard runs after
 * `validateDeployEnv`), so a missing/empty `BREVO_API_KEY` does not fail here;
 * the key-shape checks only inspect a configured value. Nothing configured is
 * ever echoed: `formatEmailTransportFailure` prints only `EMAIL_TRANSPORT`.
 */
export function validateEmailTransport(
  env: Record<string, string | undefined>,
): { ok: true } | EmailTransportFailure {
  const environment = env.TARGET_ENVIRONMENT;
  if (!DEPLOYED_ENVIRONMENTS.includes(environment ?? '')) {
    return { ok: true };
  }

  const raw = env.EMAIL_TRANSPORT;
  const transport = raw === undefined || raw === '' ? 'smtp' : raw;
  if (transport === 'smtp') {
    return { ok: false, reason: 'deployed_requires_api', transport };
  }
  if (transport !== 'brevo-api') {
    return { ok: false, reason: 'unsupported_transport', transport };
  }

  const apiKey = env.BREVO_API_KEY;
  if (
    apiKey !== undefined &&
    apiKey !== '' &&
    (apiKey.startsWith('xsmtpsib-') ||
      (env.SMTP_PASS !== undefined && apiKey === env.SMTP_PASS))
  ) {
    return { ok: false, reason: 'smtp_key_reused' };
  }

  const sender = parseEmailSender(env.SMTP_FROM ?? '');
  if (sender === null) {
    return { ok: false, reason: 'invalid_sender' };
  }
  if (sender.email === DEFAULT_SMTP_FROM) {
    return { ok: false, reason: 'local_sender' };
  }
  return { ok: true };
}

/**
 * Renders the pinned AC-7(d) operator block for one email-transport failure.
 * Only the two transport blocks echo a configured value, and it is the
 * non-secret `EMAIL_TRANSPORT`; no sender, key or `SMTP_PASS` is ever printed.
 */
export function formatEmailTransportFailure(
  environment: string,
  failure: EmailTransportFailure,
): string {
  const runbook = '  Runbook: README.md § Deployment Brevo runbook';
  switch (failure.reason) {
    case 'deployed_requires_api':
      return [
        `Deploy blocked: EMAIL_TRANSPORT must be "brevo-api" for the '${environment}' environment; received "${failure.transport}".`,
        "  Deployed verification email uses Brevo's HTTPS API (port 443); SMTP authentication is not used.",
        runbook,
      ].join('\n');
    case 'unsupported_transport':
      return [
        `Deploy blocked: EMAIL_TRANSPORT must be "smtp" or "brevo-api" ('${environment}' environment); received "${failure.transport}".`,
        runbook,
      ].join('\n');
    case 'smtp_key_reused':
      return [
        `Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('${environment}' environment).`,
        '  Create a Brevo API key under Settings → SMTP & API → API Keys and store it as the BREVO_API_KEY secret.',
        runbook,
      ].join('\n');
    case 'local_sender':
      return [
        `Deploy blocked: SMTP_FROM is the local Mailpit default and cannot deliver through the Brevo API ('${environment}' environment).`,
        '  Set SMTP_FROM to the Brevo-verified sender.',
        runbook,
      ].join('\n');
    case 'invalid_sender':
      return [
        `Deploy blocked: SMTP_FROM must be an address or "Display Name <address>" when EMAIL_TRANSPORT=brevo-api ('${environment}' environment).`,
        '  Set SMTP_FROM to the Brevo-verified sender.',
        runbook,
      ].join('\n');
  }
}

/**
 * The single strict SMTP transport failure kind (AC-1(a)). `invalid_port`
 * keeps the unmodified input in `raw`; `starttls_required` keeps the raw
 * `SMTP_SECURE` value so the operator block can echo it verbatim.
 */
export type SmtpPortFailure =
  | { ok: false; reason: 'render_free_blocked'; port: number }
  | { ok: false; reason: 'invalid_port'; raw: string }
  | { ok: false; reason: 'local_port'; port: number }
  | { ok: false; reason: 'starttls_required'; value: string };

/**
 * Strict Render-free SMTP transport guard (AC-1(a)). Development only:
 * production is unprovisioned and placeholder-only, so every input passes
 * there (decision D-2).
 *
 * Presence and `CHANGEME` are the catalog's job; a missing, empty or
 * placeholder `SMTP_PORT` passes here. A present value must match `/^\d+$/`
 * (no trimming, no sign, no decimal) and be 1–65535, else `invalid_port` with
 * the untouched input. Valid ports then reject the Render-free blocklist and
 * the local Mailpit port; `2525` additionally requires `SMTP_SECURE` to be
 * unset, empty, `false` or `0`, because it is a STARTTLS port. Any other
 * valid port is accepted: this guard does not validate `SMTP_HOST`
 * reachability (operator/live-proof scope).
 */
export function validateSmtpTransportPort(
  env: Record<string, string | undefined>,
): { ok: true } | SmtpPortFailure {
  if (env.TARGET_ENVIRONMENT !== 'development') {
    return { ok: true };
  }

  const raw = env.SMTP_PORT;
  if (raw === undefined || raw === '' || isPlaceholder(raw)) {
    return { ok: true };
  }
  if (!/^\d+$/.test(raw)) {
    return { ok: false, reason: 'invalid_port', raw };
  }

  const port = Number(raw);
  if (port < 1 || port > 65535) {
    return { ok: false, reason: 'invalid_port', raw };
  }
  if (BLOCKED_RENDER_FREE_SMTP_PORTS.includes(port)) {
    return { ok: false, reason: 'render_free_blocked', port };
  }
  if (port === LOCAL_MAILPIT_PORT) {
    return { ok: false, reason: 'local_port', port };
  }
  if (port === RENDER_FREE_SMTP_PORT) {
    const secure = env.SMTP_SECURE;
    if (
      secure !== undefined &&
      secure !== '' &&
      secure !== 'false' &&
      secure !== '0'
    ) {
      return { ok: false, reason: 'starttls_required', value: secure };
    }
  }
  return { ok: true };
}

/**
 * Renders the pinned AC-1(b) operator block for one transport failure: a
 * header naming the port problem and the environment, a remediation line and
 * the runbook pointer. Only the rejected port or raw value is echoed; no
 * other configured value is ever printed.
 */
export function formatSmtpPortFailure(
  environment: string,
  failure: SmtpPortFailure,
): string {
  const runbook = '  Runbook: README.md § Deployment Brevo runbook';
  switch (failure.reason) {
    case 'render_free_blocked':
      return [
        `Deploy blocked: SMTP_PORT=${failure.port} is blocked for outbound SMTP on the Render free plan ('${environment}' environment).`,
        '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS); ports 25, 465 and 587 stay blocked on Render free.',
        runbook,
      ].join('\n');
    case 'invalid_port':
      return [
        `Deploy blocked: SMTP_PORT="${failure.raw}" must be an integer between 1 and 65535 ('${environment}' environment).`,
        '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS) on Render free.',
        runbook,
      ].join('\n');
    case 'local_port':
      return [
        `Deploy blocked: SMTP_PORT=${failure.port} is the local Mailpit port and is not reachable from a deployed Render service ('${environment}' environment).`,
        '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS).',
        runbook,
      ].join('\n');
    case 'starttls_required':
      return [
        `Deploy blocked: SMTP_SECURE must be "false" when SMTP_PORT=2525 ('${environment}' environment); received "${failure.value}".`,
        '  Port 2525 uses STARTTLS; set SMTP_SECURE=false.',
        runbook,
      ].join('\n');
  }
}

/** `https://api.render.com/v1/services/<serviceId>/env-vars/<key>`. */
export function renderEnvVarUrl(serviceId: string, key: string): string {
  return `https://api.render.com/v1/services/${serviceId}/env-vars/${key}`;
}

/** The per-key `PUT` body: exactly `{"value":"<JSON-escaped value>"}`. */
export function buildEnvVarPayload(value: string): string {
  return JSON.stringify({ value });
}

/** Minimal shape of the Render API response this module consumes. */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

/** Injected HTTP seam; the real `fetch` is assignable to it. */
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<FetchResponseLike>;

const REDACTED = '[redacted]';

/**
 * Value-shaped and key-shaped material a transport or provider error might
 * echo. Patterns mirror the repository credential guard (`rnd_` keys, Render
 * key assignments, Brevo REST/SMTP keys) so a failed request can never print
 * one.
 */
const KEY_PATTERNS: readonly { pattern: RegExp; replacement: string }[] = [
  { pattern: /rnd_[A-Za-z0-9_-]{20,}/g, replacement: REDACTED },
  {
    pattern: /(RENDER_API_KEY=)["']?[A-Za-z0-9_-]{12,}["']?/g,
    replacement: `$1${REDACTED}`,
  },
  { pattern: /xkeysib-[A-Za-z0-9]{20,}/g, replacement: REDACTED },
  { pattern: /xsmtpsib-[A-Za-z0-9]{15,}/g, replacement: REDACTED },
];

/**
 * Replaces every configured value and every key-shaped token with
 * `[redacted]`. Values are replaced longest-first so an overlapping shorter
 * value cannot leave a suffix of a longer value behind; empty values are
 * ignored (they would otherwise match between every character).
 */
export function redactValues(text: string, values: readonly string[]): string {
  let redacted = text;
  const ordered = values
    .filter((value) => value !== '')
    .sort((a, b) => b.length - a.length);
  for (const value of ordered) {
    redacted = redacted.split(value).join(REDACTED);
  }
  for (const { pattern, replacement } of KEY_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

/** Inputs for {@link syncRenderEnv}; every side effect is injected. */
export interface SyncRenderEnvInput {
  /** URL path coordinate only; never sent in a body. */
  serviceId: string;
  /** Bearer credential only; never sent in a body. */
  apiKey: string;
  /** Exactly the nine synced names; extra properties are ignored by the loop. */
  syncValues: SyncValues;
  fetchImpl: FetchLike;
  log: (line: string) => void;
  /** Message label for the summary line (the CLI passes `TARGET_ENVIRONMENT`). */
  environment?: string;
}

/** Sync outcome: the keys written and verified before any stop. */
export interface SyncRenderEnvResult {
  synced: SyncKey[];
}

interface JsonObject {
  [key: string]: unknown;
}

/** Parses a response body only far enough to read machine-readable fields. */
function parseJsonObject(text: string): JsonObject | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Render's `code` when the body parses with a non-empty string, else `unknown`. */
function errorCode(body: JsonObject | undefined): string {
  const code = body?.code;
  return typeof code === 'string' && code !== '' ? code : 'unknown';
}

/** `AbortSignal.timeout` rejects with a `TimeoutError` (`DOMException` or Error). */
function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'TimeoutError'
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Writes the nine synced names to the Render service in `SYNC_CATALOG` order,
 * one per-key `PUT` each, and verifies the echoed `key` and `value`. The wiring
 * names never reach a body: `RENDER_SERVICE_ID` is only the URL and
 * `RENDER_API_KEY` only the authorization header.
 *
 * On the first failure (non-2xx, timeout, other transport rejection, or a
 * response that does not echo the sent value) the pinned line is logged, the
 * loop stops and the already-synced keys are returned without a summary. The
 * caller compares the result with `SYNC_CATALOG.length` to choose the exit
 * code. An extra property on `syncValues` is ignored by the loop.
 */
export async function syncRenderEnv(
  input: SyncRenderEnvInput,
): Promise<SyncRenderEnvResult> {
  const { serviceId, apiKey, syncValues, fetchImpl, log } = input;
  const environment = input.environment ?? 'unknown';
  const synced: SyncKey[] = [];

  // Redact every configured string plus the bearer credential, even though the
  // API key is never part of a request body.
  const sensitiveValues = [...Object.values(syncValues), apiKey];

  for (const { key } of SYNC_CATALOG) {
    const value = syncValues[key];
    try {
      const response = await fetchImpl(renderEnvVarUrl(serviceId, key), {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: buildEnvVarPayload(value),
      });

      if (!response.ok) {
        const body = parseJsonObject(await response.text());
        log(`Render API error for ${key}: HTTP ${response.status} (${errorCode(body)})`);
        return { synced };
      }

      const body = parseJsonObject(await response.text());
      if (body?.key !== key || body.value !== value) {
        log(`Render API returned a different value for ${key}; aborting`);
        return { synced };
      }
    } catch (error) {
      if (isTimeoutError(error)) {
        log(`Render API request for ${key} timed out after ${RENDER_REQUEST_TIMEOUT_MS}ms`);
      } else {
        log(
          `Render API request for ${key} failed: ` +
            redactValues(errorMessage(error), sensitiveValues),
        );
      }
      return { synced };
    }

    log(`SYNCED ${key} (value verified, not shown)`);
    synced.push(key);
  }

  log(
    `Synced ${synced.length} value(s) to Render service ${serviceId} for the '${environment}' environment.`,
  );
  return { synced };
}
