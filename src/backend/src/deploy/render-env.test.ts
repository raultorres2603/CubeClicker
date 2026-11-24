import { describe, expect, it } from 'vitest';

import {
  BLOCKED_RENDER_FREE_SMTP_PORTS,
  buildEnvVarPayload,
  CATALOG,
  formatGuardFailure,
  formatSmtpPortFailure,
  isPlaceholder,
  LOCAL_MAILPIT_PORT,
  PLACEHOLDER_TOKEN,
  redactValues,
  RENDER_FREE_SMTP_PORT,
  renderEnvVarUrl,
  RENDER_REQUEST_TIMEOUT_MS,
  RENDER_WIRING,
  SMTP_CATALOG,
  syncRenderEnv,
  validateDeployEnv,
  validateSmtpTransportPort,
  type DeployEnvFailure,
  type DeployEnvValidation,
  type FetchLike,
  type FetchResponseLike,
  type SmtpPortFailure,
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

const ALL_KEYS = [...SMTP_KEYS, 'RENDER_SERVICE_ID', 'RENDER_API_KEY'] as const;

const SMTP_VALUES: SmtpValues = {
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_PORT: '587',
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
  '{"value":"587"}',
  '{"value":"false"}',
  '{"value":"10000"}',
  '{"value":"CubeClicker <no-reply@example.com>"}',
  '{"value":"smtp-login@example.com"}',
  '{"value":"smtp-pass-value"}',
];

const EXPECTED_SYNCED = [...SMTP_KEYS];

function expectFailure(result: DeployEnvValidation): DeployEnvFailure {
  if (result.ok) {
    throw new Error('expected the fixture to fail validation');
  }
  return result;
}

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

function createFakeFetch(
  respond: (
    call: RecordedCall,
    index: number,
  ) => FetchResponseLike | Promise<FetchResponseLike>,
) {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const call: RecordedCall = { url, init };
    calls.push(call);
    return respond(call, calls.length - 1);
  };
  return { fetchImpl, calls };
}

function createHarness(
  respond: (
    call: RecordedCall,
    index: number,
  ) => FetchResponseLike | Promise<FetchResponseLike> = echo,
) {
  const { fetchImpl, calls } = createFakeFetch(respond);
  const lines: string[] = [];
  const log = (line: string): void => {
    lines.push(line);
  };
  return { fetchImpl, calls, lines, log };
}

describe('deployment catalog (AC-2)', () => {
  it('pins the seven SMTP names in order with their GitHub classification', () => {
    expect(SMTP_CATALOG).toStrictEqual([
      { key: 'SMTP_HOST', source: 'variable' },
      { key: 'SMTP_PORT', source: 'variable' },
      { key: 'SMTP_SECURE', source: 'variable' },
      { key: 'SMTP_CONNECTION_TIMEOUT_MS', source: 'variable' },
      { key: 'SMTP_FROM', source: 'variable' },
      { key: 'SMTP_USER', source: 'secret' },
      { key: 'SMTP_PASS', source: 'secret' },
    ]);
    expect(SMTP_CATALOG).toHaveLength(7);
    expect(SMTP_CATALOG.map((entry) => entry.key)).toStrictEqual([...SMTP_KEYS]);
  });

  it('pins the two Render-wiring names and the nine-name validation catalog', () => {
    expect(RENDER_WIRING).toStrictEqual([
      { key: 'RENDER_SERVICE_ID', source: 'variable' },
      { key: 'RENDER_API_KEY', source: 'secret' },
    ]);
    expect(RENDER_WIRING).toHaveLength(2);
    expect(CATALOG).toHaveLength(9);
    expect(CATALOG).toStrictEqual([
      { key: 'SMTP_HOST', source: 'variable' },
      { key: 'SMTP_PORT', source: 'variable' },
      { key: 'SMTP_SECURE', source: 'variable' },
      { key: 'SMTP_CONNECTION_TIMEOUT_MS', source: 'variable' },
      { key: 'SMTP_FROM', source: 'variable' },
      { key: 'SMTP_USER', source: 'secret' },
      { key: 'SMTP_PASS', source: 'secret' },
      { key: 'RENDER_SERVICE_ID', source: 'variable' },
      { key: 'RENDER_API_KEY', source: 'secret' },
    ]);
    expect(CATALOG.map((entry) => entry.key)).toStrictEqual([...ALL_KEYS]);
  });

  it('pins the CHANGEME sentinel and the 10000ms request timeout', () => {
    expect(PLACEHOLDER_TOKEN).toBe('CHANGEME');
    expect(RENDER_REQUEST_TIMEOUT_MS).toBe(10_000);
  });
});

describe('isPlaceholder (AC-3)', () => {
  it('is true exactly when the value contains the literal CHANGEME', () => {
    expect(isPlaceholder('<CHANGEME-verified-sender>')).toBe(true);
    expect(isPlaceholder('CHANGEME')).toBe(true);
    expect(isPlaceholder('prefix-CHANGEME-suffix')).toBe(true);
    expect(isPlaceholder('smtp-relay.brevo.com')).toBe(false);
    expect(isPlaceholder('changeme')).toBe(false);
    expect(isPlaceholder('')).toBe(false);
  });
});

describe('validateDeployEnv (AC-3)', () => {
  it('classifies the pinned development placeholders in catalog order', () => {
    expect(validateDeployEnv(DEVELOPMENT_PLACEHOLDER_ENV)).toStrictEqual({
      ok: false,
      missing: [],
      placeholders: ['SMTP_FROM', 'SMTP_USER', 'SMTP_PASS', 'RENDER_API_KEY'],
    });
  });

  it('classifies the pinned production placeholders in catalog order', () => {
    expect(validateDeployEnv(PRODUCTION_PLACEHOLDER_ENV)).toStrictEqual({
      ok: false,
      missing: [],
      placeholders: [
        'SMTP_FROM',
        'SMTP_USER',
        'SMTP_PASS',
        'RENDER_SERVICE_ID',
        'RENDER_API_KEY',
      ],
    });
  });

  it('reports every name missing for an empty environment', () => {
    expect(validateDeployEnv({})).toStrictEqual({
      ok: false,
      missing: [...ALL_KEYS],
      placeholders: [],
    });
  });

  it('reports whitespace-only values as missing while preserving list order', () => {
    const mixed = {
      ...COMPLETE_ENV,
      SMTP_HOST: '   ',
      SMTP_PORT: '<CHANGEME-port>',
      SMTP_SECURE: '',
      SMTP_FROM: '  <CHANGEME-sender>  ',
    };

    expect(validateDeployEnv(mixed)).toStrictEqual({
      ok: false,
      missing: ['SMTP_HOST', 'SMTP_SECURE'],
      placeholders: ['SMTP_PORT', 'SMTP_FROM'],
    });
  });

  it('returns all nine values only when every name is real', () => {
    expect(validateDeployEnv(COMPLETE_ENV)).toStrictEqual({
      ok: true,
      values: {
        SMTP_HOST: 'smtp-relay.brevo.com',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_CONNECTION_TIMEOUT_MS: '10000',
        SMTP_FROM: 'CubeClicker <no-reply@example.com>',
        SMTP_USER: 'smtp-login@example.com',
        SMTP_PASS: 'smtp-pass-value',
        RENDER_SERVICE_ID: 'srv-dbtcvv9srm7s73au5bag',
        RENDER_API_KEY: API_KEY,
      },
    });
  });
});

describe('formatGuardFailure (AC-4)', () => {
  it('renders the exact production placeholder block', () => {
    const result = expectFailure(validateDeployEnv(PRODUCTION_PLACEHOLDER_ENV));

    expect(formatGuardFailure('production', result)).toBe(
      [
        "Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).",
        '  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY',
        'Remediation (names only; never paste a value into a command argument):',
        '  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker',
        '  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker',
        'Runbook: README.md § Deployment Brevo runbook',
      ].join('\n'),
    );
  });

  it('prints Missing before Placeholder when both kinds exist', () => {
    const both = {
      ...COMPLETE_ENV,
      SMTP_HOST: ' ',
      SMTP_FROM: '<CHANGEME-verified-sender>',
    };
    const result = expectFailure(validateDeployEnv(both));

    expect(formatGuardFailure('development', result)).toBe(
      [
        "Deploy blocked: the 'development' environment has 2 unset or placeholder value(s).",
        '  Missing: SMTP_HOST',
        '  Placeholder: SMTP_FROM',
        'Remediation (names only; never paste a value into a command argument):',
        '  variables: gh variable set <NAME> --env development --repo raultorres2603/CubeClicker',
        '  secrets:   gh secret set <NAME> --env development --repo raultorres2603/CubeClicker',
        'Runbook: README.md § Deployment Brevo runbook',
      ].join('\n'),
    );
  });

  it('omits the Placeholder line when only names are missing', () => {
    const result: DeployEnvFailure = {
      ok: false,
      missing: ['SMTP_HOST', 'RENDER_API_KEY'],
      placeholders: [],
    };

    expect(formatGuardFailure('production', result)).toBe(
      [
        "Deploy blocked: the 'production' environment has 2 unset or placeholder value(s).",
        '  Missing: SMTP_HOST, RENDER_API_KEY',
        'Remediation (names only; never paste a value into a command argument):',
        '  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker',
        '  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker',
        'Runbook: README.md § Deployment Brevo runbook',
      ].join('\n'),
    );
  });
});

describe('validateSmtpTransportPort (AC-1(a))', () => {
  /** Development environment holding only the two transport names. */
  function developmentEnv(
    port?: string,
    secure?: string,
  ): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = {
      TARGET_ENVIRONMENT: 'development',
    };
    if (port !== undefined) {
      env.SMTP_PORT = port;
    }
    if (secure !== undefined) {
      env.SMTP_SECURE = secure;
    }
    return env;
  }

  it('pins the Render-free blocklist, the local Mailpit port and the STARTTLS port', () => {
    expect(BLOCKED_RENDER_FREE_SMTP_PORTS).toStrictEqual([25, 465, 587]);
    expect(LOCAL_MAILPIT_PORT).toBe(1025);
    expect(RENDER_FREE_SMTP_PORT).toBe(2525);
  });

  it('rejects the three Render-free blocked ports', () => {
    for (const [raw, port] of [
      ['25', 25],
      ['465', 465],
      ['587', 587],
    ] as const) {
      expect(validateSmtpTransportPort(developmentEnv(raw, 'false'))).toStrictEqual({
        ok: false,
        reason: 'render_free_blocked',
        port,
      });
    }
  });

  it('rejects every non-integer or out-of-range port with the untouched raw input', () => {
    for (const raw of ['0', '65536', '-1', '587abc', '25.5', ' 2525']) {
      expect(validateSmtpTransportPort(developmentEnv(raw, 'false'))).toStrictEqual({
        ok: false,
        reason: 'invalid_port',
        raw,
      });
    }
  });

  it('rejects the local Mailpit port', () => {
    expect(validateSmtpTransportPort(developmentEnv('1025', 'false'))).toStrictEqual({
      ok: false,
      reason: 'local_port',
      port: 1025,
    });
  });

  it('accepts 2525 with an unset, empty, false or 0 SMTP_SECURE', () => {
    for (const secure of [undefined, '', 'false', '0']) {
      expect(
        validateSmtpTransportPort(developmentEnv('2525', secure)),
      ).toStrictEqual({ ok: true });
    }
  });

  it('requires STARTTLS on 2525 and keeps the raw SMTP_SECURE value', () => {
    for (const secure of ['true', '1', 'yes']) {
      expect(
        validateSmtpTransportPort(developmentEnv('2525', secure)),
      ).toStrictEqual({ ok: false, reason: 'starttls_required', value: secure });
    }
  });

  it('leaves presence and CHANGEME to the catalog', () => {
    expect(validateSmtpTransportPort(developmentEnv())).toStrictEqual({ ok: true });
    expect(validateSmtpTransportPort(developmentEnv('', 'true'))).toStrictEqual({
      ok: true,
    });
    expect(validateSmtpTransportPort(developmentEnv('CHANGEME', 'true'))).toStrictEqual({
      ok: true,
    });
  });

  it('accepts the inclusive 1-65535 boundaries and other non-blocked ports', () => {
    for (const port of ['1', '65535', '2465']) {
      expect(
        validateSmtpTransportPort(developmentEnv(port, 'false')),
      ).toStrictEqual({ ok: true });
    }
  });

  it('passes every port in production and in an unlabelled environment', () => {
    for (const port of ['25', '1025', '587abc', '2525']) {
      expect(
        validateSmtpTransportPort({
          TARGET_ENVIRONMENT: 'production',
          SMTP_PORT: port,
          SMTP_SECURE: 'true',
        }),
      ).toStrictEqual({ ok: true });
    }
    expect(validateSmtpTransportPort({ SMTP_PORT: '587' })).toStrictEqual({
      ok: true,
    });
  });
});

describe('formatSmtpPortFailure (AC-1(b))', () => {
  it('renders the exact blocked-port block naming the port', () => {
    const failure: SmtpPortFailure = {
      ok: false,
      reason: 'render_free_blocked',
      port: 587,
    };

    expect(formatSmtpPortFailure('development', failure)).toBe(
      [
        "Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment).",
        '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS); ports 25, 465 and 587 stay blocked on Render free.',
        '  Runbook: README.md § Deployment Brevo runbook',
      ].join('\n'),
    );
  });

  it('renders the equivalent first line for 25 and 465', () => {
    for (const port of [25, 465]) {
      const failure: SmtpPortFailure = {
        ok: false,
        reason: 'render_free_blocked',
        port,
      };

      expect(formatSmtpPortFailure('development', failure)).toBe(
        [
          `Deploy blocked: SMTP_PORT=${port} is blocked for outbound SMTP on the Render free plan ('development' environment).`,
          '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS); ports 25, 465 and 587 stay blocked on Render free.',
          '  Runbook: README.md § Deployment Brevo runbook',
        ].join('\n'),
      );
    }
  });

  it('renders the exact malformed-port block quoting the raw value', () => {
    const failure: SmtpPortFailure = {
      ok: false,
      reason: 'invalid_port',
      raw: '587abc',
    };

    expect(formatSmtpPortFailure('development', failure)).toBe(
      [
        'Deploy blocked: SMTP_PORT="587abc" must be an integer between 1 and 65535 (\'development\' environment).',
        '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS) on Render free.',
        '  Runbook: README.md § Deployment Brevo runbook',
      ].join('\n'),
    );
  });

  it('renders the exact local Mailpit block', () => {
    const failure: SmtpPortFailure = {
      ok: false,
      reason: 'local_port',
      port: 1025,
    };

    expect(formatSmtpPortFailure('development', failure)).toBe(
      [
        "Deploy blocked: SMTP_PORT=1025 is the local Mailpit port and is not reachable from a deployed Render service ('development' environment).",
        '  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS).',
        '  Runbook: README.md § Deployment Brevo runbook',
      ].join('\n'),
    );
  });

  it('renders the exact STARTTLS block echoing the raw SMTP_SECURE value', () => {
    const failure: SmtpPortFailure = {
      ok: false,
      reason: 'starttls_required',
      value: 'true',
    };

    expect(formatSmtpPortFailure('development', failure)).toBe(
      [
        'Deploy blocked: SMTP_SECURE must be "false" when SMTP_PORT=2525 (\'development\' environment); received "true".',
        '  Port 2525 uses STARTTLS; set SMTP_SECURE=false.',
        '  Runbook: README.md § Deployment Brevo runbook',
      ].join('\n'),
    );
  });
});

describe('renderEnvVarUrl (AC-5)', () => {
  it('builds the pinned per-key Render URL', () => {
    expect(renderEnvVarUrl(SERVICE_ID, 'SMTP_HOST')).toBe(
      'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/SMTP_HOST',
    );
    expect(renderEnvVarUrl(SERVICE_ID, 'SMTP_PASS')).toBe(
      'https://api.render.com/v1/services/srv-dbtcvv9srm7s73au5bag/env-vars/SMTP_PASS',
    );
  });
});

describe('buildEnvVarPayload (AC-5)', () => {
  it('JSON-encodes exactly one value field', () => {
    expect(buildEnvVarPayload('smtp-relay.brevo.com')).toBe(
      '{"value":"smtp-relay.brevo.com"}',
    );
  });

  it('escapes quotes and backslashes without adding fields', () => {
    expect(buildEnvVarPayload('say "hi" \\ done')).toBe(
      '{"value":"say \\"hi\\" \\\\ done"}',
    );
  });
});

describe('redactValues (AC-5(c), AC-9)', () => {
  it('replaces every configured value', () => {
    expect(
      redactValues(
        'login smtp-login@example.com with smtp-pass-value',
        [SMTP_VALUES.SMTP_USER, SMTP_VALUES.SMTP_PASS],
      ),
    ).toBe('login [redacted] with [redacted]');
  });

  it('replaces longest values first so no suffix survives', () => {
    expect(redactValues('abcdef', ['abc', 'abcdef'])).toBe('[redacted]');
    expect(redactValues('abcdef', ['abcdef', 'abc'])).toBe('[redacted]');
  });

  it('replaces values shorter than four characters too', () => {
    expect(redactValues('port 587 secure false', ['587', 'false'])).toBe(
      'port [redacted] secure [redacted]',
    );
  });

  it('ignores empty configured values', () => {
    expect(redactValues('clean message', [''])).toBe('clean message');
  });

  it('redacts rnd_-shaped tokens, Render key assignments and Brevo key shapes', () => {
    const renderToken = 'rnd_' + 'a'.repeat(24);
    const renderAssignment = 'RENDER_API_KEY=' + 'b'.repeat(16);
    const restKey = 'xkeysib-' + 'c'.repeat(20);
    const smtpKey = 'xsmtpsib-' + 'd'.repeat(15);

    expect(
      redactValues(
        `token ${renderToken} using ${renderAssignment} then ${restKey} and ${smtpKey}`,
        [],
      ),
    ).toBe(
      'token [redacted] using RENDER_API_KEY=[redacted] then [redacted] and [redacted]',
    );
  });
});

describe('syncRenderEnv success (AC-5)', () => {
  it('sends exactly seven PUTs in catalog order with the pinned URL, headers and body', async () => {
    const { fetchImpl, calls, lines, log } = createHarness();

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

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
    }
    expect(calls.map((call) => call.init.body)).toStrictEqual(EXPECTED_BODIES);

    expect(result).toStrictEqual({ synced: EXPECTED_SYNCED });
    expect(lines).toStrictEqual([
      'SYNCED SMTP_HOST (value verified, not shown)',
      'SYNCED SMTP_PORT (value verified, not shown)',
      'SYNCED SMTP_SECURE (value verified, not shown)',
      'SYNCED SMTP_CONNECTION_TIMEOUT_MS (value verified, not shown)',
      'SYNCED SMTP_FROM (value verified, not shown)',
      'SYNCED SMTP_USER (value verified, not shown)',
      'SYNCED SMTP_PASS (value verified, not shown)',
      "Synced 7 value(s) to Render service srv-dbtcvv9srm7s73au5bag for the 'development' environment.",
    ]);
  });

  it('never writes either wiring name and keeps the service id and key out of every body', async () => {
    const { fetchImpl, calls, log } = createHarness();

    await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    for (const call of calls) {
      expect(call.init.body).not.toContain('RENDER_SERVICE_ID');
      expect(call.init.body).not.toContain('RENDER_API_KEY');
      expect(call.init.body).not.toContain(SERVICE_ID);
      expect(call.init.body).not.toContain(API_KEY);
      expect(call.url).not.toContain(API_KEY);
      expect(call.url).toBe(
        `https://api.render.com/v1/services/${SERVICE_ID}/env-vars/${keyFromUrl(call.url)}`,
      );
    }
    expect(calls).toHaveLength(7);
  });

  it('ignores a stray RENDER_API_KEY property on the sync payload', async () => {
    const smtpValuesWithStray = {
      ...SMTP_VALUES,
      RENDER_API_KEY: 'stray-api-key-value',
    };
    const { fetchImpl, calls, lines, log } = createHarness();

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: smtpValuesWithStray,
      fetchImpl,
      log,
    });

    expect(calls).toHaveLength(7);
    expect(calls.map((call) => call.init.body)).toStrictEqual(EXPECTED_BODIES);
    for (const call of calls) {
      expect(call.init.body).not.toContain('RENDER_API_KEY');
      expect(call.init.body).not.toContain('stray-api-key-value');
    }
    expect(result).toStrictEqual({ synced: EXPECTED_SYNCED });
    expect(lines.at(-1)).toBe(
      "Synced 7 value(s) to Render service srv-dbtcvv9srm7s73au5bag for the 'unknown' environment.",
    );
  });
});

describe('syncRenderEnv failures (AC-5)', () => {
  it('stops on the first non-2xx response and prints the Render code only', async () => {
    const { fetchImpl, calls, lines, log } = createHarness((call, index) => {
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

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    expect(calls.map((call) => call.url)).toStrictEqual(
      EXPECTED_URLS.slice(0, 2),
    );
    expect(lines).toStrictEqual([
      'SYNCED SMTP_HOST (value verified, not shown)',
      'Render API error for SMTP_PORT: HTTP 403 (insufficient_token_scope)',
    ]);
    expect(lines.join('\n')).not.toContain('do not print this body');
    expect(result).toStrictEqual({ synced: ['SMTP_HOST'] });
  });

  it('reports an unparseable error body as an unknown code and prints no body text', async () => {
    const { fetchImpl, calls, lines, log } = createHarness(() => ({
      ok: false,
      status: 500,
      text: async () => `upstream exploded with ${SMTP_VALUES.SMTP_PASS}`,
    }));

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API error for SMTP_HOST: HTTP 500 (unknown)',
    ]);
    expect(lines.join('\n')).not.toContain(SMTP_VALUES.SMTP_PASS);
    expect(result).toStrictEqual({ synced: [] });
  });

  it('maps a timeout rejection to the pinned 10000ms line', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    const { fetchImpl, calls, lines, log } = createHarness(() =>
      Promise.reject(timeoutError),
    );

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API request for SMTP_HOST timed out after 10000ms',
    ]);
    expect(result).toStrictEqual({ synced: [] });
  });

  it('redacts every configured value and the Render key shape in a transport rejection', async () => {
    const shapedToken = 'rnd_' + 'z'.repeat(24);
    const rejection = new Error(
      `send failed for ${SMTP_VALUES.SMTP_USER} via ${SMTP_VALUES.SMTP_HOST} ` +
        `key ${API_KEY} token ${shapedToken}`,
    );
    const { fetchImpl, calls, lines, log } = createHarness(() =>
      Promise.reject(rejection),
    );

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API request for SMTP_HOST failed: send failed for [redacted] via [redacted] key [redacted] token [redacted]',
    ]);
    const output = lines.join('\n');
    expect(output).not.toContain(SMTP_VALUES.SMTP_USER);
    expect(output).not.toContain(SMTP_VALUES.SMTP_HOST);
    expect(output).not.toContain(API_KEY);
    expect(output).not.toContain(shapedToken);
    expect(result).toStrictEqual({ synced: [] });
  });

  it('sanitizes a non-Error rejection value', async () => {
    const { fetchImpl, calls, lines, log } = createHarness(() =>
      Promise.reject('connection reset by peer'),
    );

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API request for SMTP_HOST failed: connection reset by peer',
    ]);
    expect(result).toStrictEqual({ synced: [] });
  });

  it('aborts when the echoed value differs from the sent value', async () => {
    const { fetchImpl, calls, lines, log } = createHarness((call) => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ key: keyFromUrl(call.url), value: 'tampered-value' }),
    }));

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API returned a different value for SMTP_HOST; aborting',
    ]);
    expect(result).toStrictEqual({ synced: [] });
  });

  it('aborts when the echoed key differs from the sent key', async () => {
    const { fetchImpl, calls, lines, log } = createHarness(() => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ key: 'SMTP_PORT', value: SMTP_VALUES.SMTP_HOST }),
    }));

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API returned a different value for SMTP_HOST; aborting',
    ]);
    expect(result).toStrictEqual({ synced: [] });
  });

  it('treats an unparseable 2xx echo as an unverified write', async () => {
    const { fetchImpl, calls, lines, log } = createHarness(() => ({
      ok: true,
      status: 200,
      text: async () => 'not-json',
    }));

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API returned a different value for SMTP_HOST; aborting',
    ]);
    expect(result).toStrictEqual({ synced: [] });
  });

  it('treats a non-object 2xx echo as an unverified write', async () => {
    const { fetchImpl, calls, lines, log } = createHarness(() => ({
      ok: true,
      status: 200,
      text: async () => 'null',
    }));

    const result = await syncRenderEnv({
      serviceId: SERVICE_ID,
      apiKey: API_KEY,
      smtpValues: SMTP_VALUES,
      environment: ENVIRONMENT,
      fetchImpl,
      log,
    });

    expect(calls).toHaveLength(1);
    expect(lines).toStrictEqual([
      'Render API returned a different value for SMTP_HOST; aborting',
    ]);
    expect(result).toStrictEqual({ synced: [] });
  });
});
