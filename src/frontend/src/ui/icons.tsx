import type { ReactElement, ReactNode } from 'react';

/**
 * Inline SVG icon set for the gameplay HUD (AC-4, AC-5, AC-6, AC-7, AC-19).
 *
 * Every icon is decorative: the DOM overlay always pairs it with visible text or an
 * `aria-label`, so each `<svg>` is hidden from the accessibility tree (`aria-hidden`)
 * and removed from the tab order (`focusable="false"`). The shapes are plain inline SVG
 * elements painted with `currentColor` — no image files, no external URLs and no
 * `dangerouslySetInnerHTML` — so they follow the surrounding text colour at 16–24 px.
 */
export interface IconProps {
  className?: string;
}

function Icon({
  name,
  className,
  children,
}: IconProps & { name: string; children: ReactNode }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-icon={name}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

/** Arrow cursor — HUD clicks row. */
export function CursorIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="cursor">
      <path d="M5.5 3.2l14 7.6-6.3 1.6-2.9 6.4z" fill="currentColor" strokeWidth={1.1} />
    </Icon>
  );
}

/** Isometric cube — HUD faces/cube visuals. */
export function CubeIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="cube">
      <path d="M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2z" />
      <path d="M4 7.2l8 4.4 8-4.4M12 11.6v9.6" />
    </Icon>
  );
}

/** Coin with a star — HUD coins row and currency costs. */
export function CoinIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="coin">
      <circle cx="12" cy="12" r="8.75" />
      <path
        d="M12 7.4l1.12 3.06 3.25.12-2.56 2.01.89 3.13L12 13.9l-2.7 1.82.89-3.13-2.56-2.01 3.25-.12z"
        fill="currentColor"
        strokeWidth={1}
      />
    </Icon>
  );
}

/** Server stack — HUD server row. */
export function ServerIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="server">
      <rect x="3.5" y="4" width="17" height="6" rx="1.8" />
      <rect x="3.5" y="14" width="17" height="6" rx="1.8" />
      <circle cx="7" cy="7" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="0.9" fill="currentColor" stroke="none" />
      <path d="M11 7h6M11 17h6" />
    </Icon>
  );
}

/** Cube with an upward arrow — HUD cube level row. */
export function CubeLevelIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="cube-level">
      <path d="M9 3.6l6.4 3.3v6.9L9 17.1l-6.4-3.3V6.9z" />
      <path d="M2.6 6.9L9 10.2l6.4-3.3M9 10.2v6.9" />
      <path d="M18.2 12.2V5.4M15.4 8.2l2.8-2.8 2.8 2.8" />
    </Icon>
  );
}

/** Two players — Users on Server badge. */
export function GroupIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="group">
      <circle cx="9" cy="8" r="3.1" />
      <path d="M3.4 20.2a5.6 5.6 0 0111.2 0" />
      <circle cx="17.3" cy="9.2" r="2.3" />
      <path d="M14.9 14.9a4.3 4.3 0 015.7 4.1" />
    </Icon>
  );
}

/** Cog — Spaceship customization toggle. */
export function GearIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="gear">
      <path d="M12 3.2l2.49 2.79 3.73-.21-.21 3.73L20.8 12l-2.79 2.49.21 3.73-3.73-.21L12 20.8l-2.49-2.79-3.73.21.21-3.73L3.2 12l2.79-2.49-.21-3.73 3.73.21z" />
      <circle cx="12" cy="12" r="3.2" />
    </Icon>
  );
}

/** Spaceship — Spaceship customization toggle. */
export function ShipIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="ship">
      <path d="M12 2.6c2.7 2.5 4.1 5.8 4.1 9.3l2.7 3.4-3.2-.7a6.2 6.2 0 01-7.2 0l-3.2.7 2.7-3.4c0-3.5 1.4-6.8 4.1-9.3z" />
      <circle cx="12" cy="8.8" r="1.5" />
      <path d="M10 18.7l2 2.7 2-2.7" />
    </Icon>
  );
}

/** Gem — upgrade cost diamond. */
export function DiamondIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="diamond">
      <path d="M7.2 3.4h9.6l3.8 5.4L12 20.8 3.4 8.8z" />
      <path d="M3.4 8.8h17.2M7.2 3.4L12 8.8l4.8-5.4M12 20.8V8.8" />
    </Icon>
  );
}

/** Pointer with a plus — Click Power upgrade row. */
export function UpgradeClickIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="upgrade-click">
      <path d="M6 3.2l10.4 5.7-4.4 1.1-2 4.6z" fill="currentColor" strokeWidth={1.1} />
      <path d="M17.4 14.6v6.2M14.3 17.7h6.2" />
    </Icon>
  );
}

/** Cube with a plus — Cube Bonus upgrade row. */
export function UpgradeCubeIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="upgrade-cube">
      <path d="M8.4 3.4l6 3.2v6.8l-6 3.2-6-3.2V6.6z" />
      <path d="M2.4 6.6L8.4 9.8l6-3.2M8.4 9.8v6.8" />
      <path d="M18.6 13v6.6M15.3 16.3h6.6" />
    </Icon>
  );
}

/** Lightning bolt — Quick Hands upgrade row. */
export function UpgradeSpeedIcon({ className }: IconProps): ReactElement {
  return (
    <Icon className={className} name="upgrade-speed">
      <path
        d="M13.2 2.6L4.8 14.1h6.1L10.8 21.4l8.4-11.5h-6.1z"
        fill="currentColor"
        strokeWidth={1.1}
      />
    </Icon>
  );
}
