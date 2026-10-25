/**
 * The multiplayer wire catalog and its codecs (T4).
 *
 * One JSON text message per WebSocket frame (spec § 8). This module owns the shapes for
 * both directions, the client-message codec and the server-message builders/encoder the
 * hub uses. Everything here is pure: JSON in, JSON out — no sockets, no timers, no I/O.
 *
 * Pinned rules implemented here (plan § Protocol, spec § 8):
 * - `hello` stays the exact accepted envelope (`{ type: 'hello', serverTime }`, built by
 *   `app.ts`); the catalog only declares its shape, it never renames or extends it;
 * - field validation is presence + type: an unknown `type`, a non-JSON frame, a missing
 *   required field or a wrong field type all decode to `bad_message` (AC-20);
 * - semantic validation (does the id exist, is the level current, is the cube complete) is
 *   the hub's job — `explode`/`cubeCompleted` carry those values through untouched;
 * - unknown extra fields are ignored: decoders return the pinned shape only, so nothing
 *   unvetted can travel further into the server;
 * - `MAX_MESSAGE_BYTES` (1024) is exported here as the codec constant; the size check
 *   itself belongs to the caller, which drops oversized frames with `bad_message`.
 */

import type { Position } from './servers.js';

export type { Position };

/**
 * Pinned message-size cap in bytes (spec § Pinned constants: 1024). Measured on the raw
 * frame text; the caller drops anything above it before decoding.
 */
export const MAX_MESSAGE_BYTES = 1024;

/**
 * Pinned upper bound for a single orientation step count (yaw). The spec defines
 * `yawSteps` in `0..3` and `pitchSteps` in `-1..1`; this constant records the yaw
 * upper bound (the larger of the two). Open question: the brief suggested a single
 * `MAX_STEPS` default of 8, but the spec pins the ranges above, so 3 is used and
 * the "8 default" is overridden (recorded as open in the build log).
 */
export const MAX_STEPS = 3;

/** Size cap applied to a `rotate` frame; identical to the global frame cap. */
export const MAX_ROTATE_BYTES = MAX_MESSAGE_BYTES;

/** The six cube faces, in the accepted board order (mirrors the frontend `FaceId`). */
export type FaceId = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

/** A mini-cube id: `face:row:col` (retained wire format). */
export type MiniCubeId = `${FaceId}:${number}:${number}`;

/** The authoritative board of one level, as sent over the wire (`z = 0` world plane). */
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
      identity: Identity;
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
      identity: Identity;
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

/** A JSON object, as produced by `JSON.parse` for a well-formed frame. */
type JsonObject = Record<string, unknown>;

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

function badMessage(): ClientMessageParseResult {
  return { ok: false, error: 'bad_message' };
}

/**
 * Decodes one client frame.
 *
 * Returns `{ ok: true, message }` with the pinned shape (extra fields dropped) or
 * `{ ok: false, error: 'bad_message' }` for non-JSON text, a non-object frame, an unknown
 * `type`, a missing required field or a field of the wrong type (AC-20). Field *values* are
 * not judged: `explode.id`/`level` and `cubeCompleted.level` are validated against the
 * member's authoritative cube by the hub, which answers `invalid_click`/`invalid_completion`
 * (AC-14/AC-15).
 */
export function parseClientMessage(text: string): ClientMessageParseResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return badMessage();
  }

  const frame = asJsonObject(decoded);
  if (frame === null) {
    return badMessage();
  }

  switch (frame.type) {
    case 'join': {
      if (frame.mode === undefined) {
        return { ok: true, message: { type: 'join' } };
      }
      if (frame.mode !== 'account' && frame.mode !== 'guest') {
        return badMessage();
      }
      return { ok: true, message: { type: 'join', mode: frame.mode } };
    }

    case 'rejoin':
      if (!isNonEmptyString(frame.token)) {
        return badMessage();
      }
      return { ok: true, message: { type: 'rejoin', token: frame.token } };

    case 'explode':
      if (!isNonEmptyString(frame.id) || !isNumber(frame.level)) {
        return badMessage();
      }
      // The wire type is the `face:row:col` template literal; existence is checked by the
      // hub's `validateExplode`, so the decode only guarantees "a non-empty string id".
      return {
        ok: true,
        message: { type: 'explode', id: frame.id as MiniCubeId, level: frame.level },
      };

    case 'cubeCompleted':
      if (!isNumber(frame.level)) {
        return badMessage();
      }
      return { ok: true, message: { type: 'cubeCompleted', level: frame.level } };

    case 'rotate':
      if (!isInteger(frame.yawSteps) || !isInteger(frame.pitchSteps)) {
        return badMessage();
      }
      return {
        ok: true,
        message: { type: 'rotate', yawSteps: frame.yawSteps, pitchSteps: frame.pitchSteps },
      };

    default:
      return badMessage();
  }
}

/**
 * The placement payload shared by `welcome` (join/resume) and `worldEntered` (a mover whose
 * next cube lands on a different server): identity, assignment and the full world state.
 */
export type Identity =
  | { kind: 'account'; accountId: string; username: string }
  | { kind: 'guest'; playerId: string };

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

/** The payload of a fresh-cube broadcast (`levelAdvanced`; `removedIds` is always empty). */
export interface LevelAdvance {
  playerId: string;
  levelIndex: number;
  gridSize: number;
  styleId: string;
  position: Position;
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

/** The shared `welcome`/`worldEntered` payload, copied so later mutations cannot leak in. */
function placementPayload(placement: Placement): Placement {
  const identity: Identity =
    placement.identity.kind === 'account'
      ? {
          kind: 'account',
          accountId: placement.identity.accountId,
          username: placement.identity.username,
        }
      : { kind: 'guest', playerId: placement.identity.playerId };
  return {
    playerId: placement.playerId,
    name: placement.name,
    token: placement.token,
    serverId: placement.serverId,
    maxUsers: placement.maxUsers,
    position: { x: placement.position.x, y: placement.position.y },
    self: copyCubeState(placement.self),
    roster: placement.roster.map(copyMemberState),
    identity,
  };
}

/** The identity + assignment + world-state message sent on join and resume. */
export function welcomeMessage(placement: Placement): ServerMessage {
  return { type: 'welcome', ...placementPayload(placement) };
}

/** The same placement payload, sent to a mover whose next cube lands elsewhere. */
export function worldEnteredMessage(placement: Placement): ServerMessage {
  return { type: 'worldEntered', ...placementPayload(placement) };
}

/** Broadcast to a server's existing members when someone joins (or moves in). */
export function memberJoinedMessage(member: MemberState): ServerMessage {
  return { type: 'memberJoined', member: copyMemberState(member) };
}

/** Broadcast when a member leaves after grace expiry (`left`) or moves servers (`moved`). */
export function memberLeftMessage(playerId: string, reason: 'left' | 'moved'): ServerMessage {
  return { type: 'memberLeft', playerId, reason };
}

/** Broadcast to **all** members of a server, including the origin player (ack). */
export function miniCubeRemovedMessage(playerId: string, id: MiniCubeId): ServerMessage {
  return { type: 'miniCubeRemoved', playerId, id };
}

/** Broadcast to all members of a server when one member's cube advances to a fresh level. */
export function levelAdvancedMessage(advance: LevelAdvance): ServerMessage {
  return {
    type: 'levelAdvanced',
    playerId: advance.playerId,
    levelIndex: advance.levelIndex,
    gridSize: advance.gridSize,
    styleId: advance.styleId,
    position: { x: advance.position.x, y: advance.position.y },
    removedIds: [],
  };
}

/** The authoritative board for one member: join/resume payloads and corrections. */
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

/** Broadcast to all other members of a server when one member's cube orientation settles. */
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

/** An error addressed to one client (`detail` omitted when not supplied). */
export function errorMessage(code: ErrorCode, detail?: string): ServerMessage {
  return detail === undefined ? { type: 'error', code } : { type: 'error', code, detail };
}

/** Serialises one server message into the single JSON text frame sent over the wire. */
export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

/** Defensive copy of a cube state (the wire `removedIds` is a plain mutable array). */
function copyCubeState(cube: CubeState): CubeState {
  return {
    levelIndex: cube.levelIndex,
    gridSize: cube.gridSize,
    styleId: cube.styleId,
    removedIds: [...cube.removedIds],
    yawSteps: cube.yawSteps,
    pitchSteps: cube.pitchSteps,
  };
}

/** Defensive copy of a member state (flattened cube state included). */
function copyMemberState(member: MemberState): MemberState {
  return {
    playerId: member.playerId,
    name: member.name,
    position: { x: member.position.x, y: member.position.y },
    levelIndex: member.levelIndex,
    gridSize: member.gridSize,
    styleId: member.styleId,
    removedIds: [...member.removedIds],
    yawSteps: member.yawSteps,
    pitchSteps: member.pitchSteps,
  };
}
