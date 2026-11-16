import { describe, expect, it } from 'vitest';

import { helloMessage } from '../app.js';
import { loadGameConfig } from './config.js';
import { allIds } from './cubes.js';
import {
  ACTIVITY_EVENT_TTL_MS,
  ACTIVITY_FEED_LIMIT,
  type ActivityEvent,
  type CubeState,
  type CubeSync,
  LEADERBOARD_TOP_LIMIT,
  type LeaderboardSnapshot,
  MAX_MESSAGE_BYTES,
  MAX_STEPS,
  MAX_ROTATE_BYTES,
  type MemberState,
  type MiniCubeId,
  type Placement,
  type CustomizationState,
  activityEventMessage,
  copyActivityEvent,
  copyLeaderboardSnapshot,
  cubeRotatedMessage,
  encodeServerMessage,
  economyUpdateMessage,
  errorMessage,
  upgradesUpdateMessage,
  customizationUpdateMessage,
  copyCustomizationState,
  leaderboardUpdateMessage,
  levelAdvancedMessage,
  memberJoinedMessage,
  memberLeftMessage,
  miniCubeRemovedMessage,
  miniCubesRemovedMessage,
  type LootboxOpened,
  lootboxOpenedMessage,
  parseActivityEvent,
  parseClientMessage,
  parseLeaderboardSnapshot,
  parseLootboxOpened,
  pongMessage,
  rotateMessage,
  stateSyncMessage,
  welcomeMessage,
  worldEnteredMessage,
} from './protocol.js';

/** The cube state of the fixture member `p1` (level 2, 5×5 board, two tiles removed). */
const P1_CUBE: CubeState = {
  levelIndex: 2,
  gridSize: 5,
  styleId: 'emerald-crystal',
  removedIds: ['front:0:0', 'front:0:1'],
  yawSteps: 0,
  pitchSteps: 0,
};

const P1: MemberState = {
  playerId: 'p1',
  name: 'Player 1',
  position: { x: 38.197186342054884, y: 0 },
  levelIndex: 2,
  gridSize: 5,
  styleId: 'emerald-crystal',
  removedIds: ['front:0:0', 'front:0:1'],
  yawSteps: 0,
  pitchSteps: 0,
};

const P2: MemberState = {
  playerId: 'p2',
  name: 'Player 2',
  position: { x: -7.639437268410976, y: 9.355612398046502e-16 },
  levelIndex: 0,
  gridSize: 3,
  styleId: 'obsidian-neon',
  removedIds: [],
  yawSteps: 0,
  pitchSteps: 0,
};

const PLACEMENT: Placement = {
  playerId: 'p1',
  name: 'Player 1',
  token: '0123456789abcdef0123456789abcdef',
  serverId: 1,
  maxUsers: 10,
  position: { x: 38.197186342054884, y: 0 },
  self: P1_CUBE,
  roster: [P1, P2],
  identity: { kind: 'guest', playerId: 'p1' },
  economy: { coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 },
};

describe('MAX_MESSAGE_BYTES', () => {
  it('pins the 1024-byte frame cap', () => {
    expect(MAX_MESSAGE_BYTES).toBe(1024);
  });

  it('agrees with the message cap carried by the validated game config', () => {
    // The two homes of the pinned value (spec § Pinned constants) must never diverge.
    expect(loadGameConfig({}).maxMessageBytes).toBe(MAX_MESSAGE_BYTES);
  });
});

describe('parseClientMessage — happy paths', () => {
  it('decodes join to exactly the empty payload', () => {
    expect(parseClientMessage('{"type":"join"}')).toEqual({
      ok: true,
      message: { type: 'join' },
    });
  });

  it('decodes rejoin with its token', () => {
    expect(
      parseClientMessage('{"type":"rejoin","token":"0123456789abcdef0123456789abcdef"}'),
    ).toEqual({
      ok: true,
      message: { type: 'rejoin', token: '0123456789abcdef0123456789abcdef' },
    });
  });

  it('decodes explode with its mini-cube id and level', () => {
    expect(parseClientMessage('{"type":"explode","id":"front:2:3","level":4}')).toEqual({
      ok: true,
      message: { type: 'explode', id: 'front:2:3', level: 4 },
    });
  });

  it('decodes cubeCompleted with its level', () => {
    expect(parseClientMessage('{"type":"cubeCompleted","level":0}')).toEqual({
      ok: true,
      message: { type: 'cubeCompleted', level: 0 },
    });
  });

  it('tolerates surrounding JSON whitespace', () => {
    expect(parseClientMessage('  {"type":"join"}\n')).toEqual({
      ok: true,
      message: { type: 'join' },
    });
  });

  it('ignores unknown extra fields instead of forwarding them', () => {
    expect(
      parseClientMessage(
        '{"type":"explode","id":"left:0:0","level":1,"playerId":"p9","nested":{"a":[1,2]}}',
      ),
    ).toEqual({
      ok: true,
      message: { type: 'explode', id: 'left:0:0', level: 1 },
    });
    expect(parseClientMessage('{"type":"join","token":"smuggled"}')).toEqual({
      ok: true,
      message: { type: 'join' },
    });
  });

  it('leaves semantic values to the hub (a stale level still decodes)', () => {
    // AC-14/AC-15: the hub answers `invalid_click`/`invalid_completion`; the codec only types.
    expect(parseClientMessage('{"type":"explode","id":"top:1:1","level":99}')).toEqual({
      ok: true,
      message: { type: 'explode', id: 'top:1:1', level: 99 },
    });
  });
});

describe('parseClientMessage — non-JSON and non-object frames', () => {
  const invalidFrames: readonly string[] = [
    '',
    '   ',
    'join',
    '{"type":"join"',
    "{'type':'join'}",
    'null',
    'true',
    '42',
    '"join"',
    '[]',
    '[{"type":"join"}]',
  ];

  it.each(invalidFrames)('rejects %j with bad_message', (text) => {
    expect(parseClientMessage(text)).toEqual({ ok: false, error: 'bad_message' });
  });
});

describe('parseClientMessage — unknown, missing or mistyped type', () => {
  const invalidFrames: readonly string[] = [
    '{}',
    '{"type":7}',
    '{"type":null}',
    '{"type":"JOIN"}',
    '{"type":"join "}',
    '{"type":"hello","serverTime":"2026-10-21T12:00:00.000Z"}',
    '{"type":"welcome"}',
    '{"type":"error","code":"bad_message"}',
  ];

  it.each(invalidFrames)('rejects %j with bad_message', (text) => {
    expect(parseClientMessage(text)).toEqual({ ok: false, error: 'bad_message' });
  });
});

describe('parseClientMessage — missing required fields', () => {
  it('rejects rejoin without a token', () => {
    expect(parseClientMessage('{"type":"rejoin"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects explode without an id', () => {
    expect(parseClientMessage('{"type":"explode","level":0}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects explode without a level', () => {
    expect(parseClientMessage('{"type":"explode","id":"front:0:0"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects cubeCompleted without a level', () => {
    expect(parseClientMessage('{"type":"cubeCompleted"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });
});

describe('parseClientMessage — wrong field types', () => {
  const invalidFrames: readonly string[] = [
    '{"type":"rejoin","token":7}',
    '{"type":"rejoin","token":null}',
    '{"type":"rejoin","token":""}',
    '{"type":"rejoin","token":{"value":"0123456789abcdef"}}',
    '{"type":"explode","id":7,"level":0}',
    '{"type":"explode","id":"","level":0}',
    '{"type":"explode","id":null,"level":0}',
    '{"type":"explode","id":["front:0:0"],"level":0}',
    '{"type":"explode","id":"front:0:0","level":"0"}',
    '{"type":"explode","id":"front:0:0","level":null}',
    '{"type":"cubeCompleted","level":"0"}',
    '{"type":"cubeCompleted","level":false}',
  ];

  it.each(invalidFrames)('rejects %j with bad_message', (text) => {
    expect(parseClientMessage(text)).toEqual({ ok: false, error: 'bad_message' });
  });
});

describe('server-message builders', () => {
  it('builds the welcome placement with copies of its inputs', () => {
    const placement: Placement = {
      ...PLACEMENT,
      self: { ...P1_CUBE, removedIds: [...P1_CUBE.removedIds] },
      roster: [P1, P2],
    };

    const message = welcomeMessage(placement);

    expect(message).toStrictEqual({
      type: 'welcome',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 1,
      maxUsers: 10,
      position: { x: 38.197186342054884, y: 0 },
      self: {
        levelIndex: 2,
        gridSize: 5,
        styleId: 'emerald-crystal',
        removedIds: ['front:0:0', 'front:0:1'],
        yawSteps: 0,
        pitchSteps: 0,
      },
      roster: [P1, P2],
      activity: [],
      identity: { kind: 'guest', playerId: 'p1' },
      economy: { coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 },
    });

    // Later hub mutations of the source must not rewrite an already-built message.
    placement.roster.push(P1);
    placement.self.removedIds.push('back:0:0');
    expect(message).toStrictEqual({
      type: 'welcome',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 1,
      maxUsers: 10,
      position: { x: 38.197186342054884, y: 0 },
      self: {
        levelIndex: 2,
        gridSize: 5,
        styleId: 'emerald-crystal',
        removedIds: ['front:0:0', 'front:0:1'],
        yawSteps: 0,
        pitchSteps: 0,
      },
      roster: [P1, P2],
      activity: [],
      identity: { kind: 'guest', playerId: 'p1' },
      economy: { coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 },
    });
  });

  it('builds worldEntered with the same placement shape', () => {
    expect(worldEnteredMessage(PLACEMENT)).toStrictEqual({
      type: 'worldEntered',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 1,
      maxUsers: 10,
      position: { x: 38.197186342054884, y: 0 },
      self: {
        levelIndex: 2,
        gridSize: 5,
        styleId: 'emerald-crystal',
        removedIds: ['front:0:0', 'front:0:1'],
        yawSteps: 0,
        pitchSteps: 0,
      },
      roster: [P1, P2],
      activity: [],
      identity: { kind: 'guest', playerId: 'p1' },
      economy: { coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 },
    });
  });

  it('builds memberJoined from the joining member', () => {
    expect(memberJoinedMessage(P2)).toStrictEqual({ type: 'memberJoined', member: P2 });
  });

  it('builds both memberLeft reasons', () => {
    expect(memberLeftMessage('p3', 'left')).toStrictEqual({
      type: 'memberLeft',
      playerId: 'p3',
      reason: 'left',
    });
    expect(memberLeftMessage('p3', 'moved')).toStrictEqual({
      type: 'memberLeft',
      playerId: 'p3',
      reason: 'moved',
    });
  });

  it('builds miniCubeRemoved for the origin player ack', () => {
    expect(miniCubeRemovedMessage('p1', 'top:1:2')).toEqual({
      type: 'miniCubeRemoved',
      playerId: 'p1',
      id: 'top:1:2',
    });
  });

  it('builds miniCubesRemoved with an ordered copy of the ids', () => {
    const ids: MiniCubeId[] = ['front:0:0', 'front:0:1'];
    const message = miniCubesRemovedMessage('p1', ids);

    expect(message).toStrictEqual({
      type: 'miniCubesRemoved',
      playerId: 'p1',
      ids: ['front:0:0', 'front:0:1'],
    });

    // Later hub mutations of the pending-id array must not rewrite a queued batch.
    ids.push('top:0:0');
    expect(message).toStrictEqual({
      type: 'miniCubesRemoved',
      playerId: 'p1',
      ids: ['front:0:0', 'front:0:1'],
    });
  });

  it('builds levelAdvanced with an empty (fresh-board) removed set', () => {
    expect(
      levelAdvancedMessage({
        playerId: 'p1',
        levelIndex: 3,
        gridSize: 7,
        styleId: 'violet-nebula',
        position: { x: 38.197186342054884, y: 0 },
      }),
    ).toStrictEqual({
      type: 'levelAdvanced',
      playerId: 'p1',
      levelIndex: 3,
      gridSize: 7,
      styleId: 'violet-nebula',
      position: { x: 38.197186342054884, y: 0 },
      removedIds: [],
    });
  });

  it('builds stateSync with a copy of the authoritative removed set', () => {
    const cube: CubeSync = {
      playerId: 'p2',
      levelIndex: 1,
      gridSize: 4,
      styleId: 'crimson-alloy',
      removedIds: ['front:0:0', 'back:3:3'],
      yawSteps: 2,
      pitchSteps: -1,
    };

    const message = stateSyncMessage(cube);
    expect(message).toStrictEqual({
      type: 'stateSync',
      playerId: 'p2',
      levelIndex: 1,
      gridSize: 4,
      styleId: 'crimson-alloy',
      removedIds: ['front:0:0', 'back:3:3'],
      yawSteps: 2,
      pitchSteps: -1,
    });

    cube.removedIds.push('left:1:1');
    expect(message).toStrictEqual({
      type: 'stateSync',
      playerId: 'p2',
      levelIndex: 1,
      gridSize: 4,
      styleId: 'crimson-alloy',
      removedIds: ['front:0:0', 'back:3:3'],
      yawSteps: 2,
      pitchSteps: -1,
    });
  });

  it('builds error with and without a detail', () => {
    expect(errorMessage('bad_message')).toStrictEqual({ type: 'error', code: 'bad_message' });
    expect(errorMessage('invalid_click', 'stale level 4')).toEqual({
      type: 'error',
      code: 'invalid_click',
      detail: 'stale level 4',
    });
  });
});

describe('encodeServerMessage', () => {
  it('keeps the retained hello envelope byte-shape-identical', () => {
    // Integration tier: the accepted `app.ts` builder through the new catalog encoder.
    expect(encodeServerMessage(helloMessage(new Date('2026-10-21T12:34:56.789Z')))).toBe(
      '{"type":"hello","serverTime":"2026-10-21T12:34:56.789Z"}',
    );
  });

  it('encodes a one-frame JSON string for a broadcast message', () => {
    expect(encodeServerMessage(memberLeftMessage('p3', 'moved'))).toBe(
      '{"type":"memberLeft","playerId":"p3","reason":"moved"}',
    );
  });

  it('encodes an error without an undefined detail key', () => {
    expect(encodeServerMessage(errorMessage('not_joined'))).toBe(
      '{"type":"error","code":"not_joined"}',
    );
  });

  it('keeps the legacy miniCubeRemoved frame byte-identical', () => {
    expect(encodeServerMessage(miniCubeRemovedMessage('p1', 'top:1:2'))).toBe(
      '{"type":"miniCubeRemoved","playerId":"p1","id":"top:1:2"}',
    );
  });

  it('encodes miniCubesRemoved as one pinned JSON frame', () => {
    expect(
      encodeServerMessage(miniCubesRemovedMessage('p1', ['front:0:0', 'front:0:1'])),
    ).toBe('{"type":"miniCubesRemoved","playerId":"p1","ids":["front:0:0","front:0:1"]}');
  });

  it('round-trips a placement message through JSON', () => {
    const encoded = encodeServerMessage(welcomeMessage(PLACEMENT));

    expect(JSON.parse(encoded)).toEqual({
      type: 'welcome',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 1,
      maxUsers: 10,
      position: { x: 38.197186342054884, y: 0 },
      self: {
        levelIndex: 2,
        gridSize: 5,
        styleId: 'emerald-crystal',
        removedIds: ['front:0:0', 'front:0:1'],
        yawSteps: 0,
        pitchSteps: 0,
      },
      roster: [P1, P2],
      activity: [],
      identity: { kind: 'guest', playerId: 'p1' },
      economy: { coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 },
    });
  });

  it('keeps the representative welcome frame byte-identical (AC-10)', () => {
    // No wire-shape change: the `leave` addition and the TTL constant must leave the
    // accepted `welcome` placement bytes untouched.
    expect(encodeServerMessage(welcomeMessage(PLACEMENT))).toBe(
      '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":38.197186342054884,"y":0},"self":{"levelIndex":2,"gridSize":5,"styleId":"emerald-crystal","removedIds":["front:0:0","front:0:1"],"yawSteps":0,"pitchSteps":0},"roster":[{"playerId":"p1","name":"Player 1","position":{"x":38.197186342054884,"y":0},"levelIndex":2,"gridSize":5,"styleId":"emerald-crystal","removedIds":["front:0:0","front:0:1"],"yawSteps":0,"pitchSteps":0},{"playerId":"p2","name":"Player 2","position":{"x":-7.639437268410976,"y":9.355612398046502e-16},"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[],"yawSteps":0,"pitchSteps":0}],"activity":[],"identity":{"kind":"guest","playerId":"p1"},"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1}}',
    );
  });
});

describe('miniCubesRemovedMessage — runtime validation', () => {
  it.each([
    ['a missing playerId', undefined, ['front:0:0']],
    ['an empty playerId', '', ['front:0:0']],
    ['a non-string playerId', 7, ['front:0:0']],
    ['missing ids', 'p1', undefined],
    ['null ids', 'p1', null],
    ['non-array ids', 'p1', 'front:0:0'],
    ['empty ids', 'p1', []],
    ['a non-string id', 'p1', ['front:0:0', 7]],
    ['an empty id', 'p1', ['']],
  ])('rejects %s', (_label, playerId, ids) => {
    expect(() =>
      miniCubesRemovedMessage(playerId as string, ids as unknown as MiniCubeId[]),
    ).toThrow(new TypeError('invalid miniCubesRemoved payload'));
  });

  it('keeps a 30-id batch frame under the 1024-byte cap', () => {
    const ids = allIds(7).slice(0, 30) as MiniCubeId[];
    const encoded = encodeServerMessage(miniCubesRemovedMessage('p1', ids));

    expect(Buffer.byteLength(encoded, 'utf8')).toBeLessThanOrEqual(1024);
  });
});

describe('economyUpdateMessage', () => {
  it('builds economyUpdate from an EconomyState', () => {
    expect(
      economyUpdateMessage({ coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 }),
    ).toStrictEqual({
      type: 'economyUpdate',
      coins: 1.25,
      clicks: 3,
      facesDestroyed: 2,
      cubesDestroyed: 1,
    });
  });

  it('builds economyUpdate from positional numbers', () => {
    expect(economyUpdateMessage(0.3, 4, 5, 6)).toStrictEqual({
      type: 'economyUpdate',
      coins: 0.3,
      clicks: 4,
      facesDestroyed: 5,
      cubesDestroyed: 6,
    });
  });

  it('encodes economyUpdate as one JSON frame', () => {
    expect(
      encodeServerMessage(economyUpdateMessage({ coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 })),
    ).toBe('{"type":"economyUpdate","coins":0,"clicks":0,"facesDestroyed":0,"cubesDestroyed":0}');
  });
});

describe('MAX_STEPS / MAX_ROTATE_BYTES', () => {
  it('pins MAX_STEPS to the yaw upper bound', () => {
    expect(MAX_STEPS).toBe(3);
  });

  it('reuses the global frame cap for rotate frames', () => {
    expect(MAX_ROTATE_BYTES).toBe(MAX_MESSAGE_BYTES);
  });
});

describe('parseClientMessage — rotate', () => {
  it('accepts an integer rotate payload', () => {
    expect(parseClientMessage('{"type":"rotate","yawSteps":1,"pitchSteps":0}')).toEqual({
      ok: true,
      message: { type: 'rotate', yawSteps: 1, pitchSteps: 0 },
    });
  });

  it('accepts an out-of-range integer (clamped server-side)', () => {
    expect(parseClientMessage('{"type":"rotate","yawSteps":5,"pitchSteps":0}')).toEqual({
      ok: true,
      message: { type: 'rotate', yawSteps: 5, pitchSteps: 0 },
    });
  });

  it('accepts negative out-of-range integers', () => {
    expect(parseClientMessage('{"type":"rotate","yawSteps":-1,"pitchSteps":2}')).toEqual({
      ok: true,
      message: { type: 'rotate', yawSteps: -1, pitchSteps: 2 },
    });
  });

  it('rejects a non-integer yawSteps', () => {
    expect(parseClientMessage('{"type":"rotate","yawSteps":1.5,"pitchSteps":0}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects a non-integer pitchSteps', () => {
    expect(parseClientMessage('{"type":"rotate","yawSteps":0,"pitchSteps":1.5}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects missing fields', () => {
    expect(parseClientMessage('{"type":"rotate"}')).toEqual({ ok: false, error: 'bad_message' });
    expect(parseClientMessage('{"type":"rotate","yawSteps":1}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
    expect(parseClientMessage('{"type":"rotate","pitchSteps":0}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects wrong field types', () => {
    expect(parseClientMessage('{"type":"rotate","yawSteps":"1","pitchSteps":0}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
    expect(parseClientMessage('{"type":"rotate","yawSteps":true,"pitchSteps":0}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });
});

describe('server-message builders — orientation', () => {
  it('builds cubeRotated', () => {
    expect(cubeRotatedMessage('p1', 3, -1)).toStrictEqual({
      type: 'cubeRotated',
      playerId: 'p1',
      yawSteps: 3,
      pitchSteps: -1,
    });
    expect(cubeRotatedMessage({ playerId: 'p2', yawSteps: 0, pitchSteps: 1 })).toStrictEqual({
      type: 'cubeRotated',
      playerId: 'p2',
      yawSteps: 0,
      pitchSteps: 1,
    });
  });

  it('builds rotate client message', () => {
    expect(rotateMessage(2, 1)).toStrictEqual({ type: 'rotate', yawSteps: 2, pitchSteps: 1 });
    expect(rotateMessage({ yawSteps: 0, pitchSteps: -1 })).toStrictEqual({
      type: 'rotate',
      yawSteps: 0,
      pitchSteps: -1,
    });
  });

  it('encodes cubeRotated as one JSON frame', () => {
    expect(encodeServerMessage(cubeRotatedMessage('p1', 1, 0))).toBe(
      '{"type":"cubeRotated","playerId":"p1","yawSteps":1,"pitchSteps":0}',
    );
  });
});

describe('parseClientMessage — purchaseUpgrade', () => {
  it('decodes purchaseUpgrade with a non-empty upgradeId', () => {
    expect(parseClientMessage('{"type":"purchaseUpgrade","upgradeId":"mini_cube_value"}')).toEqual({
      ok: true,
      message: { type: 'purchaseUpgrade', upgradeId: 'mini_cube_value' },
    });
  });

  it('rejects purchaseUpgrade without upgradeId', () => {
    expect(parseClientMessage('{"type":"purchaseUpgrade"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects purchaseUpgrade with an empty upgradeId', () => {
    expect(parseClientMessage('{"type":"purchaseUpgrade","upgradeId":""}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects purchaseUpgrade with a non-string upgradeId', () => {
    expect(parseClientMessage('{"type":"purchaseUpgrade","upgradeId":7}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('drops unknown extra fields', () => {
    expect(
      parseClientMessage('{"type":"purchaseUpgrade","upgradeId":"cube_value","level":3}'),
    ).toEqual({
      ok: true,
      message: { type: 'purchaseUpgrade', upgradeId: 'cube_value' },
    });
  });
});

describe('upgradesUpdateMessage', () => {
  it('builds upgradesUpdate from an UpgradeState', () => {
    expect(upgradesUpdateMessage({ mini_cube_value: 2, cube_value: 1 })).toStrictEqual({
      type: 'upgradesUpdate',
      upgrades: { mini_cube_value: 2, cube_value: 1 },
    });
  });

  it('builds upgradesUpdate from an empty map', () => {
    expect(upgradesUpdateMessage({})).toStrictEqual({ type: 'upgradesUpdate', upgrades: {} });
  });

  it('copies its input defensively', () => {
    const source = { mini_cube_value: 3 };
    const message = upgradesUpdateMessage(source);
    source.mini_cube_value = 99;
    expect(message).toStrictEqual({ type: 'upgradesUpdate', upgrades: { mini_cube_value: 3 } });
  });

  it('encodes upgradesUpdate as one JSON frame', () => {
    expect(encodeServerMessage(upgradesUpdateMessage({ speed_window: 2 }))).toBe(
      '{"type":"upgradesUpdate","upgrades":{"speed_window":2}}',
    );
  });
});

describe('placement upgrades field', () => {
  it('welcomeMessage copies upgrades when present', () => {
    const placement: Placement = { ...PLACEMENT, upgrades: { mini_cube_value: 4 } };
    const message = welcomeMessage(placement);
    expect(message.type).toBe('welcome');
    expect(message.upgrades).toStrictEqual({ mini_cube_value: 4 });
    placement.upgrades!.mini_cube_value = 99;
    expect(message.upgrades).toStrictEqual({ mini_cube_value: 4 });
  });

  it('worldEnteredMessage copies upgrades when present', () => {
    const placement: Placement = { ...PLACEMENT, upgrades: { cube_value: 2 } };
    const message = worldEnteredMessage(placement);
    expect(message.type).toBe('worldEntered');
    expect(message.upgrades).toStrictEqual({ cube_value: 2 });
  });

  it('omits upgrades when absent', () => {
    expect(welcomeMessage(PLACEMENT)).not.toHaveProperty('upgrades');
  });
});

describe('ErrorCode upgrades', () => {
  it('builds errors for the new upgrade codes', () => {
    expect(errorMessage('insufficient_funds')).toStrictEqual({ type: 'error', code: 'insufficient_funds' });
    expect(errorMessage('unknown_upgrade')).toStrictEqual({ type: 'error', code: 'unknown_upgrade' });
    expect(errorMessage('max_level')).toStrictEqual({ type: 'error', code: 'max_level' });
  });
});

describe('ErrorCode customization', () => {
  it('builds errors for the new customization codes', () => {
    expect(errorMessage('no_lootbox')).toStrictEqual({ type: 'error', code: 'no_lootbox' });
    expect(errorMessage('no_key')).toStrictEqual({ type: 'error', code: 'no_key' });
    expect(errorMessage('unknown_part')).toStrictEqual({ type: 'error', code: 'unknown_part' });
    expect(errorMessage('not_owned')).toStrictEqual({ type: 'error', code: 'not_owned' });
  });
});

describe('parseClientMessage — openLootbox', () => {
  it('decodes openLootbox with no fields', () => {
    expect(parseClientMessage('{"type":"openLootbox"}')).toEqual({
      ok: true,
      message: { type: 'openLootbox' },
    });
  });

  it('drops unknown extra fields', () => {
    expect(parseClientMessage('{"type":"openLootbox","foo":1}')).toEqual({
      ok: true,
      message: { type: 'openLootbox' },
    });
  });

  it('rejects non-object frames', () => {
    expect(parseClientMessage('null')).toEqual({ ok: false, error: 'bad_message' });
  });
});

describe('parseClientMessage — equipPart', () => {
  it('decodes equipPart with a non-empty partId', () => {
    expect(parseClientMessage('{"type":"equipPart","partId":"nose-crimson"}')).toEqual({
      ok: true,
      message: { type: 'equipPart', partId: 'nose-crimson' },
    });
  });

  it('rejects equipPart without partId', () => {
    expect(parseClientMessage('{"type":"equipPart"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects equipPart with an empty partId', () => {
    expect(parseClientMessage('{"type":"equipPart","partId":""}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects equipPart with a non-string partId', () => {
    expect(parseClientMessage('{"type":"equipPart","partId":7}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('drops unknown extra fields', () => {
    expect(parseClientMessage('{"type":"equipPart","partId":"body-gold","level":3}')).toEqual({
      ok: true,
      message: { type: 'equipPart', partId: 'body-gold' },
    });
  });
});

describe('parseClientMessage — unequipPart', () => {
  it('decodes unequipPart with a non-empty slotId', () => {
    expect(parseClientMessage('{"type":"unequipPart","slotId":"wing-left"}')).toEqual({
      ok: true,
      message: { type: 'unequipPart', slotId: 'wing-left' },
    });
  });

  it('accepts a legacy slot key as a non-empty string (the hub resolves the slot)', () => {
    expect(parseClientMessage('{"type":"unequipPart","slotId":"wings"}')).toEqual({
      ok: true,
      message: { type: 'unequipPart', slotId: 'wings' },
    });
  });

  it('rejects unequipPart without slotId', () => {
    expect(parseClientMessage('{"type":"unequipPart"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it.each([
    '{"type":"unequipPart","slotId":""}',
    '{"type":"unequipPart","slotId":7}',
    '{"type":"unequipPart","slotId":null}',
    '{"type":"unequipPart","slotId":["wing-left"]}',
  ])('rejects %j with bad_message', (text) => {
    expect(parseClientMessage(text)).toEqual({ ok: false, error: 'bad_message' });
  });

  it('drops unknown extra fields', () => {
    expect(parseClientMessage('{"type":"unequipPart","slotId":"hull","level":3}')).toEqual({
      ok: true,
      message: { type: 'unequipPart', slotId: 'hull' },
    });
  });
});

describe('parseClientMessage — legacy equip ids', () => {
  it.each([
    ['body-gold', '{"type":"equipPart","partId":"body-gold"}'],
    ['wings-silver', '{"type":"equipPart","partId":"wings-silver"}'],
    ['engine-blue', '{"type":"equipPart","partId":"engine-blue"}'],
  ])('accepts the legacy id %s as a non-empty string', (partId, text) => {
    expect(parseClientMessage(text)).toEqual({
      ok: true,
      message: { type: 'equipPart', partId },
    });
  });
});

describe('ErrorCode lootbox slots', () => {
  it('builds the unknown_slot error used by unequipPart', () => {
    expect(errorMessage('unknown_slot')).toStrictEqual({ type: 'error', code: 'unknown_slot' });
  });
});

describe('customizationUpdateMessage', () => {
  it('builds customizationUpdate from a CustomizationState', () => {
    const state: CustomizationState = {
      lootboxes: 2,
      keys: 1,
      parts: { 'nose-crimson': 1 },
      appearance: { nose: 'nose-crimson' },
    };
    expect(customizationUpdateMessage(state)).toStrictEqual({
      type: 'customizationUpdate',
      lootboxes: 2,
      keys: 1,
      parts: { 'nose-crimson': 1 },
      appearance: { nose: 'nose-crimson' },
    });
  });

  it('builds from an empty state', () => {
    expect(customizationUpdateMessage({ lootboxes: 0, keys: 0, parts: {}, appearance: {} })).toStrictEqual({
      type: 'customizationUpdate',
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
  });

  it('copies its input defensively', () => {
    const state: CustomizationState = { lootboxes: 1, keys: 1, parts: { a: 1 }, appearance: { nose: 'a' } };
    const message = customizationUpdateMessage(state);
    state.parts.a = 99;
    state.appearance.nose = 'b';
    state.lootboxes = 5;
    expect(message).toStrictEqual({
      type: 'customizationUpdate',
      lootboxes: 1,
      keys: 1,
      parts: { a: 1 },
      appearance: { nose: 'a' },
    });
  });

  it('encodes as one JSON frame', () => {
    expect(
      encodeServerMessage(customizationUpdateMessage({ lootboxes: 0, keys: 0, parts: {}, appearance: {} })),
    ).toBe('{"type":"customizationUpdate","lootboxes":0,"keys":0,"parts":{},"appearance":{}}');
  });
});

describe('copyCustomizationState', () => {
  it('returns an equal deep copy', () => {
    const state: CustomizationState = { lootboxes: 3, keys: 2, parts: { x: 2 }, appearance: { body: 'y' } };
    const copy = copyCustomizationState(state);
    expect(copy).toStrictEqual(state);
    expect(copy).not.toBe(state);
    expect(copy.parts).not.toBe(state.parts);
    expect(copy.appearance).not.toBe(state.appearance);
  });

  it('does not alias nested maps', () => {
    const state: CustomizationState = { lootboxes: 1, keys: 1, parts: { a: 1 }, appearance: { nose: 'a' } };
    const copy = copyCustomizationState(state);
    copy.parts.a = 5;
    copy.appearance.nose = 'z';
    expect(state.parts).toStrictEqual({ a: 1 });
    expect(state.appearance).toStrictEqual({ nose: 'a' });
  });
});

/** One valid AC-24 payload reused by the parser and the builder suites. */
const LOOTBOX_OPENED: LootboxOpened = {
  partId: 'wing-left-silver',
  slot: 'wing-left',
  rarity: 'rare',
  duplicate: false,
  lootboxes: 2,
  keys: 1,
  parts: { 'wing-left-silver': 2, 'hull-default': 1 },
  appearance: { 'wing-left': 'wing-left-silver', hull: 'hull-default' },
};

describe('parseLootboxOpened — valid payloads', () => {
  it('decodes the full payload to the pinned shape', () => {
    expect(parseLootboxOpened(LOOTBOX_OPENED)).toStrictEqual(LOOTBOX_OPENED);
  });

  it('accepts an epic rarity, a duplicate grant and empty maps', () => {
    expect(
      parseLootboxOpened({
        partId: 'hull-gold',
        slot: 'hull',
        rarity: 'epic',
        duplicate: true,
        lootboxes: 0,
        keys: 0,
        parts: {},
        appearance: {},
      }),
    ).toStrictEqual({
      partId: 'hull-gold',
      slot: 'hull',
      rarity: 'epic',
      duplicate: true,
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
  });

  it('accepts legacy ids and legacy appearance keys as non-empty strings', () => {
    expect(
      parseLootboxOpened({
        partId: 'wings-silver',
        slot: 'wing-left',
        rarity: 'rare',
        duplicate: false,
        lootboxes: 1,
        keys: 0,
        parts: { 'wings-silver': 1 },
        appearance: { wings: 'wings-silver' },
      }),
    ).toStrictEqual({
      partId: 'wings-silver',
      slot: 'wing-left',
      rarity: 'rare',
      duplicate: false,
      lootboxes: 1,
      keys: 0,
      parts: { 'wings-silver': 1 },
      appearance: { wings: 'wings-silver' },
    });
  });

  it('drops unknown extra fields and the message type discriminator', () => {
    expect(
      parseLootboxOpened({
        ...LOOTBOX_OPENED,
        type: 'lootboxOpened',
        playerId: 'p9',
        nested: { a: [1, 2] },
      }),
    ).toStrictEqual(LOOTBOX_OPENED);
  });

  it('copies both maps so later mutations cannot leak in', () => {
    const parts = { 'wing-left-silver': 2 };
    const appearance = { 'wing-left': 'wing-left-silver' };
    const parsed = parseLootboxOpened({ ...LOOTBOX_OPENED, parts, appearance });

    expect(parsed).toStrictEqual({
      ...LOOTBOX_OPENED,
      parts: { 'wing-left-silver': 2 },
      appearance: { 'wing-left': 'wing-left-silver' },
    });
    parts['wing-left-silver'] = 99;
    appearance['wing-left'] = 'wing-left-gold';
    expect(parsed).toStrictEqual({
      ...LOOTBOX_OPENED,
      parts: { 'wing-left-silver': 2 },
      appearance: { 'wing-left': 'wing-left-silver' },
    });
    expect(parsed?.parts).not.toBe(parts);
    expect(parsed?.appearance).not.toBe(appearance);
  });
});

describe('parseLootboxOpened — invalid payloads', () => {
  const base = (): Record<string, unknown> => ({
    partId: 'wing-left-silver',
    slot: 'wing-left',
    rarity: 'rare',
    duplicate: false,
    lootboxes: 2,
    keys: 1,
    parts: { 'wing-left-silver': 2 },
    appearance: { 'wing-left': 'wing-left-silver' },
  });
  const without = (key: string): Record<string, unknown> => {
    const payload = base();
    delete payload[key];
    return payload;
  };

  it.each<[string, unknown]>([
    ['a null payload', null],
    ['an array payload', []],
    ['a string payload', 'lootboxOpened'],
    ['a missing partId', without('partId')],
    ['an empty partId', { ...base(), partId: '' }],
    ['a non-string partId', { ...base(), partId: 7 }],
    ['a null partId', { ...base(), partId: null }],
    ['a missing slot', without('slot')],
    ['an empty slot', { ...base(), slot: '' }],
    ['a non-string slot', { ...base(), slot: false }],
    ['a missing rarity', without('rarity')],
    ['a standard rarity', { ...base(), rarity: 'standard' }],
    ['an unknown rarity', { ...base(), rarity: 'legendary' }],
    ['a non-string rarity', { ...base(), rarity: 3 }],
    ['a missing duplicate flag', without('duplicate')],
    ['a numeric duplicate flag', { ...base(), duplicate: 0 }],
    ['a string duplicate flag', { ...base(), duplicate: 'true' }],
    ['a null duplicate flag', { ...base(), duplicate: null }],
    ['missing lootboxes', without('lootboxes')],
    ['negative lootboxes', { ...base(), lootboxes: -1 }],
    ['float lootboxes', { ...base(), lootboxes: 1.5 }],
    ['string lootboxes', { ...base(), lootboxes: '2' }],
    ['missing keys', without('keys')],
    ['negative keys', { ...base(), keys: -1 }],
    ['float keys', { ...base(), keys: 0.5 }],
    ['null keys', { ...base(), keys: null }],
    ['missing parts', without('parts')],
    ['null parts', { ...base(), parts: null }],
    ['array parts', { ...base(), parts: [] }],
    ['string parts', { ...base(), parts: '{"a":1}' }],
    ['an empty parts key', { ...base(), parts: { '': 1 } }],
    ['a zero part count', { ...base(), parts: { 'wing-left-silver': 0 } }],
    ['a negative part count', { ...base(), parts: { 'wing-left-silver': -2 } }],
    ['a float part count', { ...base(), parts: { 'wing-left-silver': 1.5 } }],
    ['a string part count', { ...base(), parts: { 'wing-left-silver': '2' } }],
    ['a boolean part count', { ...base(), parts: { 'wing-left-silver': true } }],
    ['missing appearance', without('appearance')],
    ['null appearance', { ...base(), appearance: null }],
    ['array appearance', { ...base(), appearance: [] }],
    ['an empty appearance key', { ...base(), appearance: { '': 'wing-left-silver' } }],
    ['an empty appearance value', { ...base(), appearance: { 'wing-left': '' } }],
    ['a non-string appearance value', { ...base(), appearance: { 'wing-left': 7 } }],
    ['a null appearance value', { ...base(), appearance: { 'wing-left': null } }],
  ])('rejects %s', (_label, payload) => {
    expect(parseLootboxOpened(payload)).toBeNull();
  });
});

describe('lootboxOpenedMessage', () => {
  it('builds the opener-only grant with copies of both maps', () => {
    const parts = { 'wing-left-silver': 2, 'hull-default': 1 };
    const appearance = { 'wing-left': 'wing-left-silver', hull: 'hull-default' };
    const message = lootboxOpenedMessage({ ...LOOTBOX_OPENED, parts, appearance });

    expect(message).toStrictEqual({
      type: 'lootboxOpened',
      partId: 'wing-left-silver',
      slot: 'wing-left',
      rarity: 'rare',
      duplicate: false,
      lootboxes: 2,
      keys: 1,
      parts: { 'wing-left-silver': 2, 'hull-default': 1 },
      appearance: { 'wing-left': 'wing-left-silver', hull: 'hull-default' },
    });
    parts['wing-left-silver'] = 99;
    appearance['wing-left'] = 'wing-left-gold';
    expect(message).toStrictEqual({
      type: 'lootboxOpened',
      partId: 'wing-left-silver',
      slot: 'wing-left',
      rarity: 'rare',
      duplicate: false,
      lootboxes: 2,
      keys: 1,
      parts: { 'wing-left-silver': 2, 'hull-default': 1 },
      appearance: { 'wing-left': 'wing-left-silver', hull: 'hull-default' },
    });
  });

  it('rejects a payload that fails the AC-24 codec instead of encoding it', () => {
    expect(() =>
      lootboxOpenedMessage({
        ...LOOTBOX_OPENED,
        rarity: 'standard',
      } as unknown as LootboxOpened),
    ).toThrow(new TypeError('invalid lootboxOpened payload'));
    expect(() => lootboxOpenedMessage({ ...LOOTBOX_OPENED, keys: -1 })).toThrow(
      new TypeError('invalid lootboxOpened payload'),
    );
  });

  it('encodes as one JSON frame', () => {
    expect(encodeServerMessage(lootboxOpenedMessage(LOOTBOX_OPENED))).toBe(
      '{"type":"lootboxOpened","partId":"wing-left-silver","slot":"wing-left","rarity":"rare","duplicate":false,"lootboxes":2,"keys":1,"parts":{"wing-left-silver":2,"hull-default":1},"appearance":{"wing-left":"wing-left-silver","hull":"hull-default"}}',
    );
  });

  it('round-trips through the wire codec', () => {
    const encoded = encodeServerMessage(lootboxOpenedMessage(LOOTBOX_OPENED));
    expect(parseLootboxOpened(JSON.parse(encoded))).toStrictEqual(LOOTBOX_OPENED);
  });
});

describe('placement customization field', () => {
  it('welcomeMessage copies customization when present', () => {
    const placement: Placement = {
      ...PLACEMENT,
      customization: { lootboxes: 2, keys: 1, parts: { 'nose-crimson': 1 }, appearance: { nose: 'nose-crimson' } },
    };
    const message = welcomeMessage(placement);
    expect(message.type).toBe('welcome');
    expect(message.customization).toStrictEqual({ lootboxes: 2, keys: 1, parts: { 'nose-crimson': 1 }, appearance: { nose: 'nose-crimson' } });
    placement.customization!.parts['nose-crimson'] = 99;
    expect(message.customization).toStrictEqual({ lootboxes: 2, keys: 1, parts: { 'nose-crimson': 1 }, appearance: { nose: 'nose-crimson' } });
  });

  it('worldEnteredMessage copies customization when present', () => {
    const placement: Placement = {
      ...PLACEMENT,
      customization: { lootboxes: 0, keys: 0, parts: {}, appearance: {} },
    };
    const message = worldEnteredMessage(placement);
    expect(message.type).toBe('worldEntered');
    expect(message.customization).toStrictEqual({ lootboxes: 0, keys: 0, parts: {}, appearance: {} });
  });

  it('omits customization when absent', () => {
    expect(welcomeMessage(PLACEMENT)).not.toHaveProperty('customization');
  });
});

describe('diagnostic ping/pong (AC-23)', () => {
  it('decodes a ping with a finite numeric t and drops unknown extra fields', () => {
    expect(parseClientMessage('{"type":"ping","t":123}')).toEqual({
      ok: true,
      message: { type: 'ping', t: 123 },
    });
    expect(parseClientMessage('{"type":"ping","t":0}')).toEqual({
      ok: true,
      message: { type: 'ping', t: 0 },
    });
    expect(parseClientMessage('{"type":"ping","t":-4.5,"extra":true}')).toEqual({
      ok: true,
      message: { type: 'ping', t: -4.5 },
    });
  });

  it('rejects a missing, null, string, boolean, NaN or Infinity t', () => {
    const invalidFrames: readonly string[] = [
      '{"type":"ping"}',
      '{"type":"ping","t":null}',
      '{"type":"ping","t":"123"}',
      '{"type":"ping","t":true}',
      // JSON has no NaN literal: this frame fails to parse and is still bad_message.
      '{"type":"ping","t":NaN}',
      // 1e999 parses to Infinity, which must not reach the hub.
      '{"type":"ping","t":1e999}',
    ];
    for (const frame of invalidFrames) {
      expect(parseClientMessage(frame)).toEqual({ ok: false, error: 'bad_message' });
    }
  });

  it('builds the exact pong echo and encodes it as one JSON frame', () => {
    expect(pongMessage(123)).toEqual({ type: 'pong', t: 123 });
    expect(encodeServerMessage(pongMessage(123))).toBe('{"type":"pong","t":123}');
    expect(pongMessage(0)).toEqual({ type: 'pong', t: 0 });
  });
});

describe('client leave — additive self-only frame (AC-8)', () => {
  it('decodes the exact {type:"leave"} fixture to the empty payload', () => {
    expect(parseClientMessage('{"type":"leave"}')).toStrictEqual({
      ok: true,
      message: { type: 'leave' },
    });
  });

  it('drops every extra field, including a forged playerId and reason', () => {
    expect(
      parseClientMessage('{"type":"leave","playerId":"p2","reason":"left","nested":{"a":[1]}}'),
    ).toStrictEqual({ ok: true, message: { type: 'leave' } });
  });

  it('re-encodes the decoded message as exactly the additive wire frame', () => {
    const parsed = parseClientMessage('{"type":"leave","playerId":"p2"}');
    if (!parsed.ok) {
      throw new Error('expected leave to decode');
    }
    expect(JSON.stringify(parsed.message)).toBe('{"type":"leave"}');
  });

  it.each([
    '{"type":"leave"',
    '{"type":"leave"} trailing',
    '{"type":"LEAVE"}',
    '{"type":" leave"}',
    '{"type":"leave "}',
    '{"type":"leaveMember","playerId":"p2"}',
  ])('rejects the malformed or unknown frame %j with bad_message', (frame) => {
    expect(parseClientMessage(frame)).toStrictEqual({ ok: false, error: 'bad_message' });
  });

  it('adds no client message that can remove another member', () => {
    // The only removal-shaped client frame is the self-only `leave`; the server broadcast
    // `memberLeft` stays server-only even with a complete, valid-looking payload.
    expect(
      parseClientMessage('{"type":"memberLeft","playerId":"p2","reason":"left"}'),
    ).toStrictEqual({ ok: false, error: 'bad_message' });
    expect(parseClientMessage('{"type":"memberLeft"}')).toStrictEqual({
      ok: false,
      error: 'bad_message',
    });
  });
});

describe('ACTIVITY_EVENT_TTL_MS (AC-11)', () => {
  it('pins the 5000 ms activity lifetime', () => {
    expect(ACTIVITY_EVENT_TTL_MS).toBe(5000);
  });
});

/** The pinned representative event (AC-12); its key order is the wire order. */
const ACTIVITY_CUBE_CLEARED: ActivityEvent = {
  id: 1,
  at: 1000,
  serverId: 1,
  type: 'cubeCleared',
  playerId: 'p2',
  name: 'Player 2',
  level: 3,
};

/** One valid fixture per closed event type, each declared in the pinned wire key order. */
const VALID_ACTIVITY_EVENTS: readonly ActivityEvent[] = [
  ACTIVITY_CUBE_CLEARED,
  {
    id: 2,
    at: 2000,
    serverId: 1,
    type: 'fastClear',
    playerId: 'p2',
    name: 'Player 2',
    level: 4,
    elapsedMs: 2500,
  },
  {
    id: 3,
    at: 3000,
    serverId: 1,
    type: 'levelMilestone',
    playerId: 'p2',
    name: 'Player 2',
    level: 5,
  },
  {
    id: 4,
    at: 4000,
    serverId: 1,
    type: 'epicLoot',
    playerId: 'p2',
    name: 'Player 2',
    partId: 'crown-epic',
  },
  {
    id: 5,
    at: 5000,
    serverId: 1,
    type: 'memberJoined',
    playerId: 'p2',
    name: 'Player 2',
  },
  {
    id: 6,
    at: 6000,
    serverId: 1,
    type: 'memberLeft',
    playerId: 'p2',
    name: 'Player 2',
  },
];

/** The all-fields-valid `cubeCleared` payload the invalid matrix mutates. */
const ACTIVITY_BASE: Record<string, unknown> = {
  id: 1,
  at: 1000,
  serverId: 1,
  type: 'cubeCleared',
  playerId: 'p2',
  name: 'Player 2',
  level: 3,
};

/** The same payload with one field absent (a missing field, not an `undefined` value). */
function withoutActivityField(field: string): Record<string, unknown> {
  const copy = { ...ACTIVITY_BASE };
  delete copy[field];
  return copy;
}

const FAST_CLEAR_BASE: Record<string, unknown> = {
  id: 2,
  at: 2000,
  serverId: 1,
  type: 'fastClear',
  playerId: 'p2',
  name: 'Player 2',
  level: 4,
  elapsedMs: 2500,
};

const MILESTONE_BASE: Record<string, unknown> = {
  id: 3,
  at: 3000,
  serverId: 1,
  type: 'levelMilestone',
  playerId: 'p2',
  name: 'Player 2',
  level: 5,
};

const EPIC_LOOT_BASE: Record<string, unknown> = {
  id: 4,
  at: 4000,
  serverId: 1,
  type: 'epicLoot',
  playerId: 'p2',
  name: 'Player 2',
  partId: 'crown-epic',
};

/** Every invalid variant of the shared validation matrix (spec § Protocol validation matrix). */
const INVALID_ACTIVITY_EVENTS: ReadonlyArray<readonly [string, unknown]> = [
  ['a non-object null', null],
  ['an array', [ACTIVITY_BASE]],
  ['a bare string', 'activityEvent'],
  ['a number', 42],
  ['a missing id', withoutActivityField('id')],
  ['an id of 0', { ...ACTIVITY_BASE, id: 0 }],
  ['a negative id', { ...ACTIVITY_BASE, id: -1 }],
  ['a fractional id', { ...ACTIVITY_BASE, id: 1.5 }],
  ['a string id', { ...ACTIVITY_BASE, id: '1' }],
  ['a null id', { ...ACTIVITY_BASE, id: null }],
  ['a missing at', withoutActivityField('at')],
  ['a negative at', { ...ACTIVITY_BASE, at: -1 }],
  ['a NaN at', { ...ACTIVITY_BASE, at: Number.NaN }],
  ['an Infinity at', { ...ACTIVITY_BASE, at: Number.POSITIVE_INFINITY }],
  ['a string at', { ...ACTIVITY_BASE, at: '0' }],
  ['a null at', { ...ACTIVITY_BASE, at: null }],
  ['a missing serverId', withoutActivityField('serverId')],
  ['a serverId of 0', { ...ACTIVITY_BASE, serverId: 0 }],
  ['a negative serverId', { ...ACTIVITY_BASE, serverId: -2 }],
  ['a fractional serverId', { ...ACTIVITY_BASE, serverId: 2.5 }],
  ['a string serverId', { ...ACTIVITY_BASE, serverId: '1' }],
  ['a null serverId', { ...ACTIVITY_BASE, serverId: null }],
  ['a missing type', withoutActivityField('type')],
  ['a type with trailing space', { ...ACTIVITY_BASE, type: 'cubeCleared ' }],
  ['an unknown type', { ...ACTIVITY_BASE, type: 'unknown' }],
  ['a null type', { ...ACTIVITY_BASE, type: null }],
  ['a missing playerId', withoutActivityField('playerId')],
  ['an empty playerId', { ...ACTIVITY_BASE, playerId: '' }],
  ['a null playerId', { ...ACTIVITY_BASE, playerId: null }],
  ['a numeric playerId', { ...ACTIVITY_BASE, playerId: 7 }],
  ['a missing name', withoutActivityField('name')],
  ['an empty name', { ...ACTIVITY_BASE, name: '' }],
  ['a null name', { ...ACTIVITY_BASE, name: null }],
  ['a numeric name', { ...ACTIVITY_BASE, name: 7 }],
  ['a missing level on cubeCleared', withoutActivityField('level')],
  ['a level of 0 on cubeCleared', { ...ACTIVITY_BASE, level: 0 }],
  ['a negative level on cubeCleared', { ...ACTIVITY_BASE, level: -1 }],
  ['a fractional level on cubeCleared', { ...ACTIVITY_BASE, level: 1.5 }],
  ['a null level on cubeCleared', { ...ACTIVITY_BASE, level: null }],
  ['a missing level on levelMilestone', { ...MILESTONE_BASE, level: undefined }],
  ['a level of 0 on levelMilestone', { ...MILESTONE_BASE, level: 0 }],
  ['a missing level on fastClear', { ...FAST_CLEAR_BASE, level: undefined }],
  ['a negative level on fastClear', { ...FAST_CLEAR_BASE, level: -4 }],
  ['a missing elapsedMs on fastClear', { ...FAST_CLEAR_BASE, elapsedMs: undefined }],
  ['a negative elapsedMs', { ...FAST_CLEAR_BASE, elapsedMs: -1 }],
  ['a NaN elapsedMs', { ...FAST_CLEAR_BASE, elapsedMs: Number.NaN }],
  ['an Infinity elapsedMs', { ...FAST_CLEAR_BASE, elapsedMs: Number.POSITIVE_INFINITY }],
  ['a null elapsedMs', { ...FAST_CLEAR_BASE, elapsedMs: null }],
  ['a string elapsedMs', { ...FAST_CLEAR_BASE, elapsedMs: '2500' }],
  ['a missing partId on epicLoot', { ...EPIC_LOOT_BASE, partId: undefined }],
  ['an empty partId', { ...EPIC_LOOT_BASE, partId: '' }],
  ['a null partId', { ...EPIC_LOOT_BASE, partId: null }],
  ['a numeric partId', { ...EPIC_LOOT_BASE, partId: 7 }],
];

describe('activity feed wire catalog', () => {
  it('pins the 20-event ring limit', () => {
    expect(ACTIVITY_FEED_LIMIT).toBe(20);
  });

  it('pins the exact representative encoded frame', () => {
    expect(encodeServerMessage(activityEventMessage(ACTIVITY_CUBE_CLEARED))).toBe(
      '{"type":"activityEvent","event":{"id":1,"at":1000,"serverId":1,"type":"cubeCleared","playerId":"p2","name":"Player 2","level":3}}',
    );
  });

  it('never accepts a client activityEvent frame (server-only catalog)', () => {
    expect(
      parseClientMessage(
        '{"type":"activityEvent","event":{"id":1,"at":1000,"serverId":1,"type":"cubeCleared","playerId":"p2","name":"Player 2","level":3}}',
      ),
    ).toEqual({ ok: false, error: 'bad_message' });
    expect(parseClientMessage('{"type":"activityEvent"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });
});

describe('parseActivityEvent — valid payloads', () => {
  it.each(VALID_ACTIVITY_EVENTS)('round-trips $type through JSON', (event) => {
    expect(parseActivityEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });

  it('accepts a zero/float at and a zero/float elapsedMs', () => {
    expect(
      parseActivityEvent({
        ...ACTIVITY_CUBE_CLEARED,
        id: 7,
        at: 0,
      }),
    ).toEqual({ ...ACTIVITY_CUBE_CLEARED, id: 7, at: 0 });
    expect(
      parseActivityEvent({
        ...FAST_CLEAR_BASE,
        at: 999.5,
        elapsedMs: 0,
      }),
    ).toEqual({ ...FAST_CLEAR_BASE, at: 999.5, elapsedMs: 0 });
  });

  it('drops unknown extra fields instead of forwarding them', () => {
    expect(
      parseActivityEvent({
        ...ACTIVITY_CUBE_CLEARED,
        accountId: 'account-1',
        token: 'secret',
        extra: { nested: true },
      }),
    ).toEqual(ACTIVITY_CUBE_CLEARED);
    expect(parseActivityEvent({ ...EPIC_LOOT_BASE, level: 9 })).toEqual(EPIC_LOOT_BASE);
  });
});

describe('parseActivityEvent — invalid payloads', () => {
  it.each(INVALID_ACTIVITY_EVENTS)('rejects %s', (_label, payload) => {
    expect(parseActivityEvent(payload)).toBeNull();
  });
});

describe('copyActivityEvent', () => {
  it.each(VALID_ACTIVITY_EVENTS)('copies $type as a fresh pinned-order object', (event) => {
    const copy = copyActivityEvent(event);

    expect(copy).toEqual(event);
    expect(copy).not.toBe(event);
    expect(Object.keys(copy)).toEqual(Object.keys(event));
  });
});

describe('activityEventMessage', () => {
  it.each(VALID_ACTIVITY_EVENTS)('builds and copies a valid $type event', (event) => {
    const message = activityEventMessage(event);

    expect(message).toStrictEqual({ type: 'activityEvent', event });
    if (message.type !== 'activityEvent') {
      throw new Error('expected an activityEvent message');
    }
    expect(message.event).not.toBe(event);
  });

  it('re-validates and copies instead of aliasing the caller object', () => {
    const source: ActivityEvent = { ...ACTIVITY_CUBE_CLEARED };
    const message = activityEventMessage(source);

    source.name = 'Mallory';
    source.level = 9;
    expect(message).toStrictEqual({ type: 'activityEvent', event: ACTIVITY_CUBE_CLEARED });
  });

  it.each(INVALID_ACTIVITY_EVENTS)('throws TypeError for %s', (_label, payload) => {
    expect(() => activityEventMessage(payload as ActivityEvent)).toThrow(
      new TypeError('invalid activityEvent payload'),
    );
  });
});

describe('placement activity field', () => {
  it('welcomeMessage copies the activity ring in newest-first order', () => {
    const placement: Placement = {
      ...PLACEMENT,
      activity: [{ ...ACTIVITY_CUBE_CLEARED }, { ...VALID_ACTIVITY_EVENTS[1]! }],
    };

    const message = welcomeMessage(placement);
    if (message.type !== 'welcome') {
      throw new Error('expected a welcome message');
    }
    expect(message.activity).toEqual([ACTIVITY_CUBE_CLEARED, VALID_ACTIVITY_EVENTS[1]]);
    expect(message.activity).not.toBe(placement.activity);
    expect(message.activity![0]).not.toBe(placement.activity![0]);

    placement.activity![0]!.name = 'Mallory';
    placement.activity!.push({ ...VALID_ACTIVITY_EVENTS[2]! });
    expect(message.activity).toEqual([ACTIVITY_CUBE_CLEARED, VALID_ACTIVITY_EVENTS[1]]);
  });

  it('worldEnteredMessage copies the activity ring', () => {
    const placement: Placement = { ...PLACEMENT, activity: [{ ...ACTIVITY_CUBE_CLEARED }] };

    const message = worldEnteredMessage(placement);
    if (message.type !== 'worldEntered') {
      throw new Error('expected a worldEntered message');
    }
    expect(message.activity).toEqual([ACTIVITY_CUBE_CLEARED]);

    placement.activity![0]!.id = 99;
    expect(message.activity).toEqual([ACTIVITY_CUBE_CLEARED]);
  });

  it('defaults an absent activity ring to an empty array', () => {
    const welcome = welcomeMessage(PLACEMENT);
    if (welcome.type !== 'welcome') {
      throw new Error('expected a welcome message');
    }
    expect(welcome.activity).toEqual([]);

    const entered = worldEnteredMessage(PLACEMENT);
    if (entered.type !== 'worldEntered') {
      throw new Error('expected a worldEntered message');
    }
    expect(entered.activity).toEqual([]);
  });
});

/** The pinned representative snapshot (spec § Wire contract); its key order is the wire order. */
function leaderboardSnapshot(): LeaderboardSnapshot {
  return {
    serverId: 1,
    at: 1000,
    entries: [{ playerId: 'p1', name: 'Player 1', cubesCompleted: 2, clicks: 40 }],
    totals: { cubesCompleted: 2, clicks: 40, facesDestroyed: 3 },
  };
}

const LEADERBOARD_SNAPSHOT: LeaderboardSnapshot = leaderboardSnapshot();

/** One ranked-row fixture the invalid matrix mutates. */
function leaderboardEntryFixture(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    playerId: 'p1',
    name: 'Player 1',
    cubesCompleted: 2,
    clicks: 40,
    ...overrides,
  };
}

/** The all-fields-valid snapshot payload the invalid matrix mutates. */
function leaderboardBase(): Record<string, unknown> {
  return {
    serverId: 1,
    at: 1000,
    entries: [leaderboardEntryFixture({})],
    totals: { cubesCompleted: 2, clicks: 40, facesDestroyed: 3 },
  };
}

/** `n` valid ranked rows (0-based counters, so every total is derivable by hand). */
function leaderboardEntries(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `p${index + 1}`,
    name: `Player ${index + 1}`,
    cubesCompleted: index,
    clicks: index * 10,
  }));
}

/** The valid payload with one top-level field absent (a missing key, not `undefined`). */
function withoutLeaderboardField(field: string): Record<string, unknown> {
  const payload = leaderboardBase();
  delete payload[field];
  return payload;
}

/** The valid payload with one ranked-row field absent. */
function withoutLeaderboardEntryField(field: string): Record<string, unknown> {
  const entry = leaderboardEntryFixture({});
  delete entry[field];
  return { ...leaderboardBase(), entries: [entry] };
}

/** The valid payload with one totals field absent. */
function withoutLeaderboardTotalField(field: string): Record<string, unknown> {
  const totals: Record<string, unknown> = {
    cubesCompleted: 2,
    clicks: 40,
    facesDestroyed: 3,
  };
  delete totals[field];
  return { ...leaderboardBase(), totals };
}

/** The valid payload with one ranked-row field overridden. */
function withLeaderboardEntry(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...leaderboardBase(), entries: [leaderboardEntryFixture(overrides)] };
}

/** The valid payload with one totals field overridden. */
function withLeaderboardTotals(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    ...leaderboardBase(),
    totals: { cubesCompleted: 2, clicks: 40, facesDestroyed: 3, ...overrides },
  };
}

/** Every invalid variant of the shared validation matrix (spec § Protocol validation matrix). */
const INVALID_LEADERBOARD_SNAPSHOTS: ReadonlyArray<readonly [string, unknown]> = [
  ['a non-object null', null],
  ['an array payload', [leaderboardBase()]],
  ['a bare string payload', 'leaderboardUpdate'],
  ['a number payload', 42],
  ['a missing serverId', withoutLeaderboardField('serverId')],
  ['a serverId of 0', { ...leaderboardBase(), serverId: 0 }],
  ['a negative serverId', { ...leaderboardBase(), serverId: -1 }],
  ['a fractional serverId', { ...leaderboardBase(), serverId: 1.5 }],
  ['a string serverId', { ...leaderboardBase(), serverId: '1' }],
  ['a null serverId', { ...leaderboardBase(), serverId: null }],
  ['a missing at', withoutLeaderboardField('at')],
  ['a negative at', { ...leaderboardBase(), at: -1 }],
  ['a NaN at', { ...leaderboardBase(), at: Number.NaN }],
  ['an Infinity at', { ...leaderboardBase(), at: Number.POSITIVE_INFINITY }],
  ['a string at', { ...leaderboardBase(), at: '0' }],
  ['a null at', { ...leaderboardBase(), at: null }],
  ['a missing entries array', withoutLeaderboardField('entries')],
  ['a non-array entries value', { ...leaderboardBase(), entries: {} }],
  ['a null entries value', { ...leaderboardBase(), entries: null }],
  ['six entries', { ...leaderboardBase(), entries: leaderboardEntries(6) }],
  ['a non-object entry', { ...leaderboardBase(), entries: [7] }],
  ['an entry missing playerId', withoutLeaderboardEntryField('playerId')],
  ['an empty playerId', withLeaderboardEntry({ playerId: '' })],
  ['a null playerId', withLeaderboardEntry({ playerId: null })],
  ['a numeric playerId', withLeaderboardEntry({ playerId: 7 })],
  ['an entry missing name', withoutLeaderboardEntryField('name')],
  ['an empty name', withLeaderboardEntry({ name: '' })],
  ['a null name', withLeaderboardEntry({ name: null })],
  ['a numeric name', withLeaderboardEntry({ name: 7 })],
  ['an entry missing cubesCompleted', withoutLeaderboardEntryField('cubesCompleted')],
  ['a negative cubesCompleted', withLeaderboardEntry({ cubesCompleted: -1 })],
  ['a fractional cubesCompleted', withLeaderboardEntry({ cubesCompleted: 1.5 })],
  ['a NaN cubesCompleted', withLeaderboardEntry({ cubesCompleted: Number.NaN })],
  ['a string cubesCompleted', withLeaderboardEntry({ cubesCompleted: '1' })],
  ['a null cubesCompleted', withLeaderboardEntry({ cubesCompleted: null })],
  ['an entry missing clicks', withoutLeaderboardEntryField('clicks')],
  ['a negative clicks', withLeaderboardEntry({ clicks: -1 })],
  ['a fractional clicks', withLeaderboardEntry({ clicks: 1.5 })],
  ['a NaN clicks', withLeaderboardEntry({ clicks: Number.NaN })],
  ['a string clicks', withLeaderboardEntry({ clicks: '1' })],
  ['a null clicks', withLeaderboardEntry({ clicks: null })],
  ['a missing totals object', withoutLeaderboardField('totals')],
  ['a null totals object', { ...leaderboardBase(), totals: null }],
  ['an array totals object', { ...leaderboardBase(), totals: [] }],
  ['missing totals.cubesCompleted', withoutLeaderboardTotalField('cubesCompleted')],
  ['negative totals.cubesCompleted', withLeaderboardTotals({ cubesCompleted: -1 })],
  ['fractional totals.cubesCompleted', withLeaderboardTotals({ cubesCompleted: 1.5 })],
  ['NaN totals.cubesCompleted', withLeaderboardTotals({ cubesCompleted: Number.NaN })],
  ['string totals.cubesCompleted', withLeaderboardTotals({ cubesCompleted: '1' })],
  ['null totals.cubesCompleted', withLeaderboardTotals({ cubesCompleted: null })],
  ['missing totals.clicks', withoutLeaderboardTotalField('clicks')],
  ['negative totals.clicks', withLeaderboardTotals({ clicks: -1 })],
  ['fractional totals.clicks', withLeaderboardTotals({ clicks: 1.5 })],
  ['NaN totals.clicks', withLeaderboardTotals({ clicks: Number.NaN })],
  ['string totals.clicks', withLeaderboardTotals({ clicks: '1' })],
  ['null totals.clicks', withLeaderboardTotals({ clicks: null })],
  ['missing totals.facesDestroyed', withoutLeaderboardTotalField('facesDestroyed')],
  ['negative totals.facesDestroyed', withLeaderboardTotals({ facesDestroyed: -1 })],
  ['fractional totals.facesDestroyed', withLeaderboardTotals({ facesDestroyed: 1.5 })],
  ['NaN totals.facesDestroyed', withLeaderboardTotals({ facesDestroyed: Number.NaN })],
  ['string totals.facesDestroyed', withLeaderboardTotals({ facesDestroyed: '1' })],
  ['null totals.facesDestroyed', withLeaderboardTotals({ facesDestroyed: null })],
];

describe('leaderboard wire catalog', () => {
  it('pins the top-five row cap', () => {
    expect(LEADERBOARD_TOP_LIMIT).toBe(5);
  });

  it('pins the exact representative encoded frame', () => {
    expect(encodeServerMessage(leaderboardUpdateMessage(leaderboardSnapshot()))).toBe(
      '{"type":"leaderboardUpdate","leaderboard":{"serverId":1,"at":1000,"entries":[{"playerId":"p1","name":"Player 1","cubesCompleted":2,"clicks":40}],"totals":{"cubesCompleted":2,"clicks":40,"facesDestroyed":3}}}',
    );
  });

  it('never accepts a client leaderboardUpdate frame (server-only catalog)', () => {
    expect(
      parseClientMessage(
        '{"type":"leaderboardUpdate","leaderboard":{"serverId":1,"at":1000,"entries":[],"totals":{"cubesCompleted":0,"clicks":0,"facesDestroyed":0}}}',
      ),
    ).toEqual({ ok: false, error: 'bad_message' });
    expect(parseClientMessage('{"type":"leaderboardUpdate"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
    expect(parseClientMessage('{"type":"leaderboardUpdate","clicks":5}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });
});

describe('parseLeaderboardSnapshot — valid payloads', () => {
  it('round-trips the pinned representative snapshot as a fresh copy', () => {
    const parsed = parseLeaderboardSnapshot(JSON.parse(JSON.stringify(LEADERBOARD_SNAPSHOT)));

    expect(parsed).toStrictEqual(LEADERBOARD_SNAPSHOT);
    expect(parsed).not.toBe(LEADERBOARD_SNAPSHOT);
    expect(parsed!.entries).not.toBe(LEADERBOARD_SNAPSHOT.entries);
    expect(parsed!.entries[0]).not.toBe(LEADERBOARD_SNAPSHOT.entries[0]);
    expect(parsed!.totals).not.toBe(LEADERBOARD_SNAPSHOT.totals);
  });

  it('accepts an empty ranking with a zero clock and zero totals', () => {
    expect(
      parseLeaderboardSnapshot({
        serverId: 2,
        at: 0,
        entries: [],
        totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
      }),
    ).toStrictEqual({
      serverId: 2,
      at: 0,
      entries: [],
      totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
    });
  });

  it('accepts exactly five entries and a fractional at', () => {
    const entries = leaderboardEntries(5);

    expect(
      parseLeaderboardSnapshot({
        serverId: 3,
        at: 1234.5,
        entries,
        totals: { cubesCompleted: 10, clicks: 100, facesDestroyed: 5 },
      }),
    ).toStrictEqual({
      serverId: 3,
      at: 1234.5,
      entries,
      totals: { cubesCompleted: 10, clicks: 100, facesDestroyed: 5 },
    });
  });

  it('drops unknown extra fields at every level', () => {
    const parsed = parseLeaderboardSnapshot({
      ...leaderboardBase(),
      rank: 99,
      accountId: 'acct-1',
      entries: [
        leaderboardEntryFixture({ accountId: 'acct-1', coins: 9, token: 'secret' }),
      ],
      totals: { cubesCompleted: 2, clicks: 40, facesDestroyed: 3, coins: 9 },
    });

    expect(parsed).toStrictEqual(LEADERBOARD_SNAPSHOT);
  });

  it('copies the input entries and totals so later mutations cannot leak in', () => {
    const entries = leaderboardEntries(2);
    const totals = { cubesCompleted: 1, clicks: 10, facesDestroyed: 2 };
    const parsed = parseLeaderboardSnapshot({ serverId: 1, at: 5, entries, totals });

    entries[0]!.clicks = 999;
    entries.push(leaderboardEntryFixture({}));
    totals.clicks = 999;

    expect(parsed).toStrictEqual({
      serverId: 1,
      at: 5,
      entries: [
        { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 0 },
        { playerId: 'p2', name: 'Player 2', cubesCompleted: 1, clicks: 10 },
      ],
      totals: { cubesCompleted: 1, clicks: 10, facesDestroyed: 2 },
    });
  });
});

describe('parseLeaderboardSnapshot — invalid payloads', () => {
  it.each(INVALID_LEADERBOARD_SNAPSHOTS)('rejects %s', (_label, payload) => {
    expect(parseLeaderboardSnapshot(payload)).toBeNull();
  });
});

describe('copyLeaderboardSnapshot', () => {
  it('returns an equal deep copy with fresh nested objects', () => {
    const snapshot = leaderboardSnapshot();
    const copy = copyLeaderboardSnapshot(snapshot);

    expect(copy).toStrictEqual(snapshot);
    expect(copy).not.toBe(snapshot);
    expect(copy.entries).not.toBe(snapshot.entries);
    expect(copy.entries[0]).not.toBe(snapshot.entries[0]);
    expect(copy.totals).not.toBe(snapshot.totals);

    copy.entries[0]!.clicks = 999;
    copy.totals.cubesCompleted = 999;
    expect(snapshot).toStrictEqual(LEADERBOARD_SNAPSHOT);
  });

  it('throws TypeError instead of copying an invalid snapshot', () => {
    expect(() =>
      copyLeaderboardSnapshot({
        ...leaderboardSnapshot(),
        serverId: 0,
      }),
    ).toThrow(new TypeError('invalid leaderboard snapshot'));
    expect(() =>
      copyLeaderboardSnapshot({
        ...leaderboardSnapshot(),
        entries: leaderboardEntries(6) as unknown as LeaderboardSnapshot['entries'],
      }),
    ).toThrow(new TypeError('invalid leaderboard snapshot'));
  });
});

describe('leaderboardUpdateMessage', () => {
  it('builds the frame with a fresh copied snapshot', () => {
    const snapshot = leaderboardSnapshot();
    const message = leaderboardUpdateMessage(snapshot);

    expect(message).toStrictEqual({ type: 'leaderboardUpdate', leaderboard: snapshot });
    if (message.type !== 'leaderboardUpdate') {
      throw new Error('expected a leaderboardUpdate message');
    }
    expect(message.leaderboard).not.toBe(snapshot);
    expect(message.leaderboard.entries[0]).not.toBe(snapshot.entries[0]);
    expect(message.leaderboard.totals).not.toBe(snapshot.totals);

    snapshot.entries[0]!.clicks = 999;
    snapshot.totals.facesDestroyed = 999;
    expect(message).toStrictEqual({
      type: 'leaderboardUpdate',
      leaderboard: LEADERBOARD_SNAPSHOT,
    });
  });

  it.each(INVALID_LEADERBOARD_SNAPSHOTS)(
    'throws TypeError for %s',
    (_label, payload) => {
      expect(() => leaderboardUpdateMessage(payload as LeaderboardSnapshot)).toThrow(
        new TypeError('invalid leaderboardUpdate payload'),
      );
    },
  );

  it('round-trips through the wire codec', () => {
    const encoded = encodeServerMessage(leaderboardUpdateMessage(leaderboardSnapshot()));
    const decoded = JSON.parse(encoded) as { leaderboard: unknown };

    expect(parseLeaderboardSnapshot(decoded.leaderboard)).toStrictEqual(LEADERBOARD_SNAPSHOT);
  });
});

describe('placement leaderboard field', () => {
  it('welcomeMessage copies the leaderboard snapshot when present', () => {
    const leaderboard = leaderboardSnapshot();
    const placement: Placement = { ...PLACEMENT, leaderboard };

    const message = welcomeMessage(placement);
    if (message.type !== 'welcome') {
      throw new Error('expected a welcome message');
    }
    expect(message.leaderboard).toStrictEqual(LEADERBOARD_SNAPSHOT);
    expect(message.leaderboard).not.toBe(leaderboard);
    expect(message.leaderboard!.entries).not.toBe(leaderboard.entries);
    expect(message.leaderboard!.entries[0]).not.toBe(leaderboard.entries[0]);

    leaderboard.entries[0]!.clicks = 99;
    leaderboard.totals.cubesCompleted = 99;
    expect(message.leaderboard).toStrictEqual(LEADERBOARD_SNAPSHOT);
  });

  it('worldEnteredMessage copies the leaderboard snapshot when present', () => {
    const leaderboard = leaderboardSnapshot();
    const placement: Placement = { ...PLACEMENT, leaderboard };

    const message = worldEnteredMessage(placement);
    if (message.type !== 'worldEntered') {
      throw new Error('expected a worldEntered message');
    }
    expect(message.leaderboard).toStrictEqual(LEADERBOARD_SNAPSHOT);

    leaderboard.entries[0]!.name = 'Mallory';
    expect(message.leaderboard).toStrictEqual(LEADERBOARD_SNAPSHOT);
  });

  it('preserves the absence of the leaderboard for legacy placements', () => {
    expect(welcomeMessage(PLACEMENT)).not.toHaveProperty('leaderboard');
    expect(worldEnteredMessage(PLACEMENT)).not.toHaveProperty('leaderboard');
  });

  it('encodes the placement leaderboard inside welcome', () => {
    const encoded = encodeServerMessage(
      welcomeMessage({ ...PLACEMENT, leaderboard: leaderboardSnapshot() }),
    );
    const decoded = JSON.parse(encoded) as Record<string, unknown>;

    expect(decoded.leaderboard).toStrictEqual(LEADERBOARD_SNAPSHOT);
  });
});
