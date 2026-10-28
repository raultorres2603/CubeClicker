import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ACCENT, HUD_BACKGROUND, HUD_TEXT, PAGE_BACKGROUND } from './theme';

/**
 * WCAG 2.x contrast gate for the HUD (AC-14) — computed from the exported constants, so
 * changing a colour without re-checking the ratio fails here instead of shipping
 * unreadable text.
 *
 * The HUD panel is translucent: its effective colour is the panel fill composited over
 * the page background (black under the starfield), which is what a player actually sees.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

function parseRgba(rgba: string): { color: Rgb; alpha: number } {
  const match = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(rgba);
  if (match === null) {
    throw new Error(`theme.test.ts: not an rgba() colour: ${rgba}`);
  }
  return {
    color: { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) },
    alpha: Number(match[4]),
  };
}

/** Source-over compositing of a translucent fill on an opaque backdrop. */
function composite(overlay: Rgb, alpha: number, backdrop: Rgb): Rgb {
  return {
    r: overlay.r * alpha + backdrop.r * (1 - alpha),
    g: overlay.g * alpha + backdrop.g * (1 - alpha),
    b: overlay.b * alpha + backdrop.b * (1 - alpha),
  };
}

function linearChannel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function readCssVar(name: string): string {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
  const match = css.match(new RegExp(`${name.replace(/[-]/g, '\\-')}:\\s*([^;]+);`));
  if (match === null) {
    throw new Error(`theme.test.ts: css var ${name} not found`);
  }
  return match[1].trim();
}

describe('HUD theme', () => {
  it('pins the exact theme colours', () => {
    expect(HUD_TEXT).toBe('#e8f6ff');
    expect(HUD_BACKGROUND).toBe('rgba(6, 10, 20, 0.72)');
    expect(ACCENT).toBe('#7cf6ff');
    expect(PAGE_BACKGROUND).toBe('#000000');
  });

  it('keeps HUD text at WCAG AA contrast over the composited HUD panel', () => {
    const { color, alpha } = parseRgba(HUD_BACKGROUND);
    const panel = composite(color, alpha, hexToRgb(PAGE_BACKGROUND));
    const ratio = contrastRatio(hexToRgb(HUD_TEXT), panel);

    // Exact value for the pinned pair (18.2648…), so an unnoticed colour change fails.
    expect(Math.round(ratio * 100) / 100).toBe(18.26);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps HUD text contrast >= 12 over the frame center (AC-17)', () => {
    const { color, alpha } = parseRgba(readCssVar('--frame-center-top'));
    const center = composite(color, alpha, hexToRgb(PAGE_BACKGROUND));
    const ratio = contrastRatio(hexToRgb(HUD_TEXT), center);
    expect(ratio).toBeGreaterThanOrEqual(12);
  });

  it('keeps HUD text contrast >= 12 over both alert center stops (AC-22)', () => {
    for (const name of ['--frame-center-alert-start', '--frame-center-alert-end']) {
      const { color, alpha } = parseRgba(readCssVar(name));
      const center = composite(color, alpha, hexToRgb(PAGE_BACKGROUND));
      const ratio = contrastRatio(hexToRgb(HUD_TEXT), center);
      expect(ratio).toBeGreaterThanOrEqual(12);
    }
  });

  it('keeps #ffb4b4 contrast >= 4.5 over both alert center stops (AC-22)', () => {
    for (const name of ['--frame-center-alert-start', '--frame-center-alert-end']) {
      const { color, alpha } = parseRgba(readCssVar(name));
      const center = composite(color, alpha, hexToRgb(PAGE_BACKGROUND));
      const ratio = contrastRatio(hexToRgb('#ffb4b4'), center);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps HUD text contrast >= 4.5 over the input well (AC-22)', () => {
    const { color: centerColor, alpha: centerAlpha } = parseRgba(readCssVar('--frame-center-top'));
    const center = composite(centerColor, centerAlpha, hexToRgb(PAGE_BACKGROUND));
    const { color: wellColor, alpha: wellAlpha } = parseRgba('rgba(0, 0, 0, 0.42)');
    const well = composite(wellColor, wellAlpha, center);
    const ratio = contrastRatio(hexToRgb(HUD_TEXT), well);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps disabled text at 0.62 alpha contrast >= 4.5 over the frame center (AC-23)', () => {
    const { color: centerColor, alpha: centerAlpha } = parseRgba(readCssVar('--frame-center-top'));
    const center = composite(centerColor, centerAlpha, hexToRgb(PAGE_BACKGROUND));
    const disabledText = composite(hexToRgb(HUD_TEXT), 0.62, center);
    const ratio = contrastRatio(disabledText, center);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});