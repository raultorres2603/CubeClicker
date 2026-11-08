/**
 * Level-complete burst and banner (T12; spec AC-40, AC-48).
 *
 * The full-screen DOM burst is exactly 16 gold + 8 cyan rays, 3 concentric rings, 12 star
 * glyphs and 20 coin glyphs over `MOTION.levelBurstMs`; the banner enters at 0.2/−8°,
 * peaks at 1.08 on `bannerPeakMs`, settles by `bannerOvershootMs` and carries a
 * `bannerHaloMs` halo. App owns the `bannerHoldMs` visible window; this component only
 * renders the visible frame. Reduced motion is the CSS overlay variant (150 ms, ≤15 %),
 * with the banner fading at scale 1/0°.
 */

import type { CSSProperties, ReactElement } from 'react';

import { MOTION } from '../game/motion';

export interface LevelCompleteBannerProps {
  visible: boolean;
  reducedMotion?: boolean;
  /** The 1-based level number just completed. */
  levelNumber: number;
}

function rayStyle(index: number, count: number): CSSProperties {
  const angle = (360 / count) * index;
  return { '--ray-index': index, '--ray-angle': `${angle}deg` } as CSSProperties;
}

export function LevelCompleteBanner({
  visible,
  reducedMotion = false,
  levelNumber,
}: LevelCompleteBannerProps): ReactElement | null {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="level-complete"
      data-level-complete="true"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <div className="level-burst" data-level-burst="true" aria-hidden="true">
        <span className="level-burst-core" data-burst-core="true" />
        {Array.from({ length: MOTION.levelRayGold }, (_, index) => (
          <span
            key={`gold-ray-${index}`}
            className="level-ray level-ray-gold"
            data-ray="gold"
            style={rayStyle(index, MOTION.levelRayGold)}
          />
        ))}
        {Array.from({ length: MOTION.levelRayCyan }, (_, index) => (
          <span
            key={`cyan-ray-${index}`}
            className="level-ray level-ray-cyan"
            data-ray="cyan"
            style={rayStyle(index, MOTION.levelRayCyan)}
          />
        ))}
        {Array.from({ length: MOTION.levelRingCount }, (_, index) => (
          <span
            key={`ring-${index}`}
            className="level-ring"
            data-ring={index}
            style={{ '--ring-index': index } as CSSProperties}
          />
        ))}
        {Array.from({ length: MOTION.levelStarCount }, (_, index) => (
          <span
            key={`star-${index}`}
            className="level-star"
            data-star={index}
            style={{ '--glyph-index': index } as CSSProperties}
          >
            ✦
          </span>
        ))}
        {Array.from({ length: MOTION.levelCoinCount }, (_, index) => (
          <span
            key={`coin-${index}`}
            className="level-coin"
            data-coin={index}
            style={{ '--glyph-index': index } as CSSProperties}
          >
            ●
          </span>
        ))}
      </div>
      <div className="level-banner" data-level-banner="true">
        <span className="level-banner-halo" data-banner-halo="true" aria-hidden="true" />
        <p className="level-banner-title">LEVEL COMPLETE</p>
        <p className="level-banner-level">{`Cube ${levelNumber}`}</p>
      </div>
    </div>
  );
}
