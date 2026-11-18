import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';
import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Points,
  TetrahedronGeometry,
  TorusGeometry,
  Vector3,
  type Object3D,
} from 'three';

import {
  SHOT_TRAVEL_MS,
  SPACESHIP_CURSOR_NDC_OFFSET_X,
  SPACESHIP_CURSOR_NDC_OFFSET_Y,
  SPACESHIP_FOLLOW_TAU_MS,
  SPACESHIP_IGNITION_COUNT,
  SPACESHIP_PLANE_DISTANCE,
  SPACESHIP_SCALE,
} from '../game/effects';
import { MOTION } from '../game/motion';
import { shotStyleForPart } from '../game/parts-v3';
import {
  CURSOR_SHIP_MATERIAL_COUNT,
  CURSOR_SHIP_MESH_COUNT,
  CURSOR_SHIP_SLOT_COUNT,
} from './cursor-ship';
import { shipBankRad, shipIdleOffsetY, shipPitchRad, shipRollRad } from './ship-motion';
import {
  createSpaceship,
  SHOT_BOLT_COLOR,
  SHOT_MUZZLE_FLASH_COLOR,
  SHOT_MUZZLE_FLASH_MS,
  SHOT_MUZZLE_OFFSET,
  shotRecoilOffsetAt,
  SPACESHIP_TRAIL_CAPACITY,
  spaceshipFollowFactor,
  spaceshipTargetPosition,
  type Spaceship,
} from './spaceship';

function cameraAtRest(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

function countObjects(root: Object3D): number {
  return 1 + root.children.reduce((total, child) => total + countObjects(child), 0);
}

function meshByName(ship: Spaceship, name: string): Mesh {
  const mesh = ship.model.meshes.find((candidate) => candidate.name === name);
  if (mesh === undefined) {
    throw new Error(`no ${name} mesh`);
  }
  return mesh;
}

function colorOf(ship: Spaceship, name: string): string {
  const material = meshByName(ship, name).material as unknown as {
    color: { getHexString(): string };
  };
  return material.color.getHexString();
}

describe('spaceshipFollowFactor (AC-5)', () => {
  it('keeps the 240 ms smoothing formula', () => {
    expect(SPACESHIP_FOLLOW_TAU_MS).toBe(240);
    expect(spaceshipFollowFactor(240, false)).toBeCloseTo(1 - 1 / Math.E, 12);
    expect(spaceshipFollowFactor(0, false)).toBe(0);
  });

  it('snaps (factor 1) under reduced motion for any dt >= 0', () => {
    expect(spaceshipFollowFactor(0, true)).toBe(1);
    expect(spaceshipFollowFactor(120, true)).toBe(1);
    expect(spaceshipFollowFactor(1000, true)).toBe(1);
  });
});

describe('spaceshipTargetPosition (AC-5)', () => {
  it('pins the NDC offsets, plane distance and default-camera vector', () => {
    expect(SPACESHIP_PLANE_DISTANCE).toBe(6);
    expect(SPACESHIP_CURSOR_NDC_OFFSET_X).toBe(-0.16);
    expect(SPACESHIP_CURSOR_NDC_OFFSET_Y).toBe(-0.12);

    const result = spaceshipTargetPosition(cameraAtRest(), 0, 0);
    expect(Math.abs(result.x - -0.445721)).toBeLessThan(1e-6);
    expect(Math.abs(result.y - -0.334291)).toBeLessThan(1e-6);
    expect(Math.abs(result.z - 6.025924)).toBeLessThan(1e-6);
  });
});

describe('createSpaceship model integration (AC-5, AC-7, AC-8)', () => {
  it('keeps the spaceship group identity, scale and rest pose', () => {
    const ship = createSpaceship();

    expect(ship.group.name).toBe('spaceship');
    expect(ship.group.scale.toArray()).toEqual([SPACESHIP_SCALE, SPACESHIP_SCALE, SPACESHIP_SCALE]);
    expect(ship.getPosition().toArray()).toEqual([0, 0, 6]);
    ship.dispose();
  });

  it('mounts the 32-object model plus one trail Points: 34 cursor objects', () => {
    const ship = createSpaceship();

    expect(ship.group.children).toHaveLength(2);
    expect(ship.group.children[0]).toBe(ship.model.group);
    expect(ship.group.children[1]).toBe(ship.trailPoints);
    expect(ship.trailPoints).toBeInstanceOf(Points);
    expect(countObjects(ship.group)).toBe(34);
    expect(countObjects(ship.model.group)).toBe(32);
    expect(ship.model.meshes).toHaveLength(CURSOR_SHIP_MESH_COUNT);
    expect(CURSOR_SHIP_MESH_COUNT).toBe(21);
    expect(ship.model.slotGroups).toHaveLength(CURSOR_SHIP_SLOT_COUNT);
    expect(ship.model.slotGroups.map((slot) => slot.name)).toEqual([
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
    expect(ship.model.materialCount).toBe(CURSOR_SHIP_MATERIAL_COUNT);
    expect(CURSOR_SHIP_MATERIAL_COUNT).toBe(19);
    expect(SPACESHIP_TRAIL_CAPACITY).toBe(16);
    ship.dispose();
  });

  it('applies a slot appearance to the left wing only and is idempotent', () => {
    const ship = createSpaceship();
    expect(colorOf(ship, 'cursor-wing-left')).toBe('4466cc');
    expect(colorOf(ship, 'cursor-wing-right')).toBe('4466cc');

    const changed = ship.applyAppearance({ 'wing-left': 'wing-left-silver' });
    expect(changed).toEqual(['wing-left']);
    expect(colorOf(ship, 'cursor-wing-left')).toBe('aaaaaa');
    expect(colorOf(ship, 'cursor-wing-right')).toBe('4466cc');

    expect(ship.applyAppearance({ 'wing-left': 'wing-left-silver' })).toEqual([]);
    ship.dispose();
  });

  it('normalizes legacy appearance categories for the model', () => {
    const ship = createSpaceship({ body: 'body-gold' });
    expect(colorOf(ship, 'cursor-hull')).toBe('ccaa44');
    expect(colorOf(ship, 'cursor-wing-left')).toBe('4466cc');
    ship.dispose();
  });

  it('never replaces the outer group identity on appearance changes', () => {
    const ship = createSpaceship();
    const group = ship.group;
    ship.applyAppearance({ hull: 'hull-gold' });
    expect(ship.group).toBe(group);
    expect(ship.group.children[0]).toBe(ship.model.group);
    ship.dispose();
  });
});

describe('cursor follow and motion (AC-5, AC-9, AC-42)', () => {
  it('follows the pointer by the pinned factor', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    const start = ship.getPosition();
    const target = spaceshipTargetPosition(camera, 0, 0);

    ship.update(camera, 0, 0, true, 240, false);

    const factor = spaceshipFollowFactor(240, false);
    const expected = start.clone().lerp(target, factor);
    expect(ship.getPosition().x).toBeCloseTo(expected.x, 6);
    expect(ship.getPosition().y).toBeCloseTo(expected.y, 6);
    expect(ship.getPosition().z).toBeCloseTo(expected.z, 6);
    ship.dispose();
  });

  it('does not smooth without a pointer and stays at (0, 0, 6)', () => {
    const ship = createSpaceship();
    ship.update(cameraAtRest(), 0, 0, false, 120, false);
    expect(ship.getPosition().toArray()).toEqual([0, 0, 6]);
    expect(ship.group.rotation.z).toBe(0);
    expect(ship.group.rotation.x).toBe(0);
    expect(ship.getTrailCount()).toBe(0);
    ship.dispose();
  });

  it('does not move with dtMs 0 without reduced motion', () => {
    const ship = createSpaceship();
    ship.update(cameraAtRest(), 0, 0, true, 0, false);
    expect(ship.getPosition().toArray()).toEqual([0, 0, 6]);
    expect(ship.getTrailCount()).toBe(0);
    ship.dispose();
  });

  it('applies the bank/pitch formulas from the NDC velocity', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    ship.update(camera, 0, 0, true, 100, false);
    ship.update(camera, 0.2, 0.1, true, 100, false);

    expect(ship.group.rotation.z).toBeCloseTo(shipBankRad(0.002), 12);
    expect(ship.group.rotation.x).toBeCloseTo(shipPitchRad(0.001), 12);
    expect(ship.group.rotation.z).toBeCloseTo(-0.0048, 12);
    expect(ship.group.rotation.x).toBeCloseTo(-0.0016, 12);
    ship.dispose();
  });

  it('applies the 0.015/2600 ms idle bob to the model root', () => {
    const ship = createSpaceship();
    ship.update(cameraAtRest(), 0, 0, true, 650, false);

    expect(ship.model.group.position.y).toBeCloseTo(shipIdleOffsetY(650), 12);
    expect(ship.model.group.position.y).toBeCloseTo(0.015, 12);
    ship.dispose();
  });

  it('pulses the model 4 % for 260 ms after an appearance change', () => {
    const ship = createSpaceship();
    ship.applyAppearance({ hull: 'hull-gold' });

    ship.update(cameraAtRest(), 0, 0, false, 130, false);
    expect(ship.getPulseScale()).toBeCloseTo(1.04, 12);
    expect(ship.model.group.scale.x).toBeCloseTo(1.04, 12);

    ship.update(cameraAtRest(), 0, 0, false, 130, false);
    expect(ship.getPulseScale()).toBe(1);
    ship.dispose();
  });

  it('records up to 8 trail points that expire after 220 ms', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();

    ship.update(camera, 0, 0, true, 16, false);
    expect(ship.getTrailCount()).toBe(1);
    for (let index = 0; index < 10; index += 1) {
      ship.update(camera, index / 100, 0, true, 16, false);
    }
    expect(ship.getTrailCount()).toBe(8);

    // Advancing time without a pointer expires every stored point; there is no new push.
    ship.update(camera, 0.1, 0, false, 220, false);
    expect(ship.getTrailCount()).toBe(0);
    expect(ship.trailPoints.geometry.drawRange.count).toBe(0);
    ship.dispose();
  });

  it('freezes bank, pitch, trail, pulse and ignitions under reduced motion', () => {
    const ship = createSpaceship();
    ship.applyAppearance({ hull: 'hull-gold' });
    // The equipped appearance is still reflected in the materials while motion is frozen.
    expect(colorOf(ship, 'cursor-hull')).toBe('ccaa44');
    ship.update(cameraAtRest(), 0.2, 0.1, true, 120, true);

    expect(ship.group.rotation.z).toBe(0);
    expect(ship.group.rotation.x).toBe(0);
    expect(ship.getTrailCount()).toBe(0);
    expect(ship.getPulseScale()).toBe(1);
    expect(ship.model.group.position.y).toBe(0);
    expect(ship.getIgnitionIntensity()).toBe(0);
    for (const ignition of ship.ignitions) {
      expect(ignition.visible).toBe(false);
    }
    ship.dispose();
  });

  it('snaps to the pointer under reduced motion', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    const target = spaceshipTargetPosition(camera, 0, 0);

    ship.update(camera, 0, 0, true, 0, true);

    expect(ship.getPosition().x).toBeCloseTo(target.x, 6);
    expect(ship.getPosition().y).toBeCloseTo(target.y, 6);
    expect(ship.getPosition().z).toBeCloseTo(target.z, 6);
    ship.dispose();
  });
});

describe('ignitions (AC-6)', () => {
  it('exposes two hidden ignitions named ignition with intensity 0', () => {
    const ship = createSpaceship();
    expect(ship.ignitions).toHaveLength(SPACESHIP_IGNITION_COUNT);
    expect(SPACESHIP_IGNITION_COUNT).toBe(2);
    for (const ignition of ship.ignitions) {
      expect(ignition.name).toBe('ignition');
      expect(ignition.visible).toBe(false);
    }
    expect(ship.getIgnitionIntensity()).toBe(0);
    ship.dispose();
  });

  it('activates and flickers after a moving update', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();

    ship.update(camera, 0, 0, true, 120, false);
    expect(ship.getIgnitionIntensity()).toBeGreaterThan(0);
    expect(ship.ignitions.some((ignition) => ignition.visible)).toBe(true);

    const first = ship.ignitions[0]!.scale.z;
    ship.update(camera, 0, 0, true, 120, false);
    const second = ship.ignitions[0]!.scale.z;
    expect(Math.abs(second - first)).toBeGreaterThan(1e-9);
    ship.dispose();
  });

  it('keeps ignitions hidden at rest, on dtMs 0 and under reduced motion', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();

    ship.update(camera, 0, 0, true, 0, false);
    expect(ship.getIgnitionIntensity()).toBe(0);
    for (const ignition of ship.ignitions) expect(ignition.visible).toBe(false);

    ship.update(camera, 0, 0, true, 120, true);
    expect(ship.getIgnitionIntensity()).toBe(0);
    for (const ignition of ship.ignitions) expect(ignition.visible).toBe(false);
    ship.dispose();
  });
});

describe('fly-by (AC-40)', () => {
  it('performs one 360° roll on a 1.2-unit orbit over 700 ms', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    const start = ship.getPosition().clone();

    ship.startFlyBy();
    expect(ship.isFlyingBy()).toBe(true);

    ship.update(camera, 0, 0, true, 350, false);
    const mid = ship.getPosition();
    expect(mid.x).toBeCloseTo(start.x - 2 * MOTION.shipOrbitRadius, 6);
    expect(mid.y).toBeCloseTo(start.y, 6);
    expect(mid.z).toBeCloseTo(start.z, 6);
    expect(ship.group.rotation.z).toBeCloseTo(shipRollRad(350), 12);
    expect(ship.getTrailCount()).toBe(1);

    ship.update(camera, 0, 0, true, 350, false);
    expect(ship.isFlyingBy()).toBe(false);
    const end = ship.getPosition();
    expect(end.x).toBeCloseTo(start.x, 6);
    expect(end.y).toBeCloseTo(start.y, 6);
    expect(end.z).toBeCloseTo(start.z, 6);
    expect(ship.group.rotation.z).toBe(0);
    ship.dispose();
  });

  it('uses the 16-point fire trail during the fly-by', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    ship.startFlyBy();

    for (let index = 0; index < 20; index += 1) {
      ship.update(camera, 0, 0, true, 16, false);
    }
    expect(ship.getTrailCount()).toBe(SPACESHIP_TRAIL_CAPACITY);
    ship.dispose();
  });

  it('is cancelled by reduced motion', () => {
    const ship = createSpaceship();
    ship.startFlyBy();
    ship.update(cameraAtRest(), 0, 0, true, 100, true);

    expect(ship.isFlyingBy()).toBe(false);
    expect(ship.getTrailCount()).toBe(0);
    expect(ship.group.rotation.z).toBe(0);
    ship.dispose();
  });
});

describe('quality setters (AC-52)', () => {
  it('clears and hides the trail when the high-tier trail is disabled', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    ship.update(camera, 0, 0, true, 16, false);
    expect(ship.getTrailCount()).toBe(1);

    ship.setTrailEnabled(false);
    expect(ship.getTrailCount()).toBe(0);
    ship.update(camera, 0.1, 0, true, 16, false);
    expect(ship.getTrailCount()).toBe(0);
    expect(ship.trailPoints.visible).toBe(false);

    ship.setTrailEnabled(true);
    ship.update(camera, 0.2, 0, true, 16, false);
    expect(ship.getTrailCount()).toBe(1);
    ship.dispose();
  });

  it('disables bank/pitch/idle/pulse at the low tier', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    ship.applyAppearance({ hull: 'hull-gold' });
    ship.setCursorMotionEnabled(false);

    ship.update(camera, 0.2, 0.1, true, 120, false);
    expect(ship.group.rotation.z).toBe(0);
    expect(ship.group.rotation.x).toBe(0);
    expect(ship.model.group.position.y).toBe(0);
    expect(ship.getPulseScale()).toBe(1);
    ship.dispose();
  });

  it('hides exactly the named detail meshes and restores them', () => {
    const ship = createSpaceship();
    const names = [
      'cursor-hull-seam-1',
      'cursor-hull-seam-2',
      'cursor-vent-left',
      'cursor-vent-right',
    ];

    ship.setHiddenMeshes(names);
    for (const name of names) {
      expect(meshByName(ship, name).visible).toBe(false);
    }
    expect(meshByName(ship, 'cursor-wing-left-tip').visible).toBe(true);

    ship.setHiddenMeshes([]);
    for (const name of names) {
      expect(meshByName(ship, name).visible).toBe(true);
    }
    ship.dispose();
  });
});

describe('shotRecoilOffsetAt (AC-6)', () => {
  it('pins the recoil table 0 / 60 / 120', () => {
    expect(MOTION.shotRecoilMs).toBe(120);
    expect(MOTION.shotRecoilDistance).toBe(0.12);
    expect(shotRecoilOffsetAt(0)).toBe(-0.12);
    expect(shotRecoilOffsetAt(60)).toBe(-0.015);
    expect(shotRecoilOffsetAt(120)).toBe(0);
  });

  it('returns 0 outside the 0–120 ms window', () => {
    expect([-100, -1, -0.001].map(shotRecoilOffsetAt)).toEqual([0, 0, 0]);
    expect([120, 120.001, 200, 1000].map(shotRecoilOffsetAt)).toEqual([0, 0, 0, 0]);
    expect(shotRecoilOffsetAt(119)).toBe(-6.944444444823006e-8);
    expect(shotRecoilOffsetAt(30)).toBe(-0.050624999999999996);
  });
});

describe('shots (AC-6)', () => {
  it('spawns a glowing tapered bolt at the muzzle with the 180 ms travel time', () => {
    const ship = createSpaceship();
    const start = new Vector3(1, 2, 3);
    const target = new Vector3(4, 5, 6);
    const shot = ship.spawnShot(start, target);

    expect(SHOT_TRAVEL_MS).toBe(180);
    expect(SHOT_MUZZLE_OFFSET).toBe(0.78);
    expect(SHOT_MUZZLE_FLASH_MS).toBe(80);
    expect(ship.shots).toHaveLength(1);
    expect(shot.start.toArray()).toEqual([1, 2, 3]);
    expect(shot.muzzle.toArray()).toEqual([1, 2, 3.7800000000000002]);
    expect(shot.target.toArray()).toEqual([4, 5, 6]);
    expect(shot.remainingMs).toBe(180);
    expect(shot.mesh.position.toArray()).toEqual([1, 2, 3.7800000000000002]);

    expect(shot.mesh.name).toBe('shot-bolt');
    expect(shot.mesh.geometry).toBeInstanceOf(ConeGeometry);
    const geometry = shot.mesh.geometry as ConeGeometry;
    expect(geometry.parameters.radius).toBe(0.07);
    expect(geometry.parameters.height).toBe(0.55);
    expect(geometry.parameters.radialSegments).toBe(6);
    expect(geometry.index!.count / 3).toBe(12);
    const material = shot.mesh.material as MeshBasicMaterial;
    expect(material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.color.getHex()).toBe(SHOT_BOLT_COLOR);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.95);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.depthWrite).toBe(false);
    expect(material.toneMapped).toBe(false);
    ship.dispose();
  });

  it('orients the bolt along the muzzle-to-target direction with local +z as its tip', () => {
    const ship = createSpaceship();
    const shot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 2, 3));

    // The bolt's local +z (its tip) is rotated onto the muzzle→target direction. The
    // quaternion round-trip is deterministic three.js float math; the double result is
    // pinned exactly (no tolerance): (1, 2, 2.22) normalised.
    const forward = new Vector3(0, 0, 1).applyQuaternion(shot.mesh.quaternion);
    expect(forward.toArray()).toEqual([
      0.3173659772736849,
      0.6347319545473697,
      0.7045524695475806,
    ]);
    ship.dispose();
  });

  it('creates one 80 ms additive muzzle flash at the muzzle, scale 1 → 1.4', () => {
    const ship = createSpaceship();
    const shot = ship.spawnShot(new Vector3(1, 2, 3), new Vector3(4, 5, 6));

    expect(ship.getMuzzleFlashCount()).toBe(1);
    expect(shot.muzzleRemainingMs).toBe(80);
    expect(shot.muzzleFlash.name).toBe('shot-muzzle-flash');
    expect(shot.muzzleFlash.position.toArray()).toEqual([1, 2, 3.7800000000000002]);
    expect(shot.muzzleFlash.geometry).toBeInstanceOf(OctahedronGeometry);
    const geometry = shot.muzzleFlash.geometry as OctahedronGeometry;
    expect(geometry.parameters.radius).toBe(0.22);
    expect(geometry.parameters.detail).toBe(0);
    const material = shot.muzzleFlash.material as MeshBasicMaterial;
    expect(material.color.getHex()).toBe(SHOT_MUZZLE_FLASH_COLOR);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.toneMapped).toBe(false);
    expect(material.opacity).toBe(0.9);
    expect(shot.muzzleFlash.scale.toArray()).toEqual([1, 1, 1]);
    expect(shot.muzzleFlash.quaternion.toArray()).toEqual(shot.mesh.quaternion.toArray());

    ship.updateShots(40);
    expect(shot.muzzleFlash.scale.x).toBe(1.35);
    expect(material.opacity).toBe(0.45);
    expect(ship.getMuzzleFlashCount()).toBe(1);

    ship.updateShots(39);
    expect(shot.muzzleRemainingMs).toBe(1);
    expect(ship.getMuzzleFlashCount()).toBe(1);

    ship.updateShots(1);
    expect(shot.muzzleRemainingMs).toBe(0);
    expect(ship.getMuzzleFlashCount()).toBe(0);
    expect(shot.muzzleFlash.parent).toBeNull();
    // The bolt is still in flight and is the only live shot drawable.
    expect(ship.shotsGroup.children.map((child) => child.name)).toEqual(['shot-bolt']);
    ship.dispose();
  });

  it('travels linearly from the muzzle and completes on arrival', () => {
    const ship = createSpaceship();
    const shot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(10, 10, 10));

    expect(ship.updateShots(90)).toHaveLength(0);
    const mid = ship.shots[0]!;
    expect(mid.mesh.position.toArray()).toEqual([5, 5, 5.390000000000001]);

    const completed = ship.updateShots(90);
    expect(completed).toHaveLength(1);
    expect(completed[0]).toBe(shot);
    expect(shot.mesh.position.toArray()).toEqual([10, 10, 10]);
    expect(ship.shots).toHaveLength(0);
    expect(ship.shotsGroup.children).toEqual([]);
    ship.dispose();
  });

  it('draws exactly one bolt plus one transient flash per live shot', () => {
    const ship = createSpaceship();
    ship.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    expect(ship.shotsGroup.children).toHaveLength(2);
    expect(ship.shotsGroup.children.map((child) => child.name).sort()).toEqual([
      'shot-bolt',
      'shot-muzzle-flash',
    ]);

    ship.updateShots(80);
    expect(ship.shotsGroup.children).toHaveLength(1);
    expect(ship.shotsGroup.children[0]!.name).toBe('shot-bolt');
    ship.dispose();
  });

  it('applies the 0.12-local recoil to the model subgroup and settles by 120 ms', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    ship.update(camera, 0, 0, true, 0, false);
    const shot = ship.spawnShot(new Vector3(0, 0, 6), new Vector3(0, 0, 0));
    expect(shot.start.toArray()).toEqual([0, 0, 6]);

    ship.update(camera, 0, 0, true, 60, false);
    expect(ship.getRecoilOffset()).toBe(-0.015);
    expect(ship.model.group.position.z).toBe(-0.015);

    ship.update(camera, 0, 0, true, 60, false);
    expect(ship.getRecoilOffset()).toBe(0);
    expect(ship.model.group.position.z).toBe(0);
    ship.dispose();
  });

  it('cancels the flash and recoil when the shot FX layer is disabled; the bolt still travels', () => {
    const ship = createSpaceship();
    const shot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    expect(ship.getMuzzleFlashCount()).toBe(1);

    ship.setShotFxEnabled(false);

    expect(ship.getMuzzleFlashCount()).toBe(0);
    expect(shot.muzzleRemainingMs).toBe(0);
    expect(shot.muzzleFlash.parent).toBeNull();
    expect(ship.getRecoilOffset()).toBe(0);
    expect(ship.model.group.position.z).toBe(0);
    expect(ship.shots).toHaveLength(1);
    expect(ship.shotsGroup.children.map((child) => child.name)).toEqual(['shot-bolt']);

    ship.updateShots(90);
    expect(shot.mesh.position.toArray()).toEqual([0.5, 0.5, 0.89]);
    ship.dispose();
  });

  it('spawns no flash or recoil at the low tier and under reduced motion', () => {
    const low = createSpaceship();
    low.setShotFxEnabled(false);
    const lowShot = low.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    expect(lowShot.muzzleRemainingMs).toBe(0);
    expect(low.getMuzzleFlashCount()).toBe(0);
    expect(low.getRecoilOffset()).toBe(0);
    expect(low.shotsGroup.children.map((child) => child.name)).toEqual(['shot-bolt']);
    low.dispose();

    const reduced = createSpaceship();
    reduced.update(cameraAtRest(), 0, 0, true, 0, true);
    const reducedShot = reduced.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    expect(reducedShot.muzzleRemainingMs).toBe(0);
    expect(reduced.getMuzzleFlashCount()).toBe(0);
    expect(reduced.getRecoilOffset()).toBe(0);
    reduced.update(cameraAtRest(), 0, 0, true, 60, true);
    expect(reduced.model.group.position.z).toBe(0);
    reduced.dispose();
  });

  it('cancels a live flash and the recoil on a reduced-motion update', () => {
    const ship = createSpaceship();
    ship.update(cameraAtRest(), 0, 0, true, 0, false);
    ship.spawnShot(new Vector3(0, 0, 6), new Vector3(0, 0, 0));
    ship.update(cameraAtRest(), 0, 0, true, 30, false);
    expect(ship.getRecoilOffset()).toBe(-0.050624999999999996);
    expect(ship.getMuzzleFlashCount()).toBe(1);

    ship.update(cameraAtRest(), 0, 0, true, 16, true);

    expect(ship.getMuzzleFlashCount()).toBe(0);
    expect(ship.getRecoilOffset()).toBe(0);
    expect(ship.model.group.position.z).toBe(0);
    ship.dispose();
  });
});

describe('shot styles (AC-24, AC-25)', () => {
  it('fires the accepted bolt/spark default with the shot-default colours', () => {
    const ship = createSpaceship();
    const style = shotStyleForPart('shot-default');

    expect(style).toEqual({
      partId: 'shot-default',
      geometry: 'bolt',
      scale: 1,
      muzzle: 'spark',
      color: '#fff1c8',
      accent: '#ffd27a',
    });
    const shot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
    expect(shot.mesh.name).toBe('shot-bolt');
    expect(shot.mesh.geometry).toBeInstanceOf(ConeGeometry);
    expect(shot.mesh.scale.toArray()).toEqual([1, 1, 1]);
    expect((shot.mesh.material as MeshBasicMaterial).color.getHexString()).toBe('fff1c8');
    expect(shot.muzzleFlash.geometry).toBeInstanceOf(OctahedronGeometry);
    expect((shot.muzzleFlash.material as MeshBasicMaterial).color.getHexString()).toBe('ffd27a');
    ship.dispose();
  });

  it('switches all four projectile geometries and three muzzle forms with the style colours', () => {
    const ship = createSpaceship();
    const cases = [
      {
        partId: 'shot-lance-azure',
        geometry: 'bolt',
        scale: 1.25,
        muzzle: 'spark',
        color: '2f6fd6',
        accent: '7cf6ff',
        projectileCtor: ConeGeometry,
      },
      {
        partId: 'shot-hauler-jade',
        geometry: 'orb',
        scale: 1.1,
        muzzle: 'ring',
        color: '15803d',
        accent: '86efac',
        projectileCtor: OctahedronGeometry,
      },
      {
        partId: 'shot-orca-violet',
        geometry: 'wave',
        scale: 1.2,
        muzzle: 'petal',
        color: '6d28d9',
        accent: 'c4b5fd',
        projectileCtor: TorusGeometry,
      },
      {
        partId: 'shot-arrow-crimson',
        geometry: 'shard',
        scale: 1,
        muzzle: 'petal',
        color: '9f1239',
        accent: 'fb7185',
        projectileCtor: TetrahedronGeometry,
      },
    ] as const;

    for (const fixture of cases) {
      const style = shotStyleForPart(fixture.partId);
      expect(style).toEqual({
        partId: fixture.partId,
        geometry: fixture.geometry,
        scale: fixture.scale,
        muzzle: fixture.muzzle,
        color: `#${fixture.color}`,
        accent: `#${fixture.accent}`,
      });

      ship.applyShotStyle(style);
      const shot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
      expect(shot.mesh.name).toBe(`shot-${fixture.geometry}`);
      expect(shot.mesh.geometry).toBeInstanceOf(fixture.projectileCtor);
      expect(shot.mesh.scale.toArray()).toEqual([
        fixture.scale,
        fixture.scale,
        fixture.scale,
      ]);
      expect((shot.mesh.material as MeshBasicMaterial).color.getHexString()).toBe(
        fixture.color,
      );
      expect((shot.muzzleFlash.material as MeshBasicMaterial).color.getHexString()).toBe(
        fixture.accent,
      );

      if (fixture.muzzle === 'spark') {
        expect(shot.muzzleFlash.geometry).toBeInstanceOf(OctahedronGeometry);
      } else if (fixture.muzzle === 'ring') {
        expect(shot.muzzleFlash.geometry).toBeInstanceOf(TorusGeometry);
      } else {
        expect(shot.muzzleFlash.geometry).toBeInstanceOf(BufferGeometry);
        expect(shot.muzzleFlash.geometry.getAttribute('position').count).toBe(18);
      }
    }
    ship.dispose();
  });

  it('captures geometry, scale and muzzle at spawn and keeps an in-flight shot after an equip', () => {
    const ship = createSpaceship();
    const boltShot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
    const boltGeometry = boltShot.mesh.geometry;
    const boltMuzzleGeometry = boltShot.muzzleFlash.geometry;
    const projectileMaterial = boltShot.mesh.material;
    const muzzleMaterial = boltShot.muzzleFlash.material;

    ship.applyShotStyle(shotStyleForPart('shot-orca-violet'));
    const waveShot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));

    // The in-flight bolt keeps the geometry/scale/muzzle it captured at spawn.
    expect(boltShot.mesh.geometry).toBe(boltGeometry);
    expect(boltShot.mesh.geometry).toBeInstanceOf(ConeGeometry);
    expect(boltShot.mesh.scale.toArray()).toEqual([1, 1, 1]);
    expect(boltShot.muzzleFlash.geometry).toBe(boltMuzzleGeometry);
    expect(boltShot.muzzleFlash.geometry).toBeInstanceOf(OctahedronGeometry);

    // The new shot captures the equipped wave/petal style.
    expect(waveShot.mesh.geometry).not.toBe(boltGeometry);
    expect(waveShot.mesh.geometry).toBeInstanceOf(TorusGeometry);
    expect(waveShot.mesh.scale.toArray()).toEqual([1.2, 1.2, 1.2]);
    expect(waveShot.muzzleFlash.geometry).not.toBe(boltMuzzleGeometry);
    expect(waveShot.muzzleFlash.geometry.getAttribute('position').count).toBe(18);

    // The materials are shared, so both live shots follow the equipped style colours.
    expect(waveShot.mesh.material).toBe(projectileMaterial);
    expect(waveShot.muzzleFlash.material).toBe(muzzleMaterial);
    expect((boltShot.mesh.material as MeshBasicMaterial).color.getHexString()).toBe(
      '6d28d9',
    );
    expect(
      (boltShot.muzzleFlash.material as MeshBasicMaterial).color.getHexString(),
    ).toBe('c4b5fd');
    ship.dispose();
  });

  it('is a no-op for an identical style and writes the colours once on a change', () => {
    const ship = createSpaceship();
    ship.applyShotStyle(shotStyleForPart('shot-kite-solar'));
    const shot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
    const projectileMaterial = shot.mesh.material as MeshBasicMaterial;
    const muzzleMaterial = shot.muzzleFlash.material as MeshBasicMaterial;
    const projectileColorSet = vi.spyOn(projectileMaterial.color, 'set');
    const muzzleColorSet = vi.spyOn(muzzleMaterial.color, 'set');

    // A fresh style object with identical values (as `shotStyleForPart` returns) is a no-op.
    ship.applyShotStyle(shotStyleForPart('shot-kite-solar'));
    expect(projectileColorSet).not.toHaveBeenCalled();
    expect(muzzleColorSet).not.toHaveBeenCalled();

    ship.applyShotStyle(shotStyleForPart('shot-lance-ember'));
    expect(projectileColorSet).toHaveBeenCalledTimes(1);
    expect(projectileColorSet).toHaveBeenCalledWith('#c2410c');
    expect(muzzleColorSet).toHaveBeenCalledTimes(1);
    expect(muzzleColorSet).toHaveBeenCalledWith('#ffb35c');
    ship.dispose();
  });

  it('re-uses the one geometry set and the two shared materials for every shot', () => {
    const ship = createSpaceship();
    ship.applyShotStyle(shotStyleForPart('shot-hauler-jade'));
    const first = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
    const second = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
    const third = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));

    expect(second.mesh.geometry).toBe(first.mesh.geometry);
    expect(third.mesh.geometry).toBe(first.mesh.geometry);
    expect(second.mesh.material).toBe(first.mesh.material);
    expect(third.mesh.material).toBe(first.mesh.material);
    expect(second.muzzleFlash.geometry).toBe(first.muzzleFlash.geometry);
    expect(third.muzzleFlash.geometry).toBe(first.muzzleFlash.geometry);
    expect(second.muzzleFlash.material).toBe(first.muzzleFlash.material);
    expect(ship.shotsGroup.children).toHaveLength(6);

    // A style switch re-uses the same two materials, only the captured geometry changes.
    const projectileMaterial = first.mesh.material;
    const muzzleMaterial = first.muzzleFlash.material;
    ship.applyShotStyle(shotStyleForPart('shot-arrow-crimson'));
    const fourth = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
    expect(fourth.mesh.material).toBe(projectileMaterial);
    expect(fourth.muzzleFlash.material).toBe(muzzleMaterial);
    expect(fourth.mesh.geometry).not.toBe(first.mesh.geometry);
    ship.dispose();
  });

  it('applies the equipped appearance shot style at construction and on a live change (AC-25)', () => {
    const ship = createSpaceship({ shot: 'shot-orca-violet' });
    const first = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
    expect(first.mesh.geometry).toBeInstanceOf(TorusGeometry);
    expect(first.mesh.scale.toArray()).toEqual([1.2, 1.2, 1.2]);
    expect((first.mesh.material as MeshBasicMaterial).color.getHexString()).toBe(
      '6d28d9',
    );
    expect((first.muzzleFlash.material as MeshBasicMaterial).color.getHexString()).toBe(
      'c4b5fd',
    );

    // A shot-only appearance change is applied live (the model reports no ship slot change).
    expect(ship.applyAppearance({ shot: 'shot-arrow-crimson' })).toEqual([]);
    const second = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
    expect(second.mesh.geometry).toBeInstanceOf(TetrahedronGeometry);
    expect((second.mesh.material as MeshBasicMaterial).color.getHexString()).toBe(
      '9f1239',
    );

    // Unknown/absent shot entries fall back to the accepted shot-default bolt/spark.
    expect(ship.applyAppearance({ shot: 'shot-not-a-part' })).toEqual([]);
    const third = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
    expect(third.mesh.geometry).toBeInstanceOf(ConeGeometry);
    expect(third.mesh.scale.toArray()).toEqual([1, 1, 1]);
    expect((third.mesh.material as MeshBasicMaterial).color.getHexString()).toBe(
      'fff1c8',
    );
    expect((third.muzzleFlash.material as MeshBasicMaterial).color.getHexString()).toBe(
      'ffd27a',
    );
    ship.dispose();
  });
});

describe('chassis x equip pulse composition (AC-17)', () => {
  it('keeps the generated hull chassis at rest and at the 130 ms pulse peak', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    ship.applyAppearance({ hull: 'hull-dart-chrome' });

    ship.update(camera, 0, 0, false, 0, false);
    expect(ship.getPulseScale()).toBe(1);
    expect(ship.model.group.scale.toArray()).toEqual([0.95, 0.9, 1.25]);

    ship.update(camera, 0, 0, false, 130, false);
    expect(ship.getPulseScale()).toBe(1.04);
    const peak = ship.model.group.scale.toArray();
    expect(peak).toHaveLength(3);
    expect(Math.abs(peak[0]! - 0.988)).toBeLessThan(1e-9);
    expect(Math.abs(peak[1]! - 0.936)).toBeLessThan(1e-9);
    expect(Math.abs(peak[2]! - 1.3)).toBeLessThan(1e-9);
    ship.dispose();
  });

  it('preserves the accepted classic [1, 1, 1] chassis through the 260 ms pulse', () => {
    const ship = createSpaceship();
    const camera = cameraAtRest();
    ship.applyAppearance({ hull: 'hull-gold' });

    ship.update(camera, 0, 0, false, 0, false);
    expect(ship.model.group.scale.toArray()).toEqual([1, 1, 1]);

    ship.update(camera, 0, 0, false, 130, false);
    expect(ship.getPulseScale()).toBe(1.04);
    expect(ship.model.group.scale.toArray()).toEqual([1.04, 1.04, 1.04]);

    ship.update(camera, 0, 0, false, 130, false);
    expect(ship.getPulseScale()).toBe(1);
    expect(ship.model.group.scale.toArray()).toEqual([1, 1, 1]);
    ship.dispose();
  });

  it('never writes the model scale with a scalar, only through applyPulseScale', () => {
    const source = readFileSync(new URL('./spaceship.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/model\.group\.scale\.setScalar\(/u);
    expect(source).not.toMatch(/model\.group\.scale\.set\(/u);
    expect(source).toContain('model.applyPulseScale(pulseScale)');
    expect(source).toContain('model.applyPulseScale(1)');
  });
});

describe('dispose', () => {
  it('releases the shared bolt and muzzle resources exactly once', () => {
    const ship = createSpaceship();
    const shot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    const boltGeometry = shot.mesh.geometry;
    const boltMaterial = shot.mesh.material as MeshBasicMaterial;
    const muzzleGeometry = shot.muzzleFlash.geometry;
    const muzzleMaterial = shot.muzzleFlash.material as MeshBasicMaterial;
    const spies = [
      vi.spyOn(boltGeometry, 'dispose'),
      vi.spyOn(boltMaterial, 'dispose'),
      vi.spyOn(muzzleGeometry, 'dispose'),
      vi.spyOn(muzzleMaterial, 'dispose'),
    ];

    ship.dispose();
    ship.dispose();

    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
    expect(ship.shots).toHaveLength(0);
    expect(ship.shotsGroup.children).toEqual([]);
    expect(ship.getMuzzleFlashCount()).toBe(0);
    expect(ship.getRecoilOffset()).toBe(0);
  });

  it('releases all seven prebuilt geometries and both shared materials exactly once', () => {
    const ship = createSpaceship();
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<MeshBasicMaterial>();
    for (const partId of [
      'shot-default',
      'shot-hauler-jade',
      'shot-orca-violet',
      'shot-arrow-crimson',
      'shot-lance-azure',
    ]) {
      ship.applyShotStyle(shotStyleForPart(partId));
      const shot = ship.spawnShot(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
      geometries.add(shot.mesh.geometry);
      geometries.add(shot.muzzleFlash.geometry);
      materials.add(shot.mesh.material as MeshBasicMaterial);
      materials.add(shot.muzzleFlash.material as MeshBasicMaterial);
    }
    expect(geometries.size).toBe(7);
    expect(materials.size).toBe(2);
    const spies = [
      ...[...geometries].map((geometry) => vi.spyOn(geometry, 'dispose')),
      ...[...materials].map((material) => vi.spyOn(material, 'dispose')),
    ];

    ship.dispose();
    ship.dispose();

    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it('empties the group and the shots and is idempotent', () => {
    const ship = createSpaceship();
    ship.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 1, 1));

    ship.dispose();
    ship.dispose();

    expect(ship.shots).toHaveLength(0);
    expect(ship.group.children).toEqual([]);
    expect(ship.shotsGroup.children).toEqual([]);
  });

  it('does not update after disposal', () => {
    const ship = createSpaceship();
    ship.dispose();
    ship.update(cameraAtRest(), 0, 0, true, 120, false);
    expect(ship.getPosition().toArray()).toEqual([0, 0, 6]);
    expect(ship.getIgnitionIntensity()).toBe(0);
  });
});
