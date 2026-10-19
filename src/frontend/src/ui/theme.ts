/**
 * HUD theme (T14) — the pinned colour constants the DOM overlay is built from.
 *
 * The canvas is black with the procedural starfield on it (AC-3), so HUD text sits on
 * `HUD_BACKGROUND` composited over `PAGE_BACKGROUND`. `theme.test.ts` computes the WCAG
 * relative-luminance contrast from these exact exports and pins it at ≥ 4.5:1 (AC-14);
 * `app.css` mirrors the same literals as CSS custom properties (the stylesheet cannot
 * import TypeScript values — the test is what keeps the pair honest).
 */

/** Primary HUD text colour (contrast-checked against the HUD panel). */
export const HUD_TEXT = '#e8f6ff';

/** HUD panel fill: near-black, translucent over the starfield. */
export const HUD_BACKGROUND = 'rgba(6, 10, 20, 0.72)';

/** Accent used for numbers, the focus ring and the phase hint. */
export const ACCENT = '#7cf6ff';

/** The page/canvas backdrop under the starfield — the contrast reference (AC-14). */
export const PAGE_BACKGROUND = '#000000';
