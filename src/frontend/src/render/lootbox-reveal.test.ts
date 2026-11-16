/**
 * Tests for the 3D lootbox reveal stage factory (game-feel-overhaul T2; spec AC-4, AC-5,
 * AC-14, AC-15).
 *
 * Contract covered: the pinned four-child scene, camera and light values, the rarity ring
 * geometry/material/colour, the catalog-derived try-on appearance with no caller mutation,
 * the per-frame pose writes (including the key-light flash lift), the triangle/draw budgets,
 * the absence of shadows/textures/loaders/randomness, and dispose-once/idempotence.
 * Assertions use concrete expected values; no snapshot or wildcard matchers.
 */

import { readFileSync } from 'node:fs';

import {
  AmbientLight,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  Sprite,
  Vector3,
  type Material,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeAppearance } from '../game/parts-v2';
import { REVEAL_RARITY_HEX } from '../game/reveal-motion';
import type { LootboxGrant } from '../game/types';
import {
  createRevealStage,
  REVEAL_AMBIENT_COLOR,
  REVEAL_AMBIENT_INTENSITY,
  REVEAL_CAMERA_FAR,
  REVEAL_CAMERA_FOV,
  REVEAL_CAMERA_NEAR,
  REVEAL_CAMERA_POSITION,
  REVEAL_CAMERA_TARGET,
  REVEAL_KEY_LIGHT_BASE_INTENSITY,
  REVEAL_KEY_LIGHT_COLOR,
  REVEAL_KEY_LIGHT_POSITION,
  REVEAL_MAX_DRAW_CALLS,
  REVEAL_MAX_TRIANGLES,
  REVEAL_RING_INNER_RADIUS,
  REVEAL_RING_OUTER_RADIUS,
  REVEAL_RING_POSITION_Y,
  REVEAL_RING_THETA_SEGMENTS,
  REVEAL_RING_TRIANGLES,
  REVEAL_STAGE_SCENE_NAME,
  type RevealStage,
} from './lootbox-reveal';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A rare grant for the port silver wing (razor shape: scale `1.16/1/0.9`, yaw `-0.12`). */
function rareGrant(overrides: Partial<LootboxGrant> = {}): LootboxGrant {
  return {
    partId: 'wing-left-silver',
    slot: 'wing-left',
    rarity: 'rare',
    duplicate: false,
    sequence: 1,
    ...overrides,
  };
}

/** The ring's single basic material. */
function ringMaterialOf(stage: RevealStage): MeshBasicMaterial {
  return stage.ring.material as MeshBasicMaterial;
}

/** The scene's key light. */
function keyLightOf(stage: RevealStage): DirectionalLight {
  return stage.scene.getObjectByName('reveal-key-light') as DirectionalLight;
}

describe('reveal stage constants (AC-4/AC-15)', () => {
  it('pins the scene, camera, ring and budget values', () => {
    expect(REVEAL_STAGE_SCENE_NAME).toBe('lootbox-reveal-scene');
    expect(REVEAL_AMBIENT_COLOR).toBe(0xbcd6ff);
    expect(REVEAL_AMBIENT_INTENSITY).toBe(1.1);
    expect(REVEAL_KEY_LIGHT_COLOR).toBe(0xffffff);
    expect(REVEAL_KEY_LIGHT_BASE_INTENSITY).toBe(3);
    expect(REVEAL_KEY_LIGHT_POSITION).toEqual([2.5, 3.5, 4]);
    expect(REVEAL_CAMERA_FOV).toBe(32);
    expect(REVEAL_CAMERA_NEAR).toBe(0.1);
    expect(REVEAL_CAMERA_FAR).toBe(20);
    expect(REVEAL_CAMERA_POSITION).toEqual([0, 0.42, 2.35]);
    expect(REVEAL_CAMERA_TARGET).toEqual([0, 0.03, 0]);
    expect(REVEAL_RING_INNER_RADIUS).toBe(0.86);
    expect(REVEAL_RING_OUTER_RADIUS).toBe(0.9);
    expect(REVEAL_RING_THETA_SEGMENTS).toBe(48);
    expect(REVEAL_RING_TRIANGLES).toBe(96);
    expect(REVEAL_RING_POSITION_Y).toBe(-0.25);
    expect(REVEAL_MAX_DRAW_CALLS).toBe(24);
    expect(REVEAL_MAX_TRIANGLES).toBe(2596);
  });
});

describe('createRevealStage scene and camera (AC-4)', () => {
  it('builds the four pinned children in order with the pinned lights', () => {
    const stage = createRevealStage({}, rareGrant());

    expect(stage.scene).toBeInstanceOf(Scene);
    expect(stage.scene.name).toBe('lootbox-reveal-scene');
    expect(stage.scene.children).toHaveLength(4);
    expect(stage.scene.children.map((child) => child.name)).toEqual([
      'reveal-ambient',
      'reveal-key-light',
      'cursor-ship-model',
      'reveal-slot-ring',
    ]);

    const ambient = stage.scene.children[0];
    expect(ambient).toBeInstanceOf(AmbientLight);
    expect((ambient as AmbientLight).intensity).toBe(1.1);
    expect((ambient as AmbientLight).color.getHex()).toBe(0xbcd6ff);

    const keyLight = stage.scene.children[1];
    expect(keyLight).toBeInstanceOf(DirectionalLight);
    expect((keyLight as DirectionalLight).intensity).toBe(3);
    expect((keyLight as DirectionalLight).color.getHex()).toBe(0xffffff);
    expect(keyLight.position.toArray()).toEqual([2.5, 3.5, 4]);

    const modelGroup = stage.scene.children[2];
    expect(modelGroup).toBeInstanceOf(Group);
    expect(modelGroup).toBe(stage.model.group);
    expect(modelGroup.name).toBe('cursor-ship-model');
    expect(stage.model.meshes).toHaveLength(21);

    const ring = stage.scene.children[3];
    expect(ring).toBeInstanceOf(Mesh);
    expect(ring).toBe(stage.ring);
    expect(ring.name).toBe('reveal-slot-ring');
  });

  it('builds the fixed perspective camera framing the craft', () => {
    const stage = createRevealStage({}, rareGrant());
    const camera = stage.camera;

    expect(camera).toBeInstanceOf(PerspectiveCamera);
    expect(camera.fov).toBe(32);
    expect(camera.aspect).toBe(1);
    expect(camera.near).toBe(0.1);
    expect(camera.far).toBe(20);
    expect(camera.position.toArray()).toEqual([0, 0.42, 2.35]);

    const direction = new Vector3();
    camera.getWorldDirection(direction);
    const expectedDirection = new Vector3(0, 0.03, 0)
      .sub(camera.position)
      .normalize();
    // `lookAt` leaves a -0 x component; normalise it so the comparison is value-exact.
    const normalizeZero = (value: number): number => (value === 0 ? 0 : value);
    expect(direction.toArray().map(normalizeZero)).toEqual(
      expectedDirection.toArray().map(normalizeZero),
    );
  });

  it('builds the pinned rarity ring geometry and material', () => {
    const stage = createRevealStage({}, rareGrant());

    expect(stage.ring.geometry).toBeInstanceOf(RingGeometry);
    const parameters = (stage.ring.geometry as RingGeometry).parameters;
    expect(parameters.innerRadius).toBe(0.86);
    expect(parameters.outerRadius).toBe(0.9);
    expect(parameters.thetaSegments).toBe(48);
    expect(parameters.phiSegments).toBe(1);
    expect(stage.ring.geometry.getIndex()?.count).toBe(288);

    expect(stage.ring.rotation.x).toBe(-Math.PI / 2);
    expect(stage.ring.position.toArray()).toEqual([0, -0.25, 0]);

    const material = ringMaterialOf(stage);
    expect(material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(DoubleSide);
    // Construction applies the charge row, where the ring is fully transparent.
    expect(material.opacity).toBe(0);
  });
});

describe('rarity ring colour (AC-4/AC-14)', () => {
  it('uses the rarity hex table for rare and epic grants', () => {
    const rare = createRevealStage({}, rareGrant());
    const epic = createRevealStage(
      {},
      rareGrant({ partId: 'tail-fin-comet', slot: 'tail-fin', rarity: 'epic' }),
    );

    expect(REVEAL_RARITY_HEX.rare).toBe('#60a5fa');
    expect(REVEAL_RARITY_HEX.epic).toBe('#c084fc');
    expect(ringMaterialOf(rare).color.getHex()).toBe(0x60a5fa);
    expect(ringMaterialOf(epic).color.getHex()).toBe(0xc084fc);

    rare.dispose();
    epic.dispose();
  });
});

describe('try-on appearance (AC-5)', () => {
  it('stages only the catalog slot, normalizes the rest and never mutates the input', () => {
    // A legacy `body` key expands to the hull; the wire `slot` is deliberately wrong.
    const appearance = { body: 'body-gold' };
    const before = { ...appearance };
    const stage = createRevealStage(appearance, rareGrant({ slot: 'hull' }));

    expect(stage.stageAppearance).toEqual({
      hull: 'hull-gold',
      'wing-left': 'wing-left-silver',
    });
    expect(stage.stageAppearance).toEqual({
      ...normalizeAppearance(appearance),
      'wing-left': 'wing-left-silver',
    });
    expect(stage.stageAppearance['wing-left']).toBe('wing-left-silver');
    expect(stage.stageAppearance).not.toBe(appearance);
    expect(appearance).toEqual(before);

    // The appearance reached the model: hull-gold colour/accent, then the granted wing part.
    const hull = stage.scene.getObjectByName('cursor-hull') as Mesh;
    expect((hull.material as MeshPhysicalMaterial).color.getHex()).toBe(0xccaa44);
    const wing = stage.scene.getObjectByName('cursor-wing-left') as Mesh;
    expect((wing.material as MeshPhysicalMaterial).color.getHex()).toBe(0xaaaaaa);
    const wingTip = stage.scene.getObjectByName('cursor-wing-left-tip') as Mesh;
    expect((wingTip.material as MeshPhysicalMaterial).color.getHex()).toBe(0xd9dee7);

    stage.dispose();
  });

  it('keeps the caller appearance unchanged across frames', () => {
    const appearance = { hull: 'hull-gold', cockpit: 'cockpit-oracle' };
    const before = { ...appearance };
    const stage = createRevealStage(appearance, rareGrant());

    stage.update(0, false);
    stage.update(970, false);
    stage.update(1290, false);

    expect(appearance).toEqual(before);
    expect(stage.stageAppearance).toEqual({
      hull: 'hull-gold',
      cockpit: 'cockpit-oracle',
      'wing-left': 'wing-left-silver',
    });

    stage.dispose();
  });

  it('rejects an unknown part before building any stage resource', () => {
    expect(() => createRevealStage({}, rareGrant({ partId: 'unknown-part' }))).toThrow(
      'unknown part: unknown-part',
    );
  });

  it('applies the staged appearance through the model exactly once', () => {
    const source = readFileSync(new URL('./lootbox-reveal.ts', import.meta.url), 'utf8');
    expect(source.match(/\.applyAppearance\(/g) ?? []).toHaveLength(1);
  });
});

describe('per-frame pose writes (AC-4/AC-15)', () => {
  it('writes the exact charge/orb/flash/reveal/settle/rest values', () => {
    const stage = createRevealStage({}, rareGrant());
    const ringMaterial = ringMaterialOf(stage);
    const keyLight = keyLightOf(stage);
    const wing = stage.model.slots['wing-left'];
    const hull = stage.model.slots.hull;

    // Charge start: preview rest yaw, no scale lift, hidden ring, unflashed key light.
    let pose = stage.update(0, false);
    expect(pose.phase).toBe('charge');
    expect(stage.model.group.rotation.y).toBe(0.55);
    expect(stage.model.group.scale.x).toBe(1);
    expect(wing.scale.toArray()).toEqual([1.16, 1, 0.9]);
    expect(wing.rotation.y).toBe(-0.12);
    expect(stage.ring.scale.x).toBe(0.4);
    expect(ringMaterial.opacity).toBe(0);
    expect(keyLight.intensity).toBe(3);

    // Orb: the ship is at the slot yaw and the charge scale.
    pose = stage.update(420, false);
    expect(pose.phase).toBe('orb');
    expect(stage.model.group.rotation.y).toBe(0.85);
    expect(stage.model.group.scale.x).toBe(1.04);
    expect(stage.ring.scale.x).toBe(0.4);

    // Flash peak: 0.85 lift on the key light, ring still hidden.
    pose = stage.update(730, false);
    expect(pose.phase).toBe('flash');
    expect(pose.flashOpacity).toBe(0.85);
    expect(keyLight.intensity).toBe(3 * (1 + 0.85));
    expect(stage.model.group.scale.x).toBe(1.1);
    expect(wing.scale.toArray()).toEqual([1.16, 1, 0.9]);

    // Reveal peak: slot pulse 1.1, ring 2.15 at 0.9 opacity, no flash lift.
    pose = stage.update(970, false);
    expect(pose.phase).toBe('reveal');
    expect(stage.model.group.scale.x).toBe(1.0125);
    expect(wing.scale.x).toBe(1.16 * 1.1);
    expect(wing.scale.y).toBe(1.1);
    expect(wing.scale.z).toBe(0.9 * 1.1);
    expect(wing.rotation.y).toBe(-0.12);
    expect(stage.ring.scale.x).toBe(2.15);
    expect(ringMaterial.opacity).toBe(0.9);
    expect(keyLight.intensity).toBe(3);

    // Settle: back to rest scale, the ring fully faded.
    pose = stage.update(1150, false);
    expect(pose.phase).toBe('settle');
    expect(stage.model.group.scale.x).toBe(1);
    expect(wing.scale.toArray()).toEqual([1.16, 1, 0.9]);
    expect(stage.ring.scale.x).toBe(2.4);
    expect(ringMaterial.opacity).toBe(0);

    // Rest at the timeline end keeps the slot yaw and the hidden ring.
    pose = stage.update(1290, false);
    expect(pose.phase).toBe('rest');
    expect(stage.model.group.rotation.y).toBe(0.85);
    expect(stage.model.group.scale.x).toBe(1);
    expect(stage.ring.scale.x).toBe(1);
    expect(ringMaterial.opacity).toBe(0);
    expect(keyLight.intensity).toBe(3);

    // A non-granted slot keeps its base transform on every frame.
    expect(hull.scale.toArray()).toEqual([1, 1, 1]);
    expect(hull.rotation.y).toBe(0);

    stage.dispose();
  });

  it('reuses one pose buffer across frames (no per-frame allocation)', () => {
    const stage = createRevealStage({}, rareGrant());

    const first = stage.update(0, false);
    const second = stage.update(970, false);
    const third = stage.update(1290, true);

    expect(second).toBe(first);
    expect(third).toBe(first);

    stage.dispose();
  });

  it('writes the static rest row under reduced motion', () => {
    const stage = createRevealStage({}, rareGrant());
    const wing = stage.model.slots['wing-left'];

    stage.update(970, false);
    const pose = stage.update(730, true);

    expect(pose.phase).toBe('rest');
    expect(pose.yawRad).toBe(0.85);
    expect(pose.scale).toBe(1);
    expect(pose.slotPulse).toBe(1);
    expect(pose.ringScale).toBe(1);
    expect(pose.ringOpacity).toBe(0);
    expect(pose.flashOpacity).toBe(0);
    expect(stage.model.group.rotation.y).toBe(0.85);
    expect(stage.model.group.scale.x).toBe(1);
    expect(wing.scale.toArray()).toEqual([1.16, 1, 0.9]);
    expect(stage.ring.scale.x).toBe(1);
    expect(ringMaterialOf(stage).opacity).toBe(0);
    expect(keyLightOf(stage).intensity).toBe(3);

    stage.dispose();
  });
});

describe('draw and triangle budgets (AC-15)', () => {
  it('stays within 24 draw calls and 2596 triangles', () => {
    const stage = createRevealStage({}, rareGrant());
    const drawCalls = stage.model.meshes.length + 1;
    const ringTriangles = (stage.ring.geometry.getIndex()?.count ?? 0) / 3;
    const triangles = stage.model.triangleCount + ringTriangles;

    expect(drawCalls).toBe(22);
    expect(drawCalls).toBeLessThanOrEqual(REVEAL_MAX_DRAW_CALLS);
    expect(stage.model.triangleCount).toBe(776);
    expect(ringTriangles).toBe(REVEAL_RING_TRIANGLES);
    expect(triangles).toBe(872);
    expect(triangles).toBeLessThanOrEqual(REVEAL_MAX_TRIANGLES);

    stage.dispose();
  });
});

describe('no shadows, textures, sprites, points or randomness (AC-4)', () => {
  it('builds two lights, twenty-two unshadowed untextured meshes and no sprite/points', () => {
    const stage = createRevealStage({}, rareGrant());
    // three's constructors generate UUIDs from Math.random; only the frame path is ours.
    const randomSpy = vi.spyOn(Math, 'random');
    stage.update(0, false);
    stage.update(970, false);
    expect(randomSpy).toHaveBeenCalledTimes(0);

    let meshes = 0;
    let lights = 0;
    let sprites = 0;
    let points = 0;
    const materials = new Set<Material>();
    stage.scene.traverse((object) => {
      if (object instanceof AmbientLight || object instanceof DirectionalLight) {
        lights += 1;
      }
      if (object instanceof Sprite) {
        sprites += 1;
      }
      if (object instanceof Points) {
        points += 1;
      }
      if (!(object instanceof Mesh)) {
        return;
      }
      meshes += 1;
      expect(object.castShadow).toBe(false);
      expect(object.receiveShadow).toBe(false);
      const material = object.material as MeshBasicMaterial;
      expect(material.map).toBeNull();
      materials.add(material);
    });

    expect(meshes).toBe(22);
    expect(lights).toBe(2);
    expect(sprites).toBe(0);
    expect(points).toBe(0);
    expect(materials.size).toBe(20);

    stage.dispose();
  });

  it('contains no texture, loader, sprite/points, browser-global or random construction', () => {
    const source = readFileSync(new URL('./lootbox-reveal.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(
      /\b(?:TextureLoader|GLTFLoader|OBJLoader|FileLoader|ImageLoader|AudioLoader)\b/,
    );
    expect(source).not.toMatch(/new\s+Texture\s*\(/);
    expect(source).not.toMatch(/new\s+(?:Sprite|Points)\s*\(/);
    expect(source).not.toMatch(/\b(?:document|window)\./);
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/\.(?:png|jpe?g|webp|glb|gltf|obj)\b/);
    expect(source.match(/new\s+AmbientLight\s*\(/g) ?? []).toHaveLength(1);
    expect(source.match(/new\s+DirectionalLight\s*\(/g) ?? []).toHaveLength(1);
    expect(source.match(/new\s+Scene\s*\(/g) ?? []).toHaveLength(1);
    expect(source.match(/new\s+RingGeometry\s*\(/g) ?? []).toHaveLength(1);
  });
});

describe('reveal stage disposal (AC-4)', () => {
  it('disposes every unique geometry/material once, clears the scene and is idempotent', () => {
    const stage = createRevealStage({}, rareGrant());

    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    stage.scene.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }
      geometries.add(object.geometry);
      materials.add(object.material as Material);
    });
    expect(geometries.size).toBe(22);
    expect(materials.size).toBe(20);

    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...materials].map((material) => vi.spyOn(material, 'dispose'));
    const lastPose = stage.update(970, false);
    const yawBeforeDispose = stage.model.group.rotation.y;

    stage.dispose();

    expect(stage.scene.children).toEqual([]);
    expect(stage.model.meshes).toHaveLength(0);
    expect(stage.model.slotGroups).toHaveLength(0);
    expect(stage.model.group.parent).toBeNull();
    for (const geometrySpy of geometrySpies) {
      expect(geometrySpy).toHaveBeenCalledTimes(1);
    }
    for (const materialSpy of materialSpies) {
      expect(materialSpy).toHaveBeenCalledTimes(1);
    }

    // A second dispose is a no-op: nothing is released twice.
    stage.dispose();
    expect(stage.scene.children).toEqual([]);
    for (const geometrySpy of geometrySpies) {
      expect(geometrySpy).toHaveBeenCalledTimes(1);
    }
    for (const materialSpy of materialSpies) {
      expect(materialSpy).toHaveBeenCalledTimes(1);
    }

    // Updates after disposal are no-ops that keep returning the last pose.
    expect(stage.update(1290, false)).toBe(lastPose);
    expect(stage.update(1290, false).phase).toBe('reveal');
    expect(stage.model.group.rotation.y).toBe(yawBeforeDispose);
  });
});
