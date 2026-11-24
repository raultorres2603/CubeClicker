import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runRenderEnvCli, type RenderEnvCliIo } from './render-env-cli.js';
import {
  CATALOG,
  type FetchLike,
  type FetchResponseLike,
  type SmtpValues,
} from './render-env.js';

const SMTP_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_CONNECTION_TIMEOUT_MS',
  'SMTP_FROM',
  'SMTP_USER',
  'SMTP_PASS',
] as const;

const SMTP_VALUES: SmtpValues = {
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_PORT: '2525',
  SMTP_SECURE: 'false',
  SMTP_CONNECTION_TIMEOUT_MS: '10000',
  SMTP_FROM: 'CubeClicker <no-reply@example.com>',
  SMTP_USER: 'smtp-login@example.com',
  SMTP_PASS: 'smtp-pass-value',
};

const SERVICE_ID = 'srv-dbtcvv9srm7s73au5bag';
// Built from a prefix plus a repeat so no literal Render-key shape lives in the tree.
const API_KEY = 'rnd_' + 'k'.repeat(24);
const ENVIRONMENT = 'development';

const COMPLETE_ENV = {
  TARGET_ENVIRONMENT: ENVIRONMENT,
  ...SMTP_VALUES,
  RENDER_SERVICE_ID: SERVICE_ID,
  RENDER_API_KEY: API_KEY,
};

const DEVELOPMENT_PLACEHOLDER_ENV = {
  ...COMPLETE_ENV,
  SMTP_FROM: '<CHANGEME-verified-sender>',
  SMTP_USER: '<CHANGEME-smtp-login>',
  SMTP_PASS: '<CHANGEME-smtp-key>',
  RENDER_API_KEY: '<CHANGEME-render-api-key>',
};

const PRODUCTION_PLACEHOLDER_ENV = {
  ...DEVELOPMENT_PLACEHOLDER_ENV,
  TARGET_ENVIRONMENT: 'production',
  // Production stays at the placeholder-era 587: the catalog rejects it before
  // the port guard, proving catalog precedence under the new strict guard.
  SMTP_PORT: '587',
  RENDER_SERVICE_ID: '<CHANGEME-render-service-id>',
};

const EXPECTED_URLS = [
  'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/SMTP_HOST',
  'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/SMTP_PORT',
  'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/SMTP_SECURE',
  'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/SMTP_CONNECTION_TIMEOUT_MS',
  'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/SMTP_FROM',
  'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/SMTP_USER',
  'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/SMTP_PASS',
];

const EXPECTED_BODIES = [
  '{"value":"smtp-relay.brevo.com"}',
  '{"value":"2525"}',
  '{"value":"false"}',
  '{"value":"10000"}',
  '{"value":"CubeClicker <no-reply@example.com>"}',
  '{"value":"smtp-login@example.com"}',
  '{"value":"smtp-pass-value"}',
];

const CHECK_ONLY_SUCCESS =
  "Deploy configuration OK: 9 value(s) present for the 'development' environment.";

const DRY_RUN_SUMMARY =
  "DRY RUN complete: 9 value(s) validated for the 'development' environment; 7 would be synced; no network calls made.";

const EXPECTED_DRY_RUN_LINES = [
  ...SMTP_KEYS.map(
    (key) =>
      `DRY RUN: would set ${key} (PUT https://api.render.com/v1/services/${SERVICE_ID}/env-vars/${key})`,
  ),
  DRY_RUN_SUMMARY,
];

const EXPECTED_SYNC_LINES = [
  ...SMTP_KEYS.map((key) => `SYNCED ${key} (value verified, not shown)`),
  `Synced 7 value(s) to Render service ${SERVICE_ID} for the 'development' environment.`,
];

/** Independent copy of the usage pinned by `--help` (AC-4(c)). */
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

/** Exact AC-4(a) block for the pinned production placeholder set. */
const PRODUCTION_BLOCK = [
  "Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).",
  '  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY',
  'Remediation (names only; never paste a value into a command argument):',
  '  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker',
  '  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker',
  'Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-4(a) block for an environment with every name unset. */
const ALL_MISSING_BLOCK = [
  "Deploy blocked: the 'unknown' environment has 9 unset or placeholder value(s).",
  '  Missing: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_CONNECTION_TIMEOUT_MS, SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY',
  'Remediation (names only; never paste a value into a command argument):',
  '  variables: gh variable set <NAME> --env unknown --repo raultorres2603/CubeClicker',
  '  secrets:   gh secret set <NAME> --env unknown --repo raultorres2603/CubeClicker',
  'Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-1(b) block for a development fixture pinned to blocked port 587. */
const BLOCKED_PORT_BLOCK = [
  "Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment).",
  '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS); ports 25, 465 and 587 stay blocked on Render free.',
  '  Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-1(b) block for a malformed development port. */
const INVALID_PORT_BLOCK = [
  'Deploy blocked: SMTP_PORT="587abc" must be an integer between 1 and 65535 (\'development\' environment).',
  '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS) on Render free.',
  '  Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-1(b) block for the local Mailpit port. */
const LOCAL_PORT_BLOCK = [
  "Deploy blocked: SMTP_PORT=1025 is the local Mailpit port and is not reachable from a deployed Render service ('development' environment).",
  '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS).',
  '  Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-1(b) block for 2525 with implicit TLS requested. */
const STARTTLS_BLOCK = [
  'Deploy blocked: SMTP_SECURE must be "false" when SMTP_PORT=2525 (\'development\' environment); received "true".',
  '  Port 2525 uses STARTTLS; set SMTP_SECURE=false.',
  '  Runbook: README.md § Deployment Brevo runbook',
].join('\n');

const BLOCKED_PORT_ENV = { ...COMPLETE_ENV, SMTP_PORT: '587' };
const INVALID_PORT_ENV = { ...COMPLETE_ENV, SMTP_PORT: '587abc' };
const LOCAL_PORT_ENV = { ...COMPLETE_ENV, SMTP_PORT: '1025' };
const NON_STARTTLS_ENV = {
  ...COMPLETE_ENV,
  SMTP_PORT: '2525',
  SMTP_SECURE: 'true',
};

interface RecordedCall {
  url: string;
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  };
}

function keyFromUrl(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}

/** Simulates Render echoing the stored key and the exact value it received. */
function echo(call: RecordedCall): FetchResponseLike {
  const sent = JSON.parse(call.init.body) as { value: string };
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ key: keyFromUrl(call.url), value: sent.value }),
  };
}

function createHarness(
  respond: (
    call: RecordedCall,
    index: number,
  ) => FetchResponseLike | Promise<FetchResponseLike> = echo,
) {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const call: RecordedCall = { url, init };
    calls.push(call);
    return respond(call, calls.length - 1);
  };
  const lines: string[] = [];
  const io: RenderEnvCliIo = {
    fetchImpl,
    log: (line) => {
      lines.push(line);
    },
  };
  return { io, calls, lines };
}

/** A mode that must not touch the network: calling fetch fails the test loudly. */
function createNoNetworkHarness() {
  return createHarness(() => {
    throw new Error('the CLI must not call fetch in a no-network mode');
  });
}

/**
 * Every configured secret-shaped fixture value plus the bearer credential must
 * stay out of every printed line (AC-9(b)). The four non-secret constants and
 * the public service id may appear; the 10000 ms request-timeout constant is
 * asserted separately because the pinned timeout line legitimately prints it.
 */
function expectNoFixtureSecrets(lines: string[]): void {
  const output = lines.join('\n');
  for (const value of [
    SMTP_VALUES.SMTP_HOST,
    SMTP_VALUES.SMTP_FROM,
    SMTP_VALUES.SMTP_USER,
    SMTP_VALUES.SMTP_PASS,
    API_KEY,
  ]) {
    expect(output).not.toContain(value);
  }
}

describe('runRenderEnvCli flags (AC-4(c))', () => {
  it('prints exactly the usage for --help and returns 0 without a fetch', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--help'], {}, io)).toBe(0);

    expect(lines).toStrictEqual([USAGE]);
    expect(calls).toHaveLength(0);
  });

  it('rejects an unknown option with the pinned line plus usage and exit 1', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--bogus'], COMPLETE_ENV, io)).toBe(1);

    expect(lines).toStrictEqual(['Unknown option: --bogus', USAGE]);
    expect(calls).toHaveLength(0);
  });

  it('rejects an unknown option that follows a known flag before validating', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(
      await runRenderEnvCli(['--check-only', '--verbose'], COMPLETE_ENV, io),
    ).toBe(1);

    expect(lines).toStrictEqual(['Unknown option: --verbose', USAGE]);
    expect(calls).toHaveLength(0);
  });

  it('prefers --check-only over --dry-run when both are passed', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(
      await runRenderEnvCli(['--dry-run', '--check-only'], COMPLETE_ENV, io),
    ).toBe(0);

    expect(lines).toStrictEqual([CHECK_ONLY_SUCCESS]);
    expect(calls).toHaveLength(0);
  });
});

describe('runRenderEnvCli --check-only (AC-4)', () => {
  it('prints the exact success line for the complete development fixture', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], COMPLETE_ENV, io)).toBe(0);

    expect(lines).toStrictEqual([CHECK_ONLY_SUCCESS]);
    expect(calls).toHaveLength(0);
  });

  it('prints the exact production placeholder block at 587 (catalog wins over the port guard) and exits 1', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(
      await runRenderEnvCli(['--check-only'], PRODUCTION_PLACEHOLDER_ENV, io),
    ).toBe(1);

    expect(lines).toStrictEqual([PRODUCTION_BLOCK]);
    expect(calls).toHaveLength(0);
    expectNoFixtureSecrets(lines);
  });

  it('labels an absent TARGET_ENVIRONMENT as unknown and lists all nine names', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], {}, io)).toBe(1);

    expect(lines).toStrictEqual([ALL_MISSING_BLOCK]);
    expect(calls).toHaveLength(0);
  });

  it('prints Missing before Placeholder and treats a blank target environment as unknown', async () => {
    const mixed = {
      ...COMPLETE_ENV,
      TARGET_ENVIRONMENT: '   ',
      SMTP_HOST: ' ',
      SMTP_USER: '',
      SMTP_FROM: '<CHANGEME-verified-sender>',
    };
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], mixed, io)).toBe(1);

    expect(lines).toStrictEqual([
      [
        "Deploy blocked: the 'unknown' environment has 3 unset or placeholder value(s).",
        '  Missing: SMTP_HOST, SMTP_USER',
        '  Placeholder: SMTP_FROM',
        'Remediation (names only; never paste a value into a command argument):',
        '  variables: gh variable set <NAME> --env unknown --repo raultorres2603/CubeClicker',
        '  secrets:   gh secret set <NAME> --env unknown --repo raultorres2603/CubeClicker',
        'Runbook: README.md § Deployment Brevo runbook',
      ].join('\n'),
    ]);
    expect(calls).toHaveLength(0);
    expectNoFixtureSecrets(lines);
  });
});

describe('runRenderEnvCli strict SMTP transport guard (AC-1)', () => {
  it('rejects a development 587 in --check-only before any success line or fetch', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], BLOCKED_PORT_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([BLOCKED_PORT_BLOCK]);
    expect(calls).toHaveLength(0);
    expectNoFixtureSecrets(lines);
  });

  it('rejects a malformed development port in --check-only', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], INVALID_PORT_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([INVALID_PORT_BLOCK]);
    expect(calls).toHaveLength(0);
  });

  it('rejects the local Mailpit port in --check-only', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], LOCAL_PORT_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([LOCAL_PORT_BLOCK]);
    expect(calls).toHaveLength(0);
  });

  it('rejects 2525 with SMTP_SECURE=true in --check-only', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], NON_STARTTLS_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([STARTTLS_BLOCK]);
    expect(calls).toHaveLength(0);
  });

  it('prints no DRY RUN line and makes no fetch for a blocked or malformed port', async () => {
    for (const [fixture, block] of [
      [BLOCKED_PORT_ENV, BLOCKED_PORT_BLOCK],
      [INVALID_PORT_ENV, INVALID_PORT_BLOCK],
    ] as const) {
      const { io, calls, lines } = createNoNetworkHarness();

      expect(await runRenderEnvCli(['--dry-run'], fixture, io)).toBe(1);

      expect(lines).toStrictEqual([block]);
      expect(lines.join('\n')).not.toContain('DRY RUN:');
      expect(calls).toHaveLength(0);
    }
  });

  it('fails the default sync mode on 587 without a network call', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli([], BLOCKED_PORT_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([BLOCKED_PORT_BLOCK]);
    expect(calls).toHaveLength(0);
  });
});

describe('runRenderEnvCli --dry-run (AC-6)', () => {
  it('lists the seven writes in catalog order and prints the summary without a fetch', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--dry-run'], COMPLETE_ENV, io)).toBe(0);

    expect(lines).toStrictEqual(EXPECTED_DRY_RUN_LINES);
    expect(calls).toHaveLength(0);
    expectNoFixtureSecrets(lines);
  });

  it('fails the guard before printing any DRY RUN line when a value is a placeholder', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(
      await runRenderEnvCli(['--dry-run'], PRODUCTION_PLACEHOLDER_ENV, io),
    ).toBe(1);

    expect(lines).toStrictEqual([PRODUCTION_BLOCK]);
    expect(calls).toHaveLength(0);
    expectNoFixtureSecrets(lines);
  });
});

describe('runRenderEnvCli default sync mode (AC-5)', () => {
  it('validates nine, then sends exactly the seven SMTP PUTs in order and exits 0', async () => {
    const { io, calls, lines } = createHarness();

    expect(await runRenderEnvCli([], COMPLETE_ENV, io)).toBe(0);

    expect(calls.map((call) => call.url)).toStrictEqual(EXPECTED_URLS);
    expect(calls.map((call) => call.init.method)).toStrictEqual([
      'PUT',
      'PUT',
      'PUT',
      'PUT',
      'PUT',
      'PUT',
      'PUT',
    ]);
    for (const call of calls) {
      expect(call.init.headers).toStrictEqual({
        authorization: `Bearer ${API_KEY}`,
        'content-type': 'application/json',
      });
      expect(call.init.signal).toBeInstanceOf(AbortSignal);
      expect(call.init.signal?.aborted).toBe(false);
    }
    expect(calls.map((call) => call.init.body)).toStrictEqual(EXPECTED_BODIES);
    expect(lines).toStrictEqual(EXPECTED_SYNC_LINES);
    expectNoFixtureSecrets(lines);
  });

  it('keeps both wiring names out of every request body and URL credential', async () => {
    const { io, calls } = createHarness();

    expect(await runRenderEnvCli([], COMPLETE_ENV, io)).toBe(0);

    expect(calls).toHaveLength(7);
    for (const call of calls) {
      expect(call.init.body).not.toContain('RENDER_API_KEY');
      expect(call.init.body).not.toContain('RENDER_SERVICE_ID');
      expect(call.init.body).not.toContain(API_KEY);
      expect(call.init.body).not.toContain(SERVICE_ID);
      expect(call.url).toBe(
        `https://api.render.com/v1/services/${SERVICE_ID}/env-vars/${keyFromUrl(call.url)}`,
      );
    }
  });

  it('returns 1 and stops after the failing key on a non-2xx response', async () => {
    const { io, calls, lines } = createHarness((call, index) => {
      if (index === 0) {
        return echo(call);
      }
      return {
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({
            code: 'insufficient_token_scope',
            message: 'do not print this body',
          }),
      };
    });

    expect(await runRenderEnvCli([], COMPLETE_ENV, io)).toBe(1);

    expect(calls).toHaveLength(2);
    expect(lines).toStrictEqual([
      'SYNCED SMTP_HOST (value verified, not shown)',
      'Render API error for SMTP_PORT: HTTP 403 (insufficient_token_scope)',
    ]);
    expect(lines.join('\n')).not.toContain('do not print this body');
    expectNoFixtureSecrets(lines);
  });

  it('returns 1 when the stored value differs from the sent value', async () => {
    const { io, calls, lines } = createHarness((call) => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ key: keyFromUrl(call.url), value: 'tampered-value' }),
    }));

    expect(await runRenderEnvCli([], COMPLETE_ENV, io)).toBe(1);

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API returned a different value for SMTP_HOST; aborting',
    ]);
    expectNoFixtureSecrets(lines);
  });

  it('returns 1 with the pinned timeout line when a request aborts', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    const { io, calls, lines } = createHarness(() =>
      Promise.reject(timeoutError),
    );

    expect(await runRenderEnvCli([], COMPLETE_ENV, io)).toBe(1);

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API request for SMTP_HOST timed out after 10000ms',
    ]);
  });

  it('fails the guard without a network call before syncing placeholders', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli([], PRODUCTION_PLACEHOLDER_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([PRODUCTION_BLOCK]);
    expect(calls).toHaveLength(0);
    expectNoFixtureSecrets(lines);
  });

  it('labels the sync summary as unknown when TARGET_ENVIRONMENT is absent', async () => {
    const withoutLabel: Record<string, string> = { ...COMPLETE_ENV };
    delete withoutLabel.TARGET_ENVIRONMENT;
    const { io, lines } = createHarness();

    expect(await runRenderEnvCli([], withoutLabel, io)).toBe(0);

    expect(lines.at(-1)).toBe(
      `Synced 7 value(s) to Render service ${SERVICE_ID} for the 'unknown' environment.`,
    );
  });
});

describe('integration through the process boundary (AC-4/AC-6)', () => {
  const CLI_PATH = fileURLToPath(new URL('./render-env-cli.ts', import.meta.url));
  const FIXTURE_KEYS = [
    'TARGET_ENVIRONMENT',
    ...CATALOG.map((entry) => entry.key),
  ];

  /** Runs the real script with a hermetic environment (no inherited SMTP_*). */
  function runCliProcess(args: string[], fixture: Record<string, string>) {
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    for (const key of FIXTURE_KEYS) {
      delete childEnv[key];
    }
    Object.assign(childEnv, fixture);
    return spawnSync(process.execPath, ['--import', 'tsx', CLI_PATH, ...args], {
      encoding: 'utf8',
      env: childEnv,
      timeout: 30_000,
    });
  }

  it(
    'prints exactly the usage with exit 0 through the real entrypoint',
    () => {
      const result = runCliProcess(['--help'], {});

      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${USAGE}\n`);
      expect(result.stderr).toBe('');
    },
    20_000,
  );

  it(
    'exits 1 with the exact AC-4(a) block for the production placeholder fixture',
    () => {
      const result = runCliProcess(['--check-only'], PRODUCTION_PLACEHOLDER_ENV);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe(`${PRODUCTION_BLOCK}\n`);
      expect(result.stderr).toBe('');
    },
    20_000,
  );

  it(
    'exits 1 with the exact blocked-port block for a development 587 fixture',
    () => {
      const result = runCliProcess(['--check-only'], BLOCKED_PORT_ENV);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe(`${BLOCKED_PORT_BLOCK}\n`);
      expect(result.stderr).toBe('');
    },
    20_000,
  );

  it(
    'exits 0 with the exact AC-4(b) line for the complete development fixture',
    () => {
      const result = runCliProcess(['--check-only'], COMPLETE_ENV);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${CHECK_ONLY_SUCCESS}\n`);
      expect(result.stderr).toBe('');
    },
    20_000,
  );

  it(
    'exits 0 with the exact dry-run lines and summary for the complete fixture',
    () => {
      const result = runCliProcess(['--dry-run'], COMPLETE_ENV);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${EXPECTED_DRY_RUN_LINES.join('\n')}\n`);
      expect(result.stderr).toBe('');
    },
    20_000,
  );
});
