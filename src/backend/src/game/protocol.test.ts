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
  cubeRotatedMessage,
  encodeServerMessage,
  errorMessage,
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
    });
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
