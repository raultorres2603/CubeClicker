// Deterministic brand-asset generator for the verification email.
//
// The game ships no logo (its visuals are procedural three.js), so the two email
// images are authored here, pixel by pixel, and committed as build artifacts:
//
//   src/frontend/public/email/cubeclicker-hero.png  600x200  starfield + cube + wordmark
//   src/frontend/public/email/cubeclicker-cube.png    72x72  footer cube mark
//
// Constraints (spec AC-17(a) and AC-21):
// - Node built-ins only: no npm dependency, no network, no rasterizer.
// - Deterministic: the PRNG seed, geometry, 5x7 bitmap font, palette and zlib
//   level are pinned, so two runs produce byte-identical PNGs.
// - Only the eight pinned palette colours may reach encoded pixels. "Glow" and
//   edge softness are simulated with ordered (Bayer) dithering between palette
//   colours instead of alpha blending, which keeps the palette contract exact.
//
// Usage:
//   node src/frontend/scripts/generate-email-assets.mjs           # write both PNGs
//   node src/frontend/scripts/generate-email-assets.mjs --check   # verify SHA-256 only
//
// `--check` regenerates in memory and compares each SHA-256 with the committed
// file (exit 0 only when every asset is byte-identical). The script is never
// imported by the app and is not part of `npm run build`; it is an authoring tool.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { deflateSync } from 'node:zlib';

/**
 * The pinned asset palette. These eight literals are the only colours the script
 * may emit; `ASSET_PALETTE` is the single source of truth for both the drawing
 * code and the post-render palette assertion.
 *
 * `void`, `emerald`, `cyan` and `text` are game literals from
 * `src/frontend/src/ui/theme.ts` / `app.css`. `surface` and `metallic` are the
 * email-safe opaque solids used by the template. `emeraldMid`/`emeraldDark` are
 * shading derivations of the emerald body so the isometric cube reads as
 * three flat-shaded faces.
 */
export const ASSET_PALETTE = Object.freeze({
  /** Void backdrop — game literal `#04060d`. */
  void: '#04060d',
  /** Opaque panel surface — email-safe solid for the game's translucent glass. */
  surface: '#0a1222',
  /** Emerald cube body (light face) — game literal `#34d399`. */
  emerald: '#34d399',
  /** Emerald cube left face, a darker shading derivation. */
  emeraldMid: '#2a9e78',
  /** Emerald cube right face, the darkest shading derivation. */
  emeraldDark: '#1f7a5c',
  /** Neon cyan rim, wordmark and accent stars — game literal `#7cf6ff`. */
  cyan: '#7cf6ff',
  /** Bright star / tagline text colour — game literal `#e8f6ff`. */
  text: '#e8f6ff',
  /** Metallic slate: glow ramp, starfield dust and wordmark shadow. */
  metallic: '#2b4a63',
});

/** Pinned PRNG seed for the starfield. Changing it changes the committed bytes. */
const STARFIELD_SEED = 0x5eed1a2b;

/** Pinned zlib level. Filter 0 (None) on every scanline keeps the encoder trivial. */
const ZLIB_LEVEL = 9;

/** PNG truecolour (type 2) signature — the only image format the email allows. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Hero geometry. The cube is an isometric hexagonal projection centred in the
 * left third; the wordmark lockup occupies the right two thirds. Both are pinned
 * integers so the output never depends on a viewport or a font metric.
 */
const HERO = Object.freeze({
  label: 'src/frontend/public/email/cubeclicker-hero.png',
  url: new URL('../public/email/cubeclicker-hero.png', import.meta.url),
  width: 600,
  height: 200,
  /** 60 KiB = 61,440 bytes (AC-17(a)). */
  maxBytes: 60 * 1024,
  starCount: 170,
  cube: Object.freeze({ cx: 140, cy: 100, radius: 80 }),
  glow: Object.freeze({ cx: 140, cy: 100, rx: 152, ry: 122 }),
  wordmark: Object.freeze({ text: 'CUBECLICKER', x: 248, y: 60, scale: 5 }),
  rule: Object.freeze({ x: 248, y: 108, width: 325, height: 2, accentWidth: 72 }),
  tagline: Object.freeze({ text: 'AN ONLINE CUBE-CLICKING GAME', y: 124, scale: 2 }),
  /**
   * Stars are suppressed inside this rectangle so no bright pixel lands in a
   * glyph counter (e.g. the holes in B/R) or between letters.
   */
  textKeepOut: Object.freeze({ x: 238, y: 48, width: 350, height: 100 }),
});

/**
 * Footer mark geometry: the same cube at 26px circumradius, on the template's
 * opaque surface colour so it blends into the footer panel in the email.
 */
const CUBE_MARK = Object.freeze({
  label: 'src/frontend/public/email/cubeclicker-cube.png',
  url: new URL('../public/email/cubeclicker-cube.png', import.meta.url),
  width: 72,
  height: 72,
  /** 15 KiB = 15,360 bytes (AC-17(a)). */
  maxBytes: 15 * 1024,
  starCount: 6,
  cube: Object.freeze({ cx: 36, cy: 36, radius: 26 }),
  /** Tighter halo than the hero: the mark should tile cleanly at 72px. */
  glow: Object.freeze({ cx: 36, cy: 36, rx: 34, ry: 32 }),
});

/**
 * Classic 5x7 bitmap font. Every glyph is exactly 7 rows of 5 bits, drawn with
 * integer rectangles only — no anti-aliasing, so glyphs stay crisp at any
 * integer scale. Only the characters used by the pinned strings are defined
 * (A-Z, space, hyphen); `assertFontIntegrity` fails loudly on drift.
 */
const FONT_5X7 = Object.freeze({
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
});

/**
 * 8x8 ordered-dither matrix (Bayer). An 8x8 pattern reads as a finer, less
 * patterned haze at 1x than a 4x4 one, which matters for the 72px footer mark.
 */
const BAYER_8X8 = Object.freeze([
  Object.freeze([0, 32, 8, 40, 2, 34, 10, 42]),
  Object.freeze([48, 16, 56, 24, 50, 18, 58, 26]),
  Object.freeze([12, 44, 4, 36, 14, 46, 6, 38]),
  Object.freeze([60, 28, 52, 20, 62, 30, 54, 22]),
  Object.freeze([3, 35, 11, 43, 1, 33, 9, 41]),
  Object.freeze([51, 19, 59, 27, 49, 17, 57, 25]),
  Object.freeze([15, 47, 7, 39, 13, 45, 5, 37]),
  Object.freeze([63, 31, 55, 23, 61, 29, 53, 21]),
]);

/** Resolve a palette name to an `[r, g, b]` triple; unknown names are a bug. */
function colorOf(name) {
  const hex = ASSET_PALETTE[name];
  if (hex === undefined) throw new Error(`unknown palette colour ${JSON.stringify(name)}`);
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Cached RGB triples so the hot pixel loops do not re-parse hex strings. */
const PALETTE_RGB = Object.freeze(
  Object.fromEntries(Object.entries(ASSET_PALETTE).map(([name, hex]) => [name, colorOf(name)])),
);

/** Ordered-dither threshold in `[0, 1)` for a pixel. */
function ditherThreshold(x, y) {
  return (BAYER_8X8[y & 7][x & 7] + 0.5) / 64;
}

/**
 * Minimal RGB raster. All writes go through a palette name, which is what makes
 * the "pinned palette only" guarantee mechanical rather than aspirational.
 */
class Raster {
  constructor(width, height, background) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 3);
    this.fill(background);
  }

  fill(colorName) {
    const [r, g, b] = PALETTE_RGB[colorName];
    for (let offset = 0; offset < this.pixels.length; offset += 3) {
      this.pixels[offset] = r;
      this.pixels[offset + 1] = g;
      this.pixels[offset + 2] = b;
    }
  }

  set(x, y, colorName) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b] = PALETTE_RGB[colorName];
    const offset = (y * this.width + x) * 3;
    this.pixels[offset] = r;
    this.pixels[offset + 1] = g;
    this.pixels[offset + 2] = b;
  }

  fillRect(x, y, width, height, colorName) {
    const left = Math.max(0, Math.round(x));
    const top = Math.max(0, Math.round(y));
    const right = Math.min(this.width, Math.round(x + width));
    const bottom = Math.min(this.height, Math.round(y + height));
    for (let row = top; row < bottom; row += 1) {
      for (let column = left; column < right; column += 1) this.set(column, row, colorName);
    }
  }

  /**
   * Even-odd scanline fill sampled at pixel centres (`y + 0.5`). Faces are
   * filled over a hexagon base first, so the shared diagonals cannot leave a
   * one-pixel seam; the cyan rim is drawn on top of the joins.
   */
  fillPolygon(points, colorName) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const firstRow = Math.max(0, Math.floor(minY));
    const lastRow = Math.min(this.height - 1, Math.ceil(maxY));
    for (let y = firstRow; y <= lastRow; y += 1) {
      const scanline = y + 0.5;
      const crossings = [];
      for (let index = 0; index < points.length; index += 1) {
        const [x0, y0] = points[index];
        const [x1, y1] = points[(index + 1) % points.length];
        if ((y0 <= scanline && y1 > scanline) || (y1 <= scanline && y0 > scanline)) {
          crossings.push(x0 + ((scanline - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      crossings.sort((left, right) => left - right);
      for (let index = 0; index + 1 < crossings.length; index += 2) {
        const start = Math.max(0, Math.ceil(crossings[index] - 0.5));
        const end = Math.min(this.width - 1, Math.ceil(crossings[index + 1] - 0.5) - 1);
        for (let x = start; x <= end; x += 1) this.set(x, y, colorName);
      }
    }
  }

  /** Bresenham line with a square brush; thickness is an integer pixel count. */
  drawLine(x0, y0, x1, y1, colorName, thickness = 1) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const endX = Math.round(x1);
    const endY = Math.round(y1);
    const deltaX = Math.abs(endX - x);
    const deltaY = Math.abs(endY - y);
    const stepX = x < endX ? 1 : -1;
    const stepY = y < endY ? 1 : -1;
    const brushOffset = Math.floor((thickness - 1) / 2);
    let error = deltaX - deltaY;
    for (;;) {
      this.fillRect(x - brushOffset, y - brushOffset, thickness, thickness, colorName);
      if (x === endX && y === endY) return;
      const doubled = 2 * error;
      if (doubled > -deltaY) {
        error -= deltaY;
        x += stepX;
      }
      if (doubled < deltaX) {
        error += deltaX;
        y += stepY;
      }
    }
  }
}

/** Deterministic 32-bit PRNG (mulberry32). Same seed → same starfield forever. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Width in pixels of a 5x7 string at an integer scale with a one-cell gap. */
function textWidth(text, scale) {
  if (text.length === 0) return 0;
  return (text.length * 5 + (text.length - 1)) * scale;
}

/**
 * Paint a string with the 5x7 font. Every set bit becomes a `scale`x`scale`
 * rectangle, so edges are axis-aligned and the glyphs never blur or corrupt.
 */
function drawText(raster, text, x, y, scale, colorName) {
  let cursor = Math.round(x);
  for (const char of text) {
    const rows = FONT_5X7[char];
    if (rows === undefined) throw new Error(`5x7 font has no glyph for ${JSON.stringify(char)}`);
    for (let row = 0; row < rows.length; row += 1) {
      for (let column = 0; column < rows[row].length; column += 1) {
        if (rows[row][column] === '1') {
          raster.fillRect(cursor + column * scale, y + row * scale, scale, scale, colorName);
        }
      }
    }
    cursor += 6 * scale;
  }
}

/** Fail loudly if a font row is malformed or a pinned string uses an unknown glyph. */
function assertFontIntegrity() {
  for (const [char, rows] of Object.entries(FONT_5X7)) {
    if (rows.length !== 7) throw new Error(`glyph ${JSON.stringify(char)} must have 7 rows`);
    for (const row of rows) {
      if (!/^[01]{5}$/.test(row)) {
        throw new Error(`glyph ${JSON.stringify(char)} has a malformed row ${JSON.stringify(row)}`);
      }
    }
  }
  for (const text of [HERO.wordmark.text, HERO.tagline.text]) {
    for (const char of text) {
      if (FONT_5X7[char] === undefined) {
        throw new Error(`pinned text needs a glyph for ${JSON.stringify(char)}`);
      }
    }
  }
}

/**
 * Dithered radial glow between palette ramp stops. A pixel's intensity selects
 * a fractional position in the ramp, and the Bayer threshold decides whether it
 * takes the higher stop — a smooth-looking halo built only from palette colours.
 */
function drawGlow(raster, glow, ramp) {
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      const nx = (x + 0.5 - glow.cx) / glow.rx;
      const ny = (y + 0.5 - glow.cy) / glow.ry;
      const distance = Math.hypot(nx, ny);
      if (distance >= 1) continue;
      const level = (1 - distance) ** 1.7 * (ramp.length - 1);
      const lower = Math.min(ramp.length - 1, Math.floor(level));
      const upper = Math.min(ramp.length - 1, lower + 1);
      const fraction = level - lower;
      const colorName = fraction > ditherThreshold(x, y) ? ramp[upper] : ramp[lower];
      raster.set(x, y, colorName);
    }
  }
}

/** One bright star: a 2x2 white core with four short cyan sparkle arms. */
function drawSparkle(raster, x, y) {
  raster.fillRect(x, y, 2, 2, 'text');
  raster.set(x - 1, y, 'cyan');
  raster.set(x + 2, y, 'cyan');
  raster.set(x + 1, y - 1, 'cyan');
  raster.set(x + 1, y + 2, 'cyan');
}

/**
 * Deterministic starfield: dim metallic dust, cyan and white singles, and a
 * bounded number of bright sparkles. Stars inside the text lockup are skipped
 * so the wordmark stays clean; the cube is drawn later and covers its own area.
 */
function drawStarfield(raster, { seed, count, keepOut }) {
  const random = mulberry32(seed);
  let sparklesLeft = 6;
  for (let index = 0; index < count; index += 1) {
    const x = Math.floor(random() * raster.width);
    const y = Math.floor(random() * raster.height);
    const roll = random();
    if (
      keepOut !== undefined &&
      x >= keepOut.x &&
      x < keepOut.x + keepOut.width &&
      y >= keepOut.y &&
      y < keepOut.y + keepOut.height
    ) {
      continue;
    }
    if (roll < 0.05 && sparklesLeft > 0) {
      sparklesLeft -= 1;
      drawSparkle(raster, x, y);
    } else if (roll < 0.3) {
      raster.set(x, y, 'cyan');
    } else if (roll < 0.45) {
      raster.set(x, y, 'text');
    } else {
      raster.set(x, y, 'metallic');
      if (random() < 0.2) raster.set(x + 1, y, 'metallic');
    }
  }
}

/** Six silhouette vertices plus the centre of a regular isometric hexagon. */
function isometricCube(cx, cy, radius) {
  const halfWidth = (Math.sqrt(3) / 2) * radius;
  return {
    top: [cx, cy - radius],
    upperRight: [cx + halfWidth, cy - radius / 2],
    lowerRight: [cx + halfWidth, cy + radius / 2],
    bottom: [cx, cy + radius],
    lowerLeft: [cx - halfWidth, cy + radius / 2],
    upperLeft: [cx - halfWidth, cy - radius / 2],
    center: [cx, cy],
  };
}

/**
 * Flat-shaded isometric cube with a cyan neon rim.
 *
 * A regular hexagon is the isometric projection of a cube; filling the whole
 * hexagon with the darkest emerald first guarantees there is no seam between
 * the three rhombic faces. The top face is the lightest, the left face mid, the
 * right face dark, and the "Y" internal edges are painted last in cyan.
 */
function drawCube(raster, cube) {
  const { top, upperRight, lowerRight, bottom, lowerLeft, upperLeft, center } = cube;
  const silhouette = [top, upperRight, lowerRight, bottom, lowerLeft, upperLeft, top];

  raster.fillPolygon([top, upperRight, lowerRight, bottom, lowerLeft, upperLeft], 'emeraldDark');
  raster.fillPolygon([top, upperRight, center, upperLeft], 'emerald');
  raster.fillPolygon([upperLeft, center, bottom, lowerLeft], 'emeraldMid');

  // A one-pixel metallic fringe under the cyan keeps the rim from clipping hard
  // into the background; the cyan itself is the neon light.
  for (let index = 0; index + 1 < silhouette.length; index += 1) {
    const [x0, y0] = silhouette[index];
    const [x1, y1] = silhouette[index + 1];
    raster.drawLine(x0, y0, x1, y1, 'metallic', 4);
  }
  for (let index = 0; index + 1 < silhouette.length; index += 1) {
    const [x0, y0] = silhouette[index];
    const [x1, y1] = silhouette[index + 1];
    raster.drawLine(x0, y0, x1, y1, 'cyan', 2);
  }
  for (const [x, y] of [upperRight, upperLeft, bottom]) {
    raster.drawLine(center[0], center[1], x, y, 'metallic', 3);
    raster.drawLine(center[0], center[1], x, y, 'cyan', 1);
  }
}

/** The 600x200 hero: void → dithered glow → stars → cube → wordmark lockup. */
function renderHero() {
  const raster = new Raster(HERO.width, HERO.height, 'void');
  drawGlow(raster, HERO.glow, ['void', 'surface', 'metallic']);
  drawStarfield(raster, {
    seed: STARFIELD_SEED,
    count: HERO.starCount,
    keepOut: HERO.textKeepOut,
  });
  drawCube(raster, isometricCube(HERO.cube.cx, HERO.cube.cy, HERO.cube.radius));

  const { wordmark, rule, tagline } = HERO;
  // Metallic drop shadow offset by 3px gives the cyan wordmark depth without
  // introducing any colour outside the palette.
  drawText(raster, wordmark.text, wordmark.x + 3, wordmark.y + 3, wordmark.scale, 'metallic');
  drawText(raster, wordmark.text, wordmark.x, wordmark.y, wordmark.scale, 'cyan');

  raster.fillRect(rule.x, rule.y, rule.width, rule.height, 'metallic');
  raster.fillRect(rule.x, rule.y, rule.accentWidth, rule.height, 'cyan');

  const taglineWidth = textWidth(tagline.text, tagline.scale);
  const taglineX = rule.x + Math.round((rule.width - taglineWidth) / 2);
  drawText(raster, tagline.text, taglineX, tagline.y, tagline.scale, 'text');
  return raster;
}

/** The 72x72 footer mark: the same cube, tighter, on the email surface colour. */
function renderCubeMark() {
  const raster = new Raster(CUBE_MARK.width, CUBE_MARK.height, 'surface');
  drawGlow(raster, CUBE_MARK.glow, ['surface', 'metallic']);
  drawStarfield(raster, { seed: STARFIELD_SEED ^ 0x9e3779b9, count: CUBE_MARK.starCount });
  drawCube(raster, isometricCube(CUBE_MARK.cube.cx, CUBE_MARK.cube.cy, CUBE_MARK.cube.radius));
  return raster;
}

/** Throw if any rendered pixel is not one of the eight pinned palette colours. */
function assertPaletteOnly(raster, label) {
  const allowed = new Set(Object.values(PALETTE_RGB).map(([r, g, b]) => `${r},${g},${b}`));
  const { pixels } = raster;
  for (let offset = 0; offset < pixels.length; offset += 3) {
    const key = `${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`;
    if (!allowed.has(key)) {
      const x = (offset / 3) % raster.width;
      const y = Math.floor(offset / 3 / raster.width);
      throw new Error(`${label} pixel ${x},${y} uses off-palette colour rgb(${key})`);
    }
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

/**
 * Encode a raster as an 8-bit truecolour PNG: every scanline uses filter 0
 * (None) and the single IDAT stream is deflated at the pinned zlib level.
 */
function encodePng(raster) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(raster.width, 0);
  header.writeUInt32BE(raster.height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour RGB
  header[10] = 0; // compression: deflate
  header[11] = 0; // filter method: adaptive
  header[12] = 0; // interlace: none

  const stride = raster.width * 3;
  const raw = Buffer.alloc((stride + 1) * raster.height);
  for (let y = 0; y < raster.height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter 0 (None)
    Buffer.from(raster.pixels.buffer, raster.pixels.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }
  const imageData = deflateSync(raw, { level: ZLIB_LEVEL });
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', imageData),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function main() {
  const check = process.argv.slice(2).includes('--check');
  const assets = [
    { spec: HERO, render: renderHero },
    { spec: CUBE_MARK, render: renderCubeMark },
  ];

  let failures = 0;
  for (const { spec, render } of assets) {
    const raster = render();
    assertPaletteOnly(raster, spec.label);
    const png = encodePng(raster);
    const hash = sha256(png);

    if (png.byteLength > spec.maxBytes) {
      console.error(
        `FAIL ${spec.label} ${png.byteLength} B exceeds the ${spec.maxBytes} B budget`,
      );
      failures += 1;
      continue;
    }

    if (check) {
      let committed;
      try {
        committed = readFileSync(spec.url);
      } catch {
        console.error(`MISSING ${spec.label} (run the generator without --check to create it)`);
        failures += 1;
        continue;
      }
      const committedHash = sha256(committed);
      if (committedHash === hash) {
        console.log(`PASS ${spec.label} ${png.byteLength} B ${hash}`);
      } else {
        console.error(
          `MISMATCH ${spec.label}: generated ${hash} (${png.byteLength} B) != committed ${committedHash} (${committed.byteLength} B)`,
        );
        failures += 1;
      }
    } else {
      mkdirSync(new URL('../public/email/', import.meta.url), { recursive: true });
      writeFileSync(spec.url, png);
      console.log(
        `WROTE ${spec.label} ${spec.width}x${spec.height} ${png.byteLength} B ${hash}`,
      );
    }
  }

  if (check) {
    console.log(
      failures === 0
        ? `email assets: ${assets.length}/${assets.length} OK`
        : `email assets: ${failures} failure(s)`,
    );
  } else if (failures === 0) {
    console.log(`email assets: wrote ${assets.length} files`);
  }
  process.exitCode = failures === 0 ? 0 : 1;
}

assertFontIntegrity();
main();
