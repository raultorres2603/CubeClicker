import type { ReactElement } from 'react';

import { GearIcon, ShipIcon } from './icons';

/**
 * The `Spaceship customization` toggle (T7, AC-7/AC-19).
 *
 * Pinned markup contract: a real `<button type="button">` carrying
 * `class="customization-toggle"` and `aria-expanded={open}`, with the decorative
 * gear and ship icons (each `aria-hidden="true"` and `focusable="false"` inside
 * `icons.tsx`) followed by the exact label `Spaceship customization`. The icons
 * contribute no accessible text, so the button's name stays the visible label and
 * it remains a native, keyboard-operable control (the 44 px target and the
 * `:focus-visible` ring are owned by `game-view.css`).
 *
 * The component is presentational: it owns no state and only forwards a click to
 * `onToggle`, exactly once per activation. `App` (`T8`) owns the open/closed state
 * and the `SpaceshipCustomizationPanel` wiring.
 */
export function CustomizationToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className="customization-toggle"
      aria-expanded={open}
      onClick={onToggle}
    >
      <GearIcon />
      <ShipIcon />
      Spaceship customization
    </button>
  );
}
