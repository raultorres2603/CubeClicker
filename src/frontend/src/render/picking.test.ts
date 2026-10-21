/**
 * Picking tests (T10 — spec § Testing strategy: render-layer modules are exercised against
 * real three.js objects in the node environment, no mocks).
 *
 * Every case builds a real `cube-view` plus a real `PerspectiveCamera` and casts one
 * concrete NDC position; the assertion is always the exact id or the exact `null`, so a
 * dropped front-face gate, a transposed instance decode, a wrong grid size or a pick that
 * ignores the hidden-instance rule fails the test.
 *
 * The NDC literals come from the fixture camera: fov 50, square viewport, at the AC-22
 * rest position `(0, 0, 12)` looking at the origin — 9.375 world units in front of the
 * front tile plane (`12 - 2.625`). There, one world unit spans `1 / (9.375 * tan 25°) =
 * 0.2287474…` NDC, and a tile is 0.9 world units wide (±0.45 = ±0.1029 NDC), so each
 * coordinate below lands within ~0.00002 NDC of the tile centre it names.
 */

import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';

import { CUBE_STYLES } from '../game/progression';
import { createCubeView } from './cube-view';
import { pickMiniCube } from './picking';

const STYLE = CUBE_STYLES[0]!;

/**
 * The picking camera. Note that neither the camera nor the cube group is given a
 * `updateMatrixWorld` call here: `pickMiniCube` refreshes both ends of the ray itself, so a
 * tap dispatched before the next frame is picked against the current transform.
 */
function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);
  return camera;
}

describe('pickMiniCube', () => {
  it('resolves the mini-cube under the viewport centre', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // NDC (0, 0) is the front face's centre tile: row 2, col 2 → instance 12.
    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBe('front:2:2');
  });

  it('decodes the instance index into the face row and col of the id', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // World (-2, 2), (2, 2), (-2, -2) and (2, -2) are the four front-face corners; the two
    // off-diagonal cells would decode to the mirrored id if row and col were transposed.
    expect(pickMiniCube(camera, view, 'front', -0.4575, 0.4575)).toBe('front:0:0');
    expect(pickMiniCube(camera, view, 'front', 0.4575, 0.4575)).toBe('front:0:4');
    expect(pickMiniCube(camera, view, 'front', -0.4575, -0.4575)).toBe('front:4:0');
    expect(pickMiniCube(camera, view, 'front', 0.4575, -0.4575)).toBe('front:4:4');
    expect(pickMiniCube(camera, view, 'front', 0.22875, 0.22875)).toBe('front:1:3');
    expect(pickMiniCube(camera, view, 'front', -0.22875, -0.22875)).toBe('front:3:1');
  });

  it('returns null between two mini-cubes and still picks their neighbours', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // The neighbours of each gap: col 1 at world x = -1, col 3 at world x = 1, row 2 at
    // world y = 0 — the positive controls that keep the two nulls below meaningful.
    expect(pickMiniCube(camera, view, 'front', -0.22875, 0)).toBe('front:2:1');
    expect(pickMiniCube(camera, view, 'front', 0.22875, 0)).toBe('front:2:3');

    // x = -0.5 / y = 0.5 are the 0.1-wide grid gaps: the ray reaches the plate and the body
    // behind them, but those are not pick targets.
    expect(pickMiniCube(camera, view, 'front', -0.11437, 0)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', 0, 0.11437)).toBeNull();
  });

  it('returns null when the ray misses the cube', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    expect(pickMiniCube(camera, view, 'front', 0.9, 0.9)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', -0.9, -0.9)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', 0, 1)).toBeNull();
  });

  it('ignores a hit on a face that is not the given front face', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // A yaw step of +90° turns the cube so that the left face — not the front face — points
    // at the camera: the centre ray now reaches the left face's centre tile only.
    view.group.rotation.y = Math.PI / 2;

    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBeNull();
    expect(pickMiniCube(camera, view, 'left', 0, 0)).toBe('left:2:2');
  });

  it('returns null for a hidden mini-cube and keeps its neighbours pickable', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    view.hideMiniCube('front:2:2');

    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', 0.22875, 0)).toBe('front:2:3');
  });

  it('returns null while a mini-cube is still playing its pop', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // At t = 0 the tile is still full size, but the intent already marked it hidden:
    // a second tap on the animating tile can never double-fire (spec AC-4).
    view.hideMiniCube('front:2:2');
    view.update(50);

    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', 0.22875, 0)).toBe('front:2:3');
  });

  it('returns null once the front face has been removed', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    view.removeFace('front');

    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBeNull();
  });

  it('reads the grid size back from the view', () => {
    const camera = createCamera();

    // 3x3 grid: the centre tile is row 1, col 1, and instance 6 is (row 2, col 0) at world
    // (-5/3, -5/3). Decoding instance 6 with the default grid size would yield row 1, col 1.
    const three = createCubeView(STYLE, 3);
    expect(pickMiniCube(camera, three, 'front', 0, 0)).toBe('front:1:1');
    expect(pickMiniCube(camera, three, 'front', -0.38125, -0.38125)).toBe('front:2:0');

    // 1x1 grid: the single tile covers the whole face.
    const one = createCubeView(STYLE, 1);
    expect(pickMiniCube(camera, one, 'front', 0, 0)).toBe('front:0:0');
  });
});
