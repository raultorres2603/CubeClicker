import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  ACCENT,
  COIN_GOLD,
  HUD_BACKGROUND,
  HUD_TEXT,
  PAGE_BACKGROUND,
  PANEL_BACKGROUND_BOTTOM,
  PANEL_BACKGROUND_TOP,
  PANEL_BORDER,
  PANEL_GLOW,
  PANEL_RADIUS,
  UPGRADE_GREEN,
  USERS_BADGE_BOTTOM,
  USERS_BADGE_TOP,
} from './theme';

/** Brightest plausible nebula backdrop — the worst case for dark panel text (AC-19). */
const WHITE_BACKDROP = '#ffffff';

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

  it('pins the nine reference HUD tokens (AC-3)', () => {
    expect(PANEL_BACKGROUND_TOP).toBe('rgba(5, 11, 24, 0.86)');
    expect(PANEL_BACKGROUND_BOTTOM).toBe('rgba(10, 22, 44, 0.8)');
    expect(PANEL_BORDER).toBe('rgba(124, 246, 255, 0.62)');
    expect(PANEL_GLOW).toBe('rgba(124, 246, 255, 0.35)');
    expect(PANEL_RADIUS).toBe('1rem');
    expect(USERS_BADGE_TOP).toBe('#d63a2f');
    expect(USERS_BADGE_BOTTOM).toBe('#a51f1f');
    expect(COIN_GOLD).toBe('#ffcc66');
    expect(UPGRADE_GREEN).toBe('#16a34a');
  });

  it('keeps HUD text contrast >= 4.5 over both panel stops on black and white backdrops (AC-19)', () => {
    const cases = [
      { stop: PANEL_BACKGROUND_TOP, backdrop: PAGE_BACKGROUND, expected: 18.03 },
      { stop: PANEL_BACKGROUND_TOP, backdrop: WHITE_BACKDROP, expected: 12.49 },
      { stop: PANEL_BACKGROUND_BOTTOM, backdrop: PAGE_BACKGROUND, expected: 17.03 },
      { stop: PANEL_BACKGROUND_BOTTOM, backdrop: WHITE_BACKDROP, expected: 8.81 },
    ];

    for (const { stop, backdrop, expected } of cases) {
      const { color, alpha } = parseRgba(stop);
      const panel = composite(color, alpha, hexToRgb(backdrop));
      const ratio = contrastRatio(hexToRgb(HUD_TEXT), panel);

      // Exact pinned ratios: a token edit cannot silently slide towards the floor.
      expect(Math.round(ratio * 100) / 100).toBe(expected);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps #ffffff contrast >= 4.5 over both users-badge stops (AC-19)', () => {
    const cases = [
      { stop: USERS_BADGE_TOP, expected: 4.66 },
      { stop: USERS_BADGE_BOTTOM, expected: 7.46 },
    ];

    for (const { stop, expected } of cases) {
      const ratio = contrastRatio(hexToRgb(WHITE_BACKDROP), hexToRgb(stop));
      expect(Math.round(ratio * 100) / 100).toBe(expected);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the green buy-button surface at >= 3.0 non-text contrast against #ffffff (AC-19)', () => {
    const ratio = contrastRatio(hexToRgb(UPGRADE_GREEN), hexToRgb(WHITE_BACKDROP));
    expect(Math.round(ratio * 100) / 100).toBe(3.3);
    expect(ratio).toBeGreaterThanOrEqual(3.0);
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