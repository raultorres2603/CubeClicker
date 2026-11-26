import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DEFAULT_SMTP_FROM } from '../auth/config.js';

import { runRenderEnvCli, type RenderEnvCliIo } from './render-env-cli.js';
import {
  CATALOG,
  type FetchLike,
  type FetchResponseLike,
  type SyncValues,
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

const SYNC_KEYS = [...SMTP_KEYS, 'EMAIL_TRANSPORT', 'BREVO_API_KEY'] as const;

const SMTP_VALUES = {
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_PORT: '2525',
  SMTP_SECURE: 'false',
  SMTP_CONNECTION_TIMEOUT_MS: '10000',
  SMTP_FROM: 'CubeClicker <no-reply@example.com>',
  SMTP_USER: 'smtp-login@example.com',
  SMTP_PASS: 'smtp-pass-value',
} as const;

// 11 characters: a fixture, not a credential shape, and short enough never to
// match the repository credential guard.
const API_FIXTURE = 'fixture-key';

const SYNC_VALUES: SyncValues = {
  ...SMTP_VALUES,
  EMAIL_TRANSPORT: 'brevo-api',
  BREVO_API_KEY: API_FIXTURE,
};

const SERVICE_ID = 'srv-dbtcvv9srm7s73au5bag';
// Built from a prefix plus a repeat so no literal Render-key shape lives in the tree.
const API_KEY = 'rnd_' + 'k'.repeat(24);
const ENVIRONMENT = 'development';

const COMPLETE_ENV = {
  TARGET_ENVIRONMENT: ENVIRONMENT,
  ...SYNC_VALUES,
  RENDER_SERVICE_ID: SERVICE_ID,
  RENDER_API_KEY: API_KEY,
};

const DEVELOPMENT_PLACEHOLDER_ENV = {
  ...COMPLETE_ENV,
  SMTP_FROM: '<CHANGEME-verified-sender>',
  SMTP_USER: '<CHANGEME-smtp-login>',
  SMTP_PASS: '<CHANGEME-smtp-key>',
  BREVO_API_KEY: '<CHANGEME-brevo-api-key>',
  RENDER_API_KEY: '<CHANGEME-render-api-key>',
};

const PRODUCTION_PLACEHOLDER_ENV = {
  ...DEVELOPMENT_PLACEHOLDER_ENV,
  TARGET_ENVIRONMENT: 'production',
  // Production stays at the placeholder-era 587: the catalog rejects it before
  // the transport or port guard, proving catalog precedence.
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
  'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/EMAIL_TRANSPORT',
  'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/BREVO_API_KEY',
];

const EXPECTED_BODIES = [
  '{"value":"smtp-relay.brevo.com"}',
  '{"value":"2525"}',
  '{"value":"false"}',
  '{"value":"10000"}',
  '{"value":"CubeClicker <no-reply@example.com>"}',
  '{"value":"smtp-login@example.com"}',
  '{"value":"smtp-pass-value"}',
  '{"value":"brevo-api"}',
  `{"value":"${API_FIXTURE}"}`,
];

const CHECK_ONLY_SUCCESS =
  "Deploy configuration OK: 11 value(s) present for the 'development' environment.";

const DRY_RUN_SUMMARY =
  "DRY RUN complete: 11 value(s) validated for the 'development' environment; 9 would be synced; no network calls made.";

const EXPECTED_DRY_RUN_LINES = [
  ...SYNC_KEYS.map(
    (key) =>
      `DRY RUN: would set ${key} (PUT https://api.render.com/v1/services/${SERVICE_ID}/env-vars/${key})`,
  ),
  DRY_RUN_SUMMARY,
];

const EXPECTED_SYNC_LINES = [
  ...SYNC_KEYS.map((key) => `SYNCED ${key} (value verified, not shown)`),
  `Synced 9 value(s) to Render service ${SERVICE_ID} for the 'development' environment.`,
];

/** Independent copy of the usage pinned by `--help` (AC-8(c)). */
const USAGE = [
  'Usage: npx --no-install tsx src/backend/src/deploy/render-env-cli.ts [--check-only | --dry-run]',
  '       node dist/deploy/render-env-cli.js [--check-only | --dry-run]',
  '',
  'Validates the eleven deployment names from the environment, then writes the',
  'nine deployed values (SMTP plus the Brevo HTTPS API transport) to the Render',
  'service. --check-only and --dry-run never make a network call. Configured',
  'values are never printed.',
  '',
  'Options:',
  '  --check-only  Validate the eleven names and exit (no network calls)',
  '  --dry-run     Validate the eleven names and list the nine writes (no network calls)',
  '  --help        Show this help and exit',
].join('\n');

/** Exact AC-7(b) block for the pinned production placeholder set. */
const PRODUCTION_BLOCK = [
  "Deploy blocked: the 'production' environment has 6 unset or placeholder value(s).",
  '  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, BREVO_API_KEY, RENDER_SERVICE_ID, RENDER_API_KEY',
  'Remediation (names only; never paste a value into a command argument):',
  '  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker',
  '  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker',
  'Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-7(b) block for an environment with every name unset. */
const ALL_MISSING_BLOCK = [
  "Deploy blocked: the 'unknown' environment has 11 unset or placeholder value(s).",
  '  Missing: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_CONNECTION_TIMEOUT_MS, SMTP_FROM, SMTP_USER, SMTP_PASS, EMAIL_TRANSPORT, BREVO_API_KEY, RENDER_SERVICE_ID, RENDER_API_KEY',
  'Remediation (names only; never paste a value into a command argument):',
  '  variables: gh variable set <NAME> --env unknown --repo raultorres2603/CubeClicker',
  '  secrets:   gh secret set <NAME> --env unknown --repo raultorres2603/CubeClicker',
  'Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-7(d) block for an explicit smtp selection in development. */
const DEPLOYED_SMTP_BLOCK = [
  'Deploy blocked: EMAIL_TRANSPORT must be "brevo-api" for the \'development\' environment; received "smtp".',
  "  Deployed verification email uses Brevo's HTTPS API (port 443); SMTP authentication is not used.",
  '  Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-7(d) block for an unknown transport value. */
const UNKNOWN_TRANSPORT_BLOCK = [
  'Deploy blocked: EMAIL_TRANSPORT must be "smtp" or "brevo-api" (\'development\' environment); received "mailgun".',
  '  Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-7(d) block for the SMTP key reused as the API key. */
const SMTP_KEY_REUSE_BLOCK = [
  "Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('development' environment).",
  '  Create a Brevo API key under Settings → SMTP & API → API Keys and store it as the BREVO_API_KEY secret.',
  '  Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-7(d) block for the local Mailpit sender. */
const LOCAL_SENDER_BLOCK = [
  "Deploy blocked: SMTP_FROM is the local Mailpit default and cannot deliver through the Brevo API ('development' environment).",
  '  Set SMTP_FROM to the Brevo-verified sender.',
  '  Runbook: README.md § Deployment Brevo runbook',
].join('\n');

/** Exact AC-7(d) block for a sender that does not parse. */
const INVALID_SENDER_BLOCK = [
  'Deploy blocked: SMTP_FROM must be an address or "Display Name <address>" when EMAIL_TRANSPORT=brevo-api (\'development\' environment).',
  '  Set SMTP_FROM to the Brevo-verified sender.',
  '  Runbook: README.md § Deployment Brevo runbook',
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

/**
 * Deployed development fixture that selects SMTP, also pinned to the blocked
 * port 587. The transport guard must win, proving it runs before the port
 * guard; if the port block appears instead, the test fails.
 */
const DEPLOYED_SMTP_ENV = {
  ...COMPLETE_ENV,
  EMAIL_TRANSPORT: 'smtp',
  SMTP_PORT: '587',
};

const UNKNOWN_TRANSPORT_ENV = { ...COMPLETE_ENV, EMAIL_TRANSPORT: 'mailgun' };

/** The API key is the configured SMTP password, so the guard must reject it. */
const SMTP_KEY_REUSE_ENV = {
  ...COMPLETE_ENV,
  BREVO_API_KEY: SMTP_VALUES.SMTP_PASS,
};

const LOCAL_SENDER_ENV = { ...COMPLETE_ENV, SMTP_FROM: DEFAULT_SMTP_FROM };

const INVALID_SENDER_ENV = { ...COMPLETE_ENV, SMTP_FROM: 'not an address' };

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
    API_FIXTURE,
    API_KEY,
  ]) {
    expect(output).not.toContain(value);
  }
}

describe('runRenderEnvCli flags (AC-8(c))', () => {
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

describe('runRenderEnvCli --check-only (AC-8(a))', () => {
  it('prints the exact success line for the complete development fixture', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], COMPLETE_ENV, io)).toBe(0);

    expect(lines).toStrictEqual([CHECK_ONLY_SUCCESS]);
    expect(calls).toHaveLength(0);
  });

  it('prints the exact production placeholder block at 587 (catalog wins) and exits 1', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(
      await runRenderEnvCli(['--check-only'], PRODUCTION_PLACEHOLDER_ENV, io),
    ).toBe(1);

    expect(lines).toStrictEqual([PRODUCTION_BLOCK]);
    expect(calls).toHaveLength(0);
    expect(lines.join('\n')).not.toContain('Deploy blocked: SMTP_PORT=');
    expect(lines.join('\n')).not.toContain('Deploy blocked: EMAIL_TRANSPORT must be');
    expectNoFixtureSecrets(lines);
  });

  it('labels an absent TARGET_ENVIRONMENT as unknown and lists all eleven names', async () => {
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

describe('runRenderEnvCli deployed email transport guard (AC-7)', () => {
  it('rejects an explicit smtp selection before the SMTP port guard', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], DEPLOYED_SMTP_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([DEPLOYED_SMTP_BLOCK]);
    expect(lines.join('\n')).not.toContain('Deploy blocked: SMTP_PORT=');
    expect(calls).toHaveLength(0);
    expectNoFixtureSecrets(lines);
  });

  it('rejects an unknown transport value with the pinned block', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(
      await runRenderEnvCli(['--check-only'], UNKNOWN_TRANSPORT_ENV, io),
    ).toBe(1);

    expect(lines).toStrictEqual([UNKNOWN_TRANSPORT_BLOCK]);
    expect(calls).toHaveLength(0);
    expectNoFixtureSecrets(lines);
  });

  it('rejects the SMTP key reused as the Brevo API key', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], SMTP_KEY_REUSE_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([SMTP_KEY_REUSE_BLOCK]);
    expect(calls).toHaveLength(0);
    expectNoFixtureSecrets(lines);
  });

  it('rejects the local Mailpit sender without echoing it', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], LOCAL_SENDER_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([LOCAL_SENDER_BLOCK]);
    expect(lines.join('\n')).not.toContain(DEFAULT_SMTP_FROM);
    expect(calls).toHaveLength(0);
  });

  it('rejects an unparseable sender without echoing it', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli(['--check-only'], INVALID_SENDER_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([INVALID_SENDER_BLOCK]);
    expect(lines.join('\n')).not.toContain('not an address');
    expect(calls).toHaveLength(0);
  });

  it('prints no DRY RUN line and makes no fetch for any transport failure', async () => {
    for (const [fixture, block] of [
      [DEPLOYED_SMTP_ENV, DEPLOYED_SMTP_BLOCK],
      [UNKNOWN_TRANSPORT_ENV, UNKNOWN_TRANSPORT_BLOCK],
      [SMTP_KEY_REUSE_ENV, SMTP_KEY_REUSE_BLOCK],
      [LOCAL_SENDER_ENV, LOCAL_SENDER_BLOCK],
      [INVALID_SENDER_ENV, INVALID_SENDER_BLOCK],
    ] as const) {
      const { io, calls, lines } = createNoNetworkHarness();

      expect(await runRenderEnvCli(['--dry-run'], fixture, io)).toBe(1);

      expect(lines).toStrictEqual([block]);
      expect(lines.join('\n')).not.toContain('DRY RUN:');
      expect(calls).toHaveLength(0);
    }
  });
});

describe('runRenderEnvCli strict SMTP transport guard (AC-7(d))', () => {
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

describe('runRenderEnvCli --dry-run (AC-8(c))', () => {
  it('lists the nine writes in catalog order and prints the summary without a fetch', async () => {
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

describe('runRenderEnvCli default sync mode (AC-8(d))', () => {
  it('validates eleven, then sends exactly the nine PUTs in order and exits 0', async () => {
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

    expect(calls).toHaveLength(9);
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

  it('fails the transport guard without a network call before syncing', async () => {
    const { io, calls, lines } = createNoNetworkHarness();

    expect(await runRenderEnvCli([], DEPLOYED_SMTP_ENV, io)).toBe(1);

    expect(lines).toStrictEqual([DEPLOYED_SMTP_BLOCK]);
    expect(calls).toHaveLength(0);
  });

  it('labels the sync summary as unknown when TARGET_ENVIRONMENT is absent', async () => {
    const withoutLabel: Record<string, string> = { ...COMPLETE_ENV };
    delete withoutLabel.TARGET_ENVIRONMENT;
    const { io, lines } = createHarness();

    expect(await runRenderEnvCli([], withoutLabel, io)).toBe(0);

    expect(lines.at(-1)).toBe(
      `Synced 9 value(s) to Render service ${SERVICE_ID} for the 'unknown' environment.`,
    );
  });
});

describe('integration through the process boundary (AC-8(a)/AC-8(b))', () => {
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
    'exits 1 with the exact production placeholder block for the production fixture',
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
    'exits 1 with the exact deployed-transport block for a development smtp fixture',
    () => {
      const result = runCliProcess(['--check-only'], DEPLOYED_SMTP_ENV);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe(`${DEPLOYED_SMTP_BLOCK}\n`);
      expect(result.stderr).toBe('');
    },
    20_000,
  );

  it(
    'exits 1 with the exact SMTP-key-reuse block for the reuse fixture',
    () => {
      const result = runCliProcess(['--check-only'], SMTP_KEY_REUSE_ENV);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe(`${SMTP_KEY_REUSE_BLOCK}\n`);
      expect(result.stderr).toBe('');
    },
    20_000,
  );

  it(
    'exits 1 with the exact local-sender block for the local-sender fixture',
    () => {
      const result = runCliProcess(['--check-only'], LOCAL_SENDER_ENV);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe(`${LOCAL_SENDER_BLOCK}\n`);
      expect(result.stderr).toBe('');
    },
    20_000,
  );

  it(
    'exits 0 with the exact AC-8(a) line for the complete development fixture',
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
