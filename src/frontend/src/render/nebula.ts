/**
 * Procedural nebula backdrop texture (T9 — reference-image-game-view spec AC-9).
 *
 * The texture is a 256 × 128 RGBA, 8-bit {@link DataTexture} built entirely in memory:
 * four seeded value-noise octaves produce a cloud field, which is mapped through the
 * pinned purple/blue/pink palette ({@link NEBULA_PURPLE}, {@link NEBULA_BLUE},
 * {@link NEBULA_PINK}) over a near-black {@link NEBULA_DARK} base. There is no canvas,
 * image asset or DOM access, so the module runs unchanged in the node test environment.
 *
 * Every pixel is opaque (alpha 255), and the same injected random sequence always
 * produces the same bytes (no `Math.random`, clocks or timers). The cloud's horizontal
 * band selector uses the lowest octaves (purple → blue → pink) while the four-octave
 * density field modulates brightness and dark voids, so each pinned hue range keeps a
 * substantial, representative presence in the output (AC-9: at least
 * {@link NEBULA_MIN_HUE_PIXELS} saturated pixels per range).
 */

import { DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';

/** Texture width in pixels (AC-9). */
export const NEBULA_WIDTH = 256;

/** Texture height in pixels (AC-9). */
export const NEBULA_HEIGHT = 128;

/** Number of seeded value-noise octaves combined into the cloud field (AC-9). */
export const NEBULA_OCTAVES = 4;

/** Pinned purple palette stop (AC-9); HSL hue 263.4°. */
export const NEBULA_PURPLE = 0x5b21b6;

/** Pinned blue palette stop (AC-9); HSL hue 224.3°. */
export const NEBULA_BLUE = 0x1d4ed8;

/** Pinned pink palette stop (AC-9); HSL hue 333.3°. */
export const NEBULA_PINK = 0xdb2777;

/** Pinned near-black base the cloud fades into (AC-9). */
export const NEBULA_DARK = 0x070a1a;

/** Inclusive HSL hue ranges (degrees) each palette family occupies (AC-9). */
export const NEBULA_HUE_RANGES = {
  purple: [250, 280],
  blue: [205, 240],
  pink: [310, 345],
} as const;

/** Minimum pixels that must sit in each hue range with saturation ≥ 0.35 and L ∈ [0.15, 0.85] (AC-9). */
export const NEBULA_MIN_HUE_PIXELS = 100;

/** Minimum variance every RGB channel must exceed so the texture is not monochrome (AC-9). */
export const NEBULA_MIN_CHANNEL_VARIANCE = 100;

/** Base lattice cell counts of the lowest octave; 4 × 2 cells keeps cells square at 2:1. */
const NEBULA_BASE_CELLS_X = 4;
const NEBULA_BASE_CELLS_Y = 2;

/** Each octave halves the amplitude of the previous one (classic fractal sum). */
const NEBULA_OCTAVE_FALLOFF = 0.5;

/** Palette families laid out left → right as purple → blue → pink. */
const NEBULA_BAND_COUNT = 3;

/** Horizontal warp amplitude applied by the low-frequency octaves. */
const NEBULA_BAND_WARP_HORIZONTAL = 1.15;

/** Vertical warp amplitude that keeps the bands from looking like straight columns. */
const NEBULA_BAND_WARP_VERTICAL = 0.45;

/** Brightness floor for the darkest voids, keeping the nebula visible rather than black. */
const NEBULA_BRIGHTNESS_FLOOR = 0.34;

/** Maximum fraction of {@link NEBULA_DARK} mixed into low-density regions. */
const NEBULA_DARKNESS_MAX = 0.32;

/** Maximum fraction of white mixed into the brightest filaments. */
const NEBULA_HIGHLIGHT_MAX = 0.6;

/** Density at which the white highlight ramp starts. */
const NEBULA_HIGHLIGHT_DENSITY = 0.5;

/** Peak-to-peak fine-octave green chroma variation (0–255 channel units). */
const NEBULA_GREEN_CHROMA = 32;

/** Density window remapped onto the brightness ramp. */
const NEBULA_DENSITY_LOW = 0.15;
const NEBULA_DENSITY_HIGH = 0.85;

interface NoiseOctave {
  readonly cellsX: number;
  readonly cellsY: number;
  readonly lattice: Float32Array;
}

/** Splits a 0xRRGGBB colour into its three byte channels. */
function splitRgb(color: number): readonly [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

const NEBULA_PURPLE_RGB = splitRgb(NEBULA_PURPLE);
const NEBULA_BLUE_RGB = splitRgb(NEBULA_BLUE);
const NEBULA_PINK_RGB = splitRgb(NEBULA_PINK);
const NEBULA_DARK_RGB = splitRgb(NEBULA_DARK);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** GLSL-style smoothstep over [0, 1]. */
function smoothStep01(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Rounds a channel value into an 8-bit byte. */
function toByte(value: number): number {
  return clamp(Math.round(value), 0, 255);
}

/**
 * Creates one octave of seeded value noise: a lattice of uniformly random values at
 * `(baseCells << octave)` cells, bilinearly sampled with smoothstep interpolation.
 */
function createNoiseOctave(random: () => number, octave: number): NoiseOctave {
  const cellsX = NEBULA_BASE_CELLS_X << octave;
  const cellsY = NEBULA_BASE_CELLS_Y << octave;
  const lattice = new Float32Array((cellsX + 1) * (cellsY + 1));
  for (let index = 0; index < lattice.length; index += 1) {
    lattice[index] = random();
  }
  return { cellsX, cellsY, lattice };
}

function createNoiseOctaves(random: () => number): NoiseOctave[] {
  const octaves: NoiseOctave[] = [];
  for (let octave = 0; octave < NEBULA_OCTAVES; octave += 1) {
    octaves.push(createNoiseOctave(random, octave));
  }
  return octaves;
}

/** Samples one octave at normalized texture coordinates `u`, `v` ∈ [0, 1). */
function sampleOctave(octave: NoiseOctave, u: number, v: number): number {
  const { cellsX, cellsY, lattice } = octave;
  const x = u * cellsX;
  const y = v * cellsY;
  const x0 = Math.min(cellsX - 1, Math.floor(x));
  const y0 = Math.min(cellsY - 1, Math.floor(y));
  const tx = smoothStep01(x - x0);
  const ty = smoothStep01(y - y0);
  const row0 = y0 * (cellsX + 1);
  const row1 = row0 + cellsX + 1;
  const top = lattice[row0 + x0] * (1 - tx) + lattice[row0 + x0 + 1] * tx;
  const bottom = lattice[row1 + x0] * (1 - tx) + lattice[row1 + x0 + 1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * Builds the procedural nebula texture from the injected random source.
 *
 * Draw order: one uniform value per lattice point of each octave, octave 0 (coarsest)
 * through octave 3 (finest), row by row. The cloud density is the amplitude-weighted
 * four-octave sum; the band selector (purple → blue → pink, left → right) is warped by
 * the two lowest octaves so the colour regions have organic edges. Brightness follows
 * the density, with a small fine-octave shimmer and a dark base mixed into low-density
 * voids. Alpha is always 255.
 */
export function createNebulaTexture(random: () => number): DataTexture {
  const octaves = createNoiseOctaves(random);
  const data = new Uint8Array(NEBULA_WIDTH * NEBULA_HEIGHT * 4);
  const samples = new Float32Array(NEBULA_OCTAVES);

  for (let y = 0; y < NEBULA_HEIGHT; y += 1) {
    const v = (y + 0.5) / NEBULA_HEIGHT;
    for (let x = 0; x < NEBULA_WIDTH; x += 1) {
      const u = (x + 0.5) / NEBULA_WIDTH;

      let density = 0;
      let amplitude = 1;
      let amplitudeTotal = 0;
      for (let octave = 0; octave < NEBULA_OCTAVES; octave += 1) {
        const value = sampleOctave(octaves[octave], u, v);
        samples[octave] = value;
        density += value * amplitude;
        amplitudeTotal += amplitude;
        amplitude *= NEBULA_OCTAVE_FALLOFF;
      }
      density /= amplitudeTotal;

      const warp = samples[0] * 0.72 + samples[1] * 0.28;
      const band = clamp(
        u * NEBULA_BAND_COUNT +
          (warp - 0.5) * NEBULA_BAND_WARP_HORIZONTAL +
          (v - 0.5) * NEBULA_BAND_WARP_VERTICAL,
        0,
        NEBULA_BAND_COUNT,
      );

      // Triangular weights centred on the three palette families; only adjacent
      // families overlap, so the interior of each region keeps its stop's pinned hue.
      const purpleWeight = Math.max(0, 1 - Math.abs(band - 0.5));
      const blueWeight = Math.max(0, 1 - Math.abs(band - 1.5));
      const pinkWeight = Math.max(0, 1 - Math.abs(band - 2.5));
      const weightTotal = purpleWeight + blueWeight + pinkWeight;

      const familyRed =
        (NEBULA_PURPLE_RGB[0] * purpleWeight +
          NEBULA_BLUE_RGB[0] * blueWeight +
          NEBULA_PINK_RGB[0] * pinkWeight) /
        weightTotal;
      const familyGreen =
        (NEBULA_PURPLE_RGB[1] * purpleWeight +
          NEBULA_BLUE_RGB[1] * blueWeight +
          NEBULA_PINK_RGB[1] * pinkWeight) /
        weightTotal;
      const familyBlue =
        (NEBULA_PURPLE_RGB[2] * purpleWeight +
          NEBULA_BLUE_RGB[2] * blueWeight +
          NEBULA_PINK_RGB[2] * pinkWeight) /
        weightTotal;

      const glow = smoothStep01(
        (density - NEBULA_DENSITY_LOW) / (NEBULA_DENSITY_HIGH - NEBULA_DENSITY_LOW),
      );
      const fine = samples[2] * 0.6 + samples[3] * 0.4;
      const brightness =
        (NEBULA_BRIGHTNESS_FLOOR + (1 - NEBULA_BRIGHTNESS_FLOOR) * glow) *
        (0.86 + fine * 0.28);
      const darkness = NEBULA_DARKNESS_MAX * (1 - glow);
      const light = brightness * (1 - darkness);
      const highlight =
        NEBULA_HIGHLIGHT_MAX *
        smoothStep01((density - NEBULA_HIGHLIGHT_DENSITY) / (1 - NEBULA_HIGHLIGHT_DENSITY)) *
        (0.35 + 0.65 * fine);

      // Adding white per channel keeps the family hue and raises the green channel, so
      // every RGB channel has a wide, non-monochrome distribution.
      const red = familyRed * light + NEBULA_DARK_RGB[0] * darkness;
      const green = familyGreen * light + NEBULA_DARK_RGB[1] * darkness;
      const blue = familyBlue * light + NEBULA_DARK_RGB[2] * darkness;
      // The finest octave adds a gentle green chroma grain, which keeps the green
      // channel's distribution wide without moving any family hue out of its range.
      const greenChroma = (samples[3] - 0.5) * NEBULA_GREEN_CHROMA;

      const offset = (y * NEBULA_WIDTH + x) * 4;
      data[offset] = toByte(red + (255 - red) * highlight);
      data[offset + 1] = toByte(green + (255 - green) * highlight + greenChroma);
      data[offset + 2] = toByte(blue + (255 - blue) * highlight);
      data[offset + 3] = 255;
    }
  }

  const texture = new DataTexture(
    data,
    NEBULA_WIDTH,
    NEBULA_HEIGHT,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
