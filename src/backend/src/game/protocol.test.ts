import { describe, expect, it } from 'vitest';

import { helloMessage } from '../app.js';
import { loadGameConfig } from './config.js';
import {
  type CubeState,
  type CubeSync,
  MAX_MESSAGE_BYTES,
  MAX_STEPS,
  MAX_ROTATE_BYTES,
  type MemberState,
  type Placement,
  type CustomizationState,
  cubeRotatedMessage,
  encodeServerMessage,
  economyUpdateMessage,
  errorMessage,
  upgradesUpdateMessage,
  customizationUpdateMessage,
  copyCustomizationState,
  levelAdvancedMessage,
  memberJoinedMessage,
  memberLeftMessage,
  miniCubeRemovedMessage,
  parseClientMessage,
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
      identity: { kind: 'guest', playerId: 'p1' },
      economy: { coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 },
    });
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
