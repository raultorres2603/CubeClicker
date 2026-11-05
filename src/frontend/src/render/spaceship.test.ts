import { describe, expect, it } from 'vitest';

import { Mesh, MeshStandardMaterial, PerspectiveCamera, Vector3 } from 'three';

import {
  SHOT_TRAVEL_MS,
  SPACESHIP_IGNITION_COUNT,
  SPACESHIP_SCALE,
} from '../game/effects';
import {
  createSpaceship,
  spaceshipFollowFactor,
  spaceshipTargetPosition,
} from './spaceship';

describe('spaceshipFollowFactor', () => {
  it('follows 1 - exp(-dt/tau) without reduced motion', () => {
    expect(spaceshipFollowFactor(240, false)).toBeCloseTo(1 - 1 / Math.E, 6);
    expect(spaceshipFollowFactor(0, false)).toBe(0);
  });

  it('snaps (factor 1) under reduced motion for any dt >= 0', () => {
    expect(spaceshipFollowFactor(0, true)).toBe(1);
    expect(spaceshipFollowFactor(120, true)).toBe(1);
    expect(spaceshipFollowFactor(1000, true)).toBe(1);
  });

  it('returns 0 for dtMs === 0 without reduced motion', () => {
    expect(spaceshipFollowFactor(0, false)).toBe(0);
  });
});

describe('spaceshipTargetPosition', () => {
  it('matches the pinned default-camera vector', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const result = spaceshipTargetPosition(camera, 0, 0);
    expect(Math.abs(result.x - -0.445721)).toBeLessThan(1e-6);
    expect(Math.abs(result.y - -0.334291)).toBeLessThan(1e-6);
    expect(Math.abs(result.z - 6.025924)).toBeLessThan(1e-6);
  });

  it('is independent of the NDC z input', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const a = spaceshipTargetPosition(camera, 0.1, -0.2);
    const ndc = new Vector3(0.1 - 0.16, -0.2 - 0.12, 1);
    ndc.unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const expected = camera.position.clone().add(dir.multiplyScalar(6));
    expect(a.x).toBeCloseTo(expected.x, 6);
    expect(a.y).toBeCloseTo(expected.y, 6);
    expect(a.z).toBeCloseTo(expected.z, 6);
  });
});

describe('createSpaceship', () => {
  it('creates a group named spaceship containing at least one Mesh', () => {
    const ship = createSpaceship();
    expect(ship.group.name).toBe('spaceship');
    let meshCount = 0;
    ship.group.traverse((o) => {
      if (o instanceof Mesh) meshCount += 1;
    });
    expect(meshCount).toBeGreaterThan(0);
    ship.dispose();
  });

  it('group scale is (SPACESHIP_SCALE, SPACESHIP_SCALE, SPACESHIP_SCALE)', () => {
    const ship = createSpaceship();
    expect(ship.group.scale.x).toBe(SPACESHIP_SCALE);
    expect(ship.group.scale.y).toBe(SPACESHIP_SCALE);
    expect(ship.group.scale.z).toBe(SPACESHIP_SCALE);
    ship.dispose();
  });

  it('contains ConeGeometry, CylinderGeometry, and at least two BoxGeometry wings named wing', () => {
    const ship = createSpaceship();
    const meshes: Mesh[] = [];
    ship.group.traverse((o) => {
      if (o instanceof Mesh) meshes.push(o);
    });
    const types = meshes.map((m) => m.geometry.type);
    expect(types).toContain('ConeGeometry');
    expect(types).toContain('CylinderGeometry');
    const wings = meshes.filter((m) => m.name === 'wing');
    expect(wings.length).toBeGreaterThanOrEqual(2);
    for (const wing of wings) {
      expect(wing.geometry.type).toBe('BoxGeometry');
    }
    ship.dispose();
  });

  it('all meshes under group use MeshStandardMaterial with metalness >= 0.4 and roughness <= 0.6', () => {
    const ship = createSpaceship();
    ship.group.traverse((o) => {
      if (o instanceof Mesh) {
        expect(o.material).toBeInstanceOf(MeshStandardMaterial);
        const material = o.material as MeshStandardMaterial;
        expect(material.metalness).toBeGreaterThanOrEqual(0.4);
        expect(material.roughness).toBeLessThanOrEqual(0.6);
      }
    });
    ship.dispose();
  });

  it('at least one mesh under group has non-zero emissive (engine glow)', () => {
    const ship = createSpaceship();
    let found = false;
    ship.group.traverse((o) => {
      if (o instanceof Mesh) {
        const material = o.material as MeshStandardMaterial;
        if (
          material.emissive &&
          (material.emissive.r > 0 || material.emissive.g > 0 || material.emissive.b > 0)
        ) {
          found = true;
        }
      }
    });
    expect(found).toBe(true);
    ship.dispose();
  });

  it('rests at (0,0,6) with no pointer', () => {
    const ship = createSpaceship();
    const pos = ship.getPosition();
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    expect(pos.z).toBe(6);
    ship.dispose();
  });

  it('snaps to the target under reduced motion on update', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    ship.update(camera, 0, 0, true, 50, true);
    const target = spaceshipTargetPosition(camera, 0, 0);
    const pos = ship.getPosition();
    expect(pos.x).toBeCloseTo(target.x, 6);
    expect(pos.y).toBeCloseTo(target.y, 6);
    expect(pos.z).toBeCloseTo(target.z, 6);
    ship.dispose();
  });

  it('does not move without a pointer', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    ship.update(camera, 0, 0, false, 120, false);
    const pos = ship.getPosition();
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    expect(pos.z).toBe(6);
    ship.dispose();
  });

  it('moves by the follow factor on update', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const start = ship.getPosition().clone();
    const target = spaceshipTargetPosition(camera, 0, 0);
    ship.update(camera, 0, 0, true, 120, false);
    const factor = spaceshipFollowFactor(120, false);
    const pos = ship.getPosition();
    expect(pos.x).toBeCloseTo(start.x + (target.x - start.x) * factor, 6);
    expect(pos.y).toBeCloseTo(start.y + (target.y - start.y) * factor, 6);
    expect(pos.z).toBeCloseTo(start.z + (target.z - start.z) * factor, 6);
    ship.dispose();
  });

  it('exposes ignitions of length SPACESHIP_IGNITION_COUNT named ignition', () => {
    const ship = createSpaceship();
    expect(ship.ignitions).toHaveLength(SPACESHIP_IGNITION_COUNT);
    for (const ig of ship.ignitions) {
      expect(ig.name).toBe('ignition');
    }
    ship.dispose();
  });

  it('ignitions created hidden with intensity 0', () => {
    const ship = createSpaceship();
    expect(ship.getIgnitionIntensity()).toBe(0);
    for (const ig of ship.ignitions) {
      expect(ig.visible).toBe(false);
    }
    ship.dispose();
  });

  it('at rest (no pointer) intensity 0 and ignitions hidden', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    ship.update(camera, 0, 0, false, 120, false);
    expect(ship.getIgnitionIntensity()).toBe(0);
    for (const ig of ship.ignitions) {
      expect(ig.visible).toBe(false);
    }
    ship.dispose();
  });

  it('after a moving update intensity > 0 and an ignition visible', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    ship.update(camera, 0, 0, true, 120, false);
    expect(ship.getIgnitionIntensity()).toBeGreaterThan(0);
    expect(ship.ignitions.some((ig) => ig.visible === true)).toBe(true);
    ship.dispose();
  });

  it('under reduced motion ignitions stay hidden even after moving update', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    ship.update(camera, 0, 0, true, 120, true);
    expect(ship.getIgnitionIntensity()).toBe(0);
    for (const ig of ship.ignitions) {
      expect(ig.visible).toBe(false);
    }
    ship.dispose();
  });

  it('ignition animation advances: two moving updates yield different scale.z', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    ship.update(camera, 0, 0, true, 120, false);
    const first = ship.ignitions[0]!.scale.z;
    ship.update(camera, 0, 0, true, 120, false);
    const second = ship.ignitions[0]!.scale.z;
    expect(Math.abs(second - first)).toBeGreaterThan(1e-9);
    ship.dispose();
  });

  it('no movement: dtMs 0 keeps intensity 0 and does not advance time', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    // first move to set position maybe
    ship.update(camera, 0, 0, true, 120, false);
    // reset by new ship for clean
    ship.dispose();
    const ship2 = createSpaceship();
    ship2.update(camera, 0, 0, true, 0, false);
    expect(ship2.getIgnitionIntensity()).toBe(0);
    for (const ig of ship2.ignitions) expect(ig.visible).toBe(false);
    ship2.dispose();
  });

  it('spawns a shot with endpoints and travel time', () => {
    const ship = createSpaceship();
    const start = new Vector3(1, 2, 3);
    const target = new Vector3(4, 5, 6);
    const shot = ship.spawnShot(start, target);
    expect(ship.shots).toHaveLength(1);
    expect(shot.start.x).toBe(1);
    expect(shot.target.x).toBe(4);
    expect(shot.remainingMs).toBe(SHOT_TRAVEL_MS);
    expect(shot.mesh.position.x).toBeCloseTo(1, 6);
    ship.dispose();
  });

  it('updates shot position to the midpoint after half travel', () => {
    const ship = createSpaceship();
    const start = new Vector3(0, 0, 0);
    const target = new Vector3(10, 10, 10);
    ship.spawnShot(start, target);
    const completed = ship.updateShots(90);
    expect(completed).toHaveLength(0);
    const shot = ship.shots[0]!;
    expect(shot.mesh.position.x).toBeCloseTo(5, 6);
    expect(shot.mesh.position.y).toBeCloseTo(5, 6);
    expect(shot.mesh.position.z).toBeCloseTo(5, 6);
    ship.dispose();
  });

  it('completes a shot after full travel and empties the list', () => {
    const ship = createSpaceship();
    const start = new Vector3(0, 0, 0);
    const target = new Vector3(10, 10, 10);
    ship.spawnShot(start, target);
    const completed = ship.updateShots(180);
    expect(completed).toHaveLength(1);
    expect(ship.shots).toHaveLength(0);
    ship.dispose();
  });

  it('updateSpaceship wrapper moves the ship', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    ship.updateSpaceship(120, camera, { x: 0, y: 0 }, true, false);
    const pos = ship.getPosition();
    expect(pos.z).not.toBe(6);
    ship.dispose();
  });

  it('dispose is idempotent (covers disposed guard)', () => {
    const ship = createSpaceship();
    ship.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    ship.dispose();
    ship.dispose();
    expect(ship.shots).toHaveLength(0);
  });

  it('sub-threshold movement keeps ignitions inactive', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    ship.update(camera, 0, 0, true, 1, false);
    expect(ship.getIgnitionIntensity()).toBe(0);
    for (const ig of ship.ignitions) expect(ig.visible).toBe(false);
    ship.dispose();
  });

  it('update after dispose is a no-op', () => {
    const ship = createSpaceship();
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    ship.dispose();
    // should not throw
    ship.update(camera, 0, 0, true, 120, false);
    expect(ship.getIgnitionIntensity()).toBe(0);
  });

  it('dispose empties shots', () => {
    const ship = createSpaceship();
    ship.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    ship.dispose();
    expect(ship.shots).toHaveLength(0);
  });
});

describe('createSpaceship appearance', () => {
  function findMesh(ship: ReturnType<typeof createSpaceship>, predicate: (mesh: Mesh) => boolean): Mesh {
    let found: Mesh | undefined;
    ship.group.traverse((object) => {
      if (object instanceof Mesh && predicate(object) && found === undefined) {
        found = object;
      }
    });
    if (found === undefined) {
      throw new Error('mesh not found');
    }
    return found;
  }

  it('defaults the nose mesh to the default nose color', () => {
    const ship = createSpaceship();
    const nose = findMesh(ship, (mesh) => mesh.geometry.type === 'ConeGeometry' && mesh.name !== 'ignition');
    expect((nose.material as MeshStandardMaterial).color.getHexString()).toBe('88aaff');
    ship.dispose();
  });

  it('applies a nose part color from an appearance record', () => {
    const ship = createSpaceship({ nose: 'nose-crimson' });
    const nose = findMesh(ship, (mesh) => mesh.geometry.type === 'ConeGeometry' && mesh.name !== 'ignition');
    expect((nose.material as MeshStandardMaterial).color.getHexString()).toBe('cc4444');
    ship.dispose();
  });

  it('applies direct color params', () => {
    const ship = createSpaceship({ noseColor: '#00ff00' });
    const nose = findMesh(ship, (mesh) => mesh.geometry.type === 'ConeGeometry' && mesh.name !== 'ignition');
    expect((nose.material as MeshStandardMaterial).color.getHexString()).toBe('00ff00');
    ship.dispose();
  });

  it('applies engine color to ignition meshes', () => {
    const ship = createSpaceship({ engine: 'engine-blue' });
    const ignition = findMesh(ship, (mesh) => mesh.name === 'ignition');
    expect((ignition.material as MeshStandardMaterial).color.getHexString()).toBe('4488ff');
    ship.dispose();
  });
});
