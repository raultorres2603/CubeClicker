/**
 * World view — the remote members' cube views on their server-assigned ring positions
 * (T10; plan § Interfaces `render/world.ts`; spec AC-13, AC-19(e)).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The scene
 * owns the local player's cube ({@link createCubeView} through `scene.ts`); this module
 * owns exactly the cubes of the other server members. Every position, grid size, style and
 * removed-id set arrives from the server (through `multiplayer/server-state.ts`), so the
 * world view never invents shared state: it places what the authority reported.
 *
 * One view per member. `applyRoster` reconciles the live set: a member not yet rendered
 * gets a cube view at its reported position, a member that left has its view disposed
 * exactly once, and a member whose cube signature (level/grid/style) changed is rebuilt in
 * place. Existing members keep their view (and therefore their running pops) across roster
 * refreshes. A server with capacity X can have at most X − 1 remote members — the local
 * cube belongs to the scene — so the drawable ceiling is `(X − 1) × 7` meshes; an
 * over-capacity roster is rejected rather than rendered unbounded.
 *
 * Broadcast application (`applyMessage`). The world view applies the remote-cube subset of
 * the server catalog:
 *
 * - `miniCubeRemoved` hides exactly that tile instance, plays the accepted pop-then-shrink
 *   animation and spawns the existing particle burst `BURST_ORIGIN_OFFSET` in front of the
 *   tile (the same effect the local cube plays). Duplicate ids are no-ops, so the origin's
 *   ack can never restart a pop or double-spawn a burst.
 * - Face clears are derived: when the last tile of a face is removed, the face is scheduled
 *   for removal with the accepted `faceFadeMs` (400 ms) countdown, so the last tile's pop
 *   and burst are visible, and `removeFace` then releases the face's geometry/material.
 * - `levelAdvanced` disposes the member's previous view exactly once and rebuilds it at the
 *   reported grid size/style/position (remote advances are instant in-place rebuilds, as
 *   spec § 5 requires — no remote travel animation).
 * - `memberJoined`/`memberLeft` upsert/remove exactly one view.
 *
 * Everything else (`hello`, `welcome`, `worldEntered`, `stateSync`, `error`) belongs to the
 * session/scene: a new `WorldView` is built for a new server world, and the local board is
 * the scene's own cube.
 *
 * Non-pickable by construction. The world exposes no picking entry point: the session calls
 * `pickMiniCube(camera, scene.cubeView, …)` with the own handle only, so a ray that crosses
 * a remote cube view can never resolve to an id (pinned in `world.test.ts` with a real
 * `Raycaster` over the composed scene). Remote views never receive the own cube's
 * orientation or rotation either: they show their owner's static board.
 */

import { Group, InstancedMesh, Matrix4, Vector3 } from 'three';

import { BURST_ORIGIN_OFFSET, createBurst, timingsFor } from '../game/effects';
import { interpolateRotation, type Orientation } from '../game/rotation';
import { CUBE_STYLES } from '../game/progression';
import { FACE_IDS, type CubeStyle, type FaceId, type MiniCubeId } from '../game/types';
import type { MemberState, ServerMessage } from '../multiplayer/protocol';
import { createCubeView, FACE_NORMALS, type CubeView } from './cube-view';
import { createParticleSystem, type ParticleSystem } from './particles';

/**
 * Cleared-face countdown: the accepted default profile's face fade (400 ms), long enough
 * for the last tile's 160 ms pop. The world view has no reduced-motion input of its own
 * (the spec keeps remote-cube rendering independent of a spectator's motion preference).
 */
const FACE_REMOVAL_MS = timingsFor(false).faceFadeMs;

/** Duration of a remote cube rotation animation (default profile, 300 ms). */
const REMOTE_ROTATION_MS = timingsFor(false).rotationMs;

/** The world view handed to the scene: remote cube handles plus the lifecycle hooks. */
export interface WorldView {
  /** Everything the world adds to the scene lives under this group. */
  readonly group: Group;
  /** The pooled burst system shared by every remote cube (one drawable, `PARTICLE_POOL_CAP`). */
  readonly particles: ParticleSystem;
  /**
   * Reconciles the rendered remote members with `members` (the server's roster **minus the
   * local player** — the scene owns the own cube):
   *
   * - new member → a cube view at its reported position, grid size and style;
   * - removed member → its view is disposed and detached exactly once;
   * - same cube signature → position refreshed and any newly reported removed ids applied
   *   instantly (roster snapshots never replay pops);
   * - different level/grid/style → old view disposed once, fresh view built.
   *
   * Throws `RangeError` when the roster exceeds the server's remote capacity (`X − 1`).
   */
  applyRoster(members: readonly MemberState[]): void;
  /**
   * Applies one decoded server message: `miniCubeRemoved` (tile pop + burst + derived face
   * clear), `levelAdvanced` (dispose once + rebuild), `memberJoined`/`memberLeft`. Messages
   * for the local player or an unknown member, and messages the world does not own, are
   * no-ops.
   */
  applyMessage(msg: ServerMessage): void;
  /** Advances the pop animations, the cleared-face countdowns and the burst particles. */
  update(dtMs: number): void;
  /** The live remote views by player id (the local player is never in this map). */
  views(): ReadonlyMap<string, CubeView>;
  /** Disposes every view and the particle system exactly once and detaches from the scene. */
  dispose(): void;
}

/** One rendered member: its latest authoritative snapshot plus the view's bookkeeping. */
interface MemberCube {
  /** Latest authoritative snapshot for this member (copied, never the caller's object). */
  member: MemberState;
  readonly view: CubeView;
  /** Every tile id already hidden, so a repeated broadcast is a no-op. */
  readonly hidden: Set<string>;
  /** Hidden-tile count per face, for the derived face-clear transition. */
  readonly hiddenPerFace: Map<FaceId, number>;
  /** Faces whose 0-remaining transition started: elapsed ms of the removal countdown. */
  readonly faceRemovalElapsed: Map<FaceId, number>;
  /** Settled target orientation for this member (quarter-turn counters). */
  orientation: Orientation;
  /** Source orientation of an in-flight rotation, or `null` when settled. */
  rotationFrom: Orientation | null;
  /** Elapsed ms of the in-flight rotation. */
  rotationElapsedMs: number;
  /** Duration of the remote rotation animation (default profile, 300 ms). */
  readonly rotationDurationMs: number;
}

/** The style for a wire style id; an unknown id falls back to the pinned first style. */
function styleFor(styleId: string): CubeStyle {
  return CUBE_STYLES.find((style) => style.id === styleId) ?? CUBE_STYLES[0]!;
}

/** Cube identity that decides whether a roster snapshot needs a fresh view. */
function cubeSignature(member: MemberState): string {
  return `${member.levelIndex}|${member.gridSize}|${member.styleId}`;
}

function copyMember(member: MemberState): MemberState {
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

/**
 * Builds the world view for one server (one capacity X, one roster).
 *
 * @param options.maxUsers server capacity X; the world renders at most `X − 1` remote cubes
 *   (the scene owns the local player's cube). `0` is accepted for the pre-`welcome` world.
 * @param options.random source for the burst directions and particle jitter (three.js
 *   renderer leaves stay injectable so tests are deterministic; defaults to `Math.random`).
 */
export function createWorldView(options: { maxUsers: number; random?: () => number }): WorldView {
  const { maxUsers } = options;
  if (!Number.isInteger(maxUsers) || maxUsers < 0) {
    throw new RangeError(`maxUsers must be a non-negative integer, received ${maxUsers}`);
  }
  /** Remote slots on this server: the local cube belongs to the scene, not this world. */
  const capacity = Math.max(0, maxUsers - 1);
  const random = options.random ?? Math.random;

  const group = new Group();
  const particles = createParticleSystem(random);
  group.add(particles.group);

  const members = new Map<string, MemberCube>();
  const views = new Map<string, CubeView>();
  const scratch = new Matrix4();
  /** World-view clock: orders bursts pooled by the particle system (advanced by `update`). */
  let nowMs = 0;
  let disposed = false;

  function store(playerId: string, memberCube: MemberCube): void {
    members.set(playerId, memberCube);
    views.set(playerId, memberCube.view);
  }

  /** Disposes one member's view exactly once and detaches it from the world group. */
  function drop(playerId: string): void {
    const memberCube = members.get(playerId);
    if (memberCube === undefined) {
      return;
    }
    members.delete(playerId);
    views.delete(playerId);
    group.remove(memberCube.view.group);
    memberCube.view.dispose();
  }

  /** Hides one tile from a roster snapshot: instant, no pop and no burst. */
  function hideInitialTile(memberCube: MemberCube, id: string): void {
    if (memberCube.hidden.has(id)) {
      return;
    }
    // `hideMiniCube` validates the id before any bookkeeping changes, so a malformed id
    // never leaves the counters inconsistent.
    memberCube.view.hideMiniCube(id as MiniCubeId, true);
    memberCube.hidden.add(id);
    const faceId = id.split(':')[0] as FaceId;
    memberCube.hiddenPerFace.set(faceId, (memberCube.hiddenPerFace.get(faceId) ?? 0) + 1);
  }

  /** A face fully removed in a snapshot is already gone: detach it without a countdown. */
  function removeExhaustedFaces(memberCube: MemberCube): void {
    const total = memberCube.member.gridSize * memberCube.member.gridSize;
    for (const faceId of FACE_IDS) {
      if (
        (memberCube.hiddenPerFace.get(faceId) ?? 0) === total &&
        memberCube.view.faces.has(faceId)
      ) {
        memberCube.faceRemovalElapsed.delete(faceId);
        memberCube.view.removeFace(faceId);
      }
    }
  }

  function orientationOf(member: MemberState): Orientation {
    return { yawSteps: member.yawSteps, pitchSteps: member.pitchSteps };
  }

  function applyOrientationToGroup(view: CubeView, orientation: Orientation): void {
    const rot = interpolateRotation(orientation, orientation, 1);
    view.group.rotation.set(rot.pitch, rot.yaw, 0);
  }

  function currentDisplayed(mc: MemberCube): Orientation {
    if (mc.rotationFrom === null) {
      return { yawSteps: mc.orientation.yawSteps, pitchSteps: mc.orientation.pitchSteps };
    }
    const t =
      mc.rotationDurationMs <= 0
        ? 1
        : Math.min(1, mc.rotationElapsedMs / mc.rotationDurationMs);
    const rot = interpolateRotation(mc.rotationFrom, mc.orientation, t);
    return { yawSteps: rot.yaw / (Math.PI / 2), pitchSteps: rot.pitch / (Math.PI / 2) };
  }

  function build(member: MemberState): MemberCube {
    const orientation = orientationOf(member);
    const view = createCubeView(styleFor(member.styleId), member.gridSize);
    view.group.position.set(member.position.x, member.position.y, 0);
    applyOrientationToGroup(view, orientation);
    const memberCube: MemberCube = {
      member: copyMember(member),
      view,
      hidden: new Set(),
      hiddenPerFace: new Map(FACE_IDS.map((faceId) => [faceId, 0])),
      faceRemovalElapsed: new Map(),
      orientation,
      rotationFrom: null,
      rotationElapsedMs: 0,
      rotationDurationMs: REMOTE_ROTATION_MS,
    };
    group.add(view.group);
    for (const id of member.removedIds) {
      hideInitialTile(memberCube, id);
    }
    removeExhaustedFaces(memberCube);
    return memberCube;
  }

  /** Rebuilds one member: the fresh view is stored before the old one is disposed. */
  function replace(memberCube: MemberCube, member: MemberState): void {
    const replacement = build(member);
    drop(member.playerId);
    store(member.playerId, replacement);
  }

  /** Adds a member or refreshes the rendered one from an authoritative snapshot. */
  function upsert(member: MemberState): void {
    const existing = members.get(member.playerId);
    if (existing === undefined) {
      store(member.playerId, build(member));
      return;
    }
    if (cubeSignature(existing.member) !== cubeSignature(member)) {
      replace(existing, member);
      return;
    }
    // Same level: refresh the position, then apply any tile the snapshot knows about.
    // Roster snapshots are state, not events — newly learned ids appear without a pop.
    existing.member = copyMember(member);
    existing.view.group.position.set(member.position.x, member.position.y, 0);
    // Orientation: animate only when the reported orientation differs from the settled target.
    const nextOrientation = orientationOf(member);
    if (
      nextOrientation.yawSteps !== existing.orientation.yawSteps ||
      nextOrientation.pitchSteps !== existing.orientation.pitchSteps
    ) {
      existing.rotationFrom = currentDisplayed(existing);
      existing.rotationElapsedMs = 0;
      existing.orientation = nextOrientation;
    }
    for (const id of member.removedIds) {
      hideInitialTile(existing, id);
    }
    removeExhaustedFaces(existing);
  }

  /**
   * World-space origin of one mini-cube instance: its local matrix carried through the
   * cube group's world matrix (the remote cube has no rotation; the position comes from the
   * server). Mirrors `scene.ts`'s local-cube origin read.
   */
  function tileOrigin(memberCube: MemberCube, mesh: InstancedMesh, id: MiniCubeId): Vector3 {
    const [, rowText, colText] = id.split(':');
    const index = Number(rowText) * memberCube.member.gridSize + Number(colText);
    mesh.updateWorldMatrix(true, false);
    mesh.getMatrixAt(index, scratch);
    scratch.premultiply(mesh.matrixWorld);
    return new Vector3().setFromMatrixPosition(scratch);
  }

  /** One remote tile removal: hide the exact instance, play its pop and burst, derive clears. */
  function applyRemoval(memberCube: MemberCube, id: MiniCubeId): void {
    if (memberCube.hidden.has(id)) {
      // The origin's ack can repeat an id the local broadcast path already applied; never
      // restart the pop or spawn a second burst.
      return;
    }
    const faceId = id.split(':')[0] as FaceId;
    const mesh = memberCube.view.faces.get(faceId);
    const origin = mesh === undefined ? null : tileOrigin(memberCube, mesh, id);
    memberCube.view.hideMiniCube(id);
    memberCube.hidden.add(id);
    const count = (memberCube.hiddenPerFace.get(faceId) ?? 0) + 1;
    memberCube.hiddenPerFace.set(faceId, count);
    if (origin !== null) {
      origin.addScaledVector(FACE_NORMALS[faceId], BURST_ORIGIN_OFFSET);
      particles.spawn(createBurst(random), origin, nowMs);
      const total = memberCube.member.gridSize * memberCube.member.gridSize;
      if (count === total) {
        // The face's 0-remaining transition: keep it for the accepted fade, which lets the
        // last tile's pop and burst finish, then detach it in `update`.
        memberCube.faceRemovalElapsed.set(faceId, 0);
      }
    }
  }

  const view: WorldView = {
    group,
    particles,

    applyRoster(membersList: readonly MemberState[]): void {
      if (disposed) {
        return;
      }
      if (membersList.length > capacity) {
        throw new RangeError(
          `roster of ${membersList.length} exceeds the ${capacity} remote slots of a ${maxUsers}-member server`,
        );
      }
      const keep = new Set<string>();
      for (const member of membersList) {
        keep.add(member.playerId);
        upsert(member);
      }
      for (const playerId of [...members.keys()]) {
        if (!keep.has(playerId)) {
          drop(playerId);
        }
      }
    },

    applyMessage(msg: ServerMessage): void {
      if (disposed) {
        return;
      }
      switch (msg.type) {
        case 'miniCubeRemoved': {
          const memberCube = members.get(msg.playerId);
          if (memberCube !== undefined) {
            applyRemoval(memberCube, msg.id);
          }
          break;
        }
        case 'levelAdvanced': {
          const existing = members.get(msg.playerId);
          if (existing !== undefined) {
            // Remote advances are instant in-place rebuilds at the reported cube; the
            // member's name/playerId are retained (the message carries no name).
            upsert({
              playerId: existing.member.playerId,
              name: existing.member.name,
              position: msg.position,
              levelIndex: msg.levelIndex,
              gridSize: msg.gridSize,
              styleId: msg.styleId,
              removedIds: [],
              yawSteps: 0,
              pitchSteps: 0,
            });
          }
          break;
        }
        case 'memberJoined':
          upsert(msg.member);
          break;
        case 'memberLeft':
          drop(msg.playerId);
          break;
        case 'cubeRotated': {
          const memberCube = members.get(msg.playerId);
          if (memberCube === undefined) {
            break;
          }
          const nextOrientation: Orientation = {
            yawSteps: msg.yawSteps,
            pitchSteps: msg.pitchSteps,
          };
          if (
            nextOrientation.yawSteps === memberCube.orientation.yawSteps &&
            nextOrientation.pitchSteps === memberCube.orientation.pitchSteps
          ) {
            break;
          }
          memberCube.rotationFrom = currentDisplayed(memberCube);
          memberCube.rotationElapsedMs = 0;
          memberCube.orientation = nextOrientation;
          memberCube.member.yawSteps = msg.yawSteps;
          memberCube.member.pitchSteps = msg.pitchSteps;
          break;
        }
        default:
          // `hello`/`welcome`/`worldEntered`/`stateSync`/`error` carry no remote-cube
          // delta this view owns; the scene/session handles them.
          break;
      }
    },

    update(dtMs: number): void {
      if (disposed) {
        return;
      }
      const advance = Math.max(0, dtMs);
      nowMs += advance;
      for (const memberCube of members.values()) {
        // Advance any in-flight remote rotation and apply the interpolated orientation.
        if (memberCube.rotationFrom !== null) {
          memberCube.rotationElapsedMs += advance;
          const t =
            memberCube.rotationDurationMs <= 0
              ? 1
              : Math.min(1, memberCube.rotationElapsedMs / memberCube.rotationDurationMs);
          const rot = interpolateRotation(memberCube.rotationFrom, memberCube.orientation, t);
          memberCube.view.group.rotation.set(rot.pitch, rot.yaw, 0);
          if (t >= 1) {
            memberCube.rotationFrom = null;
            memberCube.rotationElapsedMs = 0;
          }
        } else {
          const rot = interpolateRotation(memberCube.orientation, memberCube.orientation, 1);
          memberCube.view.group.rotation.set(rot.pitch, rot.yaw, 0);
        }
        // Removals first (like `scene.ts`): a face detached this frame receives no pop write.
        for (const [faceId, elapsed] of memberCube.faceRemovalElapsed) {
          const next = elapsed + advance;
          if (next >= FACE_REMOVAL_MS) {
            memberCube.faceRemovalElapsed.delete(faceId);
            memberCube.view.removeFace(faceId);
          } else {
            memberCube.faceRemovalElapsed.set(faceId, next);
          }
        }
        memberCube.view.update(advance);
      }
      particles.update(advance);
    },

    views(): ReadonlyMap<string, CubeView> {
      return views;
    },

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const playerId of [...members.keys()]) {
        drop(playerId);
      }
      particles.dispose();
      group.clear();
      group.removeFromParent();
    },
  };

  return view;
}
