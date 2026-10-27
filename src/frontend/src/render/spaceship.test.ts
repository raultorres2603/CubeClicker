import { describe, expect, it } from 'vitest';

import { Mesh, PerspectiveCamera, Vector3 } from 'three';

import { SHOT_TRAVEL_MS } from '../game/effects';
import {
  createSpaceship,
  spaceshipFollowFactor,
  spaceshipTargetPosition,
} from './spaceship';

describe('spaceshipFollowFactor', () => {
  it('follows 1 - exp(-dt/tau) without reduced motion', () => {
    expect(spaceshipFollowFactor(120, false)).toBeCloseTo(1 - 1 / Math.E, 6);
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
    expect(Math.abs(result.x - -0.139757)).toBeLessThan(1e-6);
    expect(Math.abs(result.y - -0.223611)).toBeLessThan(1e-6);
    expect(Math.abs(result.z - 6.005798)).toBeLessThan(1e-6);
  });

  it('is independent of the NDC z input', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const a = spaceshipTargetPosition(camera, 0.1, -0.2);
    // recompute manually with z=1 should yield the same ray direction
    const ndc = new Vector3(0.1 - 0.05, -0.2 - 0.08, 1);
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
    // avoid require in test? use imported Mesh
    expect(meshCount).toBeGreaterThan(0);
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

  it('dispose empties shots', () => {
    const ship = createSpaceship();
    ship.spawnShot(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    ship.dispose();
    expect(ship.shots).toHaveLength(0);
  });
});