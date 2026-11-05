import { describe, expect, it } from 'vitest';

import {
  type CustomizationState,
  type MemberState,
  MAX_MESSAGE_BYTES,
  type Placement,
  UpgradeState,
  copyCustomizationState,
  customizationUpdateMessage,
  economyUpdateMessage,
  encodeClientMessage,
  encodeServerMessage,
  parseClientMessage,
  parseServerMessage,
  purchaseUpgradeMessage,
  upgradesUpdateMessage,
} from './protocol';

/**
 * Parity fixture set (AC-20): every frame literal in the `parseClientMessage` suites below
 * is copied verbatim from `src/backend/src/game/protocol.test.ts`, and the expectations are
 * the backend's. `build-log-T7.md` records the script that re-extracts both fixture sets
 * from the two test files and asserts that the decoded results are identical.
 */

/** The cube state of the fixture member `p1` (level 2, 5×5 board, two tiles removed). */
const P1_CUBE = {
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
  position: { x: 30.902172888029035, y: 22.45174281092734 },
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

/** The `welcome` frame as it travels on the wire (hand-written, not stringified). */
const WELCOME_TEXT =
  '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":38.197186342054884,"y":0},"self":{"levelIndex":2,"gridSize":5,"styleId":"emerald-crystal","removedIds":["front:0:0","front:0:1"],"yawSteps":0,"pitchSteps":0},"roster":[{"playerId":"p1","name":"Player 1","position":{"x":38.197186342054884,"y":0},"levelIndex":2,"gridSize":5,"styleId":"emerald-crystal","removedIds":["front:0:0","front:0:1"],"yawSteps":0,"pitchSteps":0},{"playerId":"p2","name":"Player 2","position":{"x":30.902172888029035,"y":22.45174281092734},"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[],"yawSteps":0,"pitchSteps":0}],"identity":{"kind":"guest","playerId":"p1"},"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1}}';

describe('MAX_MESSAGE_BYTES', () => {
  it('pins the 1024-byte frame cap mirrored from the backend', () => {
    expect(MAX_MESSAGE_BYTES).toBe(1024);
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

  it('leaves semantic values to the server (a stale level still decodes)', () => {
    // AC-14/AC-15: the server answers `invalid_click`/`invalid_completion`; the codec only types.
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

describe('parseServerMessage — catalog happy paths', () => {
  it('decodes the retained hello envelope', () => {
    expect(
      parseServerMessage('{"type":"hello","serverTime":"2026-10-21T12:34:56.789Z"}'),
    ).toEqual({
      ok: true,
      message: { type: 'hello', serverTime: '2026-10-21T12:34:56.789Z' },
    });
  });

  it('decodes welcome to the exact placement payload', () => {
    expect(parseServerMessage(WELCOME_TEXT)).toEqual({
      ok: true,
      message: { type: 'welcome', ...PLACEMENT },
    });
  });

  it('decodes worldEntered to the same placement shape', () => {
    const text = WELCOME_TEXT.replace('"type":"welcome"', '"type":"worldEntered"');

    expect(parseServerMessage(text)).toEqual({
      ok: true,
      message: { type: 'worldEntered', ...PLACEMENT },
    });
  });

  it('drops unknown extra fields from a placement frame', () => {
    const text = WELCOME_TEXT.replace(
      '{"type":"welcome"',
      '{"type":"welcome","unexpected":{"nested":[1,2]}',
    );

    expect(parseServerMessage(text)).toStrictEqual({
      ok: true,
      message: { type: 'welcome', ...PLACEMENT },
    });
  });

  it('returns fresh copies for every nested array and object', () => {
    const first = parseServerMessage(WELCOME_TEXT);
    const second = parseServerMessage(WELCOME_TEXT);
    if (!first.ok || first.message.type !== 'welcome' || !second.ok || second.message.type !== 'welcome') {
      throw new Error('the pinned welcome frame must decode twice');
    }

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.message.roster[0]).not.toBe(first.message.roster[0]);
    expect(second.message.self.removedIds).not.toBe(first.message.self.removedIds);
  });

  it('decodes memberJoined from the joining member', () => {
    expect(
      parseServerMessage(
        '{"type":"memberJoined","member":{"playerId":"p2","name":"Player 2","position":{"x":30.902172888029035,"y":22.45174281092734},"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[],"yawSteps":0,"pitchSteps":0}}',
      ),
    ).toEqual({ ok: true, message: { type: 'memberJoined', member: P2 } });
  });

  it('decodes both memberLeft reasons', () => {
    expect(parseServerMessage('{"type":"memberLeft","playerId":"p3","reason":"left"}')).toEqual({
      ok: true,
      message: { type: 'memberLeft', playerId: 'p3', reason: 'left' },
    });
    expect(parseServerMessage('{"type":"memberLeft","playerId":"p3","reason":"moved"}')).toEqual({
      ok: true,
      message: { type: 'memberLeft', playerId: 'p3', reason: 'moved' },
    });
  });

  it('decodes miniCubeRemoved', () => {
    expect(
      parseServerMessage('{"type":"miniCubeRemoved","playerId":"p1","id":"top:1:2"}'),
    ).toEqual({
      ok: true,
      message: { type: 'miniCubeRemoved', playerId: 'p1', id: 'top:1:2' },
    });
  });

  it('decodes levelAdvanced with its fresh (empty) board', () => {
    expect(
      parseServerMessage(
        '{"type":"levelAdvanced","playerId":"p1","levelIndex":3,"gridSize":7,"styleId":"violet-nebula","position":{"x":38.197186342054884,"y":0},"removedIds":[]}',
      ),
    ).toEqual({
      ok: true,
      message: {
        type: 'levelAdvanced',
        playerId: 'p1',
        levelIndex: 3,
        gridSize: 7,
        styleId: 'violet-nebula',
        position: { x: 38.197186342054884, y: 0 },
        removedIds: [],
      },
    });
  });

  it('decodes stateSync with its authoritative removed set', () => {
    expect(
      parseServerMessage(
        '{"type":"stateSync","playerId":"p2","levelIndex":1,"gridSize":4,"styleId":"crimson-alloy","removedIds":["front:0:0","back:3:3"],"yawSteps":2,"pitchSteps":-1}',
      ),
    ).toEqual({
      ok: true,
      message: {
        type: 'stateSync',
        playerId: 'p2',
        levelIndex: 1,
        gridSize: 4,
        styleId: 'crimson-alloy',
        removedIds: ['front:0:0', 'back:3:3'],
        yawSteps: 2,
        pitchSteps: -1,
      },
    });
  });

  it('decodes error with and without a detail', () => {
    expect(parseServerMessage('{"type":"error","code":"not_joined"}')).toEqual({
      ok: true,
      message: { type: 'error', code: 'not_joined' },
    });
    expect(
      parseServerMessage('{"type":"error","code":"invalid_click","detail":"stale level 4"}'),
    ).toEqual({
      ok: true,
      message: { type: 'error', code: 'invalid_click', detail: 'stale level 4' },
    });
  });

  it('decodes economyUpdate with its four totals', () => {
    expect(
      parseServerMessage('{"type":"economyUpdate","coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1}'),
    ).toEqual({
      ok: true,
      message: { type: 'economyUpdate', coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 },
    });
  });
});

describe('parseServerMessage — non-JSON, non-object and unknown frames', () => {
  const invalidServerFrames: readonly string[] = [
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
    '{}',
    '{"type":7}',
    '{"type":null}',
    '{"type":"WELCOME"}',
    '{"type":"welcome "}',
    '{"type":"join"}',
    '{"type":"rejoin","token":"0123456789abcdef0123456789abcdef"}',
    '{"type":"explode","id":"front:0:0","level":0}',
    '{"type":"cubeCompleted","level":0}',
  ];

  it.each(invalidServerFrames)('rejects %j with bad_message', (text) => {
    expect(parseServerMessage(text)).toEqual({ ok: false, error: 'bad_message' });
  });
});

describe('parseServerMessage — missing required fields', () => {
  const invalidServerFrames: readonly string[] = [
    '{"type":"hello"}',
    '{"type":"welcome"}',
    '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":0,"y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[]}}',
    '{"type":"worldEntered"}',
    '{"type":"memberJoined"}',
    '{"type":"memberLeft","playerId":"p3"}',
    '{"type":"memberLeft","reason":"left"}',
    '{"type":"miniCubeRemoved","playerId":"p1"}',
    '{"type":"miniCubeRemoved","id":"front:0:0"}',
    '{"type":"levelAdvanced","playerId":"p1","levelIndex":1,"gridSize":3,"styleId":"obsidian-neon"}',
    '{"type":"stateSync","playerId":"p1","levelIndex":1,"gridSize":3}',
    '{"type":"error"}',
    '{"type":"economyUpdate"}',
    '{"type":"economyUpdate","coins":1}',
    '{"type":"economyUpdate","coins":1,"clicks":2}',
    '{"type":"economyUpdate","coins":1,"clicks":2,"facesDestroyed":3}',
  ];

  it.each(invalidServerFrames)('rejects %j with bad_message', (text) => {
    expect(parseServerMessage(text)).toEqual({ ok: false, error: 'bad_message' });
  });
});

describe('parseServerMessage — wrong field types and out-of-catalog values', () => {
  const invalidServerFrames: readonly string[] = [
    '{"type":"hello","serverTime":""}',
    '{"type":"hello","serverTime":7}',
    '{"type":"hello","serverTime":null}',
    '{"type":"welcome","playerId":"","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":0,"y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[]},"roster":[]}',
    '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":"1","maxUsers":10,"position":{"x":0,"y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[]},"roster":[]}',
    '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":"0","y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[]},"roster":[]}',
    '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":0,"y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"","removedIds":[]},"roster":[]}',
    '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":0,"y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon"},"roster":[]}',
    '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":0,"y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[]},"roster":{}}',
    '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":0,"y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[]},"roster":[{"playerId":"p2","name":7,"position":{"x":0,"y":0},"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[]}]}',
    '{"type":"memberJoined","member":{"playerId":"p2","name":"Player 2","position":{"x":0,"y":0},"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":7}}',
    '{"type":"memberJoined","member":null}',
    '{"type":"memberLeft","playerId":"p3","reason":"gone"}',
    '{"type":"memberLeft","playerId":"p3","reason":7}',
    '{"type":"miniCubeRemoved","playerId":"p1","id":""}',
    '{"type":"miniCubeRemoved","playerId":"p1","id":["front:0:0"]}',
    '{"type":"levelAdvanced","playerId":"p1","levelIndex":1,"gridSize":3,"styleId":"obsidian-neon","position":{"x":0,"y":0},"removedIds":["front:0:0"]}',
    '{"type":"levelAdvanced","playerId":"p1","levelIndex":1,"gridSize":3,"styleId":"obsidian-neon","position":{"x":0,"y":0},"removedIds":"none"}',
    '{"type":"levelAdvanced","playerId":"p1","levelIndex":1,"gridSize":3,"styleId":"obsidian-neon","position":{"x":0,"y":0}}',
    '{"type":"stateSync","playerId":"p1","levelIndex":1,"gridSize":3,"styleId":"obsidian-neon","removedIds":[7]}',
    '{"type":"stateSync","playerId":"","levelIndex":1,"gridSize":3,"styleId":"obsidian-neon","removedIds":[]}',
    '{"type":"error","code":"nope"}',
    '{"type":"error","code":"bad_message","detail":7}',
    '{"type":"economyUpdate","coins":"1","clicks":2,"facesDestroyed":3,"cubesDestroyed":4}',
    '{"type":"economyUpdate","coins":1,"clicks":null,"facesDestroyed":3,"cubesDestroyed":4}',
    '{"type":"economyUpdate","coins":1,"clicks":2,"facesDestroyed":true,"cubesDestroyed":4}',
    '{"type":"economyUpdate","coins":1,"clicks":2,"facesDestroyed":3,"cubesDestroyed":{}}',
    '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":0,"y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[],"yawSteps":0,"pitchSteps":0},"roster":[],"identity":{"kind":"guest","playerId":"p1"},"economy":"bad"}',
    '{"type":"welcome","playerId":"p1","name":"Player 1","token":"0123456789abcdef0123456789abcdef","serverId":1,"maxUsers":10,"position":{"x":0,"y":0},"self":{"levelIndex":0,"gridSize":3,"styleId":"obsidian-neon","removedIds":[],"yawSteps":0,"pitchSteps":0},"roster":[],"identity":{"kind":"guest","playerId":"p1"},"economy":{"coins":1}}',
  ];

  it.each(invalidServerFrames)('rejects %j with bad_message', (text) => {
    expect(parseServerMessage(text)).toEqual({ ok: false, error: 'bad_message' });
  });
});

describe('encodeClientMessage', () => {
  it('encodes join as a one-frame JSON string', () => {
    expect(encodeClientMessage({ type: 'join' })).toBe('{"type":"join"}');
  });

  it('encodes an explode with its id and level', () => {
    expect(encodeClientMessage({ type: 'explode', id: 'front:0:0', level: 2 })).toBe(
      '{"type":"explode","id":"front:0:0","level":2}',
    );
  });

  it('round-trips a rejoin through the client decoder', () => {
    const encoded = encodeClientMessage({
      type: 'rejoin',
      token: '0123456789abcdef0123456789abcdef',
    });

    expect(encoded).toBe('{"type":"rejoin","token":"0123456789abcdef0123456789abcdef"}');
    expect(parseClientMessage(encoded)).toEqual({
      ok: true,
      message: { type: 'rejoin', token: '0123456789abcdef0123456789abcdef' },
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
});

describe('parseServerMessage — upgradesUpdate', () => {
  it('decodes upgradesUpdate with integer levels', () => {
    expect(parseServerMessage('{"type":"upgradesUpdate","upgrades":{"mini_cube_value":2,"cube_value":1}}')).toEqual({
      ok: true,
      message: { type: 'upgradesUpdate', upgrades: { mini_cube_value: 2, cube_value: 1 } },
    });
  });

  it('decodes upgradesUpdate with an empty map', () => {
    expect(parseServerMessage('{"type":"upgradesUpdate","upgrades":{}}')).toEqual({
      ok: true,
      message: { type: 'upgradesUpdate', upgrades: {} },
    });
  });

  it('rejects upgradesUpdate without upgrades', () => {
    expect(parseServerMessage('{"type":"upgradesUpdate"}')).toEqual({ ok: false, error: 'bad_message' });
  });

  it('rejects upgradesUpdate with non-integer levels', () => {
    expect(parseServerMessage('{"type":"upgradesUpdate","upgrades":{"mini_cube_value":1.5}}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects upgradesUpdate with empty keys', () => {
    expect(parseServerMessage('{"type":"upgradesUpdate","upgrades":{"":1}}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects upgradesUpdate with non-object upgrades', () => {
    expect(parseServerMessage('{"type":"upgradesUpdate","upgrades":7}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });
});

describe('placement upgrades field', () => {
  it('parseServerMessage copies upgrades when present on welcome', () => {
    const text = WELCOME_TEXT.replace(
      '"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1}',
      '"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1},"upgrades":{"mini_cube_value":4}',
    );
    const result = parseServerMessage(text);
    expect(result).toEqual({
      ok: true,
      message: { type: 'welcome', ...PLACEMENT, upgrades: { mini_cube_value: 4 } },
    });
  });

  it('rejects welcome with non-integer upgrade levels', () => {
    const text = WELCOME_TEXT.replace(
      '"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1}',
      '"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1},"upgrades":{"mini_cube_value":1.5}',
    );
    expect(parseServerMessage(text)).toEqual({ ok: false, error: 'bad_message' });
  });

  it('omits upgrades when absent', () => {
    const result = parseServerMessage(WELCOME_TEXT);
    if (!result.ok || result.message.type !== 'welcome') throw new Error('bad');
    expect(result.message).not.toHaveProperty('upgrades');
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
    const source: UpgradeState = { mini_cube_value: 3 };
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

describe('purchaseUpgradeMessage', () => {
  it('builds purchaseUpgrade client message', () => {
    expect(purchaseUpgradeMessage('cube_value')).toStrictEqual({
      type: 'purchaseUpgrade',
      upgradeId: 'cube_value',
    });
  });

  it('encodes purchaseUpgrade as one JSON frame', () => {
    expect(encodeClientMessage(purchaseUpgradeMessage('speed_window'))).toBe(
      '{"type":"purchaseUpgrade","upgradeId":"speed_window"}',
    );
  });
});

describe('ErrorCode upgrades', () => {
  it('accepts the new upgrade error codes', () => {
    expect(parseServerMessage('{"type":"error","code":"insufficient_funds"}')).toEqual({
      ok: true,
      message: { type: 'error', code: 'insufficient_funds' },
    });
    expect(parseServerMessage('{"type":"error","code":"unknown_upgrade"}')).toEqual({
      ok: true,
      message: { type: 'error', code: 'unknown_upgrade' },
    });
    expect(parseServerMessage('{"type":"error","code":"max_level"}')).toEqual({
      ok: true,
      message: { type: 'error', code: 'max_level' },
    });
  });
});

describe('ErrorCode customization', () => {
  it('accepts the new customization error codes', () => {
    expect(parseServerMessage('{"type":"error","code":"no_lootbox"}')).toEqual({
      ok: true,
      message: { type: 'error', code: 'no_lootbox' },
    });
    expect(parseServerMessage('{"type":"error","code":"no_key"}')).toEqual({
      ok: true,
      message: { type: 'error', code: 'no_key' },
    });
    expect(parseServerMessage('{"type":"error","code":"unknown_part"}')).toEqual({
      ok: true,
      message: { type: 'error', code: 'unknown_part' },
    });
    expect(parseServerMessage('{"type":"error","code":"not_owned"}')).toEqual({
      ok: true,
      message: { type: 'error', code: 'not_owned' },
    });
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

describe('parseServerMessage — customizationUpdate', () => {
  it('decodes customizationUpdate with counts', () => {
    expect(
      parseServerMessage(
        '{"type":"customizationUpdate","lootboxes":2,"keys":1,"parts":{"nose-crimson":1},"appearance":{"nose":"nose-crimson"}}',
      ),
    ).toEqual({
      ok: true,
      message: {
        type: 'customizationUpdate',
        lootboxes: 2,
        keys: 1,
        parts: { 'nose-crimson': 1 },
        appearance: { nose: 'nose-crimson' },
      },
    });
  });

  it('decodes customizationUpdate with empty maps', () => {
    expect(
      parseServerMessage('{"type":"customizationUpdate","lootboxes":0,"keys":0,"parts":{},"appearance":{}}'),
    ).toEqual({
      ok: true,
      message: { type: 'customizationUpdate', lootboxes: 0, keys: 0, parts: {}, appearance: {} },
    });
  });

  it('rejects customizationUpdate with missing fields', () => {
    expect(parseServerMessage('{"type":"customizationUpdate"}')).toEqual({ ok: false, error: 'bad_message' });
    expect(parseServerMessage('{"type":"customizationUpdate","lootboxes":0}')).toEqual({ ok: false, error: 'bad_message' });
  });

  it('rejects customizationUpdate with negative lootboxes/keys', () => {
    expect(
      parseServerMessage('{"type":"customizationUpdate","lootboxes":-1,"keys":0,"parts":{},"appearance":{}}'),
    ).toEqual({ ok: false, error: 'bad_message' });
    expect(
      parseServerMessage('{"type":"customizationUpdate","lootboxes":0,"keys":-1,"parts":{},"appearance":{}}'),
    ).toEqual({ ok: false, error: 'bad_message' });
  });

  it('rejects customizationUpdate with non-integer lootboxes/keys', () => {
    expect(
      parseServerMessage('{"type":"customizationUpdate","lootboxes":1.5,"keys":0,"parts":{},"appearance":{}}'),
    ).toEqual({ ok: false, error: 'bad_message' });
  });

  it('rejects customizationUpdate with non-positive parts counts', () => {
    expect(
      parseServerMessage('{"type":"customizationUpdate","lootboxes":0,"keys":0,"parts":{"a":0},"appearance":{}}'),
    ).toEqual({ ok: false, error: 'bad_message' });
    expect(
      parseServerMessage('{"type":"customizationUpdate","lootboxes":0,"keys":0,"parts":{"a":-1},"appearance":{}}'),
    ).toEqual({ ok: false, error: 'bad_message' });
  });

  it('rejects customizationUpdate with empty appearance keys/values', () => {
    expect(
      parseServerMessage('{"type":"customizationUpdate","lootboxes":0,"keys":0,"parts":{},"appearance":{"": "x"}}'),
    ).toEqual({ ok: false, error: 'bad_message' });
    expect(
      parseServerMessage('{"type":"customizationUpdate","lootboxes":0,"keys":0,"parts":{},"appearance":{"k": ""}}'),
    ).toEqual({ ok: false, error: 'bad_message' });
  });

  it('rejects customizationUpdate with empty parts keys', () => {
    expect(
      parseServerMessage('{"type":"customizationUpdate","lootboxes":0,"keys":0,"parts":{"":1},"appearance":{}}'),
    ).toEqual({ ok: false, error: 'bad_message' });
  });
});

describe('placement customization field', () => {
  it('parseServerMessage copies customization when present on welcome', () => {
    const text = WELCOME_TEXT.replace(
      '"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1}',
      '"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1},"customization":{"lootboxes":2,"keys":1,"parts":{"nose-crimson":1},"appearance":{"nose":"nose-crimson"}}',
    );
    const result = parseServerMessage(text);
    expect(result).toEqual({
      ok: true,
      message: {
        type: 'welcome',
        ...PLACEMENT,
        customization: { lootboxes: 2, keys: 1, parts: { 'nose-crimson': 1 }, appearance: { nose: 'nose-crimson' } },
      },
    });
  });

  it('rejects welcome with invalid customization', () => {
    const text = WELCOME_TEXT.replace(
      '"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1}',
      '"economy":{"coins":1.25,"clicks":3,"facesDestroyed":2,"cubesDestroyed":1},"customization":{"lootboxes":-1,"keys":0,"parts":{},"appearance":{}}',
    );
    expect(parseServerMessage(text)).toEqual({ ok: false, error: 'bad_message' });
  });

  it('omits customization when absent', () => {
    const result = parseServerMessage(WELCOME_TEXT);
    if (!result.ok || result.message.type !== 'welcome') throw new Error('bad');
    expect(result.message).not.toHaveProperty('customization');
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
