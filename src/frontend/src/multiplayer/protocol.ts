/**
 * The multiplayer wire catalog and its codecs, mirrored from the backend.
 *
 * The frontend half of the protocol: the same message unions and payload shapes as
 * `src/backend/src/game/protocol.ts`, the same `MAX_MESSAGE_BYTES` cap, and the same
 * accept/reject behaviour for the client codec (parity is pinned by replaying the
 * backend's fixture set verbatim in `protocol.test.ts`). Everything here is pure:
 * text in, plain data out — no sockets, no timers, no DOM, no storage.
 *
 * Direction split (mirrors the backend, which only decodes client frames):
 * - `parseClientMessage` decodes/validates what this client sends (kept identical to the
 *   backend decoder so both ends agree on every fixture);
 * - `parseServerMessage` decodes/validates what the transport receives — the frontend's
 *   real decode path — returning the pinned shape (extra fields dropped, defensive
 *   copies of every nested array/object) or `{ ok: false, error: 'bad_message' }`;
 * - `encodeClientMessage` serialises one client message into the single JSON text frame.
 *
 * Field validation is presence + type only, exactly like the backend: an unknown `type`,
 * a non-JSON frame, a non-object frame, a missing required field or a field of the wrong
 * type decode to `bad_message`. Field *values* are never judged here — `explode.id`,
 * `explode.level` and `cubeCompleted.level` are validated against the member's
 * authoritative cube by the server (AC-14/AC-15), and the client only ever reports what
 * the server told it. `MAX_MESSAGE_BYTES` is exported as the codec constant; the size
 * check itself belongs to the caller (the transport drops oversized frames).
 */

import type { FaceId, MiniCubeId } from '../game/types';

export type { FaceId, MiniCubeId };

/**
 * Pinned message-size cap in bytes (spec § Pinned constants: 1024), mirrored from
 * `game/protocol.ts`. Measured on the raw frame text; the caller drops anything above it.
 */
export const MAX_MESSAGE_BYTES = 1024;

/**
 * Pinned upper bound for a single orientation step count (yaw). The spec defines
 * `yawSteps` in `0..3` and `pitchSteps` in `-1..1`; this constant records the yaw
 * upper bound (the larger of the two).
 */
export const MAX_STEPS = 3;

/** Size cap applied to a `rotate` frame; identical to the global frame cap. */
export const MAX_ROTATE_BYTES = MAX_MESSAGE_BYTES;

/** A world-plane point (`z = 0`), exactly as it travels on the wire. */
export interface Position {
  x: number;
  y: number;
}

/** The authoritative board of one level, as sent over the wire. */
export interface CubeState {
  levelIndex: number;
  gridSize: number;
  styleId: string;
  removedIds: string[];
  yawSteps: number;
  pitchSteps: number;
}

/** One server member as broadcast to that server's clients (cube state inlined). */
export interface MemberState {
  playerId: string;
  name: string;
  position: Position;
  levelIndex: number;
  gridSize: number;
  styleId: string;
  removedIds: string[];
  yawSteps: number;
  pitchSteps: number;
}

/** The pinned error codes (spec § 8). */
export type ErrorCode =
  | 'bad_message'
  | 'not_joined'
  | 'rate_limited'
  | 'invalid_click'
  | 'invalid_completion'
  | 'resume_failed'
  | 'account_unverified'
  | 'not_authenticated';

/** Client → server catalog (spec § 8). */
export type ClientMessage =
  | { type: 'join'; mode?: 'account' | 'guest' }
  | { type: 'rejoin'; token: string }
  | { type: 'explode'; id: MiniCubeId; level: number }
  | { type: 'cubeCompleted'; level: number }
  | { type: 'rotate'; yawSteps: number; pitchSteps: number };

/** Server → client catalog (spec § 8). `hello` is the exact retained `app.ts` envelope. */
export type ServerMessage =
  | { type: 'hello'; serverTime: string }
  | {
      type: 'welcome';
      playerId: string;
      name: string;
      token: string;
      serverId: number;
      maxUsers: number;
      position: Position;
      self: CubeState;
      roster: MemberState[];
      identity?: Identity;
    }
  | {
      type: 'worldEntered';
      playerId: string;
      name: string;
      token: string;
      serverId: number;
      maxUsers: number;
      position: Position;
      self: CubeState;
      roster: MemberState[];
      identity?: Identity;
    }
  | { type: 'memberJoined'; member: MemberState }
  | { type: 'memberLeft'; playerId: string; reason: 'left' | 'moved' }
  | { type: 'cubeRotated'; playerId: string; yawSteps: number; pitchSteps: number }
  | { type: 'miniCubeRemoved'; playerId: string; id: MiniCubeId }
  | {
      type: 'levelAdvanced';
      playerId: string;
      levelIndex: number;
      gridSize: number;
      styleId: string;
      position: Position;
      removedIds: [];
    }
  | {
      type: 'stateSync';
      playerId: string;
      levelIndex: number;
      gridSize: number;
      styleId: string;
      removedIds: string[];
      yawSteps: number;
      pitchSteps: number;
    }
  | { type: 'error'; code: ErrorCode; detail?: string };

/** A decoded client frame: either the validated message or the pinned decode failure. */
export type ClientMessageParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: 'bad_message' };

/** A decoded server frame: either the validated message or the pinned decode failure. */
export type ServerMessageParseResult =
  | { ok: true; message: ServerMessage }
  | { ok: false; error: 'bad_message' };

/** A JSON object, as produced by `JSON.parse` for a well-formed frame. */
type JsonObject = Record<string, unknown>;

export type Identity =
  | { kind: 'account'; accountId: string; username: string }
  | { kind: 'guest'; playerId: string };

/** The placement payload shared by `welcome` (join/resume) and `worldEntered` (a mover). */
export interface Placement {
  playerId: string;
  name: string;
  token: string;
  serverId: number;
  maxUsers: number;
  position: Position;
  self: CubeState;
  roster: MemberState[];
  identity: Identity;
}

/** The payload of an authoritative board message (`stateSync`). */
export interface CubeSync {
  playerId: string;
  levelIndex: number;
  gridSize: number;
  styleId: string;
  removedIds: string[];
  yawSteps: number;
  pitchSteps: number;
}

/** Narrows an arbitrary decoded value to a plain JSON object (arrays and `null` excluded). */
function asJsonObject(value: unknown): JsonObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

/** A required string field: non-empty, so `""` can never pass as an identity or an id. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** A required numeric field (JSON numbers are always finite once parsed). */
function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/** A required integer field (rejects booleans, floats and non-numbers). */
function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** An array of strings (the wire `removedIds` shape); `[]` passes. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** The pinned error codes in catalog order — the only values an `error` frame may carry. */
const ERROR_CODES: readonly ErrorCode[] = [
  'bad_message',
  'not_joined',
  'rate_limited',
  'invalid_click',
  'invalid_completion',
  'resume_failed',
  'account_unverified',
  'not_authenticated',
];

/** A pinned error code (the `error` frame's `code` is a closed set, never free text). */
function isErrorCode(value: unknown): value is ErrorCode {
  return ERROR_CODES.some((code) => code === value);
}

function badClientMessage(): ClientMessageParseResult {
  return { ok: false, error: 'bad_message' };
}

function badServerMessage(): ServerMessageParseResult {
  return { ok: false, error: 'bad_message' };
}

/**
 * Decodes one client frame.
 *
 * Kept behaviourally identical to the backend decoder (T4) — the same fixtures produce the
 * same results on both ends (parity, AC-20). Field *values* are not judged: the server
 * validates them against the member's authoritative cube (AC-14/AC-15).
 */
export function parseClientMessage(text: string): ClientMessageParseResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return badClientMessage();
  }

  const frame = asJsonObject(decoded);
  if (frame === null) {
    return badClientMessage();
  }

  switch (frame.type) {
    case 'join': {
      if (frame.mode === undefined) {
        return { ok: true, message: { type: 'join' } };
      }
      if (frame.mode !== 'account' && frame.mode !== 'guest') {
        return badClientMessage();
      }
      return { ok: true, message: { type: 'join', mode: frame.mode } };
    }

    case 'rejoin':
      if (!isNonEmptyString(frame.token)) {
        return badClientMessage();
      }
      return { ok: true, message: { type: 'rejoin', token: frame.token } };

    case 'explode':
      if (!isNonEmptyString(frame.id) || !isNumber(frame.level)) {
        return badClientMessage();
      }
      // The wire type is the `face:row:col` template literal; existence is checked by the
      // server's `validateExplode`, so the decode only guarantees "a non-empty string id".
      return {
        ok: true,
        message: { type: 'explode', id: frame.id as MiniCubeId, level: frame.level },
      };

    case 'cubeCompleted':
      if (!isNumber(frame.level)) {
        return badClientMessage();
      }
      return { ok: true, message: { type: 'cubeCompleted', level: frame.level } };

    case 'rotate':
      if (!isInteger(frame.yawSteps) || !isInteger(frame.pitchSteps)) {
        return badClientMessage();
      }
      return {
        ok: true,
        message: { type: 'rotate', yawSteps: frame.yawSteps, pitchSteps: frame.pitchSteps },
      };

    default:
      return badClientMessage();
  }
}

/** A world-plane position from the wire (defensive copy), or `null` when malformed. */
function parsePosition(value: unknown): Position | null {
  const position = asJsonObject(value);
  if (position === null || !isNumber(position.x) || !isNumber(position.y)) {
    return null;
  }
  return { x: position.x, y: position.y };
}

/** One authoritative board from the wire (defensive copy of `removedIds`), or `null`. */
function parseCubeState(value: unknown): CubeState | null {
  const cube = asJsonObject(value);
  if (
    cube === null ||
    !isNumber(cube.levelIndex) ||
    !isNumber(cube.gridSize) ||
    !isNonEmptyString(cube.styleId) ||
    !isStringArray(cube.removedIds) ||
    !isInteger(cube.yawSteps) ||
    !isInteger(cube.pitchSteps) ||
    cube.yawSteps < 0 ||
    cube.yawSteps > MAX_STEPS ||
    cube.pitchSteps < -1 ||
    cube.pitchSteps > 1
  ) {
    return null;
  }
  return {
    levelIndex: cube.levelIndex,
    gridSize: cube.gridSize,
    styleId: cube.styleId,
    removedIds: [...cube.removedIds],
    yawSteps: cube.yawSteps,
    pitchSteps: cube.pitchSteps,
  };
}

/** One member from the wire (flattened cube state included), or `null` when malformed. */
function parseMemberState(value: unknown): MemberState | null {
  const member = asJsonObject(value);
  if (member === null) {
    return null;
  }
  const position = parsePosition(member.position);
  if (
    position === null ||
    !isNonEmptyString(member.playerId) ||
    !isNonEmptyString(member.name) ||
    !isNumber(member.levelIndex) ||
    !isNumber(member.gridSize) ||
    !isNonEmptyString(member.styleId) ||
    !isStringArray(member.removedIds) ||
    !isInteger(member.yawSteps) ||
    !isInteger(member.pitchSteps) ||
    member.yawSteps < 0 ||
    member.yawSteps > MAX_STEPS ||
    member.pitchSteps < -1 ||
    member.pitchSteps > 1
  ) {
    return null;
  }
  return {
    playerId: member.playerId,
    name: member.name,
    position,
    levelIndex: member.levelIndex,
    gridSize: member.gridSize,
    styleId: member.styleId,
    removedIds: [...member.removedIds],
    yawSteps: member.yawSteps,
    pitchSteps: member.pitchSteps,
  };
}

function parseIdentity(value: unknown): Identity | null {
  const obj = asJsonObject(value);
  if (obj === null) return null;
  if (obj.kind === 'account') {
    if (!isNonEmptyString(obj.accountId) || !isNonEmptyString(obj.username)) {
      return null;
    }
    return { kind: 'account', accountId: obj.accountId, username: obj.username };
  }
  if (obj.kind === 'guest') {
    if (!isNonEmptyString(obj.playerId)) {
      return null;
    }
    return { kind: 'guest', playerId: obj.playerId };
  }
  return null;
}

/** The `welcome`/`worldEntered` payload (identity + assignment + full world), or `null`. */
function parsePlacement(frame: JsonObject): Placement | null {
  if (
    !isNonEmptyString(frame.playerId) ||
    !isNonEmptyString(frame.name) ||
    !isNonEmptyString(frame.token) ||
    !isNumber(frame.serverId) ||
    !isNumber(frame.maxUsers)
  ) {
    return null;
  }
  const position = parsePosition(frame.position);
  const self = parseCubeState(frame.self);
  const identity = parseIdentity(frame.identity);
  if (position === null || self === null || identity === null || !Array.isArray(frame.roster)) {
    return null;
  }
  const roster: MemberState[] = [];
  for (const entry of frame.roster) {
    const member = parseMemberState(entry);
    if (member === null) {
      return null;
    }
    roster.push(member);
  }
  return {
    playerId: frame.playerId,
    name: frame.name,
    token: frame.token,
    serverId: frame.serverId,
    maxUsers: frame.maxUsers,
    position,
    self,
    roster,
    identity,
  };
}

/**
 * Decodes one server frame — the transport's only way to turn a received frame into
 * trusted data.
 */
export function parseServerMessage(text: string): ServerMessageParseResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return badServerMessage();
  }

  const frame = asJsonObject(decoded);
  if (frame === null) {
    return badServerMessage();
  }

  switch (frame.type) {
    case 'hello':
      if (!isNonEmptyString(frame.serverTime)) {
        return badServerMessage();
      }
      return { ok: true, message: { type: 'hello', serverTime: frame.serverTime } };

    case 'welcome':
    case 'worldEntered': {
      const placement = parsePlacement(frame);
      if (placement === null) {
        return badServerMessage();
      }
      return {
        ok: true,
        message: {
          type: frame.type === 'welcome' ? 'welcome' : 'worldEntered',
          ...placement,
        },
      };
    }

    case 'memberJoined': {
      const member = parseMemberState(frame.member);
      if (member === null) {
        return badServerMessage();
      }
      return { ok: true, message: { type: 'memberJoined', member } };
    }

    case 'memberLeft':
      if (
        !isNonEmptyString(frame.playerId) ||
        (frame.reason !== 'left' && frame.reason !== 'moved')
      ) {
        return badServerMessage();
      }
      return { ok: true, message: { type: 'memberLeft', playerId: frame.playerId, reason: frame.reason } };

    case 'cubeRotated':
      if (
        !isNonEmptyString(frame.playerId) ||
        !isInteger(frame.yawSteps) ||
        !isInteger(frame.pitchSteps) ||
        frame.yawSteps < 0 ||
        frame.yawSteps > MAX_STEPS ||
        frame.pitchSteps < -1 ||
        frame.pitchSteps > 1
      ) {
        return badServerMessage();
      }
      return {
        ok: true,
        message: {
          type: 'cubeRotated',
          playerId: frame.playerId,
          yawSteps: frame.yawSteps,
          pitchSteps: frame.pitchSteps,
        },
      };

    case 'miniCubeRemoved':
      if (!isNonEmptyString(frame.playerId) || !isNonEmptyString(frame.id)) {
        return badServerMessage();
      }
      return {
        ok: true,
        message: {
          type: 'miniCubeRemoved',
          playerId: frame.playerId,
          id: frame.id as MiniCubeId,
        },
      };

    case 'levelAdvanced': {
      const position = parsePosition(frame.position);
      if (
        !isNonEmptyString(frame.playerId) ||
        !isNumber(frame.levelIndex) ||
        !isNumber(frame.gridSize) ||
        !isNonEmptyString(frame.styleId) ||
        position === null ||
        !isStringArray(frame.removedIds) ||
        frame.removedIds.length > 0
      ) {
        return badServerMessage();
      }
      return {
        ok: true,
        message: {
          type: 'levelAdvanced',
          playerId: frame.playerId,
          levelIndex: frame.levelIndex,
          gridSize: frame.gridSize,
          styleId: frame.styleId,
          position,
          removedIds: [],
        },
      };
    }

    case 'stateSync': {
      const cube = parseCubeState(frame);
      if (cube === null || !isNonEmptyString(frame.playerId)) {
        return badServerMessage();
      }
      return {
        ok: true,
        message: {
          type: 'stateSync',
          playerId: frame.playerId,
          levelIndex: cube.levelIndex,
          gridSize: cube.gridSize,
          styleId: cube.styleId,
          removedIds: cube.removedIds,
          yawSteps: cube.yawSteps,
          pitchSteps: cube.pitchSteps,
        },
      };
    }

    case 'error': {
      if (!isErrorCode(frame.code)) {
        return badServerMessage();
      }
      const code = frame.code;
      if (frame.detail === undefined) {
        return { ok: true, message: { type: 'error', code } };
      }
      if (typeof frame.detail !== 'string') {
        return badServerMessage();
      }
      return { ok: true, message: { type: 'error', code, detail: frame.detail } };
    }

    default:
      return badServerMessage();
  }
}

/** Serialises one client message into the single JSON text frame sent over the wire. */
export function encodeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}

/** Serialises one server message into the single JSON text frame (parity helper). */
export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

/** Builds a client `rotate` message (orientation report). */
export function rotateMessage(
  yawStepsOrPayload: number | { yawSteps: number; pitchSteps: number },
  pitchSteps?: number,
): ClientMessage {
  const yawSteps =
    typeof yawStepsOrPayload === 'number' ? yawStepsOrPayload : yawStepsOrPayload.yawSteps;
  const pitch =
    typeof yawStepsOrPayload === 'number' ? (pitchSteps as number) : yawStepsOrPayload.pitchSteps;
  return { type: 'rotate', yawSteps, pitchSteps: pitch };
}

/** Builds a server `cubeRotated` message. */
export function cubeRotatedMessage(
  playerIdOrPayload: string | { playerId: string; yawSteps: number; pitchSteps: number },
  yawSteps?: number,
  pitchSteps?: number,
): ServerMessage {
  const playerId =
    typeof playerIdOrPayload === 'string' ? playerIdOrPayload : playerIdOrPayload.playerId;
  const yaw =
    typeof playerIdOrPayload === 'string' ? (yawSteps as number) : playerIdOrPayload.yawSteps;
  const pitch =
    typeof playerIdOrPayload === 'string' ? (pitchSteps as number) : playerIdOrPayload.pitchSteps;
  return { type: 'cubeRotated', playerId, yawSteps: yaw, pitchSteps: pitch };
}

/** Builds a server `stateSync` message. */
export function stateSyncMessage(cube: CubeSync): ServerMessage {
  return {
    type: 'stateSync',
    playerId: cube.playerId,
    levelIndex: cube.levelIndex,
    gridSize: cube.gridSize,
    styleId: cube.styleId,
    removedIds: [...cube.removedIds],
    yawSteps: cube.yawSteps,
    pitchSteps: cube.pitchSteps,
  };
}
