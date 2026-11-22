/**
 * Deployment Brevo guard and Render env-var sync (T1, AC-2/AC-3/AC-5/AC-9).
 *
 * The GitHub Environment is the deployment source of truth for nine names. The
 * first seven (`SMTP_CATALOG`) are the accepted Brevo contract and the only
 * names this module writes to Render; the last two (`RENDER_WIRING`) are
 * pipeline wiring that is validated but never written to the service:
 *   - `RENDER_SERVICE_ID` is only the URL path coordinate.
 *   - `RENDER_API_KEY` is only the `authorization` header.
 *
 * Everything here is pure or injected: `syncRenderEnv` receives a `FetchLike`
 * and a line logger, so the guard and the sync are testable with no network,
 * no timers and no live credentials. Failure output never contains a value:
 * transport errors pass through `redactValues`, and only the Render `code` of a
 * failed response body is ever printed.
 */

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

/** The two Render-wiring names: validated, never synced to the service. */
export const RENDER_WIRING = [
  { key: 'RENDER_SERVICE_ID', source: 'variable' },
  { key: 'RENDER_API_KEY', source: 'secret' },
] as const;

/** The nine-name validation catalog: `SMTP_CATALOG` then `RENDER_WIRING`. */
export const CATALOG = [...SMTP_CATALOG, ...RENDER_WIRING] as const;

/** The seven-key sync payload. The two wiring names are not part of it. */
export type SmtpKey = (typeof SMTP_CATALOG)[number]['key'];
export type SmtpValues = Record<SmtpKey, string>;

/** A value containing this sentinel is a placeholder, not configuration. */
export const PLACEHOLDER_TOKEN = 'CHANGEME';

/** Per-request timeout the CLI applies to the real fetch (AC-5(b)). */
export const RENDER_REQUEST_TIMEOUT_MS = 10_000;

/** `true` exactly when `value` contains the literal `CHANGEME` (case-sensitive). */
export function isPlaceholder(value: string): boolean {
  return value.includes(PLACEHOLDER_TOKEN);
}

/** Outcome of classifying the nine-name catalog against an environment object. */
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
 * lists. `ok: true` requires all nine names to be `ok`; the success payload
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
  /** Exactly the seven SMTP keys; extra properties are ignored by the loop. */
  smtpValues: SmtpValues;
  fetchImpl: FetchLike;
  log: (line: string) => void;
  /** Message label for the summary line (the CLI passes `TARGET_ENVIRONMENT`). */
  environment?: string;
}

/** Sync outcome: the keys written and verified before any stop. */
export interface SyncRenderEnvResult {
  synced: SmtpKey[];
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
 * Writes the seven SMTP names to the Render service in `SMTP_CATALOG` order,
 * one per-key `PUT` each, and verifies the echoed `key` and `value`. The wiring
 * names never reach a body: `RENDER_SERVICE_ID` is only the URL and
 * `RENDER_API_KEY` only the authorization header.
 *
 * On the first failure (non-2xx, timeout, other transport rejection, or a
 * response that does not echo the sent value) the pinned line is logged, the
 * loop stops and the already-synced keys are returned without a summary. The
 * caller compares the result with `SMTP_CATALOG.length` to choose the exit
 * code. An extra property on `smtpValues` is ignored by the loop.
 */
export async function syncRenderEnv(
  input: SyncRenderEnvInput,
): Promise<SyncRenderEnvResult> {
  const { serviceId, apiKey, smtpValues, fetchImpl, log } = input;
  const environment = input.environment ?? 'unknown';
  const synced: SmtpKey[] = [];

  // Redact every configured string plus the bearer credential, even though the
  // API key is never part of a request body.
  const sensitiveValues = [...Object.values(smtpValues), apiKey];

  for (const { key } of SMTP_CATALOG) {
    const value = smtpValues[key];
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
