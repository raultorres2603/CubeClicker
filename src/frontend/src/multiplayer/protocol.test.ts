import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_FEED_LIMIT,
  type ActivityEvent,
  type CustomizationState,
  type LootboxOpened,
  type MemberState,
  MAX_MESSAGE_BYTES,
  type MiniCubeId,
  type Placement,
  UpgradeState,
  activityEventMessage,
  copyActivityEvent,
  copyCustomizationState,
  customizationUpdateMessage,
  economyUpdateMessage,
  encodeClientMessage,
  encodeServerMessage,
  lootboxOpenedMessage,
  miniCubesRemovedMessage,
  parseActivityEvent,
  parseClientMessage,
  parseLootboxOpened,
  parseServerMessage,
  pongMessage,
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
  activity: [],
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

  it('decodes miniCubesRemoved with a fresh copy of the ids', () => {
    const text =
      '{"type":"miniCubesRemoved","playerId":"p1","ids":["front:0:0","front:0:1"]}';
    const first = parseServerMessage(text);
    const second = parseServerMessage(text);

    expect(first).toStrictEqual({
      ok: true,
      message: { type: 'miniCubesRemoved', playerId: 'p1', ids: ['front:0:0', 'front:0:1'] },
    });
    if (
      !first.ok ||
      first.message.type !== 'miniCubesRemoved' ||
      !second.ok ||
      second.message.type !== 'miniCubesRemoved'
    ) {
      throw new Error('the pinned miniCubesRemoved frame must decode twice');
    }
    expect(second.message.ids).toEqual(['front:0:0', 'front:0:1']);
    expect(second.message.ids).not.toBe(first.message.ids);
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
    '{"type":"miniCubesRemoved","playerId":"p1"}',
    '{"type":"miniCubesRemoved","ids":["front:0:0"]}',
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
    '{"type":"miniCubesRemoved","playerId":"","ids":["front:0:0"]}',
    '{"type":"miniCubesRemoved","playerId":"p1","ids":null}',
    '{"type":"miniCubesRemoved","playerId":"p1","ids":"front:0:0"}',
    '{"type":"miniCubesRemoved","playerId":"p1","ids":[]}',
    '{"type":"miniCubesRemoved","playerId":"p1","ids":["front:0:0",7]}',
    '{"type":"miniCubesRemoved","playerId":"p1","ids":[""]}',
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

describe('parseClientMessage — unequipPart', () => {
  it('decodes unequipPart with a non-empty slotId', () => {
    expect(parseClientMessage('{"type":"unequipPart","slotId":"wing-left"}')).toEqual({
      ok: true,
      message: { type: 'unequipPart', slotId: 'wing-left' },
    });
  });

  it('accepts a legacy slot key as a non-empty string (the server resolves the slot)', () => {
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
  it('accepts the unknown_slot code used by unequipPart', () => {
    expect(parseServerMessage('{"type":"error","code":"unknown_slot"}')).toEqual({
      ok: true,
      message: { type: 'error', code: 'unknown_slot' },
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

/** One valid AC-24 payload reused by the parser, the message decoder and the builder suites. */
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

describe('parseServerMessage — lootboxOpened', () => {
  it('decodes the opener-only grant with both maps', () => {
    expect(
      parseServerMessage(
        '{"type":"lootboxOpened","partId":"wing-left-silver","slot":"wing-left","rarity":"rare","duplicate":false,"lootboxes":2,"keys":1,"parts":{"wing-left-silver":2,"hull-default":1},"appearance":{"wing-left":"wing-left-silver","hull":"hull-default"}}',
      ),
    ).toStrictEqual({ ok: true, message: { type: 'lootboxOpened', ...LOOTBOX_OPENED } });
  });

  it('rejects a lootboxOpened frame that fails the payload codec', () => {
    expect(
      parseServerMessage(
        '{"type":"lootboxOpened","partId":"wing-left-silver","slot":"wing-left","rarity":"standard","duplicate":false,"lootboxes":2,"keys":1,"parts":{},"appearance":{}}',
      ),
    ).toEqual({ ok: false, error: 'bad_message' });
    expect(parseServerMessage('{"type":"lootboxOpened"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
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
});

describe('miniCubesRemovedMessage', () => {
  it('builds the batch with a copy of the ids', () => {
    const ids: MiniCubeId[] = ['front:0:0', 'front:0:1'];
    const message = miniCubesRemovedMessage('p1', ids);

    expect(message).toStrictEqual({
      type: 'miniCubesRemoved',
      playerId: 'p1',
      ids: ['front:0:0', 'front:0:1'],
    });

    ids.push('top:0:0');
    expect(message).toStrictEqual({
      type: 'miniCubesRemoved',
      playerId: 'p1',
      ids: ['front:0:0', 'front:0:1'],
    });
  });

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

  it('encodes as one JSON frame', () => {
    expect(encodeServerMessage(miniCubesRemovedMessage('p1', ['front:0:0', 'front:0:1']))).toBe(
      '{"type":"miniCubesRemoved","playerId":"p1","ids":["front:0:0","front:0:1"]}',
    );
  });
});

describe('diagnostic ping/pong (AC-23)', () => {
  // Fixture set copied verbatim from `src/backend/src/game/protocol.test.ts`; both codecs
  // accept and reject exactly the same frames, and the pong echo is byte-identical.
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

  it('decodes a pong with a finite numeric t and rejects malformed echoes', () => {
    expect(parseServerMessage('{"type":"pong","t":123}')).toEqual({
      ok: true,
      message: { type: 'pong', t: 123 },
    });
    expect(parseServerMessage('{"type":"pong","t":0,"extra":true}')).toEqual({
      ok: true,
      message: { type: 'pong', t: 0 },
    });

    const invalidFrames: readonly string[] = [
      '{"type":"pong"}',
      '{"type":"pong","t":null}',
      '{"type":"pong","t":"123"}',
      '{"type":"pong","t":false}',
      '{"type":"pong","t":1e999}',
    ];
    for (const frame of invalidFrames) {
      expect(parseServerMessage(frame)).toEqual({ ok: false, error: 'bad_message' });
    }
  });

  it('builds the exact pong echo and encodes it as one JSON frame', () => {
    expect(pongMessage(123)).toEqual({ type: 'pong', t: 123 });
    expect(encodeServerMessage(pongMessage(123))).toBe('{"type":"pong","t":123}');
    expect(pongMessage(0)).toEqual({ type: 'pong', t: 0 });
  });

  it('encodes exactly one ping frame from the client', () => {
    expect(encodeClientMessage({ type: 'ping', t: 123 })).toBe('{"type":"ping","t":123}');
  });
});

/**
 * Parity fixture set copied verbatim from `src/backend/src/game/protocol.test.ts`
 * (AC-15): the same valid events round-trip through both decoders and the same invalid
 * variants are rejected by both. The exact representative frame is pinned below.
 */

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

/** The exact encoded representative frame (AC-12), byte-identical to the backend's. */
const ACTIVITY_FRAME =
  '{"type":"activityEvent","event":{"id":1,"at":1000,"serverId":1,"type":"cubeCleared","playerId":"p2","name":"Player 2","level":3}}';

describe('activity feed wire catalog (AC-15)', () => {
  it('pins the 20-event ring limit', () => {
    expect(ACTIVITY_FEED_LIMIT).toBe(20);
  });

  it('pins the exact representative encoded frame', () => {
    expect(encodeServerMessage(activityEventMessage(ACTIVITY_CUBE_CLEARED))).toBe(ACTIVITY_FRAME);
  });

  it('decodes the exact backend frame to the pinned event', () => {
    expect(parseServerMessage(ACTIVITY_FRAME)).toEqual({
      ok: true,
      message: { type: 'activityEvent', event: ACTIVITY_CUBE_CLEARED },
    });
  });

  it('never accepts a client activityEvent frame (server-only catalog)', () => {
    expect(parseClientMessage(ACTIVITY_FRAME)).toEqual({ ok: false, error: 'bad_message' });
    expect(parseClientMessage('{"type":"activityEvent"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
  });

  it('rejects a malformed activityEvent frame at the server decoder', () => {
    expect(parseServerMessage('{"type":"activityEvent"}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
    expect(parseServerMessage('{"type":"activityEvent","event":null}')).toEqual({
      ok: false,
      error: 'bad_message',
    });
    expect(
      parseServerMessage(
        '{"type":"activityEvent","event":{"id":0,"at":1000,"serverId":1,"type":"memberJoined","playerId":"p2","name":"Player 2"}}',
      ),
    ).toEqual({ ok: false, error: 'bad_message' });
  });
});

describe('parseActivityEvent — valid payloads (parity table)', () => {
  it.each(VALID_ACTIVITY_EVENTS)('round-trips $type through JSON', (event) => {
    expect(parseActivityEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });

  it('accepts a zero/float at and a zero/float elapsedMs', () => {
    expect(parseActivityEvent({ ...ACTIVITY_CUBE_CLEARED, id: 7, at: 0 })).toEqual({
      ...ACTIVITY_CUBE_CLEARED,
      id: 7,
      at: 0,
    });
    expect(parseActivityEvent({ ...FAST_CLEAR_BASE, at: 999.5, elapsedMs: 0 })).toEqual({
      ...FAST_CLEAR_BASE,
      at: 999.5,
      elapsedMs: 0,
    });
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

describe('placement activity ring (AC-15)', () => {
  it('decodes a legacy welcome without activity as an empty feed', () => {
    const result = parseServerMessage(WELCOME_TEXT);
    if (!result.ok || result.message.type !== 'welcome') {
      throw new Error('the pinned legacy welcome frame must decode');
    }
    expect(result.message.activity).toEqual([]);
  });

  it('decodes a newest-first ring as fresh event copies', () => {
    const activity = [{ ...ACTIVITY_CUBE_CLEARED }, { ...VALID_ACTIVITY_EVENTS[1]! }];
    const text = JSON.stringify({ type: 'welcome', ...PLACEMENT, activity });
    const result = parseServerMessage(text);
    if (!result.ok || result.message.type !== 'welcome') {
      throw new Error('expected a welcome message');
    }

    expect(result.message.activity).toEqual([ACTIVITY_CUBE_CLEARED, VALID_ACTIVITY_EVENTS[1]]);
    expect(result.message.activity).not.toBe(activity);
    expect(result.message.activity![0]).not.toBe(activity[0]);

    activity[0]!.name = 'Mallory';
    expect(result.message.activity![0]!.name).toBe('Player 2');
  });

  it('accepts a ring of exactly 20 events', () => {
    const activity = Array.from({ length: ACTIVITY_FEED_LIMIT }, (_, index) => ({
      ...ACTIVITY_CUBE_CLEARED,
      id: index + 1,
    }));
    const result = parseServerMessage(JSON.stringify({ type: 'welcome', ...PLACEMENT, activity }));
    if (!result.ok || result.message.type !== 'welcome') {
      throw new Error('expected a 20-event welcome to decode');
    }
    expect(result.message.activity).toHaveLength(20);
    expect(result.message.activity!.map((event) => event.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it('rejects a non-array, an over-long ring or an invalid entry', () => {
    const tooLong = Array.from({ length: ACTIVITY_FEED_LIMIT + 1 }, (_, index) => ({
      ...ACTIVITY_CUBE_CLEARED,
      id: index + 1,
    }));
    const invalidFrames: readonly string[] = [
      JSON.stringify({ type: 'welcome', ...PLACEMENT, activity: 'none' }),
      JSON.stringify({ type: 'welcome', ...PLACEMENT, activity: null }),
      JSON.stringify({ type: 'welcome', ...PLACEMENT, activity: tooLong }),
      JSON.stringify({ type: 'welcome', ...PLACEMENT, activity: [{ ...ACTIVITY_CUBE_CLEARED, id: 0 }] }),
      JSON.stringify({ type: 'worldEntered', ...PLACEMENT, activity: [{}] }),
    ];
    for (const text of invalidFrames) {
      expect(parseServerMessage(text)).toEqual({ ok: false, error: 'bad_message' });
    }
  });
});
