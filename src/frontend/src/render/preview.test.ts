import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Scene,
} from 'three';
import { describe, expect, it } from 'vitest';

import {
  PREVIEW_FRAME_INTERVAL_MS,
  PREVIEW_MAX_FPS,
  PREVIEW_REST_ROTATION_RAD,
  PREVIEW_ROTATION_RAD_PER_MS,
  createPreviewScene,
} from './preview';

/** Reads a mesh's single material colour as a lower-case hex string. */
function meshColorHex(scene: Scene, name: string): string {
  const mesh = scene.getObjectByName(name);
  if (!(mesh instanceof Mesh)) {
    throw new Error(`mesh not found: ${name}`);
  }
  return (mesh.material as MeshPhysicalMaterial).color.getHexString();
}

describe('preview constants (AC-31)', () => {
  it('pins the 30 fps cap and the 0.0004 rad/ms idle rotation', () => {
    expect(PREVIEW_MAX_FPS).toBe(30);
    expect(PREVIEW_FRAME_INTERVAL_MS).toBe(1000 / 30);
    expect(PREVIEW_ROTATION_RAD_PER_MS).toBe(0.0004);
    expect(PREVIEW_REST_ROTATION_RAD).toBe(0.55);
  });
});

describe('createPreviewScene (AC-31)', () => {
  it('builds a scene with the two preview lights and the cursor model', () => {
    const preview = createPreviewScene();

    expect(preview.scene).toBeInstanceOf(Scene);
    expect(preview.scene.name).toBe('spaceship-preview-scene');
    expect(preview.scene.children.map((child) => child.name)).toEqual([
      'preview-ambient',
      'preview-key-light',
      'cursor-ship-model',
    ]);
    expect(preview.scene.children[0]).toBeInstanceOf(AmbientLight);
    expect(preview.scene.children[1]).toBeInstanceOf(DirectionalLight);

    const model = preview.model;
    expect(model.group).toBeInstanceOf(Group);
    expect(model.group.name).toBe('cursor-ship-model');
    expect(model.meshes).toHaveLength(21);
    expect(model.group.rotation.y).toBe(PREVIEW_REST_ROTATION_RAD);
  });

  it('builds a fixed perspective camera framing the craft', () => {
    const preview = createPreviewScene();

    expect(preview.camera).toBeInstanceOf(PerspectiveCamera);
    expect(preview.camera.fov).toBe(35);
    expect(preview.camera.aspect).toBe(1);
    expect(preview.camera.near).toBe(0.1);
    expect(preview.camera.far).toBe(20);
    expect(preview.camera.position.toArray()).toEqual([0, 0.32, 2.15]);
  });

  it('applies the requested v2 slot appearance through the cursor mapping', () => {
    const preview = createPreviewScene({
      hull: 'hull-gold',
      'wing-left': 'wing-left-silver',
      'ignition-left': 'ignition-left-blue',
    });

    expect(meshColorHex(preview.scene, 'cursor-hull')).toBe('ccaa44');
    expect(meshColorHex(preview.scene, 'cursor-hull-seam-1')).toBe('fff3d6');
    expect(meshColorHex(preview.scene, 'cursor-wing-left')).toBe('aaaaaa');
    expect(meshColorHex(preview.scene, 'cursor-wing-left-tip')).toBe('d9dee7');
    expect(meshColorHex(preview.scene, 'cursor-wing-right')).toBe('4466cc');
    expect(meshColorHex(preview.scene, 'cursor-nose')).toBe('88aaff');
    expect(meshColorHex(preview.scene, 'cursor-tail-fin')).toBe('14213d');

    const leftIgnition = preview.model.ignitions[0]!;
    const ignitionMaterial = leftIgnition.material as MeshPhysicalMaterial;
    expect(ignitionMaterial.color.getHexString()).toBe('cffcff');
    expect(ignitionMaterial.emissive.getHexString()).toBe('4488ff');
  });

  it('normalizes legacy appearance categories like the in-game cursor', () => {
    const preview = createPreviewScene({ wings: 'wings-silver', body: 'body-gold' });

    expect(meshColorHex(preview.scene, 'cursor-wing-left')).toBe('aaaaaa');
    expect(meshColorHex(preview.scene, 'cursor-wing-right')).toBe('aaaaaa');
    expect(meshColorHex(preview.scene, 'cursor-hull')).toBe('ccaa44');
  });

  it('renders a v3 11-entry appearance on the ten ship slots (shot ignored)', () => {
    const preview = createPreviewScene({
      hull: 'hull-dart-chrome',
      'wing-left': 'wing-left-manta-jade',
      'ignition-left': 'ignition-left-bulwark-azure',
      'tail-fin': 'tail-fin-kite-ivory',
      shot: 'shot-orca-violet',
    });

    expect(meshColorHex(preview.scene, 'cursor-hull')).toBe('c9d4e2');
    expect(meshColorHex(preview.scene, 'cursor-hull-seam-1')).toBe('ffffff');
    expect(meshColorHex(preview.scene, 'cursor-wing-left')).toBe('15803d');
    expect(meshColorHex(preview.scene, 'cursor-wing-left-tip')).toBe('86efac');
    expect(meshColorHex(preview.scene, 'cursor-tail-fin')).toBe('e7e5e4');

    const leftIgnition = preview.model.ignitions[0]!;
    const ignitionMaterial = leftIgnition.material as MeshPhysicalMaterial;
    expect(ignitionMaterial.color.getHexString()).toBe('7cf6ff');
    expect(ignitionMaterial.emissive.getHexString()).toBe('2f6fd6');

    // The hull form's chassis and slot transform reach the preview model.
    expect(preview.model.chassisScale).toEqual([0.95, 0.9, 1.25]);
    expect(preview.model.group.scale.toArray()).toEqual([0.95, 0.9, 1.25]);
    expect(preview.model.slots.hull.scale.toArray()).toEqual([0.85, 0.9, 1.15]);
    expect(preview.model.slots.hull.position.toArray()).toEqual([0, 0, 0.02]);
    expect(preview.model.slots['wing-left'].rotation.y).toBe((32 * Math.PI) / 180);
    expect(preview.model.slots['tail-fin'].rotation.z).toBe((0.5 * 38 * Math.PI) / 180);

    // The shot entry adds no slot group: the model keeps its ten geometry groups.
    expect(preview.model.group.children).toHaveLength(10);
    expect(preview.scene.getObjectByName('slot-shot')).toBeUndefined();
    expect(preview.model.meshes).toHaveLength(21);
  });

  it('selects no geometry for a shot-only appearance', () => {
    const preview = createPreviewScene({ shot: 'shot-kite-solar' });

    expect(meshColorHex(preview.scene, 'cursor-hull')).toBe('8f9bad');
    expect(meshColorHex(preview.scene, 'cursor-nose')).toBe('88aaff');
    expect(preview.model.chassisScale).toEqual([1, 1, 1]);
    expect(preview.model.group.scale.toArray()).toEqual([1, 1, 1]);
    for (const group of preview.model.slotGroups) {
      expect(group.scale.toArray()).toEqual([1, 1, 1]);
      expect(group.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
      expect(group.position.toArray()).toEqual([0, 0, 0]);
    }
    expect(preview.model.group.children).toHaveLength(10);
  });

  it('falls back to the standard part for unknown and wrong-slot v3 ids', () => {
    const preview = createPreviewScene({
      hull: 'unknown-part',
      nose: 'hull-dart-chrome',
      'wing-left': 'wing-left-manta-jade',
    });

    expect(meshColorHex(preview.scene, 'cursor-hull')).toBe('8f9bad');
    expect(meshColorHex(preview.scene, 'cursor-nose')).toBe('88aaff');
    expect(meshColorHex(preview.scene, 'cursor-wing-left')).toBe('15803d');
    expect(preview.model.chassisScale).toEqual([1, 1, 1]);
    expect(preview.model.group.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('rotates at 0.0004 rad/ms when motion is allowed and holds the pose when reduced', () => {
    const preview = createPreviewScene();
    const start = preview.model.group.rotation.y;

    preview.update(1000, false);
    expect(preview.model.group.rotation.y).toBe(
      start + PREVIEW_ROTATION_RAD_PER_MS * 1000,
    );

    preview.update(500, false);
    expect(preview.model.group.rotation.y).toBe(
      start + PREVIEW_ROTATION_RAD_PER_MS * 1000 + PREVIEW_ROTATION_RAD_PER_MS * 500,
    );

    const movingYaw = preview.model.group.rotation.y;
    preview.update(1000, true);
    expect(preview.model.group.rotation.y).toBe(movingYaw);
    preview.update(0, false);
    expect(preview.model.group.rotation.y).toBe(movingYaw);
    preview.update(-100, false);
    expect(preview.model.group.rotation.y).toBe(movingYaw);
    preview.update(Number.NaN, false);
    expect(preview.model.group.rotation.y).toBe(movingYaw);
  });

  it('disposes the model and clears the scene, idempotently', () => {
    const preview = createPreviewScene();
    preview.update(100, false);
    const yaw = preview.model.group.rotation.y;

    preview.dispose();
    expect(preview.scene.children).toHaveLength(0);
    expect(preview.model.meshes).toHaveLength(0);
    expect(preview.model.slotGroups).toHaveLength(0);
    expect(preview.model.group.children).toHaveLength(0);

    preview.update(100, false);
    expect(preview.model.group.rotation.y).toBe(yaw);

    preview.dispose();
    expect(preview.scene.children).toHaveLength(0);
    expect(preview.model.meshes).toHaveLength(0);
  });
});
