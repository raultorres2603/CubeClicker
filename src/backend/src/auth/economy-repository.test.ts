import { describe, expect, it } from 'vitest';

import {
  InMemoryEconomyRepository,
  PgEconomyRepository,
  type EconomyDb,
  type EconomyState,
} from './economy-repository.js';
import type { UpgradeState } from '../game/upgrades.js';

const FIXED_USER = '11111111-2222-3333-4444-555555555555';

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