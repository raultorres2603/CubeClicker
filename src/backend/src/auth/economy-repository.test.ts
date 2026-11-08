import { spawnSync } from 'node:child_process';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  InMemoryEconomyRepository,
  PgEconomyRepository,
  type EconomyDb,
  type EconomyState,
} from './economy-repository.js';
import type { UpgradeState } from '../game/upgrades.js';
import type { PartId } from '../game/parts.js';

const FIXED_USER = '11111111-2222-3333-4444-555555555555';

/** The AC-33 fixture: a restored version-2 row that still carries legacy ids. */
const LEGACY_ROW = {
  lootboxes: 3,
  keys: 2,
  parts: { 'wings-silver': 2, 'engine-blue': 1, 'body-gold': 1 },
  appearance: { wings: 'wings-silver', engine: 'engine-blue', body: 'body-gold' },
  customization_version: 2,
};

const LEGACY_STATE = {
  lootboxes: 3,
  keys: 2,
  parts: {
    'hull-gold': 1,
    'wing-left-silver': 2,
    'wing-right-silver': 2,
    'ignition-left-blue': 1,
    'ignition-right-blue': 1,
  },
  appearance: {
    hull: 'hull-gold',
    'wing-left': 'wing-left-silver',
    'wing-right': 'wing-right-silver',
    'ignition-left': 'ignition-left-blue',
    'ignition-right': 'ignition-right-blue',
  },
};

function sampleState(overrides: Partial<EconomyState> = {}): EconomyState {
  return {
    coins: 12.34,
    clicks: 7,
    facesDestroyed: 3,
    cubesDestroyed: 2,
    ...overrides,
  };
}

function rowFor(state: EconomyState): Record<string, unknown> {
  return {
    coins: state.coins,
    clicks: state.clicks,
    faces_destroyed: state.facesDestroyed,
    cubes_destroyed: state.cubesDestroyed,
  };
}

describe('InMemoryEconomyRepository', () => {
  it('findByUserId returns null for unknown user', async () => {
    const repo = new InMemoryEconomyRepository();
    expect(await repo.findByUserId('nope')).toBeNull();
  });

  it('credit creates a new row (upsert) and returns the state', async () => {
    const repo = new InMemoryEconomyRepository();
    const result = await repo.credit(FIXED_USER, {
      coins: 0.1,
      clicks: 1,
      facesDestroyed: 1,
      cubesDestroyed: 0,
    });
    expect(result).toEqual({
      coins: 0.1,
      clicks: 1,
      facesDestroyed: 1,
      cubesDestroyed: 0,
    });
    const found = await repo.findByUserId(FIXED_USER);
    expect(found).toEqual(result);
  });

  it('credit accumulates across multiple calls', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 0.1, clicks: 1 });
    const second = await repo.credit(FIXED_USER, { coins: 0.1, clicks: 1 });
    expect(second).toEqual({
      coins: 0.2,
      clicks: 2,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
  });

  it('credit treats missing delta fields as zero', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 5 });
    const result = await repo.credit(FIXED_USER, { clicks: 3 });
    expect(result).toEqual({
      coins: 5,
      clicks: 3,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
  });

  it('credit rounds coins to 2 decimals', async () => {
    const repo = new InMemoryEconomyRepository();
    const result = await repo.credit(FIXED_USER, { coins: 0.1 + 0.2 });
    expect(result.coins).toBe(0.3);
  });

  it('credit accumulates cubesDestroyed', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { cubesDestroyed: 1 });
    const result = await repo.credit(FIXED_USER, { cubesDestroyed: 1 });
    expect(result.cubesDestroyed).toBe(2);
  });

  it('two concurrent credits accumulate (no lost update)', async () => {
    const repo = new InMemoryEconomyRepository();
    await Promise.all([
      repo.credit(FIXED_USER, { coins: 0.1, clicks: 1 }),
      repo.credit(FIXED_USER, { coins: 0.1, clicks: 1 }),
    ]);
    const found = await repo.findByUserId(FIXED_USER);
    expect(found).toEqual({
      coins: 0.2,
      clicks: 2,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
  });

  it('findByUserId returns a copy, not the internal reference', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 1 });
    const found = await repo.findByUserId(FIXED_USER);
    if (found) found.coins = 999;
    const found2 = await repo.findByUserId(FIXED_USER);
    expect(found2?.coins).toBe(1);
  });

  it('credit returns a copy, not the internal reference', async () => {
    const repo = new InMemoryEconomyRepository();
    const result = await repo.credit(FIXED_USER, { coins: 1 });
    result.coins = 999;
    const found = await repo.findByUserId(FIXED_USER);
    expect(found?.coins).toBe(1);
  });

  it('credit with zero delta on unknown user creates a zero row', async () => {
    const repo = new InMemoryEconomyRepository();
    const result = await repo.credit(FIXED_USER, {});
    expect(result).toEqual({
      coins: 0,
      clicks: 0,
      facesDestroyed: 0,
      cubesDestroyed: 0,
    });
  });
});

describe('PgEconomyRepository', () => {
  function makeDb(handler: (text: string, values?: unknown[]) => unknown): EconomyDb & {
    calls: Array<{ text: string; values?: unknown[] }>;
  } {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const db = {
      calls,
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values });
        const result = handler(text, values);
        if (result instanceof Error) throw result;
        return result as { rows: Array<Record<string, unknown>>; rowCount?: number | null };
      },
    };
    return db;
  }

  it('findByUserId issues SELECT ... WHERE user_id = $1 with bound id', async () => {
    const state = sampleState();
    const db = makeDb(() => ({ rows: [rowFor(state)], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    const found = await repo.findByUserId(FIXED_USER);
    expect(found).toEqual(state);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toContain('FROM user_economy');
    expect(db.calls[0].text).toContain('WHERE user_id = $1');
    expect(db.calls[0].values).toEqual([FIXED_USER]);
  });

  it('findByUserId returns null when no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.findByUserId('missing')).toBeNull();
  });

  it('credit issues an atomic upsert with user_economy.coins + EXCLUDED.coins', async () => {
    const state = sampleState();
    const db = makeDb(() => ({ rows: [rowFor(state)], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    const result = await repo.credit(FIXED_USER, {
      coins: 0.1,
      clicks: 1,
      facesDestroyed: 1,
      cubesDestroyed: 0,
    });
    expect(result).toEqual(state);
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('INSERT INTO user_economy');
    expect(call.text).toContain('ON CONFLICT (user_id)');
    expect(call.text).toContain('DO UPDATE SET');
    expect(call.text).toContain('coins = user_economy.coins + EXCLUDED.coins');
    expect(call.text).toContain('clicks = user_economy.clicks + EXCLUDED.clicks');
    expect(call.text).toContain('faces_destroyed = user_economy.faces_destroyed + EXCLUDED.faces_destroyed');
    expect(call.text).toContain('cubes_destroyed = user_economy.cubes_destroyed + EXCLUDED.cubes_destroyed');
    expect(call.text).toContain('RETURNING');
    expect(call.values).toEqual([FIXED_USER, 0.1, 1, 1, 0]);
  });

  it('credit maps a NUMERIC string row to a number', async () => {
    const db = makeDb(() => ({
      rows: [
        {
          coins: '12.34',
          clicks: '7',
          faces_destroyed: '3',
          cubes_destroyed: '2',
        },
      ],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);
    const result = await repo.credit(FIXED_USER, { coins: 0.1 });
    expect(result).toEqual({
      coins: 12.34,
      clicks: 7,
      facesDestroyed: 3,
      cubesDestroyed: 2,
    });
  });

  it('credit treats missing delta fields as zero', async () => {
    const db = makeDb(() => ({
      rows: [rowFor(sampleState({ coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 }))],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);
    await repo.credit(FIXED_USER, {});
    const call = db.calls[0];
    expect(call.values).toEqual([FIXED_USER, 0, 0, 0, 0]);
  });

  it('credit throws when INSERT/UPDATE returns no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    await expect(repo.credit(FIXED_USER, { coins: 1 })).rejects.toThrow(
      'INSERT/UPDATE returned no row',
    );
  });

  it('credit rethrows db errors unchanged', async () => {
    const err = new Error('connection lost');
    const db = makeDb(() => {
      throw err;
    });
    const repo = new PgEconomyRepository(db);
    await expect(repo.credit(FIXED_USER, { coins: 1 })).rejects.toBe(err);
  });
});

describe('InMemoryEconomyRepository upgrades', () => {
  it('findUpgradesByUserId returns {} for unknown user', async () => {
    const repo = new InMemoryEconomyRepository();
    expect(await repo.findUpgradesByUserId('nope')).toEqual({});
  });

  it('findUpgradesByUserId returns a copy, not the internal reference', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 20 });
    await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    const found = await repo.findUpgradesByUserId(FIXED_USER);
    expect(found).toEqual({ mini_cube_value: 1 });
    found.mini_cube_value = 999;
    const found2 = await repo.findUpgradesByUserId(FIXED_USER);
    expect(found2).toEqual({ mini_cube_value: 1 });
  });

  it('purchaseUpgrade succeeds and debits coins + increments level', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 20 });
    const result = await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    expect(result).toEqual({
      economy: { coins: 10, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
      upgrades: { mini_cube_value: 1 },
    });
    const found = await repo.findByUserId(FIXED_USER);
    expect(found?.coins).toBe(10);
    const ups = await repo.findUpgradesByUserId(FIXED_USER);
    expect(ups).toEqual({ mini_cube_value: 1 });
  });

  it('purchaseUpgrade returns null on insufficient funds and mutates nothing', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 5 });
    const result = await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    expect(result).toBeNull();
    const found = await repo.findByUserId(FIXED_USER);
    expect(found?.coins).toBe(5);
    const ups = await repo.findUpgradesByUserId(FIXED_USER);
    expect(ups).toEqual({});
  });

  it('purchaseUpgrade returns null on stale level and mutates nothing', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 50 });
    await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    const result = await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    expect(result).toBeNull();
    const ups = await repo.findUpgradesByUserId(FIXED_USER);
    expect(ups).toEqual({ mini_cube_value: 1 });
    const found = await repo.findByUserId(FIXED_USER);
    expect(found?.coins).toBe(40);
  });

  it('purchaseUpgrade returns null when no row exists (no row creation)', async () => {
    const repo = new InMemoryEconomyRepository();
    const result = await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    expect(result).toBeNull();
    expect(await repo.findByUserId(FIXED_USER)).toBeNull();
    expect(await repo.findUpgradesByUserId(FIXED_USER)).toEqual({});
  });

  it('purchaseUpgrade preserves other upgrades and stats', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 100, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 });
    await repo.purchaseUpgrade(FIXED_USER, 'cube_value', 50, 0);
    const result = await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    expect(result).not.toBeNull();
    expect(result!.upgrades).toEqual({ cube_value: 1, mini_cube_value: 1 });
    expect(result!.economy).toEqual({
      coins: 40,
      clicks: 3,
      facesDestroyed: 2,
      cubesDestroyed: 1,
    });
  });

  it('purchaseUpgrade rounds debited coins to 2 decimals', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 5.55 });
    const result = await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 0.55, 0);
    expect(result).not.toBeNull();
    expect(result!.economy.coins).toBe(5);
  });
});

describe('PgEconomyRepository upgrades', () => {
  function makeDb(handler: (text: string, values?: unknown[]) => unknown) {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const db = {
      calls,
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values });
        const result = handler(text, values);
        if (result instanceof Error) throw result;
        return result as { rows: Array<Record<string, unknown>>; rowCount?: number | null };
      },
    };
    return db;
  }

  function rowWith(state: EconomyState, upgrades: UpgradeState): Record<string, unknown> {
    return {
      coins: state.coins,
      clicks: state.clicks,
      faces_destroyed: state.facesDestroyed,
      cubes_destroyed: state.cubesDestroyed,
      upgrades,
    };
  }

  it('findUpgradesByUserId issues SELECT upgrades ... WHERE user_id = $1', async () => {
    const db = makeDb(() => ({ rows: [{ upgrades: { mini_cube_value: 2 } }], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    const found = await repo.findUpgradesByUserId(FIXED_USER);
    expect(found).toEqual({ mini_cube_value: 2 });
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toContain('FROM user_economy');
    expect(db.calls[0].text).toContain('WHERE user_id = $1');
    expect(db.calls[0].values).toEqual([FIXED_USER]);
  });

  it('findUpgradesByUserId returns {} when no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.findUpgradesByUserId('missing')).toEqual({});
  });

  it('findUpgradesByUserId parses a JSON string row', async () => {
    const db = makeDb(() => ({ rows: [{ upgrades: '{"cube_value":3}' }], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.findUpgradesByUserId(FIXED_USER)).toEqual({ cube_value: 3 });
  });

  it('findUpgradesByUserId returns {} when upgrades is null', async () => {
    const db = makeDb(() => ({ rows: [{ upgrades: null }], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.findUpgradesByUserId(FIXED_USER)).toEqual({});
  });

  it('purchaseUpgrade issues conditional UPDATE with level guard and returns parsed row', async () => {
    const state = sampleState();
    const ups: UpgradeState = { mini_cube_value: 1 };
    const db = makeDb(() => ({ rows: [rowWith(state, ups)], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    const result = await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    expect(result).toEqual({ economy: state, upgrades: ups });
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('UPDATE user_economy');
    expect(call.text).toContain('SET coins = coins -');
    expect(call.text).toContain('jsonb_set(upgrades');
    expect(call.text).toContain('updated_at = now()');
    expect(call.text).toContain('WHERE user_id = $1');
    expect(call.text).toContain('coins >=');
    expect(call.text).toContain("COALESCE((upgrades->>'mini_cube_value')::int, 0)");
    expect(call.text).toContain('RETURNING');
    expect(call.values).toEqual([FIXED_USER, 10, ['mini_cube_value'], 0]);
  });

  it('purchaseUpgrade returns null when no row (insufficient funds / stale level / missing)', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0)).toBeNull();
  });

  it('purchaseUpgrade maps NUMERIC/BIGINT string row to numbers', async () => {
    const db = makeDb(() => ({
      rows: [
        {
          coins: '12.34',
          clicks: '7',
          faces_destroyed: '3',
          cubes_destroyed: '2',
          upgrades: { mini_cube_value: 1 },
        },
      ],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);
    const result = await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    expect(result).toEqual({
      economy: { coins: 12.34, clicks: 7, facesDestroyed: 3, cubesDestroyed: 2 },
      upgrades: { mini_cube_value: 1 },
    });
  });

  it('purchaseUpgrade rethrows db errors unchanged', async () => {
    const err = new Error('connection lost');
    const db = makeDb(() => {
      throw err;
    });
    const repo = new PgEconomyRepository(db);
    await expect(repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0)).rejects.toBe(err);
  });
});

describe('InMemoryEconomyRepository last-seen', () => {
  const NOW = 1_700_000_000_000;

  it('findLastSeenAt returns null for unknown user', async () => {
    const repo = new InMemoryEconomyRepository();
    expect(await repo.findLastSeenAt('nope')).toBeNull();
  });

  it('touchLastSeen unconditional upserts a row and sets lastSeenAt', async () => {
    const repo = new InMemoryEconomyRepository();
    expect(await repo.touchLastSeen(FIXED_USER, NOW)).toBe(true);
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(NOW);
    const econ = await repo.findByUserId(FIXED_USER);
    expect(econ).toEqual({ coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 });
  });

  it('touchLastSeen unconditional updates an existing row lastSeenAt', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.touchLastSeen(FIXED_USER, NOW);
    const later = NOW + 5000;
    expect(await repo.touchLastSeen(FIXED_USER, later)).toBe(true);
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(later);
  });

  it('touchLastSeen with expectedMs null inserts when no row exists', async () => {
    const repo = new InMemoryEconomyRepository();
    expect(await repo.touchLastSeen(FIXED_USER, NOW, null)).toBe(true);
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(NOW);
  });

  it('touchLastSeen CAS wins when expectedMs matches', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.touchLastSeen(FIXED_USER, NOW);
    const later = NOW + 1000;
    expect(await repo.touchLastSeen(FIXED_USER, later, NOW)).toBe(true);
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(later);
  });

  it('touchLastSeen CAS loses when expectedMs mismatches', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.touchLastSeen(FIXED_USER, NOW);
    const before = await repo.findLastSeenAt(FIXED_USER);
    expect(await repo.touchLastSeen(FIXED_USER, NOW + 1, 42)).toBe(false);
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(before);
  });

  it('touchLastSeen expectedMs null loses when row already exists', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.touchLastSeen(FIXED_USER, NOW);
    const before = await repo.findLastSeenAt(FIXED_USER);
    expect(await repo.touchLastSeen(FIXED_USER, NOW + 1, null)).toBe(false);
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(before);
  });

  it('credit preserves lastSeenAt', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.touchLastSeen(FIXED_USER, NOW);
    await repo.credit(FIXED_USER, { coins: 5, clicks: 2 });
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(NOW);
  });

  it('credit on a new row leaves lastSeenAt null', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(FIXED_USER, { coins: 1 });
    expect(await repo.findLastSeenAt(FIXED_USER)).toBeNull();
  });

  it('purchaseUpgrade preserves lastSeenAt', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.touchLastSeen(FIXED_USER, NOW);
    await repo.credit(FIXED_USER, { coins: 20 });
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(NOW);
    const result = await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    expect(result).not.toBeNull();
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(NOW);
  });
});

describe('PgEconomyRepository last-seen', () => {
  function makeDb(handler: (text: string, values?: unknown[]) => unknown): EconomyDb & {
    calls: Array<{ text: string; values?: unknown[] }>;
  } {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const db = {
      calls,
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values });
        const result = handler(text, values);
        if (result instanceof Error) throw result;
        return result as { rows: Array<Record<string, unknown>>; rowCount?: number | null };
      },
    };
    return db;
  }

  function rowWith(state: EconomyState, upgrades: UpgradeState): Record<string, unknown> {
    return {
      coins: state.coins,
      clicks: state.clicks,
      faces_destroyed: state.facesDestroyed,
      cubes_destroyed: state.cubesDestroyed,
      upgrades,
    };
  }

  const NOW = 1_700_000_000_000;
  const TS = new Date(NOW).toISOString();

  it('findLastSeenAt issues SELECT last_seen_at ... WHERE user_id = $1', async () => {
    const db = makeDb(() => ({ rows: [{ last_seen_at: new Date(NOW) }], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    const found = await repo.findLastSeenAt(FIXED_USER);
    expect(found).toBe(NOW);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toContain('SELECT last_seen_at');
    expect(db.calls[0].text).toContain('FROM user_economy');
    expect(db.calls[0].text).toContain('WHERE user_id = $1');
    expect(db.calls[0].values).toEqual([FIXED_USER]);
  });

  it('findLastSeenAt returns null when no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.findLastSeenAt('missing')).toBeNull();
  });

  it('findLastSeenAt returns null when last_seen_at is null', async () => {
    const db = makeDb(() => ({ rows: [{ last_seen_at: null }], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.findLastSeenAt(FIXED_USER)).toBeNull();
  });

  it('findLastSeenAt parses an ISO string row', async () => {
    const db = makeDb(() => ({ rows: [{ last_seen_at: TS }], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.findLastSeenAt(FIXED_USER)).toBe(NOW);
  });

  it('touchLastSeen unconditional (expectedMs undefined) upserts and returns true', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.touchLastSeen(FIXED_USER, NOW)).toBe(true);
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('INSERT INTO user_economy');
    expect(call.text).toContain('ON CONFLICT (user_id)');
    expect(call.text).toContain('to_timestamp');
    expect(call.values).toEqual([FIXED_USER, NOW]);
  });

  it('touchLastSeen expectedMs null inserts-only and returns true when inserted', async () => {
    const db = makeDb(() => ({ rows: [{ user_id: FIXED_USER }], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.touchLastSeen(FIXED_USER, NOW, null)).toBe(true);
    const call = db.calls[0];
    expect(call.text).toContain('INSERT INTO user_economy');
    expect(call.text).toContain('ON CONFLICT (user_id) DO NOTHING');
    expect(call.text).toContain('RETURNING');
    expect(call.values).toEqual([FIXED_USER, NOW]);
  });

  it('touchLastSeen expectedMs null returns false when row exists (no insert)', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.touchLastSeen(FIXED_USER, NOW, null)).toBe(false);
  });

  it('touchLastSeen CAS returns true when a row is updated', async () => {
    const db = makeDb(() => ({ rows: [{ user_id: FIXED_USER }], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.touchLastSeen(FIXED_USER, NOW + 1, NOW)).toBe(true);
    const call = db.calls[0];
    expect(call.text).toContain('UPDATE user_economy');
    expect(call.text).toContain('SET last_seen_at = to_timestamp');
    expect(call.text).toContain('WHERE user_id = $1');
    expect(call.text).toContain('last_seen_at = to_timestamp');
    expect(call.text).toContain('RETURNING');
    expect(call.values).toEqual([FIXED_USER, NOW + 1, NOW]);
  });

  it('touchLastSeen CAS returns false when no row updated', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.touchLastSeen(FIXED_USER, NOW + 1, NOW)).toBe(false);
  });

  it('credit does not touch last_seen_at', async () => {
    const state = sampleState();
    const db = makeDb(() => ({ rows: [rowFor(state)], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    await repo.credit(FIXED_USER, { coins: 0.1 });
    const call = db.calls[0];
    expect(call.text).not.toContain('last_seen_at');
  });

  it('purchaseUpgrade does not touch last_seen_at', async () => {
    const state = sampleState();
    const ups: UpgradeState = { mini_cube_value: 1 };
    const db = makeDb(() => ({ rows: [rowWith(state, ups)], rowCount: 1 }));
    const repo = new PgEconomyRepository(db);
    await repo.purchaseUpgrade(FIXED_USER, 'mini_cube_value', 10, 0);
    const call = db.calls[0];
    expect(call.text).not.toContain('last_seen_at');
  });

  it('touchLastSeen rethrows db errors unchanged', async () => {
    const err = new Error('connection lost');
    const db = makeDb(() => {
      throw err;
    });
    const repo = new PgEconomyRepository(db);
    await expect(repo.touchLastSeen(FIXED_USER, NOW)).rejects.toBe(err);
  });
});
describe('InMemoryEconomyRepository customization', () => {
  it('findCustomizationByUserId returns default zero state for unknown user', async () => {
    const repo = new InMemoryEconomyRepository();
    const found = await repo.findCustomizationByUserId('nope');
    expect(found).toEqual({ lootboxes: 0, keys: 0, parts: {}, appearance: {} });
  });

  it('grantCustomization increments lootboxes and keys', async () => {
    const repo = new InMemoryEconomyRepository();
    const result = await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 1 });
    expect(result).toEqual({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });
    const found = await repo.findCustomizationByUserId(FIXED_USER);
    expect(found).toEqual({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });
  });

  it('applyLootboxOpen success decrements and adds part', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 1 });
    const result = await repo.applyLootboxOpen(FIXED_USER, 'nose-crimson');
    expect(result).toEqual({
      state: { lootboxes: 0, keys: 0, parts: { 'nose-crimson': 1 }, appearance: {} },
    });
  });

  it('applyLootboxOpen returns no_lootbox first when both zero', async () => {
    const repo = new InMemoryEconomyRepository();
    const result = await repo.applyLootboxOpen(FIXED_USER, 'nose-crimson');
    expect(result).toEqual({ reason: 'no_lootbox' });
  });

  it('applyLootboxOpen returns no_key when lootboxes sufficient but no key', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 0 });
    const result = await repo.applyLootboxOpen(FIXED_USER, 'nose-crimson');
    expect(result).toEqual({ reason: 'no_key' });
  });

  it('setAppearance updates appearance', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 1 });
    const result = await repo.setAppearance(FIXED_USER, { nose: 'nose-crimson' });
    expect(result).toEqual({ lootboxes: 1, keys: 1, parts: {}, appearance: { nose: 'nose-crimson' } });
  });

  it('credit preserves customization', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 2, keys: 1 });
    await repo.credit(FIXED_USER, { coins: 5 });
    const found = await repo.findCustomizationByUserId(FIXED_USER);
    expect(found).toEqual({ lootboxes: 2, keys: 1, parts: {}, appearance: {} });
  });
});

describe('PgEconomyRepository customization', () => {
  function makeDb(handler: (text: string, values?: unknown[]) => unknown) {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const db = {
      calls,
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values });
        const result = handler(text, values);
        if (result instanceof Error) throw result;
        return result as { rows: Array<Record<string, unknown>>; rowCount?: number | null };
      },
    };
    return db;
  }

  it('findCustomizationByUserId issues SELECT ... WHERE user_id = $1', async () => {
    const db = makeDb(() => ({
      rows: [{ lootboxes: 2, keys: 1, parts: { 'nose-crimson': 1 }, appearance: { nose: 'nose-crimson' } }],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);
    const found = await repo.findCustomizationByUserId(FIXED_USER);
    expect(found).toEqual({ lootboxes: 2, keys: 1, parts: { 'nose-crimson': 1 }, appearance: { nose: 'nose-crimson' } });
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toContain('FROM user_economy');
    expect(db.calls[0].text).toContain('WHERE user_id = $1');
    expect(db.calls[0].values).toEqual([FIXED_USER]);
  });

  it('findCustomizationByUserId returns default zero state when no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({ lootboxes: 0, keys: 0, parts: {}, appearance: {} });
  });

  it('grantCustomization issues upsert and returns parsed row', async () => {
    const db = makeDb(() => ({
      rows: [{ lootboxes: 1, keys: 1, parts: {}, appearance: {} }],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);
    const result = await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 1 });
    expect(result).toEqual({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('INSERT INTO user_economy');
    expect(call.text).toContain('ON CONFLICT (user_id)');
    expect(call.text).toContain('lootboxes = user_economy.lootboxes + EXCLUDED.lootboxes');
    expect(call.text).toContain('keys = user_economy.keys + EXCLUDED.keys');
    expect(call.values).toEqual([FIXED_USER, 1, 1]);
  });

  it('applyLootboxOpen success issues conditional UPDATE', async () => {
    const db = makeDb(() => ({
      rows: [{ lootboxes: 0, keys: 0, parts: { 'nose-crimson': 1 }, appearance: {} }],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);
    const result = await repo.applyLootboxOpen(FIXED_USER, 'nose-crimson');
    expect(result).toEqual({ state: { lootboxes: 0, keys: 0, parts: { 'nose-crimson': 1 }, appearance: {} } });
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('UPDATE user_economy');
    expect(call.text).toContain('jsonb_set(parts');
    expect(call.values).toEqual([FIXED_USER, ['nose-crimson'], 'nose-crimson']);
  });

  it('applyLootboxOpen returns no_lootbox when count zero', async () => {
    const db = makeDb((text) => {
      if (text.includes('UPDATE')) return { rows: [], rowCount: 0 };
      return { rows: [{ lootboxes: 0, keys: 1 }], rowCount: 1 };
    });
    const repo = new PgEconomyRepository(db);
    expect(await repo.applyLootboxOpen(FIXED_USER, 'nose-crimson')).toEqual({ reason: 'no_lootbox' });
  });

  it('applyLootboxOpen returns no_key when keys zero', async () => {
    const db = makeDb((text) => {
      if (text.includes('UPDATE')) return { rows: [], rowCount: 0 };
      return { rows: [{ lootboxes: 1, keys: 0 }], rowCount: 1 };
    });
    const repo = new PgEconomyRepository(db);
    expect(await repo.applyLootboxOpen(FIXED_USER, 'nose-crimson')).toEqual({ reason: 'no_key' });
  });

  it('setAppearance issues UPDATE and returns parsed row', async () => {
    const db = makeDb(() => ({
      rows: [{ lootboxes: 1, keys: 1, parts: {}, appearance: { nose: 'nose-crimson' } }],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);
    const result = await repo.setAppearance(FIXED_USER, { nose: 'nose-crimson' });
    expect(result).toEqual({ lootboxes: 1, keys: 1, parts: {}, appearance: { nose: 'nose-crimson' } });
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('UPDATE user_economy');
    expect(call.text).toContain('SET appearance');
    expect(call.values).toEqual([FIXED_USER, { nose: 'nose-crimson' }]);
  });
});

describe('customization read normalization (T4)', () => {
  it('in-memory read normalizes the AC-33 legacy fixture regardless of version', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 5, keys: 5 });
    await repo.setAppearance(FIXED_USER, {
      wings: 'wings-silver',
      engine: 'engine-blue',
      body: 'body-gold',
    });
    await repo.applyLootboxOpen(FIXED_USER, 'wings-silver' as PartId);
    await repo.applyLootboxOpen(FIXED_USER, 'wings-silver' as PartId);
    await repo.applyLootboxOpen(FIXED_USER, 'engine-blue' as PartId);
    await repo.applyLootboxOpen(FIXED_USER, 'body-gold' as PartId);

    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 1,
      keys: 1,
      parts: LEGACY_STATE.parts,
      appearance: LEGACY_STATE.appearance,
    });
  });

  it('in-memory read drops unknown ids, mismatched slots and unknown appearance keys', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 1 });
    await repo.applyLootboxOpen(FIXED_USER, 'mystery' as unknown as PartId);
    await repo.setAppearance(FIXED_USER, {
      hull: 'wing-left-silver',
      wings: 'wings-silver',
      bogus: 'hull-gold',
      nose: 'not-a-part',
    });

    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {
        'wing-left': 'wing-left-silver',
        'wing-right': 'wing-right-silver',
      },
    });
  });

  it('in-memory grant returns a normalized state (legacy appearance)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.setAppearance(FIXED_USER, { wings: 'wings-silver' });
    expect(await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 1 })).toEqual({
      lootboxes: 1,
      keys: 1,
      parts: {},
      appearance: {
        'wing-left': 'wing-left-silver',
        'wing-right': 'wing-right-silver',
      },
    });
  });

  it('pg read normalizes a restored version-2 row with legacy ids (AC-33)', async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const db = {
      calls,
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values });
        return { rows: [LEGACY_ROW], rowCount: 1 };
      },
    };
    const repo = new PgEconomyRepository(db);
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual(LEGACY_STATE);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toContain('SELECT lootboxes, keys, parts, appearance');
    expect(db.calls[0].text).toContain('FROM user_economy');
    expect(db.calls[0].text).toContain('WHERE user_id = $1');
    expect(db.calls[0].values).toEqual([FIXED_USER]);
  });

  it('pg read normalizes a version-1 row and drops invalid entries', async () => {
    const db = {
      async query() {
        return {
          rows: [
            {
              lootboxes: 0,
              keys: 0,
              parts: { 'hull-gold': 1, mystery: 4 },
              appearance: { hull: 'hull-gold', nose: 'wing-left-silver' },
              customization_version: 1,
            },
          ],
          rowCount: 1,
        };
      },
    };
    const repo = new PgEconomyRepository(db);
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-gold': 1 },
      appearance: { hull: 'hull-gold' },
    });
  });

  it('pg read tolerates malformed parts/appearance JSON', async () => {
    const db = {
      async query() {
        return {
          rows: [{ lootboxes: 1, keys: 1, parts: '{"hull-', appearance: 'not json' }],
          rowCount: 1,
        };
      },
    };
    const repo = new PgEconomyRepository(db);
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 1,
      keys: 1,
      parts: {},
      appearance: {},
    });
  });

  it('pg read drops non-numeric, negative, fractional, overflowing and array values', async () => {
    const db = {
      async query() {
        return {
          rows: [
            {
              lootboxes: 0,
              keys: 0,
              parts: {
                'hull-gold': 1,
                'hull-obsidian': -1,
                'nose-crimson': 1.5,
                'nose-emerald': 2_147_483_648,
                'cockpit-amber': '3',
                'cockpit-oracle': null,
                'wing-left-gold': true,
              },
              appearance: { hull: 'hull-gold', nose: 4, cockpit: null, bogus: 'hull-gold' },
              customization_version: 2,
            },
          ],
          rowCount: 1,
        };
      },
    };
    const repo = new PgEconomyRepository(db);
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-gold': 1 },
      appearance: { hull: 'hull-gold' },
    });
  });

  it('pg read returns a defensive copy of the nested maps', async () => {
    const db = {
      async query() {
        return { rows: [LEGACY_ROW], rowCount: 1 };
      },
    };
    const repo = new PgEconomyRepository(db);
    const first = await repo.findCustomizationByUserId(FIXED_USER);
    first.parts['hull-gold'] = 99;
    first.appearance.hull = 'hull-default';
    const second = await repo.findCustomizationByUserId(FIXED_USER);
    expect(second).toEqual(LEGACY_STATE);
  });

  it('pg grantCustomization normalizes a legacy row on return', async () => {
    const db = {
      async query() {
        return {
          rows: [
            {
              lootboxes: 1,
              keys: 1,
              parts: { 'wings-silver': 2 },
              appearance: { wings: 'wings-silver' },
            },
          ],
          rowCount: 1,
        };
      },
    };
    const repo = new PgEconomyRepository(db);
    expect(await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 1 })).toEqual({
      lootboxes: 1,
      keys: 1,
      parts: { 'wing-left-silver': 2, 'wing-right-silver': 2 },
      appearance: {
        'wing-left': 'wing-left-silver',
        'wing-right': 'wing-right-silver',
      },
    });
  });
});

describe('InMemoryEconomyRepository v2 lootbox/appearance', () => {
  it('applyLootboxOpenV2 reports duplicate false then true and increments the owned count', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 2, keys: 2 });

    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'hull-obsidian')).toEqual({
      state: { lootboxes: 1, keys: 1, parts: { 'hull-obsidian': 1 }, appearance: {} },
      duplicate: false,
    });
    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'hull-obsidian')).toEqual({
      state: { lootboxes: 0, keys: 0, parts: { 'hull-obsidian': 2 }, appearance: {} },
      duplicate: true,
    });
  });

  it('applyLootboxOpenV2 never lets counts go negative', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 1 });
    await repo.applyLootboxOpenV2(FIXED_USER, 'nose-crimson');

    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'nose-crimson')).toEqual({
      reason: 'no_lootbox',
    });
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1 },
      appearance: {},
    });
  });

  it('applyLootboxOpenV2 returns no_lootbox first when both counts are zero', async () => {
    const repo = new InMemoryEconomyRepository();
    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'nose-crimson')).toEqual({
      reason: 'no_lootbox',
    });
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
  });

  it('applyLootboxOpenV2 returns no_key when lootboxes exist but keys do not', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 2, keys: 0 });
    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'nose-crimson')).toEqual({
      reason: 'no_key',
    });
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 2,
      keys: 0,
      parts: {},
      appearance: {},
    });
  });

  it('applyLootboxOpenV2 returns a defensive copy', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 1, keys: 1 });
    const result = await repo.applyLootboxOpenV2(FIXED_USER, 'hull-obsidian');
    expect(result).toEqual({
      state: { lootboxes: 0, keys: 0, parts: { 'hull-obsidian': 1 }, appearance: {} },
      duplicate: false,
    });
    if (!('state' in result)) throw new Error('expected a granted state');
    result.state.parts['hull-obsidian'] = 99;
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
  });

  it('setSlotAppearance sets one slot and preserves the others', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization(FIXED_USER, { lootboxes: 3, keys: 2 });
    await repo.setAppearance(FIXED_USER, { nose: 'nose-crimson' });

    expect(await repo.setSlotAppearance(FIXED_USER, 'hull', 'hull-gold')).toEqual({
      lootboxes: 3,
      keys: 2,
      parts: {},
      appearance: { nose: 'nose-crimson', hull: 'hull-gold' },
    });
    expect((await repo.findCustomizationByUserId(FIXED_USER)).appearance).toEqual({
      nose: 'nose-crimson',
      hull: 'hull-gold',
    });
  });

  it('setSlotAppearance(null) deletes exactly one slot', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.setAppearance(FIXED_USER, {
      nose: 'nose-crimson',
      hull: 'hull-gold',
    });
    expect(await repo.setSlotAppearance(FIXED_USER, 'hull', null)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: { nose: 'nose-crimson' },
    });
    expect((await repo.findCustomizationByUserId(FIXED_USER)).appearance).toEqual({
      nose: 'nose-crimson',
    });
  });

  it('setSlotAppearance upserts a zero row when the user has none', async () => {
    const repo = new InMemoryEconomyRepository();
    expect(await repo.setSlotAppearance(FIXED_USER, 'hull', 'hull-gold')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: { hull: 'hull-gold' },
    });
    expect(await repo.findCustomizationByUserId(FIXED_USER)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: { hull: 'hull-gold' },
    });
  });

  it('setSlotAppearance(null) on a missing row creates an empty zero row', async () => {
    const repo = new InMemoryEconomyRepository();
    expect(await repo.setSlotAppearance(FIXED_USER, 'hull', null)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
  });
});

describe('PgEconomyRepository v2 lootbox/appearance', () => {
  function makeDb(handler: (text: string, values?: unknown[]) => unknown): EconomyDb & {
    calls: Array<{ text: string; values?: unknown[] }>;
  } {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const db = {
      calls,
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values });
        const result = handler(text, values);
        if (result instanceof Error) throw result;
        return result as { rows: Array<Record<string, unknown>>; rowCount?: number | null };
      },
    };
    return db;
  }

  it('applyLootboxOpenV2 issues one conditional atomic UPDATE and reports a new part', async () => {
    const db = makeDb(() => ({
      rows: [
        {
          lootboxes: 2,
          keys: 0,
          parts: { 'hull-obsidian': 1 },
          appearance: {},
          duplicate: false,
        },
      ],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);

    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'hull-obsidian')).toEqual({
      state: { lootboxes: 2, keys: 0, parts: { 'hull-obsidian': 1 }, appearance: {} },
      duplicate: false,
    });
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('UPDATE user_economy e');
    expect(call.text).toContain('lootboxes = e.lootboxes - 1');
    expect(call.text).toContain('keys = e.keys - 1');
    expect(call.text).toContain('jsonb_set(e.parts');
    expect(call.text).toContain('COALESCE((e.parts->>$3)::int, 0) + 1');
    expect(call.text).toContain('FOR UPDATE');
    expect(call.text).toContain('t.previous_parts ? $3 AS duplicate');
    expect(call.text).toContain('WHERE user_id = $1');
    expect(call.text).toContain('lootboxes >= 1');
    expect(call.text).toContain('keys >= 1');
    expect(call.values).toEqual([FIXED_USER, ['hull-obsidian'], 'hull-obsidian']);
  });

  it('applyLootboxOpenV2 reports a duplicate from the returned row', async () => {
    const db = makeDb(() => ({
      rows: [
        {
          lootboxes: 0,
          keys: 0,
          parts: { 'hull-obsidian': 2 },
          appearance: {},
          duplicate: true,
        },
      ],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'hull-obsidian')).toEqual({
      state: { lootboxes: 0, keys: 0, parts: { 'hull-obsidian': 2 }, appearance: {} },
      duplicate: true,
    });
  });

  it('applyLootboxOpenV2 returns no_lootbox first using the fallback SELECT', async () => {
    const db = makeDb((text) => {
      if (text.includes('FOR UPDATE')) return { rows: [], rowCount: 0 };
      return { rows: [{ lootboxes: 0, keys: 3 }], rowCount: 1 };
    });
    const repo = new PgEconomyRepository(db);

    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'hull-obsidian')).toEqual({
      reason: 'no_lootbox',
    });
    expect(db.calls).toHaveLength(2);
    expect(db.calls[1].text).toContain('SELECT lootboxes, keys');
    expect(db.calls[1].values).toEqual([FIXED_USER]);
  });

  it('applyLootboxOpenV2 returns no_key after the update misses', async () => {
    const db = makeDb((text) => {
      if (text.includes('FOR UPDATE')) return { rows: [], rowCount: 0 };
      return { rows: [{ lootboxes: 2, keys: 0 }], rowCount: 1 };
    });
    const repo = new PgEconomyRepository(db);
    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'hull-obsidian')).toEqual({
      reason: 'no_key',
    });
  });

  it('applyLootboxOpenV2 treats a missing row as no_lootbox', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    expect(await repo.applyLootboxOpenV2(FIXED_USER, 'hull-obsidian')).toEqual({
      reason: 'no_lootbox',
    });
  });

  it('setSlotAppearance sets one slot with an atomic jsonb_set UPDATE', async () => {
    const db = makeDb(() => ({
      rows: [
        {
          lootboxes: 1,
          keys: 2,
          parts: {},
          appearance: { nose: 'nose-crimson', hull: 'hull-gold' },
        },
      ],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);

    expect(await repo.setSlotAppearance(FIXED_USER, 'hull', 'hull-gold')).toEqual({
      lootboxes: 1,
      keys: 2,
      parts: {},
      appearance: { nose: 'nose-crimson', hull: 'hull-gold' },
    });
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('UPDATE user_economy');
    expect(call.text).toContain(
      'jsonb_set(appearance, ARRAY[$2::text], to_jsonb($3::text))',
    );
    expect(call.text).toContain('WHERE user_id = $1');
    expect(call.values).toEqual([FIXED_USER, 'hull', 'hull-gold']);
  });

  it('setSlotAppearance(null) deletes one slot with the jsonb minus operator', async () => {
    const db = makeDb(() => ({
      rows: [
        {
          lootboxes: 0,
          keys: 0,
          parts: {},
          appearance: { nose: 'nose-crimson' },
        },
      ],
      rowCount: 1,
    }));
    const repo = new PgEconomyRepository(db);

    expect(await repo.setSlotAppearance(FIXED_USER, 'hull', null)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: { nose: 'nose-crimson' },
    });
    const call = db.calls[0];
    expect(call.text).toContain('appearance - $2::text');
    expect(call.text).toContain('$3::text IS NULL');
    expect(call.values).toEqual([FIXED_USER, 'hull', null]);
  });

  it('setSlotAppearance upserts a zero row when no row exists', async () => {
    const db = makeDb((text) => {
      if (text.startsWith('UPDATE')) return { rows: [], rowCount: 0 };
      return {
        rows: [
          {
            lootboxes: 0,
            keys: 0,
            parts: {},
            appearance: { hull: 'hull-gold' },
          },
        ],
        rowCount: 1,
      };
    });
    const repo = new PgEconomyRepository(db);

    expect(await repo.setSlotAppearance(FIXED_USER, 'hull', 'hull-gold')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: { hull: 'hull-gold' },
    });
    expect(db.calls).toHaveLength(2);
    const insert = db.calls[1];
    expect(insert.text).toContain('INSERT INTO user_economy (user_id, appearance)');
    expect(insert.text).toContain('ON CONFLICT (user_id) DO UPDATE');
    expect(insert.text).toContain('jsonb_build_object($2::text, $3::text)');
    expect(insert.values).toEqual([FIXED_USER, 'hull', 'hull-gold']);
  });

  it('setSlotAppearance(null) upserts an empty zero row when no row exists', async () => {
    const db = makeDb((text) => {
      if (text.startsWith('UPDATE')) return { rows: [], rowCount: 0 };
      return {
        rows: [{ lootboxes: 0, keys: 0, parts: {}, appearance: {} }],
        rowCount: 1,
      };
    });
    const repo = new PgEconomyRepository(db);

    expect(await repo.setSlotAppearance(FIXED_USER, 'hull', null)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
    const insert = db.calls[1];
    expect(insert.text).toContain("'{}'::jsonb");
    expect(insert.values).toEqual([FIXED_USER, 'hull', null]);
  });

  it('setSlotAppearance throws when the upsert returns no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgEconomyRepository(db);
    await expect(repo.setSlotAppearance(FIXED_USER, 'hull', 'hull-gold')).rejects.toThrow(
      'INSERT/UPDATE returned no row',
    );
  });
});

type ContainerRuntime = 'podman' | 'docker';

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
  const name = `cubeclicker-economy-${process.pid}-${Date.now()}`;
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
      'docker.io/library/postgres:16-alpine',
    ],
    { encoding: 'utf8', timeout: 120_000 },
  );
  if (run.status !== 0) {
    throw new Error(`failed to start postgres:16-alpine: ${run.stderr}`);
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

dbDescribe('PgEconomyRepository v2 against PostgreSQL', () => {
  const LEGACY_USER = '20000000-0000-4000-8000-000000000001';
  const OPEN_USER = '20000000-0000-4000-8000-000000000002';
  const DUPLICATE_USER = '20000000-0000-4000-8000-000000000003';
  const SLOT_USER = '20000000-0000-4000-8000-000000000004';
  const UPSERT_USER = '20000000-0000-4000-8000-000000000005';
  const DELETE_UPSERT_USER = '20000000-0000-4000-8000-000000000006';

  let client: Client;
  let repo: PgEconomyRepository;
  let stopContainer: () => void;

  beforeAll(async () => {
    const database = startPostgres(containerRuntime as ContainerRuntime);
    stopContainer = database.stop;
    client = await waitForPostgres(database.connectionString);
    await client.query(
      `CREATE TABLE user_economy (
         user_id UUID PRIMARY KEY,
         lootboxes INT NOT NULL DEFAULT 0,
         keys INT NOT NULL DEFAULT 0,
         parts JSONB NOT NULL DEFAULT '{}'::jsonb,
         appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
         customization_version INT NOT NULL DEFAULT 2,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    const db: EconomyDb = {
      async query(text, values) {
        const result = await client.query(text, values);
        return {
          rows: result.rows as Array<Record<string, unknown>>,
          rowCount: result.rowCount,
        };
      },
    };
    repo = new PgEconomyRepository(db);
  }, 120_000);

  afterAll(async () => {
    await client?.end().catch(() => undefined);
    stopContainer?.();
  });

  async function seed(
    userId: string,
    lootboxes: number,
    keys: number,
    parts: Record<string, unknown>,
    appearance: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO user_economy
         (user_id, lootboxes, keys, parts, appearance, customization_version)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 2)`,
      [userId, lootboxes, keys, JSON.stringify(parts), JSON.stringify(appearance)],
    );
  }

  async function storedRow(userId: string): Promise<Record<string, unknown>> {
    const result = await client.query(
      'SELECT lootboxes, keys, parts, appearance FROM user_economy WHERE user_id = $1',
      [userId],
    );
    return result.rows[0] as Record<string, unknown>;
  }

  it('normalizes the restored version-2 legacy row on read', async () => {
    await seed(
      LEGACY_USER,
      LEGACY_ROW.lootboxes,
      LEGACY_ROW.keys,
      LEGACY_ROW.parts,
      LEGACY_ROW.appearance,
    );
    expect(await repo.findCustomizationByUserId(LEGACY_USER)).toEqual(LEGACY_STATE);
    expect(await storedRow(LEGACY_USER)).toEqual({
      lootboxes: 3,
      keys: 2,
      parts: LEGACY_ROW.parts,
      appearance: LEGACY_ROW.appearance,
    });
  });

  it('atomically consumes one lootbox and one key and grants a new part', async () => {
    await seed(OPEN_USER, 1, 1, {}, {});
    expect(await repo.applyLootboxOpenV2(OPEN_USER, 'hull-obsidian')).toEqual({
      state: {
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-obsidian': 1 },
        appearance: {},
      },
      duplicate: false,
    });
    expect(await repo.applyLootboxOpenV2(OPEN_USER, 'hull-obsidian')).toEqual({
      reason: 'no_lootbox',
    });
    expect(await storedRow(OPEN_USER)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
  });

  it('reports duplicate true and increments the owned count', async () => {
    await seed(DUPLICATE_USER, 1, 1, { 'hull-gold': 1 }, {});
    expect(await repo.applyLootboxOpenV2(DUPLICATE_USER, 'hull-gold')).toEqual({
      state: {
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-gold': 2 },
        appearance: {},
      },
      duplicate: true,
    });
  });

  it('sets then deletes exactly one slot', async () => {
    await seed(SLOT_USER, 2, 1, {}, { nose: 'nose-crimson' });
    expect(await repo.setSlotAppearance(SLOT_USER, 'hull', 'hull-gold')).toEqual({
      lootboxes: 2,
      keys: 1,
      parts: {},
      appearance: { nose: 'nose-crimson', hull: 'hull-gold' },
    });
    expect(await repo.setSlotAppearance(SLOT_USER, 'hull', null)).toEqual({
      lootboxes: 2,
      keys: 1,
      parts: {},
      appearance: { nose: 'nose-crimson' },
    });
    expect(await storedRow(SLOT_USER)).toEqual({
      lootboxes: 2,
      keys: 1,
      parts: {},
      appearance: { nose: 'nose-crimson' },
    });
  });

  it('upserts a zero row when the user has none', async () => {
    expect(await repo.setSlotAppearance(UPSERT_USER, 'hull', 'hull-gold')).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: { hull: 'hull-gold' },
    });
    expect(await repo.setSlotAppearance(DELETE_UPSERT_USER, 'hull', null)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
    expect(await storedRow(UPSERT_USER)).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: { hull: 'hull-gold' },
    });
  });
});
