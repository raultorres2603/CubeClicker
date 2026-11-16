/**
 * The multiplayer wire catalog and its codecs (T4).
 *
 * One JSON text message per WebSocket frame (spec § 8). This module owns the shapes for
 * both directions, the client-message codec, the server-message builders/encoder the hub
 * uses and the outbound `lootboxOpened` payload codec. Everything here is pure: JSON in,
 * JSON out — no sockets, no timers, no I/O.
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
 * - `lootboxOpened` is the opener-only grant: `parseLootboxOpened` pins the AC-24 rules and
 *   copies the nested maps, and `lootboxOpenedMessage` rejects an invalid payload instead of
 *   putting it on the wire;
 * - `miniCubesRemoved` is the batched removal frame (AC-8): `miniCubesRemovedMessage`
 *   validates the non-empty player and every non-empty id at runtime, copies the ids, and
 *   throws `TypeError` instead of putting an invalid payload on the wire; the legacy
 *   one-id `miniCubeRemoved` shape is unchanged (AC-9);
 * - `MAX_MESSAGE_BYTES` (1024) is exported here as the codec constant; the size check
 *   itself belongs to the caller, which drops oversized frames with `bad_message`;
 * - the diagnostic `ping`/`pong` pair is additive: `parseClientMessage` accepts a
 *   `{ type: 'ping', t }` frame only with a finite numeric `t`, and `pongMessage(t)` echoes
 *   it. The pair carries no identity or game state and changes no other frame;
 * - `activityEvent` is the additive server-only feed frame (feature `live-activity-feed`):
 *   `parseActivityEvent` enforces the shared validation matrix and returns the pinned shape,
 *   `activityEventMessage` re-validates and copies (throwing `TypeError` on an invalid
 *   payload) and `placementPayload` always includes a copied `activity` array (absent → `[]`)
 *   on `welcome`/`worldEntered`. The client catalog is unchanged, so a client
 *   `activityEvent` frame decodes to `bad_message`.
 * - `leaderboardUpdate` is the additive server-only ranking frame (feature
 *   `server-live-leaderboard`): `parseLeaderboardSnapshot` enforces the shared validation
 *   matrix and returns the pinned shape with fresh copies, `copyLeaderboardSnapshot` and
 *   `leaderboardUpdateMessage` re-validate + copy (throwing `TypeError` on invalid) and an
 *   optional `leaderboard` snapshot travels on `welcome`/`worldEntered` (absence preserved).
 *   The client catalog is unchanged and there is no protocol version bump.
 * - `leave` is the additive, self-only client frame (feature `presence-and-activity-liveness`):
 *   `parseClientMessage` accepts exactly `{ type: 'leave' }`, drops extra fields like every
 *   catalog message and adds no server message variant; the hub removes only the sending
 *   connection's member. `ACTIVITY_EVENT_TTL_MS` pins the 5000 ms activity eligibility TTL
 *   shared verbatim with the frontend mirror.
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

/**
 * Pinned per-server activity ring size (`live-activity-feed`): at most 20 accepted events,
 * newest first. Shared verbatim with the frontend mirror.
 */
export const ACTIVITY_FEED_LIMIT = 20;

/**
 * Pinned activity lifetime (`presence-and-activity-liveness`): an event is fresh iff
 * `serverNow - event.at < ACTIVITY_EVENT_TTL_MS`; at exactly 5000 ms it is expired and can
 * never travel in a `welcome`/`worldEntered` snapshot. Shared verbatim with the frontend
 * mirror, where it is the display lifetime.
 */
export const ACTIVITY_EVENT_TTL_MS = 5000;

/**
 * Pinned leaderboard row cap (`server-live-leaderboard`): a snapshot carries at most the
 * five highest-ranked current members. Shared verbatim with the frontend mirror.
 */
export const LEADERBOARD_TOP_LIMIT = 5;

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

/**
 * One accepted per-server activity event (`live-activity-feed`).
 *
 * The envelope is always `id`, `at`, `serverId`, `type`, `playerId`, `name` (in that
 * construction order, which pins the encoded frame) plus the type-specific fields:
 * `level` for the three cube-completion types, `elapsedMs` for `fastClear` and `partId`
 * for `epicLoot`. `at` is the backend's injected clock at acceptance; no field is ever
 * client-supplied.
 */
export type ActivityEvent =
  | {
      id: number;
      at: number;
      serverId: number;
      type: 'cubeCleared';
      playerId: string;
      name: string;
      level: number;
    }
  | {
      id: number;
      at: number;
      serverId: number;
      type: 'fastClear';
      playerId: string;
      name: string;
      level: number;
      elapsedMs: number;
    }
  | {
      id: number;
      at: number;
      serverId: number;
      type: 'levelMilestone';
      playerId: string;
      name: string;
      level: number;
    }
  | {
      id: number;
      at: number;
      serverId: number;
      type: 'epicLoot';
      playerId: string;
      name: string;
      partId: string;
    }
  | {
      id: number;
      at: number;
      serverId: number;
      type: 'memberJoined';
      playerId: string;
      name: string;
    }
  | {
      id: number;
      at: number;
      serverId: number;
      type: 'memberLeft';
      playerId: string;
      name: string;
    };

/**
 * One ranked leaderboard row (`server-live-leaderboard`): server-issued identity plus the
 * member's session counters. Coins, upgrades and account totals are never part of it.
 */
export interface LeaderboardEntry {
  playerId: string;
  name: string;
  cubesCompleted: number;
  clicks: number;
}

/**
 * One server's ranked session snapshot, carried by `leaderboardUpdate` and by the optional
 * `leaderboard` field of `welcome`/`worldEntered`.
 *
 * `entries` is already in server rank order (cubes desc → clicks desc → slot order) and is
 * capped at {@link LEADERBOARD_TOP_LIMIT}; `totals` is summed over **all** current members
 * of the server, including members outside the top five.
 */
export interface LeaderboardSnapshot {
  serverId: number;
  at: number;
  entries: LeaderboardEntry[];
  totals: {
    cubesCompleted: number;
    clicks: number;
    facesDestroyed: number;
  };
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
  | 'not_authenticated'
  | 'insufficient_funds'
  | 'unknown_upgrade'
  | 'max_level'
  | 'no_lootbox'
  | 'no_key'
  | 'unknown_part'
  | 'not_owned'
  | 'unknown_slot';

/** Client → server catalog (spec § 8). */
export type ClientMessage =
  | { type: 'join'; mode?: 'account' | 'guest' }
  | { type: 'rejoin'; token: string }
  | { type: 'explode'; id: MiniCubeId; level: number }
  | { type: 'cubeCompleted'; level: number }
  | { type: 'rotate'; yawSteps: number; pitchSteps: number }
  | { type: 'purchaseUpgrade'; upgradeId: string }
  | { type: 'openLootbox' }
  | { type: 'equipPart'; partId: string }
  | { type: 'unequipPart'; slotId: string }
  | { type: 'ping'; t: number }
  | { type: 'leave' };

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
      activity?: ActivityEvent[];
      leaderboard?: LeaderboardSnapshot;
      identity: Identity;
      economy?: EconomyState;
      upgrades?: UpgradeState;
      customization?: CustomizationState;
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
      activity?: ActivityEvent[];
      leaderboard?: LeaderboardSnapshot;
      identity: Identity;
      economy?: EconomyState;
      upgrades?: UpgradeState;
      customization?: CustomizationState;
    }
  | { type: 'memberJoined'; member: MemberState }
  | { type: 'memberLeft'; playerId: string; reason: 'left' | 'moved' }
  | { type: 'activityEvent'; event: ActivityEvent }
  | { type: 'leaderboardUpdate'; leaderboard: LeaderboardSnapshot }
  | { type: 'cubeRotated'; playerId: string; yawSteps: number; pitchSteps: number }
  | { type: 'miniCubeRemoved'; playerId: string; id: MiniCubeId }
  | { type: 'miniCubesRemoved'; playerId: string; ids: MiniCubeId[] }
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
  | { type: 'economyUpdate'; coins: number; clicks: number; facesDestroyed: number; cubesDestroyed: number }
  | { type: 'upgradesUpdate'; upgrades: UpgradeState }
  | { type: 'customizationUpdate'; lootboxes: number; keys: number; parts: Record<string, number>; appearance: Record<string, string> }
  | ({ type: 'lootboxOpened' } & LootboxOpened)
  | { type: 'error'; code: ErrorCode; detail?: string }
  | { type: 'pong'; t: number };

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

/** A finite JSON number (`1e999` parses to `Infinity` and must not reach the hub). */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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

    case 'purchaseUpgrade':
      if (!isNonEmptyString(frame.upgradeId)) {
        return badMessage();
      }
      return { ok: true, message: { type: 'purchaseUpgrade', upgradeId: frame.upgradeId } };

    case 'openLootbox':
      return { ok: true, message: { type: 'openLootbox' } };

    case 'equipPart':
      if (!isNonEmptyString(frame.partId)) {
        return badMessage();
      }
      return { ok: true, message: { type: 'equipPart', partId: frame.partId } };

    case 'unequipPart':
      if (!isNonEmptyString(frame.slotId)) {
        return badMessage();
      }
      return { ok: true, message: { type: 'unequipPart', slotId: frame.slotId } };

    case 'ping':
      // Diagnostic RTT echo: one finite number, nothing else (AC-23). A missing, string,
      // boolean or non-finite `t` is exactly the pinned `bad_message` result.
      if (!isFiniteNumber(frame.t)) {
        return badMessage();
      }
      return { ok: true, message: { type: 'ping', t: frame.t } };

    case 'leave':
      // Additive, self-only close intent (AC-8): exactly `{ type: 'leave' }`; every extra
      // field (including a forged `playerId`) is dropped, so nothing can select another
      // member. The hub removes only the sending connection's member.
      return { ok: true, message: { type: 'leave' } };

    default:
      return badMessage();
  }
}

/** A positive integer wire field: `0`, negatives, floats and non-numbers are invalid. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** A finite number `>= 0` wire field (times and durations). */
function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Decodes one `ActivityEvent` payload (the shared validation matrix).
 *
 * Returns the pinned shape with exactly the documented fields (unknown extras are dropped)
 * or `null` when any rule fails: positive-integer `id`/`serverId`/`level`, finite
 * non-negative `at`/`elapsedMs`, non-empty `playerId`/`name`/`partId`, the closed six-type
 * union and the type-specific required fields. Every returned object is a fresh value; the
 * key order is the pinned wire order (`id`, `at`, `serverId`, `type`, `playerId`, `name`,
 * then `level` / `elapsedMs` / `partId`).
 */
export function parseActivityEvent(value: unknown): ActivityEvent | null {
  const frame = asJsonObject(value);
  if (frame === null) {
    return null;
  }

  const { id, at, serverId, type, playerId, name } = frame;
  if (!isPositiveInteger(id) || !isNonNegativeFiniteNumber(at) || !isPositiveInteger(serverId)) {
    return null;
  }
  if (!isNonEmptyString(playerId) || !isNonEmptyString(name)) {
    return null;
  }

  switch (type) {
    case 'cubeCleared':
    case 'levelMilestone': {
      const level = frame.level;
      if (!isPositiveInteger(level)) {
        return null;
      }
      if (type === 'cubeCleared') {
        return { id, at, serverId, type: 'cubeCleared', playerId, name, level };
      }
      return { id, at, serverId, type: 'levelMilestone', playerId, name, level };
    }

    case 'fastClear': {
      const level = frame.level;
      const elapsedMs = frame.elapsedMs;
      if (!isPositiveInteger(level) || !isNonNegativeFiniteNumber(elapsedMs)) {
        return null;
      }
      return { id, at, serverId, type: 'fastClear', playerId, name, level, elapsedMs };
    }

    case 'epicLoot': {
      const partId = frame.partId;
      if (!isNonEmptyString(partId)) {
        return null;
      }
      return { id, at, serverId, type: 'epicLoot', playerId, name, partId };
    }

    case 'memberJoined':
      return { id, at, serverId, type: 'memberJoined', playerId, name };

    case 'memberLeft':
      return { id, at, serverId, type: 'memberLeft', playerId, name };

    default:
      return null;
  }
}

/**
 * Defensive copy of one activity event with the pinned wire key order.
 *
 * The input is expected to be a valid `ActivityEvent`; a payload that no longer satisfies
 * the validation matrix throws `TypeError` instead of leaking a malformed object.
 */
export function copyActivityEvent(event: ActivityEvent): ActivityEvent {
  switch (event.type) {
    case 'cubeCleared':
      return {
        id: event.id,
        at: event.at,
        serverId: event.serverId,
        type: 'cubeCleared',
        playerId: event.playerId,
        name: event.name,
        level: event.level,
      };

    case 'fastClear':
      return {
        id: event.id,
        at: event.at,
        serverId: event.serverId,
        type: 'fastClear',
        playerId: event.playerId,
        name: event.name,
        level: event.level,
        elapsedMs: event.elapsedMs,
      };

    case 'levelMilestone':
      return {
        id: event.id,
        at: event.at,
        serverId: event.serverId,
        type: 'levelMilestone',
        playerId: event.playerId,
        name: event.name,
        level: event.level,
      };

    case 'epicLoot':
      return {
        id: event.id,
        at: event.at,
        serverId: event.serverId,
        type: 'epicLoot',
        playerId: event.playerId,
        name: event.name,
        partId: event.partId,
      };

    case 'memberJoined':
      return {
        id: event.id,
        at: event.at,
        serverId: event.serverId,
        type: 'memberJoined',
        playerId: event.playerId,
        name: event.name,
      };

    case 'memberLeft':
      return {
        id: event.id,
        at: event.at,
        serverId: event.serverId,
        type: 'memberLeft',
        playerId: event.playerId,
        name: event.name,
      };
  }
}

/**
 * Builds the server-only `activityEvent` frame (AC-12).
 *
 * The event is re-validated through {@link parseActivityEvent} and copied, so an invalid
 * payload (despite the static type) throws `TypeError` instead of reaching the wire. The
 * client catalog has no matching message: a client `activityEvent` frame is `bad_message`.
 */
export function activityEventMessage(event: ActivityEvent): ServerMessage {
  const parsed = parseActivityEvent(event);
  if (parsed === null) {
    throw new TypeError('invalid activityEvent payload');
  }
  return { type: 'activityEvent', event: parsed };
}

/**
 * A non-negative integer wire field: `0` is valid; negatives, floats, `NaN` and non-numbers
 * are not (the session counters and every total).
 */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Decodes one `LeaderboardSnapshot` payload (the shared validation matrix).
 *
 * Returns the pinned shape with exactly the documented fields — positive-integer `serverId`,
 * finite non-negative `at`, 0…{@link LEADERBOARD_TOP_LIMIT} entries with non-empty
 * `playerId`/`name` and non-negative-integer counters, and a `totals` object with three
 * non-negative-integer counters — or `null` when any rule fails. Unknown extra fields are
 * dropped and every returned object (the entries array, each entry and the totals) is a
 * fresh copy in the pinned wire key order.
 */
export function parseLeaderboardSnapshot(value: unknown): LeaderboardSnapshot | null {
  const frame = asJsonObject(value);
  if (frame === null) {
    return null;
  }

  const { serverId, at, entries, totals } = frame;
  if (!isPositiveInteger(serverId) || !isNonNegativeFiniteNumber(at)) {
    return null;
  }
  if (!Array.isArray(entries) || entries.length > LEADERBOARD_TOP_LIMIT) {
    return null;
  }

  const copiedEntries: LeaderboardEntry[] = [];
  for (const candidate of entries) {
    const entry = asJsonObject(candidate);
    if (entry === null) {
      return null;
    }
    const { playerId, name, cubesCompleted, clicks } = entry;
    if (
      !isNonEmptyString(playerId) ||
      !isNonEmptyString(name) ||
      !isNonNegativeInteger(cubesCompleted) ||
      !isNonNegativeInteger(clicks)
    ) {
      return null;
    }
    copiedEntries.push({ playerId, name, cubesCompleted, clicks });
  }

  const totalsObject = asJsonObject(totals);
  if (totalsObject === null) {
    return null;
  }
  const { cubesCompleted, clicks, facesDestroyed } = totalsObject;
  if (
    !isNonNegativeInteger(cubesCompleted) ||
    !isNonNegativeInteger(clicks) ||
    !isNonNegativeInteger(facesDestroyed)
  ) {
    return null;
  }

  return {
    serverId,
    at,
    entries: copiedEntries,
    totals: { cubesCompleted, clicks, facesDestroyed },
  };
}

/**
 * Defensive copy of one leaderboard snapshot in the pinned wire key order.
 *
 * The input is expected to be a valid `LeaderboardSnapshot`; a payload that no longer
 * satisfies the validation matrix throws `TypeError` instead of leaking a malformed object.
 */
export function copyLeaderboardSnapshot(snapshot: LeaderboardSnapshot): LeaderboardSnapshot {
  const parsed = parseLeaderboardSnapshot(snapshot);
  if (parsed === null) {
    throw new TypeError('invalid leaderboard snapshot');
  }
  return parsed;
}

/**
 * Builds the server-only `leaderboardUpdate` frame (AC-14).
 *
 * The snapshot is re-validated through {@link parseLeaderboardSnapshot} and copied, so an
 * invalid payload (despite the static type) throws `TypeError` instead of reaching the wire.
 * The client catalog has no matching message: a client `leaderboardUpdate` frame is
 * `bad_message`.
 */
export function leaderboardUpdateMessage(snapshot: LeaderboardSnapshot): ServerMessage {
  const parsed = parseLeaderboardSnapshot(snapshot);
  if (parsed === null) {
    throw new TypeError('invalid leaderboardUpdate payload');
  }
  return { type: 'leaderboardUpdate', leaderboard: parsed };
}

/**
 * The placement payload shared by `welcome` (join/resume) and `worldEntered` (a mover whose
 * next cube lands on a different server): identity, assignment and the full world state.
 */
export type Identity =
  | { kind: 'account'; accountId: string; username: string }
  | { kind: 'guest'; playerId: string };

export type UpgradeState = Record<string, number>;

export interface CustomizationState {
  lootboxes: number;
  keys: number;
  parts: Record<string, number>;
  appearance: Record<string, string>;
}

/**
 * The opener-only lootbox grant (AC-24): what the opening connection needs to play the
 * reveal, plus the absolute customization state after the open. `parts`/`appearance` are
 * plain maps on the wire; the codec copies them so no caller-owned object is ever aliased.
 */
export interface LootboxOpened {
  partId: string;
  slot: string;
  rarity: 'rare' | 'epic';
  duplicate: boolean;
  lootboxes: number;
  keys: number;
  parts: Record<string, number>;
  appearance: Record<string, string>;
}

export interface EconomyState {
  coins: number;
  clicks: number;
  facesDestroyed: number;
  cubesDestroyed: number;
}

export interface Placement {
  playerId: string;
  name: string;
  token: string;
  serverId: number;
  maxUsers: number;
  position: Position;
  self: CubeState;
  roster: MemberState[];
  activity?: ActivityEvent[];
  leaderboard?: LeaderboardSnapshot;
  identity: Identity;
  economy?: EconomyState;
  upgrades?: UpgradeState;
  customization?: CustomizationState;
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
    activity: (placement.activity ?? []).map(copyActivityEvent),
    ...(placement.leaderboard
      ? { leaderboard: copyLeaderboardSnapshot(placement.leaderboard) }
      : {}),
    identity,
    ...(placement.economy ? { economy: copyEconomyState(placement.economy) } : {}),
    ...(placement.upgrades ? { upgrades: copyUpgradeState(placement.upgrades) } : {}),
    ...(placement.customization ? { customization: copyCustomizationState(placement.customization) } : {}),
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

/** Builds an `economyUpdate` message carrying the server's absolute totals. */
export function economyUpdateMessage(
  economyOrCoins:
    | EconomyState
    | { coins: number; clicks: number; facesDestroyed: number; cubesDestroyed: number }
    | number,
  clicks?: number,
  facesDestroyed?: number,
  cubesDestroyed?: number,
): ServerMessage {
  let coins: number;
  let c: number;
  let f: number;
  let cb: number;
  if (typeof economyOrCoins === 'number') {
    coins = economyOrCoins;
    c = clicks as number;
    f = facesDestroyed as number;
    cb = cubesDestroyed as number;
  } else {
    coins = economyOrCoins.coins;
    c = economyOrCoins.clicks;
    f = economyOrCoins.facesDestroyed;
    cb = economyOrCoins.cubesDestroyed;
  }
  return { type: 'economyUpdate', coins, clicks: c, facesDestroyed: f, cubesDestroyed: cb };
}

/** Builds an `upgradesUpdate` message carrying the server's absolute upgrade levels. */
export function upgradesUpdateMessage(upgrades: UpgradeState): ServerMessage {
  return { type: 'upgradesUpdate', upgrades: copyUpgradeState(upgrades) };
}

/** Builds a `customizationUpdate` message carrying the server's absolute customization state. */
export function customizationUpdateMessage(state: CustomizationState): ServerMessage {
  return { type: 'customizationUpdate', ...copyCustomizationState(state) };
}

/** Defensive copy of a customization state (lootboxes, keys, parts, appearance). */
export function copyCustomizationState(state: CustomizationState): CustomizationState {
  const parts: Record<string, number> = {};
  for (const key of Object.keys(state.parts)) {
    parts[key] = state.parts[key];
  }
  const appearance: Record<string, string> = {};
  for (const key of Object.keys(state.appearance)) {
    appearance[key] = state.appearance[key];
  }
  return {
    lootboxes: state.lootboxes,
    keys: state.keys,
    parts,
    appearance,
  };
}

/**
 * Decodes a `lootboxOpened` payload (AC-24).
 *
 * Returns the pinned shape with defensive copies of `parts`/`appearance`, or `null` when a
 * field is missing, mistyped or out of range: `partId`/`slot` must be non-empty strings,
 * `rarity` is exactly `rare` or `epic`, `duplicate` is a boolean, `lootboxes`/`keys` are
 * non-negative integers, `parts` counts are positive integers and `appearance` keys/values
 * are non-empty strings. Unknown extra fields are dropped, like every other codec here.
 * The `type` discriminator belongs to the enclosing `ServerMessage` and is ignored.
 */
export function parseLootboxOpened(value: unknown): LootboxOpened | null {
  const frame = asJsonObject(value);
  if (frame === null) {
    return null;
  }
  if (!isNonEmptyString(frame.partId) || !isNonEmptyString(frame.slot)) {
    return null;
  }
  if (frame.rarity !== 'rare' && frame.rarity !== 'epic') {
    return null;
  }
  if (typeof frame.duplicate !== 'boolean') {
    return null;
  }
  if (!isInteger(frame.lootboxes) || (frame.lootboxes as number) < 0) {
    return null;
  }
  if (!isInteger(frame.keys) || (frame.keys as number) < 0) {
    return null;
  }
  const partsObj = asJsonObject(frame.parts);
  if (partsObj === null) {
    return null;
  }
  const appearanceObj = asJsonObject(frame.appearance);
  if (appearanceObj === null) {
    return null;
  }
  const parts: Record<string, number> = {};
  for (const key of Object.keys(partsObj)) {
    if (key.length === 0) {
      return null;
    }
    const count = partsObj[key];
    if (!isInteger(count) || (count as number) <= 0) {
      return null;
    }
    parts[key] = count as number;
  }
  const appearance: Record<string, string> = {};
  for (const key of Object.keys(appearanceObj)) {
    if (key.length === 0) {
      return null;
    }
    if (!isNonEmptyString(appearanceObj[key])) {
      return null;
    }
    appearance[key] = appearanceObj[key] as string;
  }
  return {
    partId: frame.partId,
    slot: frame.slot,
    rarity: frame.rarity,
    duplicate: frame.duplicate,
    lootboxes: frame.lootboxes as number,
    keys: frame.keys as number,
    parts,
    appearance,
  };
}

/**
 * Builds the opener-only `lootboxOpened` message. The payload is re-validated through the
 * AC-24 codec so a malformed repository state can never reach the wire; the maps are copied.
 */
export function lootboxOpenedMessage(payload: LootboxOpened): ServerMessage {
  const parsed = parseLootboxOpened(payload);
  if (parsed === null) {
    throw new TypeError('invalid lootboxOpened payload');
  }
  return { type: 'lootboxOpened', ...parsed };
}

/** Builds a client `purchaseUpgrade` message. */
export function purchaseUpgradeMessage(upgradeId: string): ClientMessage {
  return { type: 'purchaseUpgrade', upgradeId };
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

/**
 * Builds the batched `miniCubesRemoved` frame (AC-8): the removal delta of one member
 * coalesced into a single message.
 *
 * The payload is validated at runtime before it is copied: `playerId` must be a non-empty
 * string, `ids` must be a non-empty array, and every id must be a non-empty string. Any
 * violation throws `TypeError` (mirroring `lootboxOpenedMessage`), so an invalid payload
 * can never reach the wire; the returned `ids` array is always a fresh copy.
 */
export function miniCubesRemovedMessage(
  playerId: string,
  ids: readonly MiniCubeId[],
): ServerMessage {
  if (
    typeof playerId !== 'string' ||
    playerId.length === 0 ||
    !Array.isArray(ids) ||
    ids.length === 0
  ) {
    throw new TypeError('invalid miniCubesRemoved payload');
  }
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('invalid miniCubesRemoved payload');
    }
  }
  return { type: 'miniCubesRemoved', playerId, ids: [...ids] };
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

/**
 * The diagnostic `pong` reply: echoes the client's `t` unchanged (AC-23).
 *
 * Additive, connection-local and inert: it carries no identity, room or game state, and the
 * hub answers at most one per second per connection.
 */
export function pongMessage(t: number): ServerMessage {
  return { type: 'pong', t };
}

/** Serialises one server message into the single JSON text frame sent over the wire. */
export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

/** Defensive copy of an economy state. */
function copyEconomyState(economy: EconomyState): EconomyState {
  return {
    coins: economy.coins,
    clicks: economy.clicks,
    facesDestroyed: economy.facesDestroyed,
    cubesDestroyed: economy.cubesDestroyed,
  };
}

/** Defensive copy of an upgrade state. */
function copyUpgradeState(upgrades: UpgradeState): UpgradeState {
  const copy: UpgradeState = {};
  for (const key of Object.keys(upgrades)) {
    copy[key] = upgrades[key];
  }
  return copy;
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
