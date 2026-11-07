import {
  DataTexture,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { describe, expect, it } from 'vitest';

import {
  createNebulaTexture,
  NEBULA_BLUE,
  NEBULA_DARK,
  NEBULA_HEIGHT,
  NEBULA_HUE_RANGES,
  NEBULA_MIN_CHANNEL_VARIANCE,
  NEBULA_MIN_HUE_PIXELS,
  NEBULA_OCTAVES,
  NEBULA_PINK,
  NEBULA_PURPLE,
  NEBULA_WIDTH,
} from './nebula';

type Rgb = readonly [number, number, number];

interface Hsl {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

/** Deterministic LCG (same seed → same stream), mirroring the engine's seeded sources. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Random source counting how many draws a consumer takes. */
function countingRandom(source: () => number): { random: () => number; calls: () => number } {
  let calls = 0;
  return {
    random: () => {
      calls += 1;
      return source();
    },
    calls: () => calls,
  };
}

/** Reads the texture's backing bytes, failing loudly if the data is missing. */
function textureBytes(texture: DataTexture): Uint8Array {
  const data = texture.image.data;
  if (!(data instanceof Uint8Array)) {
    throw new Error('nebula texture data must be a Uint8Array');
  }
  return data;
}

/** Standard RGB (0–255) → HSL conversion, independent of the module under test. */
function rgbToHsl([red8, green8, blue8]: Rgb): Hsl {
  const red = red8 / 255;
  const green = green8 / 255;
  const blue = blue8 / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) {
    hue += 360;
  }
  return { hue, saturation, lightness };
}

function countPixelsInHueRange(
  data: Uint8Array,
  range: readonly [number, number],
): number {
  let count = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const hsl = rgbToHsl([data[offset], data[offset + 1], data[offset + 2]]);
    const inRange = hsl.hue >= range[0] && hsl.hue <= range[1];
    const saturated = hsl.saturation >= 0.35;
    const lit = hsl.lightness >= 0.15 && hsl.lightness <= 0.85;
    if (inRange && saturated && lit) {
      count += 1;
    }
  }
  return count;
}

function channelVariance(data: Uint8Array, channel: number): number {
  let sum = 0;
  let count = 0;
  for (let offset = channel; offset < data.length; offset += 4) {
    sum += data[offset];
    count += 1;
  }
  const mean = sum / count;
  let squaredDeviation = 0;
  for (let offset = channel; offset < data.length; offset += 4) {
    const deviation = data[offset] - mean;
    squaredDeviation += deviation * deviation;
  }
  return squaredDeviation / count;
}

describe('nebula constants (AC-9)', () => {
  it('pins the texture dimensions and octave count', () => {
    expect(NEBULA_WIDTH).toBe(256);
    expect(NEBULA_HEIGHT).toBe(128);
    expect(NEBULA_OCTAVES).toBe(4);
  });

  it('pins the palette stops', () => {
    expect(NEBULA_PURPLE).toBe(0x5b21b6);
    expect(NEBULA_BLUE).toBe(0x1d4ed8);
    expect(NEBULA_PINK).toBe(0xdb2777);
    expect(NEBULA_DARK).toBe(0x070a1a);
  });

  it('pins the hue ranges and evidence thresholds', () => {
    expect(NEBULA_HUE_RANGES).toEqual({
      purple: [250, 280],
      blue: [205, 240],
      pink: [310, 345],
    });
    expect(NEBULA_MIN_HUE_PIXELS).toBe(100);
    expect(NEBULA_MIN_CHANNEL_VARIANCE).toBe(100);
  });

  it('places every exported stop inside its pinned hue range', () => {
    const purple = rgbToHsl([(NEBULA_PURPLE >> 16) & 0xff, (NEBULA_PURPLE >> 8) & 0xff, NEBULA_PURPLE & 0xff]);
    const blue = rgbToHsl([(NEBULA_BLUE >> 16) & 0xff, (NEBULA_BLUE >> 8) & 0xff, NEBULA_BLUE & 0xff]);
    const pink = rgbToHsl([(NEBULA_PINK >> 16) & 0xff, (NEBULA_PINK >> 8) & 0xff, NEBULA_PINK & 0xff]);

    expect(purple.hue).toBeGreaterThanOrEqual(NEBULA_HUE_RANGES.purple[0]);
    expect(purple.hue).toBeLessThanOrEqual(NEBULA_HUE_RANGES.purple[1]);
    expect(blue.hue).toBeGreaterThanOrEqual(NEBULA_HUE_RANGES.blue[0]);
    expect(blue.hue).toBeLessThanOrEqual(NEBULA_HUE_RANGES.blue[1]);
    expect(pink.hue).toBeGreaterThanOrEqual(NEBULA_HUE_RANGES.pink[0]);
    expect(pink.hue).toBeLessThanOrEqual(NEBULA_HUE_RANGES.pink[1]);
    expect(purple.saturation).toBeGreaterThanOrEqual(0.35);
    expect(blue.saturation).toBeGreaterThanOrEqual(0.35);
    expect(pink.saturation).toBeGreaterThanOrEqual(0.35);
  });
});

describe('createNebulaTexture (AC-9)', () => {
  it('returns an RGBA DataTexture with the pinned dimensions, format, filters and colour space', () => {
    const texture = createNebulaTexture(seededRandom(1));
    const data = textureBytes(texture);

    expect(texture).toBeInstanceOf(DataTexture);
    expect(texture.image.width).toBe(NEBULA_WIDTH);
    expect(texture.image.height).toBe(NEBULA_HEIGHT);
    expect(texture.image.width).toBe(256);
    expect(texture.image.height).toBe(128);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(NEBULA_WIDTH * NEBULA_HEIGHT * 4);
    expect(data.length).toBe(131072);
    expect(texture.format).toBe(RGBAFormat);
    expect(texture.type).toBe(UnsignedByteType);
    expect(texture.minFilter).toBe(LinearFilter);
    expect(texture.magFilter).toBe(LinearFilter);
    expect(texture.colorSpace).toBe(SRGBColorSpace);
    expect(texture.version).toBe(1);
  });

  it('draws its lattice from the injected random source (four octaves)', () => {
    const counter = countingRandom(seededRandom(3));
    createNebulaTexture(counter.random);

    // Octave cell grids 4×2, 8×4, 16×8 and 32×16: (5×3) + (9×5) + (17×9) + (33×17) draws.
    expect(counter.calls()).toBe(774);
  });

  it('produces identical bytes for the same random sequence', () => {
    const first = textureBytes(createNebulaTexture(seededRandom(42)));
    const second = textureBytes(createNebulaTexture(seededRandom(42)));

    expect(second).toEqual(first);
  });

  it('produces differing bytes for different random sequences', () => {
    const first = textureBytes(createNebulaTexture(seededRandom(1)));
    const second = textureBytes(createNebulaTexture(seededRandom(2)));

    let differingBytes = 0;
    for (let index = 0; index < first.length; index += 1) {
      if (first[index] !== second[index]) {
        differingBytes += 1;
      }
    }
    expect(differingBytes).toBeGreaterThan(0);
  });

  it('sets alpha to 255 on every pixel', () => {
    const data = textureBytes(createNebulaTexture(seededRandom(7)));

    let opaquePixels = 0;
    for (let offset = 3; offset < data.length; offset += 4) {
      if (data[offset] === 255) {
        opaquePixels += 1;
      }
    }
    expect(opaquePixels).toBe(NEBULA_WIDTH * NEBULA_HEIGHT);
    expect(opaquePixels).toBe(32768);
  });

  it('keeps every RGB channel above the pinned variance (not monochrome)', () => {
    const data = textureBytes(createNebulaTexture(seededRandom(11)));

    expect(channelVariance(data, 0)).toBeGreaterThan(NEBULA_MIN_CHANNEL_VARIANCE);
    expect(channelVariance(data, 1)).toBeGreaterThan(NEBULA_MIN_CHANNEL_VARIANCE);
    expect(channelVariance(data, 2)).toBeGreaterThan(NEBULA_MIN_CHANNEL_VARIANCE);
  });

  it('contains enough saturated purple, blue and pink pixels in their pinned hue ranges', () => {
    const data = textureBytes(createNebulaTexture(seededRandom(13)));

    const purplePixels = countPixelsInHueRange(data, NEBULA_HUE_RANGES.purple);
    const bluePixels = countPixelsInHueRange(data, NEBULA_HUE_RANGES.blue);
    const pinkPixels = countPixelsInHueRange(data, NEBULA_HUE_RANGES.pink);

    expect(purplePixels).toBeGreaterThanOrEqual(NEBULA_MIN_HUE_PIXELS);
    expect(bluePixels).toBeGreaterThanOrEqual(NEBULA_MIN_HUE_PIXELS);
    expect(pinkPixels).toBeGreaterThanOrEqual(NEBULA_MIN_HUE_PIXELS);
  });
});
