/**
 * Render env deploy CLI (T2, AC-4/AC-5/AC-6).
 *
 * The deploy workflow runs this entrypoint twice: `--check-only` as a preflight
 * before the Neon migration, then with no flag to sync the seven Brevo SMTP
 * values to the Render service before the deploy hook.
 *
 * Every input comes from the environment (`TARGET_ENVIRONMENT`,
 * `RENDER_SERVICE_ID`, `RENDER_API_KEY`, the seven `SMTP_*` names); nothing is
 * read from argv, a file or stdin, and no configured value is ever printed.
 * `--check-only` and `--dry-run` never call the injected fetch. The real fetch
 * is only wired in the bottom guard, with a per-request 10 000 ms timeout.
 */

import { pathToFileURL } from 'node:url';

import {
  CATALOG,
  formatGuardFailure,
  formatSmtpPortFailure,
  renderEnvVarUrl,
  RENDER_REQUEST_TIMEOUT_MS,
  SMTP_CATALOG,
  syncRenderEnv,
  validateDeployEnv,
  validateSmtpTransportPort,
  type FetchLike,
  type SmtpValues,
} from './render-env.js';

/** Injected side effects: the HTTP seam and the stdout writer. */
export interface RenderEnvCliIo {
  fetchImpl: FetchLike;
  log: (line: string) => void;
}

/** Usage text shared by `--help` and the argument-error path (AC-4(c)). */
const USAGE = [
  'Usage: npx --no-install tsx src/backend/src/deploy/render-env-cli.ts [--check-only | --dry-run]',
  '       node dist/deploy/render-env-cli.js [--check-only | --dry-run]',
  '',
  'Validates the nine deployment names from the environment, then writes the',
  'seven Brevo SMTP values to the Render service. --check-only and --dry-run',
  'never make a network call. Configured values are never printed.',
  '',
  'Options:',
  '  --check-only  Validate the nine names and exit (no network calls)',
  '  --dry-run     Validate the nine names and list the seven writes (no network calls)',
  '  --help        Show this help and exit',
].join('\n');

/**
 * Message label from `TARGET_ENVIRONMENT`; absent or blank falls back to
 * `unknown` so a header always reads sensibly.
 */
function readTargetEnvironment(
  env: Record<string, string | undefined>,
): string {
  const configured = env.TARGET_ENVIRONMENT;
  return configured === undefined || configured.trim() === ''
    ? 'unknown'
    : configured;
}

/**
 * Projects the validated environment onto the seven-key `SmtpValues` shape.
 * The projection is driven by `SMTP_CATALOG`, so `RENDER_SERVICE_ID` and
 * `RENDER_API_KEY` can never reach a request body; a successful validation
 * guarantees every SMTP key is present.
 */
function buildSmtpValues(values: Record<string, string>): SmtpValues {
  const projected = Object.fromEntries(
    SMTP_CATALOG.map(({ key }) => [key, values[key]]),
  );
  return projected as SmtpValues;
}

/**
 * Runs the CLI and returns its exit code instead of exiting, so every branch is
 * unit-testable. `--help` wins over every other argument (it never reads the
 * environment); any argument that is not a known flag is an error. When both
 * mode flags are present, `--check-only` wins because it is the read-only mode.
 */
export async function runRenderEnvCli(
  argv: string[],
  env: Record<string, string | undefined>,
  io: RenderEnvCliIo,
): Promise<number> {
  if (argv.includes('--help')) {
    io.log(USAGE);
    return 0;
  }

  let checkOnly = false;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--check-only') {
      checkOnly = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    io.log(`Unknown option: ${arg}`);
    io.log(USAGE);
    return 1;
  }

  const environment = readTargetEnvironment(env);
  const validation = validateDeployEnv(env);
  if (!validation.ok) {
    io.log(formatGuardFailure(environment, validation));
    return 1;
  }

  // The strict transport guard runs only after the catalog accepted all nine
  // names (catalog precedence) and before any mode prints or fetches, so a
  // blocked, malformed, local or non-STARTTLS port can never be synced.
  const portFailure = validateSmtpTransportPort(env);
  if (!portFailure.ok) {
    io.log(formatSmtpPortFailure(environment, portFailure));
    return 1;
  }

  if (checkOnly) {
    io.log(
      `Deploy configuration OK: ${CATALOG.length} value(s) present for the '${environment}' environment.`,
    );
    return 0;
  }

  const serviceId = validation.values.RENDER_SERVICE_ID;

  if (dryRun) {
    for (const { key } of SMTP_CATALOG) {
      io.log(`DRY RUN: would set ${key} (PUT ${renderEnvVarUrl(serviceId, key)})`);
    }
    io.log(
      `DRY RUN complete: ${CATALOG.length} value(s) validated for the '${environment}' environment; ` +
        `${SMTP_CATALOG.length} would be synced; no network calls made.`,
    );
    return 0;
  }

  const { synced } = await syncRenderEnv({
    serviceId,
    apiKey: validation.values.RENDER_API_KEY,
    smtpValues: buildSmtpValues(validation.values),
    environment,
    // Per-request budget; the factory is called for each PUT, so one slow
    // request cannot consume another's remaining time.
    fetchImpl: (url, init) =>
      io.fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(RENDER_REQUEST_TIMEOUT_MS),
      }),
    log: io.log,
  });

  // `syncRenderEnv` stops on the first failure without a summary line, so a
  // short result is the only signal the CLI needs to fail the deploy step.
  return synced.length === SMTP_CATALOG.length ? 0 : 1;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(invokedPath).href
) {
  process.exitCode = await runRenderEnvCli(process.argv.slice(2), process.env, {
    fetchImpl: fetch,
    log: console.log,
  });
}
