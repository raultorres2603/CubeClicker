/**
 * Expired verification cleanup against real PostgreSQL (T5, AC-16, AC-17, AC-23).
 *
 * The suite applies the consolidated `schema.sql` to a throwaway
 * `postgres:16-alpine` container (Podman or Docker, same helper pattern as
 * `migration-006.test.ts`/`migration-007.test.ts`), seeds a verified and an
 * unverified account plus expired, unexpired and used-unexpired tokens, and runs
 * the scheduler over the shipped `PgVerificationTokenRepository`. It proves that
 * one run removes only the expired row (leaving `users.verified` and `sessions`
 * untouched), that a second run reports `0`, and that two concurrent runs delete
 * each expired row exactly once.
 *
 * The suite skips only when neither container runtime is available; any failure
 * to start an available runtime fails the suite rather than hiding the proof.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  PgVerificationTokenRepository,
  type VerificationTokenDb,
} from '../auth/verification-token-repository.js';
import type { LogFields, LogSink } from '../observability/logging.js';
import { createVerificationCleanupScheduler } from './verification-cleanup.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POSTGRES_IMAGE = 'docker.io/library/postgres:16-alpine';
const schemaSql = readFileSync(path.join(HERE, 'schema.sql'), 'utf8');

const HOUR_MS = 3_600_000;
/** Fixed cleanup instant, so the SQL predicate and the events are exact. */
const NOW = Date.parse('2026-11-24T12:00:00.000Z');

const VERIFIED_USER = '10000000-0000-4000-8000-000000000051';
const UNVERIFIED_USER = '10000000-0000-4000-8000-000000000052';
const SESSION_ID = '20000000-0000-4000-8000-000000000051';
const SESSION_HASH = 'cleanup-proof-session-hash';
const UNEXPIRED_HASH = 'cleanup-token-unexpired';
const USED_HASH = 'cleanup-token-used-unexpired';

type ContainerRuntime = 'podman' | 'docker';

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  fields: LogFields;
}

function createLogRecorder(): { log: LogSink; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    entries,
    log: {
      debug: (event, fields) => entries.push({ level: 'debug', event, fields }),
      info: (event, fields) => entries.push({ level: 'info', event, fields }),
      warn: (event, fields) => entries.push({ level: 'warn', event, fields }),
      error: (event, fields) => entries.push({ level: 'error', event, fields }),
    },
  };
}

function detectContainerRuntime(): ContainerRuntime | null {
  for (const candidate of ['podman', 'docker'] as const) {
    const result = spawnSync(candidate, ['info'], {
      stdio: 'ignore',
      timeout: 10_000,
    });
    if (result.status === 0) {
      return candidate;
    }
  }
  return null;
}

function startPostgres(runtime: ContainerRuntime): {
  connectionString: string;
  stop: () => void;
} {
  const name = `cubeclicker-verification-cleanup-${process.pid}-${Date.now()}`;
  const run = spawnSync(
    runtime,
    [
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      '-e',
      'POSTGRES_USER=cubeclicker',
      '-e',
      'POSTGRES_PASSWORD=cubeclicker',
      '-e',
      'POSTGRES_DB=cubeclicker',
      '-p',
      '127.0.0.1::5432',
      POSTGRES_IMAGE,
    ],
    { encoding: 'utf8', timeout: 120_000 },
  );
  if (run.status !== 0) {
    throw new Error(`failed to start ${POSTGRES_IMAGE}: ${run.stderr}`);
  }

  const stop = (): void => {
    spawnSync(runtime, ['rm', '-f', name], { stdio: 'ignore', timeout: 30_000 });
  };

  try {
    const portResult = spawnSync(runtime, ['port', name, '5432/tcp'], {
      encoding: 'utf8',
      timeout: 15_000,
    });
    if (portResult.status !== 0) {
      throw new Error(`failed to read mapped port: ${portResult.stderr}`);
    }
    const match =
      portResult.stdout.match(/127\.0\.0\.1:(\d+)/) ??
      portResult.stdout.match(/0\.0\.0\.0:(\d+)/) ??
      portResult.stdout.match(/:(\d+)\s*$/m);
    if (match === null) {
      throw new Error(`could not parse mapped port from: ${portResult.stdout}`);
    }
    return {
      connectionString: `postgres://cubeclicker:cubeclicker@127.0.0.1:${match[1]}/cubeclicker`,
      stop,
    };
  } catch (error) {
    stop();
    throw error;
  }
}

async function waitForPostgres(connectionString: string): Promise<Client> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown = new Error('not attempted');
  while (Date.now() < deadline) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query('SELECT 1');
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`PostgreSQL did not become ready: ${String(lastError)}`);
}

const containerRuntime = detectContainerRuntime();
const dbDescribe = containerRuntime === null ? describe.skip : describe;

dbDescribe('expired verification cleanup on PostgreSQL', () => {
  let client: Client;
  let pool: Pool;
  let stopContainer: () => void;
  let repository: PgVerificationTokenRepository;

  beforeAll(async () => {
    const database = startPostgres(containerRuntime as ContainerRuntime);
    stopContainer = database.stop;
    client = await waitForPostgres(database.connectionString);

    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query(schemaSql);

    await client.query(
      `INSERT INTO users (id, username, email, password_hash, verified)
       VALUES ($1, $2, $3, $4, TRUE), ($5, $6, $7, $8, FALSE)`,
      [
        VERIFIED_USER,
        'cleanupverified',
        'cleanupverified@example.test',
        'hash',
        UNVERIFIED_USER,
        'cleanupunverified',
        'cleanupunverified@example.test',
        'hash',
      ],
    );
    await client.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [SESSION_ID, VERIFIED_USER, SESSION_HASH, new Date(NOW + HOUR_MS)],
    );
    await client.query(
      `INSERT INTO verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3), ($4, $5, $6)`,
      [
        VERIFIED_USER,
        'cleanup-token-expired',
        new Date(NOW - 1_000),
        UNVERIFIED_USER,
        UNEXPIRED_HASH,
        new Date(NOW + HOUR_MS),
      ],
    );
    await client.query(
      `INSERT INTO verification_tokens (user_id, token_hash, expires_at, used_at)
       VALUES ($1, $2, $3, $4)`,
      [VERIFIED_USER, USED_HASH, new Date(NOW + HOUR_MS), new Date(NOW - 1_000)],
    );

    pool = new Pool({ connectionString: database.connectionString, max: 4 });
    const db: VerificationTokenDb = {
      async query(text, values) {
        const result = await pool.query(text, values as unknown[]);
        return {
          rows: result.rows as Array<Record<string, unknown>>,
          rowCount: result.rowCount,
        };
      },
    };
    repository = new PgVerificationTokenRepository(db);
  }, 120_000);

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    await client?.end().catch(() => undefined);
    stopContainer?.();
  }, 60_000);

  it('deletes only the expired row, preserving accounts, sessions and the used token', async () => {
    const { log, entries } = createLogRecorder();
    const scheduler = createVerificationCleanupScheduler({
      repository,
      intervalMs: HOUR_MS,
      log,
      now: () => NOW,
    });

    expect(await scheduler.runOnce()).toBe(1);
    expect(entries).toEqual([
      {
        level: 'info',
        event: 'db_verification_cleanup_run',
        fields: { deleted: 1, durationMs: 0 },
      },
    ]);

    const tokens = await client.query<{ token_hash: string; used_at: Date | null }>(
      'SELECT token_hash, used_at FROM verification_tokens ORDER BY token_hash',
    );
    expect(tokens.rows).toEqual([
      { token_hash: UNEXPIRED_HASH, used_at: null },
      { token_hash: USED_HASH, used_at: new Date(NOW - 1_000) },
    ]);

    const users = await client.query<{ id: string; verified: boolean }>(
      'SELECT id, verified FROM users ORDER BY id',
    );
    expect(users.rows).toEqual([
      { id: VERIFIED_USER, verified: true },
      { id: UNVERIFIED_USER, verified: false },
    ]);

    const sessions = await client.query<{
      id: string;
      user_id: string;
      token_hash: string;
    }>('SELECT id, user_id, token_hash FROM sessions ORDER BY id');
    expect(sessions.rows).toEqual([
      { id: SESSION_ID, user_id: VERIFIED_USER, token_hash: SESSION_HASH },
    ]);

    expect(await scheduler.runOnce()).toBe(0);
    expect(entries[1]).toEqual({
      level: 'debug',
      event: 'db_verification_cleanup_run',
      fields: { deleted: 0, durationMs: 0 },
    });
  });

  it('deletes each expired row exactly once across two concurrent runs, then reports zero', async () => {
    const expiredAt = new Date(NOW - 1_000);
    await client.query(
      `INSERT INTO verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3), ($1, $4, $3), ($5, $6, $3)`,
      [
        VERIFIED_USER,
        'cleanup-token-concurrent-a',
        expiredAt,
        'cleanup-token-concurrent-b',
        UNVERIFIED_USER,
        'cleanup-token-concurrent-c',
      ],
    );

    const seed = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM verification_tokens WHERE expires_at <= $1',
      [expiredAt],
    );
    expect(seed.rows[0]).toEqual({ count: 3 });

    const first = createLogRecorder();
    const second = createLogRecorder();
    const schedulerA = createVerificationCleanupScheduler({
      repository,
      intervalMs: HOUR_MS,
      log: first.log,
      now: () => NOW,
    });
    const schedulerB = createVerificationCleanupScheduler({
      repository,
      intervalMs: HOUR_MS,
      log: second.log,
      now: () => NOW,
    });

    const [deletedA, deletedB] = await Promise.all([
      schedulerA.runOnce(),
      schedulerB.runOnce(),
    ]);
    expect(deletedA + deletedB).toBe(3);
    expect([first.entries, second.entries].flat()).toHaveLength(2);

    const remaining = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM verification_tokens',
    );
    expect(remaining.rows[0]).toEqual({ count: 2 });

    expect(await schedulerA.runOnce()).toBe(0);
  });
});
