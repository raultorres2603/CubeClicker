import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { REVEAL_RARITY_HEX } from '../game/reveal-motion';
import {
  ACCENT,
  COIN_GOLD,
  GF_AMBER,
  GF_AMBER_DEEP,
  GF_CTA_TEXT,
  GF_DANGER,
  GF_EPIC,
  GF_RARE,
  GF_SUCCESS,
  GF_SURFACE_BOTTOM,
  GF_SURFACE_TOP,
  GF_TEXT,
  GF_TEXT_MUTED,
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

/** Rounded contrast ratio: a token edit cannot silently slide towards the floor. */
function rounded(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

/** One translated surface, composited over black and white backdrops. */
function surfaceOver(stop: string, backdrop: string): Rgb {
  const { color, alpha } = parseRgba(stop);
  return composite(color, alpha, hexToRgb(backdrop));
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

  it('pins the Neon Forge exports and keeps GF_TEXT identical to HUD_TEXT (AC-17)', () => {
    expect(GF_SURFACE_TOP).toBe('rgba(10, 18, 34, 0.94)');
    expect(GF_SURFACE_BOTTOM).toBe('rgba(5, 10, 20, 0.9)');
    expect(GF_TEXT).toBe('#e8f6ff');
    expect(GF_TEXT).toBe(HUD_TEXT);
    expect(GF_TEXT_MUTED).toBe('rgba(232, 246, 255, 0.76)');
    expect(GF_RARE).toBe('#60a5fa');
    expect(GF_EPIC).toBe('#c084fc');
    expect(GF_AMBER).toBe('#ffb35c');
    expect(GF_AMBER_DEEP).toBe('#ff7a1a');
    expect(GF_CTA_TEXT).toBe('#1a1206');
    expect(GF_DANGER).toBe('#ff6b6b');
    expect(GF_SUCCESS).toBe('#34d399');
  });

  it('takes the rarity channels from REVEAL_RARITY_HEX', () => {
    expect(GF_RARE).toBe(REVEAL_RARITY_HEX.rare);
    expect(GF_EPIC).toBe(REVEAL_RARITY_HEX.epic);
    expect(REVEAL_RARITY_HEX).toEqual({ rare: '#60a5fa', epic: '#c084fc' });
  });

  it('mirrors each exported GF_* constant in the app.css :root block', () => {
    const mirrors: ReadonlyArray<readonly [string, string]> = [
      ['--gf-surface-top', GF_SURFACE_TOP],
      ['--gf-surface-bottom', GF_SURFACE_BOTTOM],
      ['--gf-text', GF_TEXT],
      ['--gf-text-muted', GF_TEXT_MUTED],
      ['--gf-rare', GF_RARE],
      ['--gf-epic', GF_EPIC],
      ['--gf-amber', GF_AMBER],
      ['--gf-amber-deep', GF_AMBER_DEEP],
      ['--gf-cta-text', GF_CTA_TEXT],
      ['--gf-danger', GF_DANGER],
      ['--gf-success', GF_SUCCESS],
    ];
    for (const [name, value] of mirrors) {
      expect(readCssVar(name)).toBe(value);
    }
  });

  it('leaves every accepted --panel-* and --frame-metal-* value out of app.css', () => {
    const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
    expect(css).not.toContain('--panel-bg-top');
    expect(css).not.toContain('--frame-metal');
    expect(css).not.toContain('--frame-center');
  });
});

describe('Neon Forge contrast (AC-31)', () => {
  const panels = [
    { name: 'top', stop: GF_SURFACE_TOP },
    { name: 'bottom', stop: GF_SURFACE_BOTTOM },
  ] as const;
  const backdrops = [
    { name: 'black', value: PAGE_BACKGROUND },
    { name: 'white', value: WHITE_BACKDROP },
  ] as const;

  it('keeps GF_TEXT >= 4.5 over both surface stops on black and white backdrops', () => {
    const expected = [17.13, 14.76, 18.09, 14.38];
    let index = 0;
    for (const { stop } of panels) {
      for (const { value } of backdrops) {
        const ratio = contrastRatio(hexToRgb(GF_TEXT), surfaceOver(stop, value));
        expect(rounded(ratio)).toBe(expected[index]);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
        index += 1;
      }
    }
  });

  it('keeps GF_TEXT_MUTED >= 4.5 over both surface stops on black and white backdrops', () => {
    const expected = [10.07, 9.03, 10.43, 8.85];
    const { color: muted, alpha } = parseRgba(GF_TEXT_MUTED);
    let index = 0;
    for (const { stop } of panels) {
      for (const { value } of backdrops) {
        const panel = surfaceOver(stop, value);
        const ratio = contrastRatio(composite(muted, alpha, panel), panel);
        expect(rounded(ratio)).toBe(expected[index]);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
        index += 1;
      }
    }
  });

  it('keeps the rarity/success/danger channels >= 4.5 over both surfaces on black and white', () => {
    const channels = [
      { name: 'GF_RARE', value: GF_RARE, expected: [7.42, 6.4, 7.84, 6.23] },
      { name: 'GF_EPIC', value: GF_EPIC, expected: [7.14, 6.16, 7.54, 6.0] },
      { name: 'GF_SUCCESS', value: GF_SUCCESS, expected: [9.82, 8.46, 10.37, 8.24] },
      { name: 'GF_DANGER', value: GF_DANGER, expected: [6.8, 5.86, 7.18, 5.71] },
    ] as const;

    for (const channel of channels) {
      let index = 0;
      for (const { stop } of panels) {
        for (const { value } of backdrops) {
          const ratio = contrastRatio(hexToRgb(channel.value), surfaceOver(stop, value));
          expect(rounded(ratio)).toBe(channel.expected[index]);
          expect(ratio, `${channel.name} over a panel`).toBeGreaterThanOrEqual(4.5);
          index += 1;
        }
      }
    }
  });

  it('keeps GF_CTA_TEXT >= 4.5 on both amber CTA stops', () => {
    const cases = [
      { stop: GF_AMBER, expected: 10.46 },
      { stop: GF_AMBER_DEEP, expected: 7.11 },
    ] as const;
    for (const { stop, expected } of cases) {
      const ratio = contrastRatio(hexToRgb(GF_CTA_TEXT), hexToRgb(stop));
      expect(rounded(ratio)).toBe(expected);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the composited --gf-rim >= 3.0 (non-text) over both surfaces', () => {
    const forwarded = readCssVar('--gf-rim');
    const { color: rim, alpha } = parseRgba(forwarded);
    expect(forwarded).toBe('rgba(124, 246, 255, 0.56)');
    const expected = [5.25, 4.93, 5.29, 4.86];
    let index = 0;
    for (const { stop } of panels) {
      for (const { value } of backdrops) {
        const panel = surfaceOver(stop, value);
        const ratio = contrastRatio(composite(rim, alpha, panel), panel);
        expect(rounded(ratio)).toBe(expected[index]);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
        index += 1;
      }
    }
  });

  it('keeps disabled control text >= 4.5 over both surfaces', () => {
    const text = hexToRgb(HUD_TEXT);
    const expected = [7, 6.47, 7.13, 6.37];
    let index = 0;
    for (const { stop } of panels) {
      for (const { value } of backdrops) {
        const panel = surfaceOver(stop, value);
        const ratio = contrastRatio(composite(text, 0.62, panel), panel);
        expect(rounded(ratio)).toBe(expected[index]);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
        index += 1;
      }
    }
  });

  it('keeps input-well text >= 4.5 over both surfaces', () => {
    const expected = [18, 16.92, 18.49, 16.73];
    let index = 0;
    for (const { stop } of panels) {
      for (const { value } of backdrops) {
        const panel = surfaceOver(stop, value);
        const well = composite(hexToRgb(PAGE_BACKGROUND), 0.42, panel);
        const ratio = contrastRatio(hexToRgb(HUD_TEXT), well);
        expect(rounded(ratio)).toBe(expected[index]);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
        index += 1;
      }
    }
  });

  it('keeps HUD text contrast >= 4.5 over both panel stops on black and white backdrops (AC-19)', () => {
    const cases = [
      { stop: PANEL_BACKGROUND_TOP, backdrop: PAGE_BACKGROUND, expected: 18.03 },
      { stop: PANEL_BACKGROUND_TOP, backdrop: WHITE_BACKDROP, expected: 12.49 },
      { stop: PANEL_BACKGROUND_BOTTOM, backdrop: PAGE_BACKGROUND, expected: 17.03 },
      { stop: PANEL_BACKGROUND_BOTTOM, backdrop: WHITE_BACKDROP, expected: 8.81 },
    ];

    for (const { stop, backdrop, expected } of cases) {
      const panel = surfaceOver(stop, backdrop);
      const ratio = contrastRatio(hexToRgb(HUD_TEXT), panel);

      // Exact pinned ratios: a token edit cannot silently slide towards the floor.
      expect(rounded(ratio)).toBe(expected);
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
      expect(rounded(ratio)).toBe(expected);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the green buy-button surface at >= 3.0 non-text contrast against #ffffff (AC-19)', () => {
    const ratio = contrastRatio(hexToRgb(UPGRADE_GREEN), hexToRgb(WHITE_BACKDROP));
    expect(rounded(ratio)).toBe(3.3);
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  });

  it('keeps HUD text at WCAG AA contrast over the composited HUD panel', () => {
    const { color, alpha } = parseRgba(HUD_BACKGROUND);
    const panel = composite(color, alpha, hexToRgb(PAGE_BACKGROUND));
    const ratio = contrastRatio(hexToRgb(HUD_TEXT), panel);

    // Exact value for the pinned pair (18.2648…), so an unnoticed colour change fails.
    expect(rounded(ratio)).toBe(18.26);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
