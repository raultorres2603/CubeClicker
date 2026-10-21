import { describe, expect, it } from 'vitest';

import { loadGameConfig } from './config.js';
import {
  SLOT_SPACING,
  type Position,
  type ServerState,
  computeMovePlan,
  createServerRegistry,
  pickServer,
  worldPosition,
} from './servers.js';

/** Builds a server fixture from an id and its explicit slot table (`null` = free slot). */
function server(id: number, ...members: Array<string | null>): ServerState {
  return { id, members };
}

describe('SLOT_SPACING', () => {
  it('pins the accepted cube spacing of 24 units', () => {
    expect(SLOT_SPACING).toBe(24);
  });
});

describe('worldPosition', () => {
  it('pins the ring positions for a full default server (X = 10, slots 1/2/3/10)', () => {
    // R = 10·24/(2π) = 38.197186342054884; slot s → angle 2π·(s−1)/10.
    expect(worldPosition(1, 10)).toEqual({ x: 38.197186342054884, y: 0 });
    expect(worldPosition(2, 10)).toEqual({ x: 30.902172888029035, y: 22.45174281092734 });
    expect(worldPosition(3, 10)).toEqual({ x: 11.803579717001593, y: 36.32768297475154 });
    expect(worldPosition(10, 10)).toEqual({ x: 30.902172888029032, y: -22.451742810927346 });
  });

  it('pins the ring positions for X = 2 (both slots)', () => {
    // R = 2·24/(2π) = 24/π = 7.639437268410976; slot 2 sits at angle π, so its y is the
    // floating-point residual of sin(π) — asserted exactly to pin the formula.
    expect(worldPosition(1, 2)).toEqual({ x: 7.639437268410976, y: 0 });
    expect(worldPosition(2, 2)).toEqual({ x: -7.639437268410976, y: 9.355612398046502e-16 });
  });

  it('places slots at distinct positions on the factory radius', () => {
    const first = worldPosition(1, 10);
    const second = worldPosition(2, 10);

    expect(first).not.toEqual(second);
    expect(first.x).toBe(38.197186342054884);
    expect(second.x).not.toBe(first.x);
  });
});

describe('pickServer', () => {
  it('creates a server with the supplied next id when none exist', () => {
    expect(pickServer([], 10, 1)).toEqual({ serverId: 1, slot: 1, created: true });
  });

  it('uses the caller-owned next id for a new server', () => {
    expect(pickServer([server(1, 'a', 'b')], 2, 7)).toEqual({
      serverId: 7,
      slot: 1,
      created: true,
    });
  });

  it('picks the lowest-id server with a free slot', () => {
    expect(pickServer([server(1, 'a', 'b', 'c'), server(2, 'd')], 3, 3)).toEqual({
      serverId: 2,
      slot: 2,
      created: false,
    });
  });

  it('skips full servers and keeps a gap in the id sequence', () => {
    expect(pickServer([server(1, 'a', 'b'), server(3, 'c')], 2, 4)).toEqual({
      serverId: 3,
      slot: 2,
      created: false,
    });
  });

  it('picks the lowest id regardless of the input order', () => {
    expect(pickServer([server(5, 'a'), server(2, 'b')], 10, 6)).toEqual({
      serverId: 2,
      slot: 2,
      created: false,
    });
  });
});

describe('computeMovePlan', () => {
  it('moves the lone member of server 2 down into the free slot of server 1', () => {
    // X = 3: server 1 has two members (one free slot), server 2 has one.
    const plan = computeMovePlan([server(1, 'p1', 'p2'), server(2, 'p3')], 3);

    expect([...plan]).toEqual([['p3', 1]]);
  });

  it('moves both members of server 2 to server 1 in join order when two slots are free', () => {
    // X = 3: server 1 has one member (two free slots), server 2 has two.
    const plan = computeMovePlan([server(1, 'p1'), server(2, 'p2', 'p3')], 3);

    expect([...plan]).toEqual([
      ['p2', 1],
      ['p3', 1],
    ]);
  });

  it('returns an empty plan when server 1 is full (nowhere to go)', () => {
    // X = 3: server 1 is full, server 2 has one member — the pinned AC-10 fixture.
    const plan = computeMovePlan([server(1, 'p1', 'p2', 'p3'), server(2, 'p4')], 3);

    expect([...plan]).toEqual([]);
    expect(plan.size).toBe(0);
  });

  it('skips members that cannot move down, then keeps serving higher-id donors', () => {
    // X = 2: server 1 has one free slot, server 2 is full, server 3 has one member.
    // p2 moves into server 1; p3/p4 cannot move (their lowest free destination is not lower).
    const plan = computeMovePlan(
      [server(1, 'p1'), server(2, 'p2', 'p3'), server(3, 'p4')],
      2,
    );

    expect([...plan]).toEqual([['p2', 1]]);
  });

  it('respects capacity while packing in strictly ascending donor order', () => {
    // X = 3: server 1 has two free slots; server 2 (three members) fills them with p2, p3;
    // p4 stays (server 3 is not lower), and p5 stays on its own server.
    const plan = computeMovePlan(
      [server(1, 'p1'), server(2, 'p2', 'p3', 'p4'), server(3, 'p5')],
      3,
    );

    expect([...plan]).toEqual([
      ['p2', 1],
      ['p3', 1],
    ]);
  });

  it('returns an empty plan for a single full server', () => {
    expect([...computeMovePlan([server(1, 'p1', 'p2')], 2)]).toEqual([]);
  });

  it('plans only strictly lower targets', () => {
    const servers = [server(1, 'p1'), server(2, 'p2'), server(3, 'p3', 'p4')];
    const plan = computeMovePlan(servers, 3);
    const currentServerOf = new Map<string, number>();
    for (const entry of servers) {
      for (const member of entry.members) {
        if (member !== null) {
          currentServerOf.set(member, entry.id);
        }
      }
    }

    // p2 and p3 fill server 1's two free slots; p4 lands on server 2's free slot.
    expect([...plan]).toEqual([
      ['p2', 1],
      ['p3', 1],
      ['p4', 2],
    ]);
    for (const [playerId, target] of plan) {
      expect(target).toBeLessThan(currentServerOf.get(playerId)!);
    }
  });

  it('is deterministic and does not mutate its input', () => {
    const servers = [server(1, 'p1'), server(2, 'p2', 'p3')];
    const first = computeMovePlan(servers, 3);
    const second = computeMovePlan(servers, 3);

    expect([...second]).toEqual([...first]);
    expect(servers).toEqual([server(1, 'p1'), server(2, 'p2', 'p3')]);
  });
});

describe('createServerRegistry', () => {
  it('starts empty: no server exists before the first join', () => {
    const registry = createServerRegistry(3);

    expect(registry.serverCount()).toBe(0);
    expect(registry.servers()).toEqual([]);
    expect([...registry.plan()]).toEqual([]);
  });

  it('fills server 1 to capacity then overflows into server 2', () => {
    const registry = createServerRegistry(3);

    expect(registry.assign('p1')).toEqual({ serverId: 1, slot: 1 });
    expect(registry.assign('p2')).toEqual({ serverId: 1, slot: 2 });
    expect(registry.assign('p3')).toEqual({ serverId: 1, slot: 3 });
    expect(registry.assign('p4')).toEqual({ serverId: 2, slot: 1 });

    expect(registry.serverCount()).toBe(2);
    expect(registry.servers()).toEqual([
      server(1, 'p1', 'p2', 'p3'),
      server(2, 'p4'),
    ]);
  });

  it('assigns a rejoin to the lowest-id free slot after churn without moving the survivor', () => {
    const registry = createServerRegistry(2);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');

    expect(registry.removeMember('p1')).toEqual({ left: true, serverDestroyed: false });
    // p2 keeps slot 2; the new join takes the vacated lowest slot 1.
    expect(registry.assign('p4')).toEqual({ serverId: 1, slot: 1 });
    expect(registry.servers()).toEqual([server(1, 'p4', 'p2'), server(2, 'p3')]);
  });

  it('reports a missing member without touching the registry', () => {
    const registry = createServerRegistry(2);
    registry.assign('p1');

    expect(registry.removeMember('ghost')).toEqual({ left: false, serverDestroyed: false });
    expect(registry.servers()).toEqual([server(1, 'p1')]);
  });

  it('destroys an emptied server and never reuses its id', () => {
    const registry = createServerRegistry(2);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');

    expect(registry.removeMember('p3')).toEqual({ left: true, serverDestroyed: true });
    expect(registry.serverCount()).toBe(1);
    expect(registry.servers()).toEqual([server(1, 'p1', 'p2')]);

    // Server 1 is full again, so the next join creates id 3 — never the destroyed id 2.
    expect(registry.assign('p4')).toEqual({ serverId: 3, slot: 1 });
    expect(registry.servers()).toEqual([server(1, 'p1', 'p2'), server(3, 'p4')]);
  });

  it('hands out defensive copies from servers()', () => {
    const registry = createServerRegistry(3);
    registry.assign('p1');

    const snapshot = registry.servers();
    snapshot[0].members.push('intruder');
    snapshot.push(server(9, 'p9'));

    expect(registry.serverCount()).toBe(1);
    expect(registry.servers()).toEqual([server(1, 'p1')]);
  });

  it('executes a planned move into the target’s lowest free slot and destroys the vacated server', () => {
    const registry = createServerRegistry(3);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');
    registry.assign('p4');
    registry.removeMember('p2');

    expect([...registry.plan()]).toEqual([['p4', 1]]);
    // p2's slot 2 is the lowest free slot: p3 keeps slot 3.
    expect(registry.moveMember('p4', 1)).toEqual({ slot: 2 });

    expect(registry.serverCount()).toBe(1);
    expect(registry.servers()).toEqual([server(1, 'p1', 'p4', 'p3')]);
  });

  it('rejects a move to a detached server and leaves the member in place', () => {
    const registry = createServerRegistry(2);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');
    registry.assign('p4');
    registry.assign('p5');

    // Server 2 is detached while p5 is still on server 3, so its planned target is gone.
    expect(registry.removeMember('p3')).toEqual({ left: true, serverDestroyed: false });
    expect(registry.removeMember('p4')).toEqual({ left: true, serverDestroyed: true });
    expect(registry.moveMember('p5', 2)).toBeNull();
    expect(registry.servers()).toEqual([server(1, 'p1', 'p2'), server(3, 'p5')]);
  });

  it('keeps the vacated server when other members remain on it', () => {
    const registry = createServerRegistry(3);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');
    registry.assign('p4');
    registry.assign('p5');
    registry.removeMember('p2');

    expect([...registry.plan()]).toEqual([['p4', 1]]);
    expect(registry.moveMember('p4', 1)).toEqual({ slot: 2 });

    expect(registry.serverCount()).toBe(2);
    expect(registry.servers()).toEqual([server(1, 'p1', 'p4', 'p3'), server(2, null, 'p5')]);
  });

  it('rejects a move into a full target and leaves the member in place', () => {
    const registry = createServerRegistry(2);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');
    registry.assign('p4');

    expect(registry.moveMember('p3', 1)).toBeNull();
    expect(registry.servers()).toEqual([server(1, 'p1', 'p2'), server(2, 'p3', 'p4')]);
  });

  it('rejects upward and same-server targets and unknown members', () => {
    const registry = createServerRegistry(2);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');

    expect(registry.moveMember('p3', 2)).toBeNull();
    expect(registry.moveMember('p1', 2)).toBeNull();
    expect(registry.moveMember('ghost', 1)).toBeNull();
    expect(registry.servers()).toEqual([server(1, 'p1', 'p2'), server(2, 'p3')]);
  });

  it('recomputes the plan from the current membership', () => {
    const registry = createServerRegistry(3);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');
    registry.assign('p4');

    expect([...registry.plan()]).toEqual([]);

    registry.removeMember('p2');
    expect([...registry.plan()]).toEqual([['p4', 1]]);
  });
});

describe('stable slots (T1b)', () => {
  /** Pinned X = 4 ring positions: R = 4·24/(2π) = 15.278874536821952; slot s → angle 2π·(s−1)/4. */
  const X4_SLOT_1: Position = { x: 15.278874536821952, y: 0 };
  const X4_SLOT_2: Position = { x: 9.355612398046502e-16, y: 15.278874536821952 };
  const X4_SLOT_3: Position = { x: -15.278874536821952, y: 1.8711224796093003e-15 };
  const X4_SLOT_4: Position = { x: -2.8066837194139503e-15, y: -15.278874536821952 };

  it('pins the ring positions for X = 4 (all four slots)', () => {
    expect(worldPosition(1, 4)).toEqual(X4_SLOT_1);
    expect(worldPosition(2, 4)).toEqual(X4_SLOT_2);
    expect(worldPosition(3, 4)).toEqual(X4_SLOT_3);
    expect(worldPosition(4, 4)).toEqual(X4_SLOT_4);
  });

  it('keeps every surviving member’s slot when another member leaves', () => {
    const registry = createServerRegistry(4);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');
    registry.assign('p4');

    expect(registry.removeMember('p2')).toEqual({ left: true, serverDestroyed: false });

    // Slot 2 is an explicit hole: p3 is still slot 3 and p4 still slot 4 (no compaction).
    expect(registry.servers()).toEqual([server(1, 'p1', null, 'p3', 'p4')]);
    // The exact positions p3 and p4 sit at are unchanged by the removal.
    expect(worldPosition(3, 4)).toEqual({ x: -15.278874536821952, y: 1.8711224796093003e-15 });
    expect(worldPosition(4, 4)).toEqual({ x: -2.8066837194139503e-15, y: -15.278874536821952 });
    // Slot 2 (the compacted position p3 used to drift to) is free and unused.
    expect(worldPosition(2, 4)).toEqual({ x: 9.355612398046502e-16, y: 15.278874536821952 });
  });

  it('puts a new join on the vacated slot without moving the remaining members', () => {
    const registry = createServerRegistry(4);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');
    registry.assign('p4');
    registry.removeMember('p2');

    expect(registry.assign('p5')).toEqual({ serverId: 1, slot: 2 });
    // p5 fills slot 2; p1/p3/p4 keep slots 1/3/4.
    expect(registry.servers()).toEqual([server(1, 'p1', 'p5', 'p3', 'p4')]);
    expect(registry.serverCount()).toBe(1);
  });

  it('puts a mover on the target’s lowest free slot and only holes its old slot', () => {
    const registry = createServerRegistry(4);
    registry.assign('p1');
    registry.assign('p2');
    registry.assign('p3');
    registry.assign('p4');
    registry.assign('p5');
    registry.assign('p6');

    // p3 (slot 3) leaves; p3's slot is the target's lowest free slot and the only one.
    expect(registry.removeMember('p3')).toEqual({ left: true, serverDestroyed: false });
    expect([...registry.plan()]).toEqual([['p5', 1]]);

    expect(registry.moveMember('p5', 1)).toEqual({ slot: 3 });
    // Server 1: p4 keeps slot 4, p5 took slot 3. Server 2: p6 keeps slot 2, slot 1 is a hole.
    expect(registry.servers()).toEqual([
      server(1, 'p1', 'p2', 'p5', 'p4'),
      server(2, null, 'p6'),
    ]);
  });

  it('accepts a join on a hole that a dense table could not express', () => {
    // X = 3: slot 2 is free, so the join lands there (not at "length + 1" = 3).
    expect(pickServer([server(1, 'a', null, 'c')], 3, 2)).toEqual({
      serverId: 1,
      slot: 2,
      created: false,
    });
  });

  it('counts occupied slots, not the array length, when planning moves', () => {
    // X = 2: server 1 has one member in slot 2 (slot 1 is a hole), so it has one free slot.
    expect([...computeMovePlan([server(1, null, 'p1'), server(2, 'p2')], 2)]).toEqual([
      ['p2', 1],
    ]);
  });
});

describe('composition: config + registry + ring layout (AC-11 at registry level)', () => {
  it('merges a lone server-2 member into server 1 at its next free slot on completion', () => {
    const config = loadGameConfig({ MAX_USERS_PER_SERVER: '2' });
    const registry = createServerRegistry(config.maxUsersPerServer);

    const first = registry.assign('p1');
    const second = registry.assign('p2');
    const third = registry.assign('p3');

    expect(first).toEqual({ serverId: 1, slot: 1 });
    expect(second).toEqual({ serverId: 1, slot: 2 });
    expect(third).toEqual({ serverId: 2, slot: 1 });
    expect(worldPosition(second.slot, config.maxUsersPerServer)).toEqual({
      x: -7.639437268410976,
      y: 9.355612398046502e-16,
    });

    // A server-1 member disconnects and their grace expires → the plan packs p3 downward.
    expect(registry.removeMember('p2')).toEqual({ left: true, serverDestroyed: false });
    expect([...registry.plan()]).toEqual([['p3', 1]]);

    // The move executes only at the mover's cube completion, landing on slot 2 of server 1.
    expect(registry.moveMember('p3', 1)).toEqual({ slot: 2 });
    expect(registry.serverCount()).toBe(1);
    expect(registry.servers()).toEqual([server(1, 'p1', 'p3')]);
    expect(worldPosition(2, config.maxUsersPerServer)).toEqual({
      x: -7.639437268410976,
      y: 9.355612398046502e-16,
    });
    expect([...registry.plan()]).toEqual([]);
  });
});
