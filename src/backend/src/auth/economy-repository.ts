/**
 * Economy repository (coin-economy T2, extended for spending-upgrades T2,
 * and spaceship-customization T3).
 *
 * Persists per-user coins and in-game stats (`clicks`, `facesDestroyed`,
 * `cubesDestroyed`) plus upgrade levels (`upgrades` JSONB, migration 003) and
 * spaceship customization (`lootboxes`, `keys`, `parts` JSONB, `appearance`
 * JSONB, migration 005) in the `user_economy` table. Follows the
 * `user-repository.ts` pattern: a `UserDb`-style injected pool, parameterized
 * SQL only, and both an in-memory and a Postgres implementation.
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
import type { PartId } from '../game/parts.js';

export interface EconomyState {
  coins: number;
  clicks: number;
  facesDestroyed: number;
  cubesDestroyed: number;
}

export interface CustomizationState {
  lootboxes: number;
  keys: number;
  parts: Record<string, number>;
  appearance: Record<string, string>;
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
  findLastSeenAt(userId: string): Promise<number | null>;
  touchLastSeen(userId: string, nowMs: number, expectedMs?: number | null): Promise<boolean>;
  findCustomizationByUserId(userId: string): Promise<CustomizationState>;
  grantCustomization(
    userId: string,
    delta: { lootboxes?: number; keys?: number },
  ): Promise<CustomizationState>;
  applyLootboxOpen(
    userId: string,
    partId: PartId,
  ): Promise<
    | { state: CustomizationState }
    | { reason: 'no_lootbox' }
    | { reason: 'no_key' }
  >;
  setAppearance(
    userId: string,
    appearance: Record<string, string>,
  ): Promise<CustomizationState>;
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

const ZERO_CUSTOMIZATION: CustomizationState = {
  lootboxes: 0,
  keys: 0,
  parts: {},
  appearance: {},
};

interface StoredRow {
  economy: EconomyState;
  upgrades: UpgradeState;
  customization: CustomizationState;
  lastSeenAt: number | null;
}

function copyCustomization(state: CustomizationState): CustomizationState {
  const parts: Record<string, number> = {};
  for (const key of Object.keys(state.parts)) {
    parts[key] = state.parts[key] as number;
  }
  const appearance: Record<string, string> = {};
  for (const key of Object.keys(state.appearance)) {
    appearance[key] = state.appearance[key] as string;
  }
  return {
    lootboxes: state.lootboxes,
    keys: state.keys,
    parts,
    appearance,
  };
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
    const customization: CustomizationState = existing
      ? copyCustomization(existing.customization)
      : { ...ZERO_CUSTOMIZATION, parts: {}, appearance: {} };
    const lastSeenAt = existing ? existing.lastSeenAt : null;
    this.store.set(userId, { economy: next, upgrades, customization, lastSeenAt });
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
    this.store.set(userId, {
      economy: nextEconomy,
      upgrades: nextUpgrades,
      customization: copyCustomization(row.customization),
      lastSeenAt: row.lastSeenAt,
    });
    return { economy: { ...nextEconomy }, upgrades: { ...nextUpgrades } };
  }

  async findLastSeenAt(userId: string): Promise<number | null> {
    const row = this.store.get(userId);
    return row ? row.lastSeenAt : null;
  }

  async touchLastSeen(userId: string, nowMs: number, expectedMs?: number | null): Promise<boolean> {
    const row = this.store.get(userId);
    if (expectedMs === undefined) {
      const base = row ?? {
        economy: { ...ZERO },
        upgrades: {},
        customization: { ...ZERO_CUSTOMIZATION, parts: {}, appearance: {} },
        lastSeenAt: null,
      };
      this.store.set(userId, {
        economy: { ...base.economy },
        upgrades: { ...base.upgrades },
        customization: copyCustomization(base.customization),
        lastSeenAt: nowMs,
      });
      return true;
    }
    if (!row) {
      if (expectedMs === null) {
        this.store.set(userId, {
          economy: { ...ZERO },
          upgrades: {},
          customization: { ...ZERO_CUSTOMIZATION, parts: {}, appearance: {} },
          lastSeenAt: nowMs,
        });
        return true;
      }
      return false;
    }
    if ((row.lastSeenAt ?? null) === expectedMs) {
      this.store.set(userId, {
        economy: { ...row.economy },
        upgrades: { ...row.upgrades },
        customization: copyCustomization(row.customization),
        lastSeenAt: nowMs,
      });
      return true;
    }
    return false;
  }

  async findCustomizationByUserId(userId: string): Promise<CustomizationState> {
    const row = this.store.get(userId);
    return row ? copyCustomization(row.customization) : copyCustomization(ZERO_CUSTOMIZATION);
  }

  async grantCustomization(
    userId: string,
    delta: { lootboxes?: number; keys?: number },
  ): Promise<CustomizationState> {
    const existing = this.store.get(userId);
    const baseCustom = existing
      ? copyCustomization(existing.customization)
      : copyCustomization(ZERO_CUSTOMIZATION);
    const nextCustom: CustomizationState = {
      lootboxes: baseCustom.lootboxes + (delta.lootboxes ?? 0),
      keys: baseCustom.keys + (delta.keys ?? 0),
      parts: { ...baseCustom.parts },
      appearance: { ...baseCustom.appearance },
    };
    if (existing) {
      this.store.set(userId, {
        economy: { ...existing.economy },
        upgrades: { ...existing.upgrades },
        customization: copyCustomization(nextCustom),
        lastSeenAt: existing.lastSeenAt,
      });
    } else {
      this.store.set(userId, {
        economy: { ...ZERO },
        upgrades: {},
        customization: copyCustomization(nextCustom),
        lastSeenAt: null,
      });
    }
    return copyCustomization(nextCustom);
  }

  async applyLootboxOpen(
    userId: string,
    partId: PartId,
  ): Promise<
    | { state: CustomizationState }
    | { reason: 'no_lootbox' }
    | { reason: 'no_key' }
  > {
    const existing = this.store.get(userId);
    const baseCustom = existing
      ? copyCustomization(existing.customization)
      : copyCustomization(ZERO_CUSTOMIZATION);
    if (baseCustom.lootboxes <= 0) return { reason: 'no_lootbox' };
    if (baseCustom.keys <= 0) return { reason: 'no_key' };
    const nextParts: Record<string, number> = { ...baseCustom.parts };
    nextParts[partId] = (nextParts[partId] ?? 0) + 1;
    const nextCustom: CustomizationState = {
      lootboxes: baseCustom.lootboxes - 1,
      keys: baseCustom.keys - 1,
      parts: nextParts,
      appearance: { ...baseCustom.appearance },
    };
    if (existing) {
      this.store.set(userId, {
        economy: { ...existing.economy },
        upgrades: { ...existing.upgrades },
        customization: copyCustomization(nextCustom),
        lastSeenAt: existing.lastSeenAt,
      });
    } else {
      this.store.set(userId, {
        economy: { ...ZERO },
        upgrades: {},
        customization: copyCustomization(nextCustom),
        lastSeenAt: null,
      });
    }
    return { state: copyCustomization(nextCustom) };
  }

  async setAppearance(
    userId: string,
    appearance: Record<string, string>,
  ): Promise<CustomizationState> {
    const existing = this.store.get(userId);
    const baseCustom = existing
      ? copyCustomization(existing.customization)
      : copyCustomization(ZERO_CUSTOMIZATION);
    const nextCustom: CustomizationState = {
      lootboxes: baseCustom.lootboxes,
      keys: baseCustom.keys,
      parts: { ...baseCustom.parts },
      appearance: { ...appearance },
    };
    if (existing) {
      this.store.set(userId, {
        economy: { ...existing.economy },
        upgrades: { ...existing.upgrades },
        customization: copyCustomization(nextCustom),
        lastSeenAt: existing.lastSeenAt,
      });
    } else {
      this.store.set(userId, {
        economy: { ...ZERO },
        upgrades: {},
        customization: copyCustomization(nextCustom),
        lastSeenAt: null,
      });
    }
    return copyCustomization(nextCustom);
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

function parseParts(raw: unknown): Record<string, number> {
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
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function parseAppearance(raw: unknown): Record<string, string> {
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
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function rowToCustomization(row: Record<string, unknown>): CustomizationState {
  return {
    lootboxes: Number(row.lootboxes ?? 0),
    keys: Number(row.keys ?? 0),
    parts: parseParts(row.parts),
    appearance: parseAppearance(row.appearance),
  };
}

function toEpochMsOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
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

  async findLastSeenAt(userId: string): Promise<number | null> {
    const result = await this.db.query(
      'SELECT last_seen_at FROM user_economy WHERE user_id = $1',
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return toEpochMsOrNull(row.last_seen_at);
  }

  async touchLastSeen(userId: string, nowMs: number, expectedMs?: number | null): Promise<boolean> {
    if (expectedMs === undefined) {
      await this.db.query(
        `INSERT INTO user_economy (user_id, last_seen_at)
         VALUES ($1, to_timestamp($2 / 1000.0))
         ON CONFLICT (user_id) DO UPDATE SET
           last_seen_at = to_timestamp($2 / 1000.0),
           updated_at = now()`,
        [userId, nowMs],
      );
      return true;
    }
    if (expectedMs === null) {
      const result = await this.db.query(
        `INSERT INTO user_economy (user_id, last_seen_at)
         VALUES ($1, to_timestamp($2 / 1000.0))
         ON CONFLICT (user_id) DO NOTHING
         RETURNING user_id`,
        [userId, nowMs],
      );
      return (result.rows?.length ?? 0) > 0;
    }
    const result = await this.db.query(
      `UPDATE user_economy
       SET last_seen_at = to_timestamp($2 / 1000.0),
           updated_at = now()
       WHERE user_id = $1
         AND last_seen_at = to_timestamp($3 / 1000.0)
       RETURNING user_id`,
      [userId, nowMs, expectedMs],
    );
    return (result.rows?.length ?? 0) > 0;
  }

  async findCustomizationByUserId(userId: string): Promise<CustomizationState> {
    const result = await this.db.query(
      'SELECT lootboxes, keys, parts, appearance FROM user_economy WHERE user_id = $1',
      [userId],
    );
    const row = result.rows[0];
    return row ? rowToCustomization(row) : copyCustomization(ZERO_CUSTOMIZATION);
  }

  async grantCustomization(
    userId: string,
    delta: { lootboxes?: number; keys?: number },
  ): Promise<CustomizationState> {
    const lootboxesDelta = delta.lootboxes ?? 0;
    const keysDelta = delta.keys ?? 0;
    const result = await this.db.query(
      `INSERT INTO user_economy (user_id, lootboxes, keys)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         lootboxes = user_economy.lootboxes + EXCLUDED.lootboxes,
         keys = user_economy.keys + EXCLUDED.keys,
         updated_at = now()
       RETURNING lootboxes, keys, parts, appearance`,
      [userId, lootboxesDelta, keysDelta],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('INSERT/UPDATE returned no row');
    }
    return rowToCustomization(row);
  }

  async applyLootboxOpen(
    userId: string,
    partId: PartId,
  ): Promise<
    | { state: CustomizationState }
    | { reason: 'no_lootbox' }
    | { reason: 'no_key' }
  > {
    const result = await this.db.query(
      `UPDATE user_economy
       SET lootboxes = lootboxes - 1,
           keys = keys - 1,
           parts = jsonb_set(parts, $2::text[], to_jsonb(COALESCE((parts->>$3)::int, 0) + 1)),
           updated_at = now()
       WHERE user_id = $1
         AND lootboxes >= 1
         AND keys >= 1
       RETURNING lootboxes, keys, parts, appearance`,
      [userId, [partId], partId],
    );
    const row = result.rows[0];
    if (row) {
      return { state: rowToCustomization(row) };
    }
    // Determine which condition failed.
    const check = await this.db.query(
      'SELECT lootboxes, keys FROM user_economy WHERE user_id = $1',
      [userId],
    );
    const existing = check.rows[0];
    const lootboxes = existing ? Number(existing.lootboxes ?? 0) : 0;
    if (lootboxes <= 0) return { reason: 'no_lootbox' };
    return { reason: 'no_key' };
  }

  async setAppearance(
    userId: string,
    appearance: Record<string, string>,
  ): Promise<CustomizationState> {
    const result = await this.db.query(
      `UPDATE user_economy
       SET appearance = $2::jsonb,
           updated_at = now()
       WHERE user_id = $1
       RETURNING lootboxes, keys, parts, appearance`,
      [userId, appearance],
    );
    const row = result.rows[0];
    if (row) {
      return rowToCustomization(row);
    }
    // No existing row: upsert a zero row carrying the appearance.
    const inserted = await this.db.query(
      `INSERT INTO user_economy (user_id, appearance)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         appearance = EXCLUDED.appearance,
         updated_at = now()
       RETURNING lootboxes, keys, parts, appearance`,
      [userId, appearance],
    );
    const insertedRow = inserted.rows[0];
    if (!insertedRow) {
      throw new Error('INSERT/UPDATE returned no row');
    }
    return rowToCustomization(insertedRow);
  }
}
