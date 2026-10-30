/**
 * Economy repository (coin-economy T2, extended for spending-upgrades T2).
 *
 * Persists per-user coins and in-game stats (`clicks`, `facesDestroyed`,
 * `cubesDestroyed`) plus upgrade levels (`upgrades` JSONB, migration 003) in
 * the `user_economy` table. Follows the `user-repository.ts` pattern: a
 * `UserDb`-style injected pool, parameterized SQL only, and both an in-memory
 * and a Postgres implementation.
 *
 * `credit` MUST use atomic SQL increments (INSERT ... ON CONFLICT DO UPDATE
 * SET ... = user_economy.<col> + $delta), never read-modify-write, so that
 * concurrent multi-tab credits accumulate without lost updates (F5).
 *
 * `purchaseUpgrade` MUST perform only the conditional UPDATE (no insert/upsert)
 * with a level guard, returning `null` on insufficient funds / stale level /
 * no row, so concurrent multi-tab purchases cannot overdraw or clobber a level
 * increment (F1, F2).
 */

import { roundCoins } from '../game/economy.js';
import type { UpgradeId, UpgradeState } from '../game/upgrades.js';

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
  findUpgradesByUserId(userId: string): Promise<UpgradeState>;
  purchaseUpgrade(
    userId: string,
    upgradeId: UpgradeId,
    cost: number,
    currentLevel: number,
  ): Promise<{ economy: EconomyState; upgrades: UpgradeState } | null>;
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

interface StoredRow {
  economy: EconomyState;
  upgrades: UpgradeState;
}

export class InMemoryEconomyRepository implements EconomyRepository {
  private readonly store = new Map<string, StoredRow>();
  private readonly now: () => number;

  constructor(options: InMemoryEconomyRepositoryOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  async findByUserId(userId: string): Promise<EconomyState | null> {
    const row = this.store.get(userId);
    return row ? { ...row.economy } : null;
  }

  async credit(userId: string, delta: EconomyDelta): Promise<EconomyState> {
    const existing = this.store.get(userId);
    const base = existing?.economy ?? { ...ZERO };
    const next: EconomyState = {
      coins: roundCoins(base.coins + (delta.coins ?? 0)),
      clicks: base.clicks + (delta.clicks ?? 0),
      facesDestroyed: base.facesDestroyed + (delta.facesDestroyed ?? 0),
      cubesDestroyed: base.cubesDestroyed + (delta.cubesDestroyed ?? 0),
    };
    const upgrades: UpgradeState = existing ? { ...existing.upgrades } : {};
    this.store.set(userId, { economy: next, upgrades });
    return { ...next };
  }

  async findUpgradesByUserId(userId: string): Promise<UpgradeState> {
    const row = this.store.get(userId);
    return row ? { ...row.upgrades } : {};
  }

  async purchaseUpgrade(
    userId: string,
    upgradeId: UpgradeId,
    cost: number,
    currentLevel: number,
  ): Promise<{ economy: EconomyState; upgrades: UpgradeState } | null> {
    const row = this.store.get(userId);
    if (!row) return null;
    const economy = row.economy;
    if (economy.coins < cost) return null;
    const storedLevel =
      typeof row.upgrades[upgradeId] === 'number' && Number.isFinite(row.upgrades[upgradeId])
        ? (row.upgrades[upgradeId] as number)
        : 0;
    if (storedLevel !== currentLevel) return null;
    const nextEconomy: EconomyState = {
      ...economy,
      coins: roundCoins(economy.coins - cost),
    };
    const nextUpgrades: UpgradeState = { ...row.upgrades, [upgradeId]: currentLevel + 1 };
    this.store.set(userId, { economy: nextEconomy, upgrades: nextUpgrades });
    return { economy: { ...nextEconomy }, upgrades: { ...nextUpgrades } };
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

function parseUpgrades(raw: unknown): UpgradeState {
  if (raw === null || raw === undefined) return {};
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return {};
  const out: UpgradeState = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
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

  async findUpgradesByUserId(userId: string): Promise<UpgradeState> {
    const result = await this.db.query(
      'SELECT upgrades FROM user_economy WHERE user_id = $1',
      [userId],
    );
    const row = result.rows[0];
    return row ? parseUpgrades(row.upgrades) : {};
  }

  async purchaseUpgrade(
    userId: string,
    upgradeId: UpgradeId,
    cost: number,
    currentLevel: number,
  ): Promise<{ economy: EconomyState; upgrades: UpgradeState } | null> {
    const path = [upgradeId];
    const result = await this.db.query(
      `UPDATE user_economy
       SET coins = coins - $2,
           upgrades = jsonb_set(upgrades, $3::text[], to_jsonb(($4 + 1)::int)),
           updated_at = now()
       WHERE user_id = $1
         AND coins >= $2
         AND COALESCE((upgrades->>'${upgradeId}')::int, 0) = $4
       RETURNING coins, clicks, faces_destroyed, cubes_destroyed, upgrades`,
      [userId, cost, path, currentLevel],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      economy: rowToEconomy(row),
      upgrades: parseUpgrades(row.upgrades),
    };
  }
}