import { describe, expect, it, vi } from 'vitest';
import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  MeshBasicMaterial,
  OctahedronGeometry,
  TetrahedronGeometry,
  TorusGeometry,
} from 'three';

import {
  createShotGeometries,
  createShotMaterials,
  SHOT_BOLT_HEIGHT,
  SHOT_BOLT_RADIAL_SEGMENTS,
  SHOT_BOLT_RADIUS,
  SHOT_MUZZLE_COLOR,
  SHOT_MUZZLE_OPACITY,
  SHOT_ORB_RADIUS,
  SHOT_PETAL_HALF_SIZE,
  SHOT_PROJECTILE_COLOR,
  SHOT_PROJECTILE_OPACITY,
  SHOT_RING_RADIUS,
  SHOT_RING_TUBE,
  SHOT_SHARD_RADIUS,
  SHOT_SPARK_RADIUS,
  SHOT_WAVE_RADIUS,
  SHOT_WAVE_TUBE,
} from './shot-visuals';

describe('createShotGeometries (AC-24)', () => {
  it('builds exactly four projectiles and three muzzles in the pinned order', () => {
    const set = createShotGeometries();

    expect(Object.keys(set.projectiles)).toEqual(['bolt', 'orb', 'wave', 'shard']);
    expect(Object.keys(set.muzzles)).toEqual(['spark', 'ring', 'petal']);
    for (const geometry of Object.values(set.projectiles)) {
      expect(geometry).toBeInstanceOf(BufferGeometry);
    }
    for (const geometry of Object.values(set.muzzles)) {
      expect(geometry).toBeInstanceOf(BufferGeometry);
    }
    const all = [...Object.values(set.projectiles), ...Object.values(set.muzzles)];
    expect(new Set(all).size).toBe(7);
    set.dispose();
  });

  it('keeps the accepted bolt cone with its tip on local +z', () => {
    const set = createShotGeometries();
    const bolt = set.projectiles.bolt;

    expect(SHOT_BOLT_RADIUS).toBe(0.07);
    expect(SHOT_BOLT_HEIGHT).toBe(0.55);
    expect(SHOT_BOLT_RADIAL_SEGMENTS).toBe(6);
    expect(bolt).toBeInstanceOf(ConeGeometry);
    const cone = bolt as ConeGeometry;
    expect(cone.parameters.radius).toBe(0.07);
    expect(cone.parameters.height).toBe(0.55);
    expect(cone.parameters.radialSegments).toBe(6);
    expect(cone.index!.count / 3).toBe(12);

    bolt.computeBoundingBox();
    // Geometry vertices are Float32, so the pinned double is compared at 1e-6.
    expect(bolt.boundingBox!.min.z).toBeCloseTo(-0.275, 6);
    expect(bolt.boundingBox!.max.z).toBeCloseTo(0.275, 6);

    // The extreme +z vertex is the cone tip: exactly on the local z axis.
    const position = bolt.getAttribute('position');
    let tip = 0;
    for (let index = 1; index < position.count; index += 1) {
      if (position.getZ(index) > position.getZ(tip)) {
        tip = index;
      }
    }
    expect(position.getX(tip)).toBeCloseTo(0, 6);
    expect(position.getY(tip)).toBeCloseTo(0, 6);
    expect(position.getZ(tip)).toBeCloseTo(0.275, 6);
    set.dispose();
  });

  it('builds the orb as a 0.16-radius octahedron and the shard as a 0.14 tetrahedron', () => {
    const set = createShotGeometries();

    expect(SHOT_ORB_RADIUS).toBe(0.16);
    expect(set.projectiles.orb).toBeInstanceOf(OctahedronGeometry);
    const orb = set.projectiles.orb as OctahedronGeometry;
    expect(orb.parameters.radius).toBe(0.16);
    expect(orb.parameters.detail).toBe(0);
    expect(orb.getAttribute('position').count / 3).toBe(8);

    expect(SHOT_SHARD_RADIUS).toBe(0.14);
    expect(set.projectiles.shard).toBeInstanceOf(TetrahedronGeometry);
    const shard = set.projectiles.shard as TetrahedronGeometry;
    expect(shard.parameters.radius).toBe(0.14);
    expect(shard.parameters.detail).toBe(0);
    expect(shard.getAttribute('position').count / 3).toBe(4);
    set.dispose();
  });

  it('builds the wave as a torus whose hole faces local +z', () => {
    const set = createShotGeometries();
    const wave = set.projectiles.wave;

    expect(SHOT_WAVE_RADIUS).toBe(0.18);
    expect(SHOT_WAVE_TUBE).toBe(0.05);
    expect(wave).toBeInstanceOf(TorusGeometry);
    const torus = wave as TorusGeometry;
    expect(torus.parameters.radius).toBe(0.18);
    expect(torus.parameters.tube).toBe(0.05);
    expect(torus.parameters.radialSegments).toBe(6);
    expect(torus.parameters.tubularSegments).toBe(16);

    // The ring lies in the local XY plane: z spans only the tube (sampled at sin(π/3)
    // with 6 radial segments), x/y span ring + tube.
    const zExtent = SHOT_WAVE_TUBE * Math.sin(Math.PI / 3);
    wave.computeBoundingBox();
    expect(wave.boundingBox!.min.z).toBeCloseTo(-zExtent, 6);
    expect(wave.boundingBox!.max.z).toBeCloseTo(zExtent, 6);
    expect(wave.boundingBox!.max.x).toBeCloseTo(0.23, 6);
    expect(wave.boundingBox!.min.x).toBeCloseTo(-0.23, 6);
    set.dispose();
  });

  it('keeps the accepted spark octahedron and builds the ring as a torus', () => {
    const set = createShotGeometries();

    expect(SHOT_SPARK_RADIUS).toBe(0.22);
    expect(set.muzzles.spark).toBeInstanceOf(OctahedronGeometry);
    const spark = set.muzzles.spark as OctahedronGeometry;
    expect(spark.parameters.radius).toBe(0.22);
    expect(spark.parameters.detail).toBe(0);
    expect(spark.getAttribute('position').count / 3).toBe(8);

    expect(SHOT_RING_RADIUS).toBe(0.2);
    expect(SHOT_RING_TUBE).toBe(0.045);
    expect(set.muzzles.ring).toBeInstanceOf(TorusGeometry);
    const ring = set.muzzles.ring as TorusGeometry;
    expect(ring.parameters.radius).toBe(0.2);
    expect(ring.parameters.tube).toBe(0.045);
    expect(ring.parameters.radialSegments).toBe(6);
    expect(ring.parameters.tubularSegments).toBe(14);
    set.dispose();
  });

  it('builds the petal as three crossed quads (six triangles, three planes)', () => {
    const set = createShotGeometries();
    const petal = set.muzzles.petal;

    expect(SHOT_PETAL_HALF_SIZE).toBe(0.17);
    // Three quads × two triangles × three vertices, non-indexed.
    const position = petal.getAttribute('position');
    expect(position.count).toBe(18);
    for (let index = 0; index < position.count; index += 1) {
      expect(position.getZ(index)).toBe(0);
    }

    // Blade 0 is the unrotated quad (-h, -h) first; the attribute stores Float32.
    expect([
      position.getX(0),
      position.getY(0),
      position.getZ(0),
    ]).toEqual([Math.fround(-0.17), Math.fround(-0.17), 0]);

    // The 60°/120° blades widen the bounds past one 0.34 quad's half-size.
    const extent = SHOT_PETAL_HALF_SIZE * (0.5 + Math.sqrt(3) / 2);
    petal.computeBoundingBox();
    expect(petal.boundingBox!.max.x).toBeCloseTo(extent, 6);
    expect(petal.boundingBox!.min.x).toBeCloseTo(-extent, 6);
    expect(petal.boundingBox!.max.y).toBeCloseTo(extent, 6);
    expect(petal.boundingBox!.min.y).toBeCloseTo(-extent, 6);
    set.dispose();
  });
});

describe('createShotMaterials (AC-24)', () => {
  it('creates exactly two additive materials with the accepted default colours', () => {
    const materials = createShotMaterials();

    expect(Object.keys(materials)).toEqual(['projectile', 'muzzle']);

    expect(SHOT_PROJECTILE_COLOR).toBe(0xfff1c8);
    expect(SHOT_PROJECTILE_OPACITY).toBe(0.95);
    expect(materials.projectile).toBeInstanceOf(MeshBasicMaterial);
    expect(materials.projectile.color.getHex()).toBe(0xfff1c8);
    expect(materials.projectile.opacity).toBe(0.95);
    expect(materials.projectile.transparent).toBe(true);
    expect(materials.projectile.blending).toBe(AdditiveBlending);
    expect(materials.projectile.depthWrite).toBe(false);
    expect(materials.projectile.toneMapped).toBe(false);

    expect(SHOT_MUZZLE_COLOR).toBe(0xffd27a);
    expect(SHOT_MUZZLE_OPACITY).toBe(0.9);
    expect(materials.muzzle).toBeInstanceOf(MeshBasicMaterial);
    expect(materials.muzzle.color.getHex()).toBe(0xffd27a);
    expect(materials.muzzle.opacity).toBe(0.9);
    expect(materials.muzzle.transparent).toBe(true);
    expect(materials.muzzle.blending).toBe(AdditiveBlending);
    expect(materials.muzzle.depthWrite).toBe(false);
    expect(materials.muzzle.toneMapped).toBe(false);
    expect(materials.muzzle.side).toBe(DoubleSide);

    materials.projectile.dispose();
    materials.muzzle.dispose();
  });
});

describe('dispose (AC-24)', () => {
  it('releases every geometry exactly once and is idempotent', () => {
    const set = createShotGeometries();
    const geometries = [...Object.values(set.projectiles), ...Object.values(set.muzzles)];
    expect(geometries).toHaveLength(7);
    const spies = geometries.map((geometry) => vi.spyOn(geometry, 'dispose'));

    set.dispose();
    set.dispose();

    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
