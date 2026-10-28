/**
 * Economy repository (coin-economy T2).
 *
 * Persists per-user coins and in-game stats (`clicks`, `facesDestroyed`,
 * `cubesDestroyed`) in the `user_economy` table (migration 002). Follows the
 * `user-repository.ts` pattern: a `UserDb`-style injected pool, parameterized
 * SQL only, and both an in-memory and a Postgres implementation.
 *
 * `credit` MUST use atomic SQL increments (INSERT ... ON CONFLICT DO UPDATE
 * SET ... = user_economy.<col> + $delta), never read-modify-write, so that
 * concurrent multi-tab credits accumulate without lost updates (F5).
 */

import { roundCoins } from '../game/economy.js';

export interface EconomyState {
  coins: number;
  clicks: number;
  facesDestroyed: number;
  cubesDestroyed: number;
}

export type EconomyDelta = Partial<EconomyState>;

export interface EconomyDb {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}

export interface EconomyRepository {
  findByUserId(userId: string): Promise<EconomyState | null>;
  credit(userId: string, delta: EconomyDelta): Promise<EconomyState>;
}

export interface InMemoryEconomyRepositoryOptions {
  now?: () => number;
}

const ZERO: EconomyState = {
  coins: 0,
  clicks: 0,
  facesDestroyed: 0,
  cubesDestroyed: 0,
};

export class InMemoryEconomyRepository implements EconomyRepository {
  private readonly store = new Map<string, EconomyState>();
  private readonly now: () => number;

  constructor(options: InMemoryEconomyRepositoryOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  async findByUserId(userId: string): Promise<EconomyState | null> {
    const value = this.store.get(userId);
    return value ? { ...value } : null;
  }

  async credit(userId: string, delta: EconomyDelta): Promise<EconomyState> {
    const existing = this.store.get(userId) ?? { ...ZERO };
    const next: EconomyState = {
      coins: roundCoins(existing.coins + (delta.coins ?? 0)),
      clicks: existing.clicks + (delta.clicks ?? 0),
      facesDestroyed: existing.facesDestroyed + (delta.facesDestroyed ?? 0),
      cubesDestroyed: existing.cubesDestroyed + (delta.cubesDestroyed ?? 0),
    };
    this.store.set(userId, next);
    return { ...next };
  }
}

export interface PgEconomyRepositoryOptions {
  now?: () => number;
}

function rowToEconomy(row: Record<string, unknown>): EconomyState {
  return {
    coins: Number(row.coins ?? 0),
    clicks: Number(row.clicks ?? 0),
    facesDestroyed: Number(row.faces_destroyed ?? 0),
    cubesDestroyed: Number(row.cubes_destroyed ?? 0),
  };
}

export class PgEconomyRepository implements EconomyRepository {
  private readonly db: EconomyDb;
  private readonly now: () => number;

  constructor(db: EconomyDb, options: PgEconomyRepositoryOptions = {}) {
    this.db = db;
    this.now = options.now ?? (() => Date.now());
  }

  async findByUserId(userId: string): Promise<EconomyState | null> {
    const result = await this.db.query(
      'SELECT coins, clicks, faces_destroyed, cubes_destroyed FROM user_economy WHERE user_id = $1',
      [userId],
    );
    const row = result.rows[0];
    return row ? rowToEconomy(row) : null;
  }

  async credit(userId: string, delta: EconomyDelta): Promise<EconomyState> {
    const coinsDelta = delta.coins ?? 0;
    const clicksDelta = delta.clicks ?? 0;
    const facesDelta = delta.facesDestroyed ?? 0;
    const cubesDelta = delta.cubesDestroyed ?? 0;
    const result = await this.db.query(
      `INSERT INTO user_economy (user_id, coins, clicks, faces_destroyed, cubes_destroyed)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         coins = user_economy.coins + EXCLUDED.coins,
         clicks = user_economy.clicks + EXCLUDED.clicks,
         faces_destroyed = user_economy.faces_destroyed + EXCLUDED.faces_destroyed,
         cubes_destroyed = user_economy.cubes_destroyed + EXCLUDED.cubes_destroyed,
         updated_at = now()
       RETURNING coins, clicks, faces_destroyed, cubes_destroyed`,
      [userId, coinsDelta, clicksDelta, facesDelta, cubesDelta],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('INSERT/UPDATE returned no row');
    }
    return rowToEconomy(row);
  }
}