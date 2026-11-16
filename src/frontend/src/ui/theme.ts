/**
 * HUD theme — the pinned colour constants the DOM overlay is built from.
 *
 * The canvas shows the procedural nebula backdrop with the starfield over it, so HUD
 * text sits on translucent panel fills that can composite over either a black or a
 * bright white worst-case backdrop. `theme.test.ts` computes the WCAG
 * relative-luminance contrast from these exact exports and pins the readability
 * thresholds (AC-19); the stylesheets mirror the same literals as CSS custom
 * properties (they cannot import TypeScript values — the test is what keeps the pair
 * honest).
 */

import { REVEAL_RARITY_HEX } from '../game/reveal-motion';

/** Primary HUD text colour (contrast-checked against the HUD panel). */
export const HUD_TEXT = '#e8f6ff';

/** HUD panel fill: near-black, translucent over the starfield. */
export const HUD_BACKGROUND = 'rgba(6, 10, 20, 0.72)';

/** Accent used for numbers, the focus ring and the phase hint. */
export const ACCENT = '#7cf6ff';

/** The page/canvas backdrop under the starfield — the contrast reference (AC-14). */
export const PAGE_BACKGROUND = '#000000';

/**
 * The nine reference HUD tokens (AC-3) — mirrored 1:1 by the `:root` custom
 * properties in the gameplay stylesheet; `theme.test.ts` pins the literals and the
 * contrast they must keep on both black and white worst-case backdrops (AC-19).
 */

/** Rounded panel gradient top stop. */
export const PANEL_BACKGROUND_TOP = 'rgba(5, 11, 24, 0.86)';

/** Rounded panel gradient bottom stop. */
export const PANEL_BACKGROUND_BOTTOM = 'rgba(10, 22, 44, 0.8)';

/** Cyan panel border colour. */
export const PANEL_BORDER = 'rgba(124, 246, 255, 0.62)';

/** Cyan panel glow colour. */
export const PANEL_GLOW = 'rgba(124, 246, 255, 0.35)';

/** Rounded panel corner radius. */
export const PANEL_RADIUS = '1rem';

/** Users-on-Server badge gradient top stop. */
export const USERS_BADGE_TOP = '#d63a2f';

/** Users-on-Server badge gradient bottom stop. */
export const USERS_BADGE_BOTTOM = '#a51f1f';

/** Coin value accent colour. */
export const COIN_GOLD = '#ffcc66';

/** Upgrade buy-button surface colour (white text must keep >= 3.0:1). */
export const UPGRADE_GREEN = '#16a34a';

/**
 * Neon Forge mirrors (game-feel-overhaul T6; spec AC-17, AC-31).
 *
 * These are the TypeScript side of the additive `--gf-*` palette in `app.css`. The
 * accepted `--panel-*` tokens above are unchanged; the reveal rarity colours are the
 * single source (`REVEAL_RARITY_HEX`) so the 3D ring and the CSS channel can never
 * drift apart.
 */

/** Panel gradient top stop. */
export const GF_SURFACE_TOP = 'rgba(10, 18, 34, 0.94)';

/** Panel gradient bottom stop. */
export const GF_SURFACE_BOTTOM = 'rgba(5, 10, 20, 0.9)';

/** Primary shell text (equal to `HUD_TEXT`, both contrast-checked). */
export const GF_TEXT = HUD_TEXT;

/** Secondary/muted shell text. */
export const GF_TEXT_MUTED = 'rgba(232, 246, 255, 0.76)';

/** Rare channel, shared with the reveal stage ring. */
export const GF_RARE = REVEAL_RARITY_HEX.rare;

/** Epic channel, shared with the reveal stage ring. */
export const GF_EPIC = REVEAL_RARITY_HEX.epic;

/** Warm reward accent / primary CTA top stop. */
export const GF_AMBER = '#ffb35c';

/** Primary CTA bottom stop. */
export const GF_AMBER_DEEP = '#ff7a1a';

/** Ink used on the amber primary CTA. */
export const GF_CTA_TEXT = '#1a1206';

/** Error / exhausted channel. */
export const GF_DANGER = '#ff6b6b';

/** Positive / purchase channel. */
export const GF_SUCCESS = '#34d399';
