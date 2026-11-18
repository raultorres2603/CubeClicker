/**
 * Remote spaceship — the spectated member's ship with their equipped appearance, idle
 * motion and firing (remote-spaceship-customization T11; spec AC-15…AC-22, AC-26; plan
 * § Remote ship hierarchy).
 *
 * Layer: render adapter (`render/**`) — three.js only. No DOM, no game rules, no protocol
 * access and no timers: time arrives through `update(dtMs)` and the caller's absolute
 * `fire(target, nowMs)`, and the caller decides which member is spectated and where a
 * removal's tile origin is (T12 wires both). The ship is presentation only; it never reads
 * or writes shared state.
 *
 * Hierarchy (AC-16, pinned):
 * `remote-ship` root (anchor `REMOTE_SHIP_OFFSET` + `lookAt` aim at the cube centre)
 * → `remote-ship-body` child (idle bob/sway and recoil; the only moving part)
 * → `cursor-ship-model` (the reused 32-object cursor model, 21 meshes)
 * and `shots` (a sibling group under the root holding the bolts and muzzle flashes).
 * Module subtree: 1 root + 1 body + 32 model + 1 shots group = 35 objects, 21 model
 * meshes. T12's lazy `remote-ships` manager makes the pinned scene contribution **36
 * objects / 21 draws at rest**; each in-flight bolt adds +1/+1 and each live muzzle adds
 * +1/+1, giving the pinned two-bolt fixture (38 scene objects / 23 draws) and the peak
 * (39 / 24: two bolts + one live muzzle) — AC-22.
 *
 * Aim and animation (AC-16/AC-19): the root's local `+z` points from the anchor to the cube
 * centre `(px, py, 0)` and never moves; the body child carries `position.y = bobY`,
 * `rotation.y = swayYaw` and the recoil `position.z`. Rest values are exact so the aim is
 * independent of the idle animation. Reduced motion zeroes bob, sway and recoil.
 *
 * Appearance (AC-17/AC-18): the member's 11-slot projection resolves through
 * `appearanceToShipParamsV3`; the ten ship slots drive the model and the `shot` entry only
 * selects the owner's shot style (`shot-default` when absent/unknown). `applyAppearance`
 * re-skins the mounted model in place — no remount, no dispose, no second material or
 * transform write for a repeated record.
 *
 * Firing (AC-20/AC-21/AC-26): `fire` accepts at most one shot per
 * `REMOTE_SHOT_MIN_INTERVAL_MS` (90) and at most `REMOTE_SHOT_MAX_IN_FLIGHT` (2) live
 * shots; a dropped shot starts no recoil. An accepted shot spawns at the model's local
 * `+z` nose tip, travels to the caller-supplied target over the retained
 * `SHOT_TRAVEL_MS` (180), captures the equipped style's geometry/scale/muzzle (in-flight
 * shots keep them), and starts one 0.12-unit/120 ms recoil on the body child. Muzzles use
 * `MOTION.shotMuzzleFlashMs` (80) and the style accent; at most one muzzle is live. Under
 * reduced motion no bolt travels and no recoil runs: one opacity flash is written at the
 * target for `MOTION.remoteShotFlashMs` (120).
 *
 * Shot vectors are in the `remote-ship` root's local frame because the `shots` group is a
 * child of the root; `mesh.getWorldPosition` yields world space for the scene tests.
 *
 * Allocation (AC-22): the frame path writes the preallocated idle pose, the body's own
 * position/rotation and the preallocated shot vectors; it creates no vector, set or scene
 * object. Shot meshes, muzzles and their geometry/material lookups are prebuilt/shared
 * (`createShotGeometries`/`createShotMaterials`); only one mesh per live shot is created.
 */

import { Group, Mesh, Vector3 } from 'three';

import { SHOT_TRAVEL_MS } from '../game/effects';
import { MOTION, easeOutCubic } from '../game/motion';
import {
  normalizeAppearanceV3,
  shotStyleForPart,
  type ShotStyleDef,
  type SlotIdV3,
} from '../game/parts-v3';
import type { MemberState, Position } from '../multiplayer/protocol';
import { createCursorShipModel, type CursorShipModel } from './cursor-ship';
import {
  createShotGeometries,
  createShotMaterials,
  SHOT_MUZZLE_OPACITY,
} from './shot-visuals';
import type { Shot } from './spaceship';

/** Anchor offset from the member's cube position (AC-16): above and in front of the cube. */
export const REMOTE_SHIP_OFFSET = { x: 1.6, y: 2.8, z: 4.4 } as const;

/** Uniform ship scale (AC-16) — the accepted cursor scale (`SPACESHIP_SCALE`). */
export const REMOTE_SHIP_SCALE = 1.2;

/** Minimum interval between two accepted shots of one ship (AC-20). */
export const REMOTE_SHOT_MIN_INTERVAL_MS = 90;

/** Maximum live shots of one ship; a third is dropped, never queued (AC-20). */
export const REMOTE_SHOT_MAX_IN_FLIGHT = 2;

/** Idle bob amplitude in root-local units (AC-19). */
export const REMOTE_SHIP_BOB_AMPLITUDE = 0.12;

/** Idle bob/sway period in ms (AC-19). */
export const REMOTE_SHIP_BOB_PERIOD_MS = 2600;

/** Idle sway amplitude in radians (AC-19). */
export const REMOTE_SHIP_SWAY_RAD = 0.05;

/** Recoil distance in root-local units (AC-20): `-0.12` at spawn, `0` at 120 ms. */
export const REMOTE_SHIP_RECOIL_OFFSET = 0.12;

/** Model-local `+z` tip of the accepted nose cone — the shot spawn point (AC-20). */
export const REMOTE_SHIP_NOSE_Z = 0.7;

/** Fallback target z when a removed tile is already hidden (AC-20). */
export const REMOTE_SHOT_FALLBACK_Z = 2.75;

/** Module subtree objects at rest: root + body + 32 model + shots group (AC-22). */
export const REMOTE_SHIP_OBJECT_COUNT = 35;

/** Scene objects at rest once T12's lazy `remote-ships` manager is mounted (AC-22). */
export const REMOTE_SHIP_SCENE_OBJECT_COUNT = 36;

/** Model meshes (draws) at rest — the accepted cursor-mesh count (AC-22). */
export const REMOTE_SHIP_DRAW_COUNT = 21;

/** Module subtree objects at the peak fixture: rest + two bolts + one live muzzle. */
export const REMOTE_SHIP_MAX_OBJECT_COUNT = 38;

/** Scene objects at the peak fixture: manager + module peak (AC-22). */
export const REMOTE_SHIP_MAX_SCENE_OBJECT_COUNT = 39;

/** Draws at the peak fixture: 21 model meshes + two bolts + one live muzzle (AC-22). */
export const REMOTE_SHIP_MAX_DRAW_COUNT = 24;

/** Idle pose of the `remote-ship-body` child (AC-19). */
export interface RemoteShipIdle {
  bobY: number;
  swayYaw: number;
}

/**
 * The member fields the ship needs: identity, cube position and the normalized public
 * appearance projection. `MemberState` (after T7 adds its optional `appearance`) satisfies
 * this structurally, so T12 passes roster entries without an adapter.
 */
export type RemoteShipMember = Pick<MemberState, 'playerId' | 'position'> & {
  /** The normalized slot→part-id projection; absent renders the classic defaults. */
  readonly appearance?: Record<string, string>;
};

/** The remote-ship handle handed to the scene (T12). */
export interface RemoteShip {
  /** `remote-ship` root (`name === 'remote-ship'`): anchor + aim only. */
  readonly group: Group;
  /** `remote-ship-body` child (`name === 'remote-ship-body'`): bob/sway/recoil only. */
  readonly body: Group;
  /** The `shots` group (`name === 'shots'`), a sibling of the body under the root. */
  readonly shotsGroup: Group;
  /** The spectated member's id. */
  readonly playerId: string;
  /** Live shots (root-local vectors), at most `REMOTE_SHOT_MAX_IN_FLIGHT`. */
  readonly shots: readonly Shot[];
  /**
   * The preallocated idle pose buffer last written by `update` (identity-stable across
   * frames, so the frame path allocates no object — AC-22).
   */
  readonly pose: RemoteShipIdle;
  /**
   * Re-skins the mounted model in place and switches the shot style. Returns the slots
   * whose visual actually changed (`shot` included when only the style changed); a
   * repeated record returns `[]` and writes nothing (AC-17/AC-18).
   */
  applyAppearance(appearance: Record<string, string>): readonly SlotIdV3[];
  /** Switches the equipped shot style; the next shot captures it, in-flight shots keep theirs. */
  applyShotStyle(style: ShotStyleDef): void;
  /**
   * Spawns one shot toward `target` (world space) when the 90 ms interval and the two-shot
   * cap allow it. Returns whether the shot was accepted; a dropped shot starts no recoil.
   */
  fire(target: Vector3, nowMs: number): boolean;
  /**
   * Advances one frame: idle pose, recoil, live shots/muzzles and the reduced-motion
   * impact flash, and applies the tier's hidden model meshes (no per-frame allocation).
   */
  update(dtMs: number, reducedMotion: boolean, hiddenMeshes: readonly string[]): void;
  /** Releases the model, the shot geometries/materials and the root exactly once. */
  dispose(): void;
}

/** Anchor of one member's ship: cube position + `REMOTE_SHIP_OFFSET` (AC-16). */
export function remoteShipAnchor(position: Position): { x: number; y: number; z: number } {
  return {
    x: position.x + REMOTE_SHIP_OFFSET.x,
    y: position.y + REMOTE_SHIP_OFFSET.y,
    z: REMOTE_SHIP_OFFSET.z,
  };
}

/** Fallback shot target for a removed tile that is already hidden (AC-20). */
export function remoteShipFallbackTarget(position: Position): {
  x: number;
  y: number;
  z: number;
} {
  return { x: position.x, y: position.y, z: REMOTE_SHOT_FALLBACK_Z };
}

/**
 * Idle bob and sway at `elapsedMs` (AC-19).
 *
 * `bobY = 0.12 · sin(2π·t / 2600)` and `swayYaw = 0.05 · cos(2π·t / 2600)`, so
 * `t = 0 → { 0, 0.05 }`, `t = 650 → { 0.12, 0 }`, `t = 1950 → { −0.12, 0 }`. Reduced
 * motion returns exactly zero for every `t`. Pass `out` to reuse a buffer (the frame path
 * does); without it a fresh pose object is returned.
 */
export function remoteShipIdle(
  elapsedMs: number,
  reducedMotion: boolean,
  out?: RemoteShipIdle,
): RemoteShipIdle {
  const pose = out ?? { bobY: 0, swayYaw: 0 };
  if (reducedMotion) {
    pose.bobY = 0;
    pose.swayYaw = 0;
    return pose;
  }
  const phase = (2 * Math.PI * elapsedMs) / REMOTE_SHIP_BOB_PERIOD_MS;
  pose.bobY = REMOTE_SHIP_BOB_AMPLITUDE * Math.sin(phase);
  pose.swayYaw = REMOTE_SHIP_SWAY_RAD * Math.cos(phase);
  return pose;
}

/**
 * Recoil offset at `elapsedMs` after an accepted shot (AC-20):
 * `−0.12 · (1 − easeOutCubic(clamp01(t / 120)))`, `0` outside `[0, 120)` — so `0 → −0.12`,
 * `60 → −0.015`, `120 → 0`.
 */
export function remoteShipRecoil(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= MOTION.remoteShipRecoilMs) {
    return 0;
  }
  return (
    -REMOTE_SHIP_RECOIL_OFFSET *
    (1 - easeOutCubic(elapsedMs / MOTION.remoteShipRecoilMs))
  );
}

/** Stable comparison key for one shot style (every catalog-derived field). */
function shotStyleSignatureOf(style: ShotStyleDef): string {
  return [
    style.partId,
    style.geometry,
    style.scale,
    style.muzzle,
    style.color,
    style.accent,
  ].join('|');
}

/**
 * Builds one remote ship for `member`.
 *
 * The caller mounts {@link RemoteShip.group} under the lazy `remote-ships` manager
 * (T12), drives {@link RemoteShip.update} once per frame and calls
 * {@link RemoteShip.fire} for the member's accepted removals, then must call
 * {@link RemoteShip.dispose} exactly once.
 */
export function createRemoteShip(member: RemoteShipMember): RemoteShip {
  const root = new Group();
  root.name = 'remote-ship';
  const anchor = remoteShipAnchor(member.position);
  root.position.set(anchor.x, anchor.y, anchor.z);
  root.scale.setScalar(REMOTE_SHIP_SCALE);
  // Object3D.lookAt aims local +z at the cube centre for a non-camera object (AC-16).
  root.lookAt(new Vector3(member.position.x, member.position.y, 0));
  root.updateMatrixWorld(true);

  const body = new Group();
  body.name = 'remote-ship-body';
  root.add(body);

  const model: CursorShipModel = createCursorShipModel();
  body.add(model.group);

  const shotsGroup = new Group();
  shotsGroup.name = 'shots';
  root.add(shotsGroup);

  // One geometry set (four projectiles + three muzzles) and one shared material pair for
  // every shot this ship fires; nothing is created per shot or per frame.
  const shotGeometries = createShotGeometries();
  const shotMaterials = createShotMaterials();
  const projectileMaterial = shotMaterials.projectile;
  const muzzleMaterial = shotMaterials.muzzle;

  const noseLocal = new Vector3(0, 0, REMOTE_SHIP_NOSE_Z);
  const shotForward = new Vector3(0, 0, 1);
  const shotDirection = new Vector3();
  const targetScratch = new Vector3();
  const idlePose: RemoteShipIdle = { bobY: 0, swayYaw: 0 };

  const ignitionMeshes = new Set(model.ignitions);
  let hiddenMeshesApplied: readonly string[] = [];

  const shots: Shot[] = [];
  let disposed = false;
  let elapsedMs = 0;
  let reduced = false;
  let lastFireMs = Number.NEGATIVE_INFINITY;
  let recoilElapsedMs: number = MOTION.remoteShipRecoilMs;
  let liveMuzzleCount = 0;

  // The reduced-motion impact flash: one mesh created once, attached only while it fades.
  // It re-uses the prebuilt muzzle geometries and the shared muzzle material, so it adds
  // no geometry/material and leaves the rest-state object count untouched.
  const impactFlash = new Mesh(shotGeometries.muzzles.spark, muzzleMaterial);
  impactFlash.name = 'shot-impact-flash';
  let impactRemainingMs = 0;

  // The equipped shot style; `shot-default` is the accepted bolt/spark look. A style
  // change only rewrites the two shared material colours — geometry/scale/muzzle are
  // captured at spawn.
  let currentShotStyle: ShotStyleDef = shotStyleForPart('shot-default');
  let shotStyleSignature = shotStyleSignatureOf(currentShotStyle);

  /** Normalizes an appearance record and resolves its shot style (default fallback). */
  function resolveShotStyle(appearance: Record<string, string>): ShotStyleDef {
    return shotStyleForPart(normalizeAppearanceV3(appearance).shot ?? 'shot-default');
  }

  function applyShotStyleInternal(style: ShotStyleDef): boolean {
    if (disposed) {
      return false;
    }
    const signature = shotStyleSignatureOf(style);
    if (signature === shotStyleSignature) {
      return false;
    }
    shotStyleSignature = signature;
    currentShotStyle = {
      partId: style.partId,
      geometry: style.geometry,
      scale: style.scale,
      muzzle: style.muzzle,
      color: style.color,
      accent: style.accent,
    };
    projectileMaterial.color.set(style.color);
    muzzleMaterial.color.set(style.accent);
    return true;
  }

  function applyShotStyle(style: ShotStyleDef): void {
    applyShotStyleInternal(style);
  }

  function applyAppearance(appearance: Record<string, string>): readonly SlotIdV3[] {
    if (disposed) {
      return [];
    }
    const changed = model.applyAppearance(appearance);
    if (!applyShotStyleInternal(resolveShotStyle(appearance))) {
      return changed;
    }
    return [...changed, 'shot'];
  }

  /** Detaches one muzzle flash from the `shots` group (never disposes the shared geometry). */
  function retireMuzzle(shot: Shot): void {
    if (shot.muzzleRemainingMs > 0) {
      shot.muzzleRemainingMs = 0;
      shotsGroup.remove(shot.muzzleFlash);
      liveMuzzleCount -= 1;
    }
  }

  /** Retires every live muzzle: the 90 ms spawn interval keeps at most one alive. */
  function retireMuzzles(): void {
    if (liveMuzzleCount === 0) {
      return;
    }
    for (const shot of shots) {
      retireMuzzle(shot);
    }
    liveMuzzleCount = 0;
  }

  /** Detaches every live bolt/muzzle (reduced motion or teardown); the flash is separate. */
  function clearShots(): void {
    if (shots.length === 0) {
      return;
    }
    for (const shot of shots) {
      if (shot.muzzleRemainingMs > 0) {
        shot.muzzleRemainingMs = 0;
        shotsGroup.remove(shot.muzzleFlash);
      }
      shotsGroup.remove(shot.mesh);
    }
    shots.length = 0;
    liveMuzzleCount = 0;
  }

  /** Detaches the reduced-motion impact flash if it is live. */
  function retireImpactFlash(): void {
    if (impactRemainingMs <= 0 && impactFlash.parent === null) {
      return;
    }
    impactRemainingMs = 0;
    if (impactFlash.parent !== null) {
      shotsGroup.remove(impactFlash);
    }
  }

  /**
   * Applies the tier's hidden-mesh list. Equality is compared element-wise so a caller
   * passing a fresh but identical list every frame allocates nothing; only a changed list
   * builds one `Set`. The two ignition flames stay hidden: the remote ship never ignites.
   */
  function applyHiddenMeshes(hiddenMeshes: readonly string[]): void {
    let same = hiddenMeshes.length === hiddenMeshesApplied.length;
    if (same) {
      for (let index = 0; index < hiddenMeshes.length; index += 1) {
        if (hiddenMeshes[index] !== hiddenMeshesApplied[index]) {
          same = false;
          break;
        }
      }
    }
    if (same) {
      return;
    }
    const hidden = new Set(hiddenMeshes);
    for (const mesh of model.meshes) {
      mesh.visible = !hidden.has(mesh.name) && !ignitionMeshes.has(mesh);
    }
    hiddenMeshesApplied = hiddenMeshes.slice();
  }

  function fire(target: Vector3, nowMs: number): boolean {
    if (disposed) {
      return false;
    }
    if (!reduced && shots.length >= REMOTE_SHOT_MAX_IN_FLIGHT) {
      return false;
    }
    if (nowMs - lastFireMs < REMOTE_SHOT_MIN_INTERVAL_MS) {
      return false;
    }
    lastFireMs = nowMs;

    // The shot target is supplied in world space; the `shots` group lives under the
    // scaled/aimed root, so the travel is computed in the root's local frame.
    root.updateWorldMatrix(true, false);
    targetScratch.copy(target);
    root.worldToLocal(targetScratch);

    const style = currentShotStyle;

    if (reduced) {
      // No travelling mesh and no recoil: one impact flash at the target (AC-21).
      clearShots();
      impactFlash.geometry = shotGeometries.muzzles[style.muzzle];
      impactFlash.position.copy(targetScratch);
      impactFlash.scale.setScalar(1);
      impactFlash.visible = true;
      if (impactFlash.parent === null) {
        shotsGroup.add(impactFlash);
      }
      muzzleMaterial.opacity = SHOT_MUZZLE_OPACITY;
      impactRemainingMs = MOTION.remoteShotFlashMs;
      return true;
    }

    retireImpactFlash();
    retireMuzzles();

    const mesh = new Mesh(shotGeometries.projectiles[style.geometry], projectileMaterial);
    mesh.name = `shot-${style.geometry}`;
    mesh.position.copy(noseLocal);
    mesh.scale.setScalar(style.scale);
    shotDirection.copy(targetScratch).sub(noseLocal);
    if (shotDirection.lengthSq() > 1e-12) {
      shotDirection.normalize();
      mesh.quaternion.setFromUnitVectors(shotForward, shotDirection);
    }

    const muzzleFlash = new Mesh(shotGeometries.muzzles[style.muzzle], muzzleMaterial);
    muzzleFlash.name = 'shot-muzzle-flash';
    muzzleFlash.position.copy(noseLocal);
    muzzleFlash.quaternion.copy(mesh.quaternion);
    muzzleFlash.scale.setScalar(1);
    muzzleMaterial.opacity = SHOT_MUZZLE_OPACITY;
    shotsGroup.add(muzzleFlash);
    liveMuzzleCount += 1;

    const shot: Shot = {
      mesh,
      start: new Vector3(0, 0, 0),
      muzzle: noseLocal.clone(),
      target: targetScratch.clone(),
      muzzleFlash,
      muzzleRemainingMs: MOTION.shotMuzzleFlashMs,
      remainingMs: SHOT_TRAVEL_MS,
    };
    shots.push(shot);
    shotsGroup.add(mesh);

    // One recoil per accepted shot; a rate/cap drop returns before this line (AC-20).
    recoilElapsedMs = 0;
    body.position.z = remoteShipRecoil(0);
    return true;
  }

  function advanceShots(advanceMs: number): void {
    if (shots.length === 0) {
      return;
    }
    let write = 0;
    for (let read = 0; read < shots.length; read += 1) {
      const shot = shots[read]!;
      shot.remainingMs = Math.max(0, shot.remainingMs - advanceMs);
      const elapsed = SHOT_TRAVEL_MS - shot.remainingMs;
      const progress = SHOT_TRAVEL_MS > 0 ? elapsed / SHOT_TRAVEL_MS : 1;
      shot.mesh.position.copy(shot.muzzle).lerp(shot.target, progress);

      if (shot.muzzleRemainingMs > 0) {
        shot.muzzleRemainingMs = Math.max(0, shot.muzzleRemainingMs - advanceMs);
        const flashElapsed = MOTION.shotMuzzleFlashMs - shot.muzzleRemainingMs;
        const flashProgress =
          MOTION.shotMuzzleFlashMs > 0 ? flashElapsed / MOTION.shotMuzzleFlashMs : 1;
        shot.muzzleFlash.scale.setScalar(1 + 0.4 * easeOutCubic(flashProgress));
        muzzleMaterial.opacity = SHOT_MUZZLE_OPACITY * (1 - flashProgress);
        if (shot.muzzleRemainingMs <= 0) {
          shotsGroup.remove(shot.muzzleFlash);
          liveMuzzleCount -= 1;
        }
      }

      if (shot.remainingMs <= 0) {
        shot.mesh.position.copy(shot.target);
        retireMuzzle(shot);
        shotsGroup.remove(shot.mesh);
        continue;
      }
      shots[write] = shot;
      write += 1;
    }
    shots.length = write;
  }

  function advanceImpactFlash(advanceMs: number): void {
    if (impactRemainingMs <= 0) {
      return;
    }
    impactRemainingMs = Math.max(0, impactRemainingMs - advanceMs);
    const progress = 1 - impactRemainingMs / MOTION.remoteShotFlashMs;
    muzzleMaterial.opacity = SHOT_MUZZLE_OPACITY * (1 - progress);
    if (impactRemainingMs <= 0) {
      shotsGroup.remove(impactFlash);
      impactFlash.visible = false;
    }
  }

  function update(dtMs: number, reducedMotion: boolean, hiddenMeshes: readonly string[]): void {
    if (disposed) {
      return;
    }
    const advanceMs = dtMs > 0 ? dtMs : 0;
    elapsedMs += advanceMs;
    reduced = reducedMotion;
    applyHiddenMeshes(hiddenMeshes);

    if (reducedMotion) {
      // Reduced motion is authoritative: no bob, sway, recoil or travelling shot.
      clearShots();
      recoilElapsedMs = MOTION.remoteShipRecoilMs;
      body.position.y = 0;
      body.position.z = 0;
      body.rotation.y = 0;
    } else {
      remoteShipIdle(elapsedMs, false, idlePose);
      body.position.y = idlePose.bobY;
      body.rotation.y = idlePose.swayYaw;
      if (recoilElapsedMs < MOTION.remoteShipRecoilMs) {
        recoilElapsedMs += advanceMs;
        body.position.z = remoteShipRecoil(recoilElapsedMs);
      } else {
        body.position.z = 0;
      }
    }

    advanceShots(advanceMs);
    advanceImpactFlash(advanceMs);
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    retireImpactFlash();
    clearShots();
    if (root.parent !== null) {
      root.parent.remove(root);
    }
    root.clear();
    model.dispose();
    shotGeometries.dispose();
    projectileMaterial.dispose();
    muzzleMaterial.dispose();
    body.clear();
    shotsGroup.clear();
  }

  // Seed the ship with the member's normalized projection (a no-op for the classic
  // defaults; never throws on an unknown/wrong-slot record — AC-18).
  const appearance = member.appearance ?? {};
  applyAppearance(appearance);

  return {
    group: root,
    body,
    shotsGroup,
    playerId: member.playerId,
    get shots(): readonly Shot[] {
      return shots;
    },
    get pose(): RemoteShipIdle {
      return idlePose;
    },
    applyAppearance,
    applyShotStyle,
    fire,
    update,
    dispose,
  };
}
