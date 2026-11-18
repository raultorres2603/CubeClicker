/**
 * Ship form math (remote-spaceship-customization T9; spec AC-5, AC-17; plan § Form transform).
 *
 * Layer: pure `game/**` — this module imports only `./parts-v3.js`. No three.js, no `render/**`,
 * no DOM, no timers, no randomness. The renderer (`render/cursor-ship.ts`) owns the accepted v2
 * `CURSOR_SLOT_SHAPE_TRANSFORMS` table and resolves a slot's transform as: v2 table entry → this
 * formula when the shape is a generated form id → the slot's `standard` entry, so every accepted
 * v2 visual is preserved exactly (the v2 table wins for a shared key such as `lance`).
 *
 * One recipe per generated form (from `FORM_CATALOG`) drives two things:
 *
 * - {@link slotFormTransform}: the per-slot group transform. `L` = `lengthScale`, `W` =
 *   `widthScale`, `T` = `thicknessScale`, `S` = `sweepDeg`, `Srad = S · π / 180`, `O` =
 *   `offsetZ`: hull `[W, T, L]` at `z = O`; nose `[W, W, L]` at `z = 2O`; cockpit `[W, T, L]`
 *   lifted by `0.02T`; wings `[W, T, L]` yawed `+Srad` (port) / `−Srad` (starboard); engines
 *   `[W, T, L]` at `z = O`; ignitions `0.8 · [W, T, L]`; tail fin `[W, L, T]` rolled `0.5Srad`.
 * - {@link chassisPose}: the pinned `chassis` triple the cursor/remote/preview model multiplies by
 *   the equip pulse (classic `[1, 1, 1]`, i.e. the accepted v2 look).
 *
 * `classic` has no recipe: its transforms are the accepted v2 tables, so it is identity here. The
 * `shot` slot has no geometry at all, so it is identity for every form.
 */

import {
  FORM_CATALOG,
  type FormDef,
  type FormId,
  type FormRecipe,
  type SlotIdV3,
} from './parts-v3.js';

/** Every form except `classic` (the ten generated forms). */
export type GeneratedFormId = Exclude<FormId, 'classic'>;

/** One slot group's local transform: scale, Euler rotation (XYZ) and position. */
export interface SlotTransform {
  scale: [number, number, number];
  rotation: [number, number, number];
  position: [number, number, number];
}

/** The classic chassis: the accepted v2 look, no hull scaling. */
export const CLASSIC_CHASSIS: readonly [number, number, number] = [1, 1, 1];

/** The generated forms with their recipes, in `FORM_CATALOG` order. */
const GENERATED_FORMS: readonly (FormDef & { recipe: FormRecipe })[] = FORM_CATALOG.filter(
  (form): form is FormDef & { recipe: FormRecipe } => form.recipe !== null,
);

const GENERATED_FORM_IDS: ReadonlySet<string> = new Set(
  GENERATED_FORMS.map((form) => form.id),
);

/**
 * The ten generated form recipes keyed by form id, derived from the pinned `FORM_CATALOG` (no
 * second source of truth for the numeric table).
 */
export const FORM_RECIPES: Readonly<Record<GeneratedFormId, FormRecipe>> = Object.fromEntries(
  GENERATED_FORMS.map((form) => [form.id, form.recipe]),
) as Record<GeneratedFormId, FormRecipe>;

/** True for a generated form id (`dart`…`kite`); `classic` and non-forms are false. */
export function isGeneratedFormId(value: string): value is GeneratedFormId {
  return GENERATED_FORM_IDS.has(value);
}

/** A fresh identity transform (never a shared mutable array). */
function identityTransform(): SlotTransform {
  return {
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  };
}

/**
 * The chassis triple of a form: the generated form's pinned `chassis`, classic `[1, 1, 1]`.
 * An unknown runtime value falls back to the classic chassis and never throws.
 */
export function chassisPose(form: FormId): readonly [number, number, number] {
  if (!isGeneratedFormId(form)) {
    return CLASSIC_CHASSIS;
  }
  return FORM_RECIPES[form].chassis;
}

/**
 * The local transform of one slot group for a form (plan § Form transform formula).
 *
 * `classic` and an unknown runtime form return the identity transform; the `shot` slot returns
 * the identity transform for every form (it has no mesh). An unknown runtime slot also returns
 * the identity transform instead of throwing.
 */
export function slotFormTransform(slot: SlotIdV3, form: FormId): SlotTransform {
  if (slot === 'shot' || !isGeneratedFormId(form)) {
    return identityTransform();
  }

  const recipe = FORM_RECIPES[form];
  const length = recipe.lengthScale;
  const width = recipe.widthScale;
  const thickness = recipe.thicknessScale;
  const offsetZ = recipe.offsetZ;
  const sweepRad = (recipe.sweepDeg * Math.PI) / 180;

  switch (slot) {
    case 'hull':
      return {
        scale: [width, thickness, length],
        rotation: [0, 0, 0],
        position: [0, 0, offsetZ],
      };
    case 'nose':
      return {
        scale: [width, width, length],
        rotation: [0, 0, 0],
        position: [0, 0, 2 * offsetZ],
      };
    case 'cockpit':
      return {
        scale: [width, thickness, length],
        rotation: [0, 0, 0],
        position: [0, 0.02 * thickness, 0],
      };
    case 'wing-left':
      return {
        scale: [width, thickness, length],
        rotation: [0, sweepRad, 0],
        position: [0, 0, 0],
      };
    case 'wing-right':
      return {
        scale: [width, thickness, length],
        rotation: [0, -sweepRad, 0],
        position: [0, 0, 0],
      };
    case 'engine-left':
    case 'engine-right':
      return {
        scale: [width, thickness, length],
        rotation: [0, 0, 0],
        position: [0, 0, offsetZ],
      };
    case 'ignition-left':
    case 'ignition-right':
      return {
        scale: [0.8 * width, 0.8 * thickness, 0.8 * length],
        rotation: [0, 0, 0],
        position: [0, 0, 0],
      };
    case 'tail-fin':
      // The plan writes `∓0.5Srad` "(left +, right −)"; the model has a single centred tail fin,
      // so the positive/port branch applies.
      return {
        scale: [width, length, thickness],
        rotation: [0, 0, 0.5 * sweepRad],
        position: [0, 0, 0],
      };
    default:
      return identityTransform();
  }
}
