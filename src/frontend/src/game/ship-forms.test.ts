/**
 * Tests for the pure ship form math (remote-spaceship-customization T9; spec AC-5, AC-17).
 *
 * Contract covered: the ten generated recipes against the pinned spec table, the eleven-form
 * chassis table, the per-slot transform formula (classic/`shot` identity, hull/nose/cockpit/wing/
 * engine/ignition/tail-fin columns, sweep signs), unknown-form and unknown-slot fallbacks, and the
 * import boundary (`ship-forms.ts` imports only `./parts-v3.js` — never `three` or `render/**`).
 * Assertions use concrete expected values; the sweep angles are re-derived with the same
 * `(deg · π) / 180` operation order so the comparison is exact.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { FORM_CATALOG, SLOT_CATALOG_V3, type FormId, type SlotIdV3 } from './parts-v3';
import {
  FORM_RECIPES,
  chassisPose,
  isGeneratedFormId,
  slotFormTransform,
  type GeneratedFormId,
  type SlotTransform,
} from './ship-forms';

/** The generated forms in `FORM_CATALOG` order (the `FORM_RECIPES` key order). */
const GENERATED_FORM_IDS: readonly GeneratedFormId[] = [
  'dart',
  'lance',
  'needle',
  'manta',
  'hauler',
  'bulwark',
  'arrow',
  'orca',
  'talon',
  'kite',
];

/** The eleven slots in `SLOT_CATALOG_V3` order. */
const SLOT_IDS: readonly SlotIdV3[] = [
  'hull',
  'nose',
  'cockpit',
  'wing-left',
  'wing-right',
  'engine-left',
  'engine-right',
  'ignition-left',
  'ignition-right',
  'tail-fin',
  'shot',
];

/** The pinned spec § Catalog tables recipe matrix (independent of the module under test). */
const PINNED_RECIPES = {
  dart: {
    lengthScale: 1.15,
    widthScale: 0.85,
    sweepDeg: 18,
    thicknessScale: 0.9,
    offsetZ: 0.02,
    chassis: [0.95, 0.9, 1.25],
    shot: { geometry: 'bolt', scale: 1, muzzle: 'spark' },
  },
  lance: {
    lengthScale: 1.3,
    widthScale: 0.8,
    sweepDeg: 12,
    thicknessScale: 0.95,
    offsetZ: 0.04,
    chassis: [0.9, 0.85, 1.35],
    shot: { geometry: 'bolt', scale: 1.25, muzzle: 'spark' },
  },
  needle: {
    lengthScale: 1.25,
    widthScale: 0.7,
    sweepDeg: 8,
    thicknessScale: 0.8,
    offsetZ: 0.05,
    chassis: [0.8, 0.8, 1.4],
    shot: { geometry: 'bolt', scale: 0.85, muzzle: 'spark' },
  },
  manta: {
    lengthScale: 1.0,
    widthScale: 1.25,
    sweepDeg: 32,
    thicknessScale: 0.85,
    offsetZ: 0,
    chassis: [1.2, 0.85, 1.0],
    shot: { geometry: 'wave', scale: 1.15, muzzle: 'petal' },
  },
  hauler: {
    lengthScale: 0.9,
    widthScale: 1.15,
    sweepDeg: 6,
    thicknessScale: 1.2,
    offsetZ: -0.02,
    chassis: [1.15, 1.1, 0.85],
    shot: { geometry: 'orb', scale: 1.1, muzzle: 'ring' },
  },
  bulwark: {
    lengthScale: 0.95,
    widthScale: 1.1,
    sweepDeg: 10,
    thicknessScale: 1.3,
    offsetZ: -0.03,
    chassis: [1.1, 1.15, 0.9],
    shot: { geometry: 'orb', scale: 1.2, muzzle: 'ring' },
  },
  arrow: {
    lengthScale: 1.1,
    widthScale: 0.95,
    sweepDeg: 24,
    thicknessScale: 0.9,
    offsetZ: 0.01,
    chassis: [0.95, 0.95, 1.2],
    shot: { geometry: 'shard', scale: 1, muzzle: 'petal' },
  },
  orca: {
    lengthScale: 1.05,
    widthScale: 1.2,
    sweepDeg: 14,
    thicknessScale: 1.0,
    offsetZ: 0,
    chassis: [1.1, 1.0, 1.05],
    shot: { geometry: 'wave', scale: 1.2, muzzle: 'petal' },
  },
  talon: {
    lengthScale: 1.0,
    widthScale: 1.0,
    sweepDeg: 28,
    thicknessScale: 0.85,
    offsetZ: 0.03,
    chassis: [1.0, 0.9, 1.1],
    shot: { geometry: 'shard', scale: 1.05, muzzle: 'spark' },
  },
  kite: {
    lengthScale: 1.1,
    widthScale: 1.05,
    sweepDeg: 38,
    thicknessScale: 0.9,
    offsetZ: 0,
    chassis: [1.05, 1.0, 1.1],
    shot: { geometry: 'orb', scale: 0.95, muzzle: 'ring' },
  },
} as const;

const IDENTITY_TRANSFORM: SlotTransform = {
  scale: [1, 1, 1],
  rotation: [0, 0, 0],
  position: [0, 0, 0],
};

/** Radians of a pinned sweep, computed exactly like the module (same operation order). */
function sweepRad(form: GeneratedFormId): number {
  return (PINNED_RECIPES[form].sweepDeg * Math.PI) / 180;
}

describe('ship form recipes (AC-17)', () => {
  it('exposes exactly the ten generated forms in FORM_CATALOG order', () => {
    expect(Object.keys(FORM_RECIPES)).toEqual(GENERATED_FORM_IDS);
    expect(Object.keys(FORM_RECIPES)).toEqual(
      FORM_CATALOG.filter((form) => form.recipe !== null).map((form) => form.id),
    );
    expect(Object.keys(FORM_RECIPES)).toHaveLength(10);
    expect(SLOT_IDS).toEqual(SLOT_CATALOG_V3.map((slot) => slot.id));
  });

  it('pins every recipe field against the spec table', () => {
    expect(FORM_RECIPES).toEqual(PINNED_RECIPES);
  });

  it('recognizes generated form ids and rejects classic and non-forms', () => {
    for (const form of GENERATED_FORM_IDS) {
      expect(isGeneratedFormId(form)).toBe(true);
    }
    expect(isGeneratedFormId('classic')).toBe(false);
    expect(isGeneratedFormId('standard')).toBe(false);
    expect(isGeneratedFormId('armored')).toBe(false);
    expect(isGeneratedFormId('kite-')).toBe(false);
    expect(isGeneratedFormId('')).toBe(false);
  });
});

describe('chassisPose (AC-17)', () => {
  it('returns the pinned chassis triple for every form', () => {
    const expected: Readonly<Record<FormId, readonly [number, number, number]>> = {
      classic: [1, 1, 1],
      dart: [0.95, 0.9, 1.25],
      lance: [0.9, 0.85, 1.35],
      needle: [0.8, 0.8, 1.4],
      manta: [1.2, 0.85, 1.0],
      hauler: [1.15, 1.1, 0.85],
      bulwark: [1.1, 1.15, 0.9],
      arrow: [0.95, 0.95, 1.2],
      orca: [1.1, 1.0, 1.05],
      talon: [1.0, 0.9, 1.1],
      kite: [1.05, 1.0, 1.1],
    };
    for (const form of FORM_CATALOG) {
      expect(chassisPose(form.id)).toEqual(expected[form.id]);
    }
    expect(FORM_CATALOG).toHaveLength(11);
  });

  it('falls back to the classic [1, 1, 1] chassis for an unknown form', () => {
    expect(chassisPose('unlisted-form' as FormId)).toEqual([1, 1, 1]);
  });
});

describe('slotFormTransform — identity cases (AC-17)', () => {
  it('returns the identity transform for classic on all eleven slots', () => {
    for (const slot of SLOT_IDS) {
      expect(slotFormTransform(slot, 'classic')).toEqual(IDENTITY_TRANSFORM);
    }
  });

  it('returns the identity transform for the shot slot on every form', () => {
    for (const form of FORM_CATALOG) {
      expect(slotFormTransform('shot', form.id)).toEqual(IDENTITY_TRANSFORM);
    }
  });

  it('returns the identity transform for an unknown form or slot', () => {
    expect(slotFormTransform('hull', 'unlisted-form' as FormId)).toEqual(IDENTITY_TRANSFORM);
    expect(slotFormTransform('unlisted-slot' as SlotIdV3, 'dart')).toEqual(IDENTITY_TRANSFORM);
  });

  it('returns fresh arrays so callers cannot mutate shared state', () => {
    const first = slotFormTransform('hull', 'dart');
    first.scale[0] = 9;
    first.position[2] = 9;
    expect(slotFormTransform('hull', 'dart')).toEqual({
      scale: [0.85, 0.9, 1.15],
      rotation: [0, 0, 0],
      position: [0, 0, 0.02],
    });

    const firstIdentity = slotFormTransform('shot', 'dart');
    firstIdentity.scale[1] = 9;
    expect(slotFormTransform('shot', 'dart')).toEqual(IDENTITY_TRANSFORM);
  });
});

describe('slotFormTransform — pinned matrix (AC-17)', () => {
  it('pins the full dart matrix across all eleven slots', () => {
    // dart: length 1.15, width 0.85, sweep 18°, thickness 0.9, offsetZ 0.02.
    const dartSweep = (18 * Math.PI) / 180;
    const expected: Readonly<Record<SlotIdV3, SlotTransform>> = {
      hull: {
        scale: [0.85, 0.9, 1.15],
        rotation: [0, 0, 0],
        position: [0, 0, 0.02],
      },
      nose: {
        scale: [0.85, 0.85, 1.15],
        rotation: [0, 0, 0],
        position: [0, 0, 0.04],
      },
      cockpit: {
        scale: [0.85, 0.9, 1.15],
        rotation: [0, 0, 0],
        position: [0, 0.02 * 0.9, 0],
      },
      'wing-left': {
        scale: [0.85, 0.9, 1.15],
        rotation: [0, dartSweep, 0],
        position: [0, 0, 0],
      },
      'wing-right': {
        scale: [0.85, 0.9, 1.15],
        rotation: [0, -dartSweep, 0],
        position: [0, 0, 0],
      },
      'engine-left': {
        scale: [0.85, 0.9, 1.15],
        rotation: [0, 0, 0],
        position: [0, 0, 0.02],
      },
      'engine-right': {
        scale: [0.85, 0.9, 1.15],
        rotation: [0, 0, 0],
        position: [0, 0, 0.02],
      },
      'ignition-left': {
        scale: [0.8 * 0.85, 0.8 * 0.9, 0.8 * 1.15],
        rotation: [0, 0, 0],
        position: [0, 0, 0],
      },
      'ignition-right': {
        scale: [0.8 * 0.85, 0.8 * 0.9, 0.8 * 1.15],
        rotation: [0, 0, 0],
        position: [0, 0, 0],
      },
      'tail-fin': {
        scale: [0.85, 1.15, 0.9],
        rotation: [0, 0, 0.5 * dartSweep],
        position: [0, 0, 0],
      },
      shot: { scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0, 0] },
    };
    for (const slot of SLOT_IDS) {
      expect(slotFormTransform(slot, 'dart')).toEqual(expected[slot]);
    }
  });

  it('pins the hull scale and offset for every generated form', () => {
    const expected: Readonly<
      Record<GeneratedFormId, { scale: readonly [number, number, number]; z: number }>
    > = {
      dart: { scale: [0.85, 0.9, 1.15], z: 0.02 },
      lance: { scale: [0.8, 0.95, 1.3], z: 0.04 },
      needle: { scale: [0.7, 0.8, 1.25], z: 0.05 },
      manta: { scale: [1.25, 0.85, 1.0], z: 0 },
      hauler: { scale: [1.15, 1.2, 0.9], z: -0.02 },
      bulwark: { scale: [1.1, 1.3, 0.95], z: -0.03 },
      arrow: { scale: [0.95, 0.9, 1.1], z: 0.01 },
      orca: { scale: [1.2, 1.0, 1.05], z: 0 },
      talon: { scale: [1.0, 0.85, 1.0], z: 0.03 },
      kite: { scale: [1.05, 0.9, 1.1], z: 0 },
    };
    for (const form of GENERATED_FORM_IDS) {
      expect(slotFormTransform('hull', form)).toEqual({
        scale: expected[form].scale,
        rotation: [0, 0, 0],
        position: [0, 0, expected[form].z],
      });
    }
  });

  it('doubles the offset on the nose and keeps it on both engines', () => {
    for (const form of GENERATED_FORM_IDS) {
      const offsetZ = PINNED_RECIPES[form].offsetZ;
      const width = PINNED_RECIPES[form].widthScale;
      const length = PINNED_RECIPES[form].lengthScale;

      expect(slotFormTransform('nose', form)).toEqual({
        scale: [width, width, length],
        rotation: [0, 0, 0],
        position: [0, 0, 2 * offsetZ],
      });
      expect(slotFormTransform('engine-left', form).position).toEqual([0, 0, offsetZ]);
      expect(slotFormTransform('engine-right', form).position).toEqual([0, 0, offsetZ]);
    }
  });

  it('lifts the cockpit by 2% of the form thickness', () => {
    for (const form of GENERATED_FORM_IDS) {
      const thickness = PINNED_RECIPES[form].thicknessScale;
      const width = PINNED_RECIPES[form].widthScale;
      const length = PINNED_RECIPES[form].lengthScale;
      expect(slotFormTransform('cockpit', form)).toEqual({
        scale: [width, thickness, length],
        rotation: [0, 0, 0],
        position: [0, 0.02 * thickness, 0],
      });
    }
  });

  it('sweeps the wings in opposite directions and rolls the tail fin by half the sweep', () => {
    for (const form of GENERATED_FORM_IDS) {
      const sweep = sweepRad(form);
      const width = PINNED_RECIPES[form].widthScale;
      const length = PINNED_RECIPES[form].lengthScale;
      const thickness = PINNED_RECIPES[form].thicknessScale;

      expect(slotFormTransform('wing-left', form)).toEqual({
        scale: [width, thickness, length],
        rotation: [0, sweep, 0],
        position: [0, 0, 0],
      });
      expect(slotFormTransform('wing-right', form)).toEqual({
        scale: [width, thickness, length],
        rotation: [0, -sweep, 0],
        position: [0, 0, 0],
      });
      expect(slotFormTransform('tail-fin', form)).toEqual({
        scale: [width, length, thickness],
        rotation: [0, 0, 0.5 * sweep],
        position: [0, 0, 0],
      });
      expect(sweep).toBeGreaterThan(0);
    }
  });

  it('shrinks both ignitions to 80% of the hull transform', () => {
    for (const form of GENERATED_FORM_IDS) {
      const width = PINNED_RECIPES[form].widthScale;
      const thickness = PINNED_RECIPES[form].thicknessScale;
      const length = PINNED_RECIPES[form].lengthScale;
      const expected: SlotTransform = {
        scale: [0.8 * width, 0.8 * thickness, 0.8 * length],
        rotation: [0, 0, 0],
        position: [0, 0, 0],
      };
      expect(slotFormTransform('ignition-left', form)).toEqual(expected);
      expect(slotFormTransform('ignition-right', form)).toEqual(expected);
    }
  });

  it('produces three finite numbers for every slot/form pair', () => {
    for (const slot of SLOT_IDS) {
      for (const form of FORM_CATALOG) {
        const transform = slotFormTransform(slot, form.id);
        expect(transform.scale).toHaveLength(3);
        expect(transform.rotation).toHaveLength(3);
        expect(transform.position).toHaveLength(3);
        for (const value of [
          ...transform.scale,
          ...transform.rotation,
          ...transform.position,
        ]) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});

describe('ship-forms import boundary (AC-5)', () => {
  const source = readFileSync(new URL('./ship-forms.ts', import.meta.url), 'utf8');

  it('imports only ./parts-v3.js', () => {
    const specifiers = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gmu)].map(
      (match) => match[1],
    );
    expect(specifiers).toEqual(['./parts-v3.js']);
  });

  it('never imports three.js or the render layer', () => {
    expect(source).not.toMatch(/from\s+'three'/u);
    expect(source).not.toMatch(/from\s+'(?:\.\.\/)+render\//u);
    expect(source).not.toMatch(/from\s+'\.\/render\//u);
    expect(source).not.toMatch(/\bfrom\s+'three\//u);
  });

  it('has no timer, randomness, DOM or storage access', () => {
    expect(source).not.toMatch(
      /\b(?:setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/u,
    );
    expect(source).not.toMatch(/\bMath\.random\b/u);
    expect(source).not.toMatch(/\b(?:document|window|localStorage|sessionStorage)\b/u);
  });
});
