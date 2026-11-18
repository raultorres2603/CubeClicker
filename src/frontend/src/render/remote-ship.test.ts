import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  Vector3,
  type Object3D,
} from 'three';

import { MOTION } from '../game/motion';
import { shotStyleForPart } from '../game/parts-v3';
import { QUALITY_LOW_HIDDEN_MESHES, QUALITY_MEDIUM_HIDDEN_MESHES } from './quality';
import {
  createRemoteShip,
  REMOTE_SHOT_FALLBACK_Z,
  REMOTE_SHOT_MAX_IN_FLIGHT,
  REMOTE_SHOT_MIN_INTERVAL_MS,
  REMOTE_SHIP_BOB_AMPLITUDE,
  REMOTE_SHIP_BOB_PERIOD_MS,
  REMOTE_SHIP_DRAW_COUNT,
  REMOTE_SHIP_MAX_DRAW_COUNT,
  REMOTE_SHIP_MAX_OBJECT_COUNT,
  REMOTE_SHIP_MAX_SCENE_OBJECT_COUNT,
  REMOTE_SHIP_NOSE_Z,
  REMOTE_SHIP_OBJECT_COUNT,
  REMOTE_SHIP_OFFSET,
  REMOTE_SHIP_RECOIL_OFFSET,
  REMOTE_SHIP_SCALE,
  REMOTE_SHIP_SCENE_OBJECT_COUNT,
  REMOTE_SHIP_SWAY_RAD,
  remoteShipAnchor,
  remoteShipFallbackTarget,
  remoteShipIdle,
  remoteShipRecoil,
  type RemoteShip,
  type RemoteShipIdle,
} from './remote-ship';

const TARGET = new Vector3(10, -4, 0);

function memberAt(
  x: number,
  y: number,
  appearance?: Record<string, string>,
): {
  playerId: string;
  position: { x: number; y: number };
  appearance?: Record<string, string>;
} {
  return { playerId: 'player-1', position: { x, y }, appearance };
}

function countObjects(root: Object3D): number {
  return 1 + root.children.reduce((total, child) => total + countObjects(child), 0);
}

function meshesIn(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Mesh).isMesh) {
      meshes.push(object as Mesh);
    }
  });
  return meshes;
}

function meshNamed(root: Object3D, name: string): Mesh {
  const mesh = meshesIn(root).find((candidate) => candidate.name === name);
  if (mesh === undefined) {
    throw new Error(`no ${name} mesh`);
  }
  return mesh;
}

function groupNamed(root: Object3D, name: string): Group {
  const group = root.getObjectByName(name);
  if (!(group instanceof Group)) {
    throw new Error(`no ${name} group`);
  }
  return group;
}

function colorOf(mesh: Mesh): string {
  const material = mesh.material as unknown as { color: { getHexString(): string } };
  return material.color.getHexString();
}

function opacityOf(shot: { muzzleFlash: Mesh }): number {
  return (shot.muzzleFlash.material as MeshBasicMaterial).opacity;
}

function aimOf(ship: RemoteShip): Vector3 {
  ship.group.updateMatrixWorld(true);
  return new Vector3().setFromMatrixColumn(ship.group.matrixWorld, 2).normalize();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('remote ship constants (AC-16, AC-19, AC-20, AC-22)', () => {
  it('pins the anchor offset, scale, pacing, idle and recoil values', () => {
    expect(REMOTE_SHIP_OFFSET).toEqual({ x: 1.6, y: 2.8, z: 4.4 });
    expect(REMOTE_SHIP_SCALE).toBe(1.2);
    expect(REMOTE_SHOT_MIN_INTERVAL_MS).toBe(90);
    expect(REMOTE_SHOT_MAX_IN_FLIGHT).toBe(2);
    expect(REMOTE_SHIP_BOB_AMPLITUDE).toBe(0.12);
    expect(REMOTE_SHIP_BOB_PERIOD_MS).toBe(2600);
    expect(REMOTE_SHIP_SWAY_RAD).toBe(0.05);
    expect(REMOTE_SHIP_RECOIL_OFFSET).toBe(0.12);
    expect(REMOTE_SHIP_NOSE_Z).toBe(0.7);
    expect(REMOTE_SHOT_FALLBACK_Z).toBe(2.75);
    expect(MOTION.remoteShipRecoilMs).toBe(120);
    expect(MOTION.remoteShotFlashMs).toBe(120);
    expect(MOTION.shotMuzzleFlashMs).toBe(80);
  });

  it('pins the module, scene and peak object/draw budget (AC-22)', () => {
    expect(REMOTE_SHIP_OBJECT_COUNT).toBe(35);
    expect(REMOTE_SHIP_SCENE_OBJECT_COUNT).toBe(36);
    expect(REMOTE_SHIP_DRAW_COUNT).toBe(21);
    expect(REMOTE_SHIP_MAX_OBJECT_COUNT).toBe(38);
    expect(REMOTE_SHIP_MAX_SCENE_OBJECT_COUNT).toBe(39);
    expect(REMOTE_SHIP_MAX_DRAW_COUNT).toBe(24);
  });
});

describe('remoteShipAnchor and the fallback target (AC-16, AC-20)', () => {
  it('offsets a member at (10, -4) to (11.6, -1.2, 4.4)', () => {
    const anchor = remoteShipAnchor({ x: 10, y: -4 });
    expect(anchor.x).toBe(11.6);
    // -4 + 2.8 is one ulp from the decimal literal at this slot; pin it tightly.
    expect(Math.abs(anchor.y - -1.2)).toBeLessThan(1e-12);
    expect(anchor.z).toBe(4.4);
  });

  it('offsets the origin and a negative slot without clamping', () => {
    expect(remoteShipAnchor({ x: 0, y: 0 })).toEqual({ x: 1.6, y: 2.8, z: 4.4 });
    expect(remoteShipAnchor({ x: -24, y: -24 })).toEqual({ x: -22.4, y: -21.2, z: 4.4 });
  });

  it('falls back to the cube plane at z = 2.75', () => {
    expect(remoteShipFallbackTarget({ x: 10, y: -4 })).toEqual({ x: 10, y: -4, z: 2.75 });
    expect(remoteShipFallbackTarget({ x: -7, y: 3 })).toEqual({ x: -7, y: 3, z: 2.75 });
  });
});

describe('remoteShipIdle (AC-19)', () => {
  it('pins t = 0, 650 and 1950', () => {
    const rest = remoteShipIdle(0, false);
    expect(rest.bobY).toBe(0);
    expect(rest.swayYaw).toBe(0.05);

    const quarter = remoteShipIdle(650, false);
    expect(quarter.bobY).toBe(0.12);
    expect(Math.abs(quarter.swayYaw)).toBeLessThan(1e-12);

    const threeQuarters = remoteShipIdle(1950, false);
    expect(threeQuarters.bobY).toBe(-0.12);
    expect(Math.abs(threeQuarters.swayYaw)).toBeLessThan(1e-12);
  });

  it('sways to -0.05 at half the period and keeps the period exact', () => {
    const half = remoteShipIdle(1300, false);
    expect(Math.abs(half.swayYaw - -0.05)).toBeLessThan(1e-12);
    expect(Math.abs(half.bobY)).toBeLessThan(1e-12);
    expect(remoteShipIdle(650, false).bobY).toBe(remoteShipIdle(650 + 2600, false).bobY);
  });

  it('returns exactly zero under reduced motion for every time', () => {
    for (const elapsedMs of [0, 650, 1300, 1950, -500, 100_000]) {
      expect(remoteShipIdle(elapsedMs, true)).toEqual({ bobY: 0, swayYaw: 0 });
    }
  });

  it('writes a caller buffer so the frame path allocates no pose object', () => {
    const out: RemoteShipIdle = { bobY: 7, swayYaw: 7 };
    const pose = remoteShipIdle(650, false, out);
    expect(pose).toBe(out);
    expect(out.bobY).toBe(0.12);
    expect(Math.abs(out.swayYaw)).toBeLessThan(1e-12);

    const reduced = remoteShipIdle(650, true, out);
    expect(reduced).toBe(out);
    expect(out).toEqual({ bobY: 0, swayYaw: 0 });
  });
});

describe('remoteShipRecoil (AC-20)', () => {
  it('pins -0.12 at spawn, -0.015 at 60 ms and 0 at 120 ms', () => {
    expect(remoteShipRecoil(0)).toBe(-0.12);
    expect(Math.abs(remoteShipRecoil(60) - -0.015)).toBeLessThan(1e-9);
    expect(remoteShipRecoil(120)).toBe(0);
    expect(remoteShipRecoil(121)).toBe(0);
    expect(remoteShipRecoil(-1)).toBe(0);
  });

  it('decays monotonically inside the 120 ms window', () => {
    const values = [0, 30, 60, 90, 119].map((elapsed) => remoteShipRecoil(elapsed));
    expect(values[0]).toBe(-0.12);
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]!).toBeGreaterThan(values[index - 1]!);
      expect(values[index]!).toBeLessThanOrEqual(0);
    }
    expect(Math.abs(values[4]!)).toBeLessThan(1e-5);
  });
});

describe('hierarchy and aim (AC-16)', () => {
  it('pins the root anchor, 1.2 scale and the body/model/shots tree', () => {
    const ship = createRemoteShip(memberAt(10, -4));

    expect(ship.group.name).toBe('remote-ship');
    expect(ship.group.position.x).toBe(11.6);
    expect(Math.abs(ship.group.position.y - -1.2)).toBeLessThan(1e-12);
    expect(ship.group.position.z).toBe(4.4);
    expect(ship.group.scale.toArray()).toEqual([1.2, 1.2, 1.2]);
    expect(ship.group.children[0]).toBe(ship.body);
    expect(ship.group.children[1]).toBe(ship.shotsGroup);
    expect(ship.group.children).toHaveLength(2);

    expect(ship.body.name).toBe('remote-ship-body');
    expect(ship.body.parent).toBe(ship.group);
    expect(ship.body.children).toHaveLength(1);

    const model = groupNamed(ship.group, 'cursor-ship-model');
    expect(model.parent).toBe(ship.body);
    expect(model.children).toHaveLength(10);
    expect(countObjects(model)).toBe(32);
    expect(model.children.map((slot) => slot.name)).toEqual([
      'slot-hull',
      'slot-nose',
      'slot-cockpit',
      'slot-wing-left',
      'slot-wing-right',
      'slot-engine-left',
      'slot-engine-right',
      'slot-ignition-left',
      'slot-ignition-right',
      'slot-tail-fin',
    ]);

    expect(ship.shotsGroup.name).toBe('shots');
    expect(ship.shotsGroup.parent).toBe(ship.group);
    expect(ship.shotsGroup.children).toHaveLength(0);
    expect(ship.playerId).toBe('player-1');

    ship.dispose();
  });

  it('aims local +z from the anchor at the cube centre within 1e-6', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    const aim = aimOf(ship);
    const expected = new Vector3(10 - 11.6, -4 - -1.2, 0 - 4.4).normalize();
    expect(aim.distanceTo(expected)).toBeLessThan(1e-6);

    ship.group.updateMatrixWorld(true);
    const up = new Vector3().setFromMatrixColumn(ship.group.matrixWorld, 1).normalize();
    expect(Math.abs(up.length() - 1)).toBeLessThan(1e-9);
    expect(Math.abs(up.dot(aim))).toBeLessThan(1e-9);

    ship.dispose();
  });

  it('aims correctly for a different slot and for the origin', () => {
    const origin = createRemoteShip(memberAt(0, 0));
    expect(origin.group.position.toArray()).toEqual([1.6, 2.8, 4.4]);
    expect(aimOf(origin).distanceTo(new Vector3(-1.6, -2.8, -4.4).normalize())).toBeLessThan(
      1e-6,
    );
    origin.dispose();

    const other = createRemoteShip(memberAt(-24, 7));
    expect(other.group.position.toArray()).toEqual([-22.4, 9.8, 4.4]);
    expect(
      aimOf(other).distanceTo(new Vector3(-1.6, -2.8, -4.4).normalize()),
    ).toBeLessThan(1e-6);
    other.dispose();
  });
});

describe('appearance (AC-17, AC-18)', () => {
  it('renders a classic v2 appearance exactly (obsidian hull, gold port wing)', () => {
    const ship = createRemoteShip(
      memberAt(10, -4, { hull: 'hull-obsidian', 'wing-left': 'wing-left-gold' }),
    );

    expect(colorOf(meshNamed(ship.group, 'cursor-hull'))).toBe('1a2333');
    expect(colorOf(meshNamed(ship.group, 'cursor-wing-left'))).toBe('ccaa44');

    const hullSlot = groupNamed(ship.group, 'slot-hull');
    expect(hullSlot.scale.toArray()).toEqual([1.06, 1.1, 1.02]);
    expect(hullSlot.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);

    ship.dispose();
  });

  it('applies the generated hull form to the slot and the chassis', () => {
    const ship = createRemoteShip(memberAt(0, 0, { hull: 'hull-dart-chrome' }));

    expect(groupNamed(ship.group, 'slot-hull').scale.toArray()).toEqual([0.85, 0.9, 1.15]);
    expect(groupNamed(ship.group, 'cursor-ship-model').scale.toArray()).toEqual([
      0.95, 0.9, 1.25,
    ]);
    expect(colorOf(meshNamed(ship.group, 'cursor-hull'))).toBe('c9d4e2');
    expect(colorOf(meshNamed(ship.group, 'cursor-hull-seam-1'))).toBe('ffffff');

    ship.dispose();
  });

  it('renders the classic defaults for an absent record', () => {
    const ship = createRemoteShip(memberAt(0, 0));

    expect(groupNamed(ship.group, 'slot-hull').scale.toArray()).toEqual([1, 1, 1]);
    expect(groupNamed(ship.group, 'cursor-ship-model').scale.toArray()).toEqual([1, 1, 1]);
    expect(colorOf(meshNamed(ship.group, 'cursor-hull'))).toBe('8f9bad');
    expect(colorOf(meshNamed(ship.group, 'cursor-wing-left'))).toBe('4466cc');

    ship.dispose();
  });

  it('falls back to the classic standard for unknown and wrong-slot ids', () => {
    const ship = createRemoteShip(
      memberAt(0, 0, {
        hull: 'wing-left-gold',
        nose: 'nope',
        cockpit: 'hull-obsidian',
        shot: 'nope',
      }),
    );

    expect(colorOf(meshNamed(ship.group, 'cursor-hull'))).toBe('8f9bad');
    expect(colorOf(meshNamed(ship.group, 'cursor-nose'))).toBe('88aaff');
    expect(colorOf(meshNamed(ship.group, 'cursor-cockpit'))).toBe('0b2f38');

    expect(ship.fire(new Vector3(0, 0, 0), 0)).toBe(true);
    const shot = ship.shots[0]!;
    expect(shot.mesh.name).toBe('shot-bolt');
    expect((shot.mesh.material as MeshBasicMaterial).color.getHexString()).toBe('fff1c8');
    expect(opacityOf(shot)).toBe(0.9);

    ship.dispose();
  });

  it('re-skins the mounted model live and switches the shot style without a remount', () => {
    const ship = createRemoteShip(memberAt(0, 0, { hull: 'hull-obsidian' }));
    const model = groupNamed(ship.group, 'cursor-ship-model');
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, 'dispose');

    expect(ship.applyAppearance({ hull: 'hull-dart-aurum', shot: 'shot-orca-violet' })).toEqual(
      ['hull', 'shot'],
    );
    expect(groupNamed(ship.group, 'cursor-ship-model')).toBe(model);
    expect(model.parent).toBe(ship.body);
    expect(geometryDispose).toHaveBeenCalledTimes(0);

    expect(colorOf(meshNamed(ship.group, 'cursor-hull'))).toBe('ccaa44');
    expect(colorOf(meshNamed(ship.group, 'cursor-hull-seam-1'))).toBe('fff3d6');
    expect(groupNamed(ship.group, 'slot-hull').scale.toArray()).toEqual([0.85, 0.9, 1.15]);

    expect(ship.fire(new Vector3(0, 0, 0), 0)).toBe(true);
    const shot = ship.shots[0]!;
    expect(shot.mesh.name).toBe('shot-wave');
    expect(shot.mesh.scale.x).toBe(1.2);
    expect((shot.mesh.material as MeshBasicMaterial).color.getHexString()).toBe('6d28d9');
    expect(opacityOf(shot)).toBe(0.9);
    expect((shot.muzzleFlash.material as MeshBasicMaterial).color.getHexString()).toBe(
      'c4b5fd',
    );

    // Repeating the same record writes nothing and keeps the mounted model.
    const repeatColorSet = vi.spyOn(Color.prototype, 'set');
    expect(ship.applyAppearance({ hull: 'hull-dart-aurum', shot: 'shot-orca-violet' })).toEqual(
      [],
    );
    expect(repeatColorSet).toHaveBeenCalledTimes(0);
    expect(groupNamed(ship.group, 'cursor-ship-model')).toBe(model);

    ship.dispose();
  });

  it('writes no material or transform on a repeated record', () => {
    const ship = createRemoteShip(memberAt(0, 0, { hull: 'hull-dart-chrome' }));
    const hullSlot = groupNamed(ship.group, 'slot-hull');
    const colorSet = vi.spyOn(Color.prototype, 'set');
    const scaleSet = vi.spyOn(hullSlot.scale, 'set');
    const bodyY = ship.body.position.y;
    const bodyYaw = ship.body.rotation.y;

    expect(ship.applyAppearance({ hull: 'hull-dart-chrome' })).toEqual([]);
    expect(colorSet).toHaveBeenCalledTimes(0);
    expect(scaleSet).toHaveBeenCalledTimes(0);
    expect(ship.body.position.y).toBe(bodyY);
    expect(ship.body.rotation.y).toBe(bodyYaw);
    expect(ship.shots).toHaveLength(0);

    ship.dispose();
  });

  it('writes nothing when the empty record is re-applied to the defaults', () => {
    const ship = createRemoteShip(memberAt(0, 0));
    const colorSet = vi.spyOn(Color.prototype, 'set');
    const scaleSet = vi.spyOn(groupNamed(ship.group, 'slot-hull').scale, 'set');

    expect(ship.applyAppearance({})).toEqual([]);
    expect(colorSet).toHaveBeenCalledTimes(0);
    expect(scaleSet).toHaveBeenCalledTimes(0);

    ship.dispose();
  });

  it('reports the changed slots in catalog order', () => {
    const ship = createRemoteShip(memberAt(0, 0));

    expect(
      ship.applyAppearance({
        'tail-fin': 'tail-fin-comet',
        hull: 'hull-obsidian',
        'wing-right': 'wing-right-gold',
      }),
    ).toEqual(['hull', 'wing-right', 'tail-fin']);

    ship.dispose();
  });

  it('applies a direct shot style and ignores an identical repeat', () => {
    const ship = createRemoteShip(memberAt(0, 0));
    const colorSet = vi.spyOn(Color.prototype, 'set');

    ship.applyShotStyle(shotStyleForPart('shot-kite-solar'));
    expect(colorSet).toHaveBeenCalledTimes(2);
    ship.applyShotStyle(shotStyleForPart('shot-kite-solar'));
    expect(colorSet).toHaveBeenCalledTimes(2);

    expect(ship.fire(new Vector3(0, 0, 0), 0)).toBe(true);
    const shot = ship.shots[0]!;
    expect(shot.mesh.name).toBe('shot-orb');
    expect(shot.mesh.scale.x).toBe(0.95);
    expect(shot.muzzleFlash.geometry).toBeInstanceOf(TorusGeometry);
    expect((shot.mesh.material as MeshBasicMaterial).color.getHexString()).toBe('f59e0b');
    expect((shot.muzzleFlash.material as MeshBasicMaterial).color.getHexString()).toBe(
      'fef3c7',
    );

    ship.dispose();
  });
});

describe('idle motion on the body child (AC-19)', () => {
  it('writes bob and sway to the body only and leaves the root pin exact', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    const rootPosition = ship.group.position.toArray();
    const rootQuaternion = ship.group.quaternion.toArray();

    ship.update(650, false, []);
    expect(ship.body.position.y).toBe(0.12);
    expect(Math.abs(ship.body.rotation.y)).toBeLessThan(1e-12);
    expect(ship.group.position.toArray()).toEqual(rootPosition);
    expect(ship.group.quaternion.toArray()).toEqual(rootQuaternion);

    ship.update(1300, false, []);
    expect(ship.body.position.y).toBe(-0.12);
    expect(Math.abs(ship.body.rotation.y)).toBeLessThan(1e-12);
    expect(ship.group.position.toArray()).toEqual(rootPosition);
    expect(ship.group.quaternion.toArray()).toEqual(rootQuaternion);

    ship.dispose();
  });

  it('zeroes bob, sway and recoil under reduced motion', () => {
    const ship = createRemoteShip(memberAt(10, -4));

    ship.update(650, false, []);
    expect(ship.body.position.y).toBe(0.12);

    ship.update(0, true, []);
    expect(ship.body.position.y).toBe(0);
    expect(ship.body.position.z).toBe(0);
    expect(ship.body.rotation.y).toBe(0);

    ship.update(650, true, []);
    expect(ship.body.position.y).toBe(0);
    expect(ship.body.rotation.y).toBe(0);

    ship.dispose();
  });

  it('never follows a pointer, travels or banks the root', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    const position = ship.group.position.toArray();
    const rotation = ship.group.rotation.toArray();

    for (let frame = 0; frame < 60; frame += 1) {
      ship.update(16.6, false, []);
    }

    expect(ship.group.position.toArray()).toEqual(position);
    expect(ship.group.rotation.toArray()).toEqual(rotation);

    ship.dispose();
  });
});

describe('firing (AC-20)', () => {
  it('spawns at the local nose and travels to the world target over 180 ms', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    expect(ship.fire(TARGET, 0)).toBe(true);

    const shot = ship.shots[0]!;
    expect(shot.mesh.name).toBe('shot-bolt');
    expect(shot.start.toArray()).toEqual([0, 0, 0]);
    expect(shot.muzzle.toArray()).toEqual([0, 0, 0.7]);
    expect(shot.remainingMs).toBe(180);
    expect(shot.muzzleRemainingMs).toBe(MOTION.shotMuzzleFlashMs);

    ship.group.updateMatrixWorld(true);
    const targetLocal = ship.group.localToWorld(shot.target.clone());
    expect(targetLocal.distanceTo(TARGET)).toBeLessThan(1e-9);
    const muzzleWorld = ship.group.localToWorld(shot.muzzle.clone());
    expect(Math.abs(muzzleWorld.distanceTo(ship.group.position) - 0.84)).toBeLessThan(1e-9);

    ship.update(90, false, []);
    const expected = new Vector3().lerpVectors(muzzleWorld, TARGET, 0.5);
    expect(shot.mesh.getWorldPosition(new Vector3()).distanceTo(expected)).toBeLessThan(1e-9);
    expect(shot.remainingMs).toBe(90);

    ship.update(90, false, []);
    expect(ship.shots).toHaveLength(0);

    ship.dispose();
  });

  it('drops attempts inside 90 ms and admits the exact boundary', () => {
    const ship = createRemoteShip(memberAt(10, -4));

    expect(ship.fire(TARGET, 0)).toBe(true);
    expect(ship.fire(TARGET, 89)).toBe(false);
    expect(ship.shots).toHaveLength(1);
    expect(ship.fire(TARGET, 90)).toBe(true);
    expect(ship.shots).toHaveLength(2);

    ship.dispose();
  });

  it('caps at two live shots and never queues a third', () => {
    const ship = createRemoteShip(memberAt(10, -4));

    expect(ship.fire(TARGET, 0)).toBe(true);
    expect(ship.fire(TARGET, 90)).toBe(true);
    expect(ship.fire(TARGET, 180)).toBe(false);
    expect(ship.shots).toHaveLength(REMOTE_SHOT_MAX_IN_FLIGHT);

    ship.update(180, false, []);
    expect(ship.shots).toHaveLength(0);
    expect(ship.fire(TARGET, 270)).toBe(true);

    ship.dispose();
  });

  it('starts the pinned recoil only for an accepted shot', () => {
    const ship = createRemoteShip(memberAt(10, -4));

    expect(ship.fire(TARGET, 0)).toBe(true);
    expect(ship.body.position.z).toBe(-0.12);

    expect(ship.fire(TARGET, 50)).toBe(false);
    expect(ship.body.position.z).toBe(-0.12);

    ship.update(60, false, []);
    expect(Math.abs(ship.body.position.z - -0.015)).toBeLessThan(1e-9);

    ship.update(60, false, []);
    expect(ship.body.position.z).toBe(0);

    ship.dispose();
  });

  it('uses the muzzle flash duration and fades only that flash', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    expect(ship.fire(TARGET, 0)).toBe(true);
    const shot = ship.shots[0]!;

    expect(shot.muzzleFlash.name).toBe('shot-muzzle-flash');
    expect(shot.muzzleRemainingMs).toBe(80);
    expect(opacityOf(shot)).toBe(0.9);

    ship.update(40, false, []);
    expect(shot.muzzleRemainingMs).toBe(40);
    expect(opacityOf(shot)).toBeCloseTo(0.45, 12);

    ship.update(40, false, []);
    expect(shot.muzzleRemainingMs).toBe(0);
    expect(ship.shotsGroup.children).toHaveLength(1);
    expect(opacityOf(shot)).toBe(0);

    ship.dispose();
  });

  it('captures geometry and muzzle at spawn while the style changes live', () => {
    const ship = createRemoteShip(memberAt(10, -4, { shot: 'shot-hauler-jade' }));

    expect(ship.fire(TARGET, 0)).toBe(true);
    ship.applyAppearance({ shot: 'shot-lance-azure' });
    expect(ship.fire(TARGET, 90)).toBe(true);

    const [waveShot, boltShot] = ship.shots;
    expect(waveShot!.mesh.name).toBe('shot-orb');
    expect(waveShot!.mesh.geometry).toBeInstanceOf(OctahedronGeometry);
    expect(waveShot!.muzzleFlash.geometry).toBeInstanceOf(TorusGeometry);
    expect(boltShot!.mesh.name).toBe('shot-bolt');
    expect(boltShot!.mesh.geometry).toBeInstanceOf(ConeGeometry);
    expect(boltShot!.muzzleFlash.geometry).toBeInstanceOf(OctahedronGeometry);
    expect(boltShot!.muzzleRemainingMs).toBe(80);
    // The projectile material is shared: the live style's colour reaches both shots, while
    // geometry/scale/muzzle stay captured at spawn (AC-24/AC-26).
    expect(
      (waveShot!.mesh.material as MeshBasicMaterial).color.getHexString(),
    ).toBe('2f6fd6');
    expect((waveShot!.muzzleFlash.material as MeshBasicMaterial).color.getHexString()).toBe(
      '7cf6ff',
    );

    ship.dispose();
  });

  it('switches the shot geometry of the next shot (shard / petal)', () => {
    const ship = createRemoteShip(memberAt(10, -4, { shot: 'shot-arrow-crimson' }));
    expect(ship.fire(TARGET, 0)).toBe(true);
    const shot = ship.shots[0]!;

    expect(shot.mesh.name).toBe('shot-shard');
    expect(shot.mesh.geometry).toBeInstanceOf(TetrahedronGeometry);
    expect(shot.mesh.scale.x).toBe(1);
    expect((shot.mesh.material as MeshBasicMaterial).color.getHexString()).toBe('9f1239');
    expect((shot.muzzleFlash.material as MeshBasicMaterial).color.getHexString()).toBe(
      'fb7185',
    );

    ship.dispose();
  });

  it('keeps exactly one live muzzle when two shots spawn without a frame', () => {
    const ship = createRemoteShip(memberAt(10, -4));

    expect(ship.fire(TARGET, 0)).toBe(true);
    expect(ship.fire(TARGET, 90)).toBe(true);

    const muzzles = ship.shotsGroup.children.filter(
      (child) => child instanceof Mesh && child.name === 'shot-muzzle-flash',
    );
    expect(muzzles).toHaveLength(1);
    expect(ship.shots[0]!.muzzleRemainingMs).toBe(0);
    expect(ship.shots[1]!.muzzleRemainingMs).toBe(80);
    expect(countObjects(ship.group)).toBe(REMOTE_SHIP_MAX_OBJECT_COUNT);
    expect(countObjects(ship.group) + 1).toBe(REMOTE_SHIP_MAX_SCENE_OBJECT_COUNT);
    expect(meshesIn(ship.group)).toHaveLength(REMOTE_SHIP_MAX_DRAW_COUNT);

    ship.dispose();
  });
});

describe('reduced-motion firing (AC-21)', () => {
  it('flashes at the target for 120 ms with no travelling mesh or recoil', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    ship.update(0, true, []);

    expect(ship.fire(TARGET, 0)).toBe(true);
    expect(ship.shots).toHaveLength(0);
    expect(ship.group.getObjectByName('shot-bolt')).toBeUndefined();
    expect(countObjects(ship.group)).toBe(REMOTE_SHIP_OBJECT_COUNT + 1);

    const flash = meshNamed(ship.group, 'shot-impact-flash');
    expect(flash.visible).toBe(true);
    expect(flash.getWorldPosition(new Vector3()).distanceTo(TARGET)).toBeLessThan(1e-9);
    expect((flash.material as MeshBasicMaterial).opacity).toBe(0.9);
    expect(ship.body.position.y).toBe(0);
    expect(ship.body.position.z).toBe(0);
    expect(ship.body.rotation.y).toBe(0);

    expect(ship.fire(TARGET, 50)).toBe(false);
    ship.update(60, true, []);
    expect((flash.material as MeshBasicMaterial).opacity).toBeCloseTo(0.45, 12);
    expect(ship.body.position.y).toBe(0);
    expect(ship.body.rotation.y).toBe(0);

    ship.update(60, true, []);
    expect(flash.visible).toBe(false);
    expect(ship.shotsGroup.children).toHaveLength(0);
    expect(countObjects(ship.group)).toBe(REMOTE_SHIP_OBJECT_COUNT);

    ship.dispose();
  });

  it('reuses the single flash for the next accepted removal', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    ship.update(0, true, []);

    expect(ship.fire(TARGET, 0)).toBe(true);
    expect(ship.fire(TARGET, 90)).toBe(true);
    const flashes = meshesIn(ship.group).filter((mesh) => mesh.name === 'shot-impact-flash');
    expect(flashes).toHaveLength(1);
    expect(countObjects(ship.group)).toBe(REMOTE_SHIP_OBJECT_COUNT + 1);

    ship.dispose();
  });

  it('retires a live reduced flash when the motion setting returns', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    ship.update(0, true, []);
    expect(ship.fire(TARGET, 0)).toBe(true);
    expect(meshNamed(ship.group, 'shot-impact-flash').visible).toBe(true);

    ship.update(0, false, []);
    expect(ship.fire(TARGET, 90)).toBe(true);

    const flashes = meshesIn(ship.group).filter((mesh) => mesh.name === 'shot-impact-flash');
    expect(flashes).toHaveLength(0);
    expect(ship.shots).toHaveLength(1);

    ship.dispose();
  });
});

describe('quality tiers and budget (AC-22)', () => {
  it('contributes 35 module objects / 21 draws at rest (36 scene with the manager)', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    const model = groupNamed(ship.group, 'cursor-ship-model');

    expect(countObjects(ship.group)).toBe(REMOTE_SHIP_OBJECT_COUNT);
    expect(countObjects(ship.group) + 1).toBe(REMOTE_SHIP_SCENE_OBJECT_COUNT);
    expect(meshesIn(model)).toHaveLength(REMOTE_SHIP_DRAW_COUNT);
    expect(meshesIn(ship.group)).toHaveLength(REMOTE_SHIP_DRAW_COUNT);
    expect(ship.shotsGroup.children).toHaveLength(0);

    ship.dispose();
  });

  it('reaches 38 module objects / 23 draws with two bolts and no muzzle', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    expect(ship.fire(TARGET, 0)).toBe(true);
    expect(ship.fire(TARGET, 90)).toBe(true);

    ship.update(80, false, []);

    expect(ship.shots).toHaveLength(2);
    expect(ship.shots[0]!.muzzleRemainingMs).toBe(0);
    expect(ship.shots[1]!.muzzleRemainingMs).toBe(0);
    // 35 rest + 2 bolts; the scene adds T12's manager (the pinned two-bolt 38 / 23).
    expect(countObjects(ship.group)).toBe(37);
    expect(countObjects(ship.group) + 1).toBe(38);
    expect(meshesIn(ship.group)).toHaveLength(23);

    ship.dispose();
  });

  it('hides the accepted four medium and six low detail meshes', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    const model = groupNamed(ship.group, 'cursor-ship-model');
    const ignitionLeft = meshNamed(ship.group, 'ignition');

    expect(QUALITY_MEDIUM_HIDDEN_MESHES).toHaveLength(4);
    expect(QUALITY_LOW_HIDDEN_MESHES).toHaveLength(6);

    ship.update(0, false, QUALITY_MEDIUM_HIDDEN_MESHES);
    for (const name of QUALITY_MEDIUM_HIDDEN_MESHES) {
      expect(meshNamed(ship.group, name).visible).toBe(false);
    }
    expect(meshNamed(ship.group, 'cursor-wing-left-tip').visible).toBe(true);
    expect(meshesIn(model).filter((mesh) => mesh.visible)).toHaveLength(15);
    expect(ignitionLeft.visible).toBe(false);

    // A same-length but different list is a real change (not a skipped write).
    ship.update(0, false, [
      'cursor-hull-seam-1',
      'cursor-hull-seam-2',
      'cursor-wing-left-tip',
      'cursor-wing-right-tip',
    ]);
    expect(meshNamed(ship.group, 'cursor-vent-left').visible).toBe(true);
    expect(meshNamed(ship.group, 'cursor-wing-left-tip').visible).toBe(false);
    expect(meshNamed(ship.group, 'cursor-hull-seam-1').visible).toBe(false);

    ship.update(0, false, QUALITY_LOW_HIDDEN_MESHES);
    for (const name of QUALITY_LOW_HIDDEN_MESHES) {
      expect(meshNamed(ship.group, name).visible).toBe(false);
    }
    expect(meshesIn(model).filter((mesh) => mesh.visible)).toHaveLength(13);

    ship.update(0, false, []);
    for (const name of QUALITY_LOW_HIDDEN_MESHES) {
      expect(meshNamed(ship.group, name).visible).toBe(true);
    }
    expect(meshesIn(model).filter((mesh) => mesh.visible)).toHaveLength(19);
    expect(ignitionLeft.visible).toBe(false);

    ship.dispose();
  });

  it('renders no trail, reticle, light or camera of its own', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    ship.update(16, false, []);

    expect(ship.group.getObjectByName('spaceship-trail')).toBeUndefined();
    expect(ship.group.getObjectByName('reticle')).toBeUndefined();
    expect(meshesIn(ship.group).some((mesh) => mesh.name.includes('trail'))).toBe(false);
    expect(meshesIn(ship.group).some((mesh) => mesh.name.includes('reticle'))).toBe(false);

    ship.dispose();
  });

  it('keeps one pose buffer and the object count stable across frames', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    const pose = ship.pose;
    const objects = countObjects(ship.group);
    const bodyPosition = ship.body.position;

    for (let frame = 0; frame < 120; frame += 1) {
      ship.update(16.6, frame % 2 === 0, QUALITY_MEDIUM_HIDDEN_MESHES);
    }

    expect(ship.pose).toBe(pose);
    expect(countObjects(ship.group)).toBe(objects);
    expect(ship.body.position).toBe(bodyPosition);

    ship.dispose();
  });
});

describe('dispose (AC-15, AC-22)', () => {
  it('releases every geometry and material exactly once and is idempotent', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    const manager = new Group();
    manager.name = 'remote-ships';
    manager.add(ship.group);
    expect(ship.fire(TARGET, 0)).toBe(true);

    const geometryDispose = vi.spyOn(BufferGeometry.prototype, 'dispose');
    const materialDispose = vi.spyOn(Material.prototype, 'dispose');

    ship.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(28);
    expect(materialDispose).toHaveBeenCalledTimes(21);
    expect(manager.children).toHaveLength(0);
    expect(ship.group.parent).toBeNull();
    expect(ship.group.children).toHaveLength(0);
    expect(ship.shots).toHaveLength(0);

    ship.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(28);
    expect(materialDispose).toHaveBeenCalledTimes(21);
  });

  it('is inert after disposal', () => {
    const ship = createRemoteShip(memberAt(10, -4));
    ship.dispose();

    expect(ship.fire(TARGET, 0)).toBe(false);
    ship.update(16, false, []);
    ship.applyShotStyle(shotStyleForPart('shot-kite-solar'));
    expect(ship.applyAppearance({ hull: 'hull-gold' })).toEqual([]);
    expect(ship.shots).toHaveLength(0);
    expect(ship.group.children).toHaveLength(0);
  });
});
