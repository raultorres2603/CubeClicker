/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOTION } from '../game/motion';
import { SLOT_CATALOG, partsForSlot } from '../game/parts-v2';
import type { CustomizationState, LootboxGrant } from '../game/types';
import {
  SpaceshipCustomizationPanel,
  type SpaceshipCustomizationPanelProps,
} from './SpaceshipCustomizationPanel';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const EMPTY: CustomizationState = { lootboxes: 0, keys: 0, parts: {}, appearance: {} };

// jsdom rewrites `import.meta.url` to an http URL, so read from the workspace cwd
// (the frontend package root) like App.test.tsx does.
const APP_CSS = readFileSync('src/ui/app.css', 'utf8');
const GAME_VIEW_CSS = readFileSync('src/ui/game-view.css', 'utf8');

/** Injects the real panel stylesheets so computed styles verify the shipped cascade. */
function withPanelStyles(run: () => void): void {
  const style = document.createElement('style');
  style.textContent = `${APP_CSS}\n${GAME_VIEW_CSS}`;
  document.head.append(style);
  try {
    run();
  } finally {
    style.remove();
  }
}

const HANDLERS = {
  onOpenLootbox: () => undefined,
  onEquip: () => undefined,
  onUnequip: () => undefined,
  onDismissReveal: () => undefined,
};

function panel(overrides: Partial<SpaceshipCustomizationPanelProps> = {}): string {
  return renderToStaticMarkup(
    <SpaceshipCustomizationPanel
      customization={EMPTY}
      mode="guest"
      {...HANDLERS}
      {...overrides}
    />,
  );
}

function renderPanel(
  overrides: Partial<SpaceshipCustomizationPanelProps> = {},
): ReturnType<typeof render> {
  return render(
    <SpaceshipCustomizationPanel
      customization={EMPTY}
      mode="guest"
      {...HANDLERS}
      {...overrides}
    />,
  );
}

function grant(overrides: Partial<LootboxGrant> = {}): LootboxGrant {
  return {
    partId: 'wing-left-silver',
    slot: 'wing-left',
    rarity: 'rare',
    duplicate: false,
    sequence: 1,
    ...overrides,
  };
}

/** The panel root section (the reveal spotlight shell). */
function panelRoot(container: HTMLElement): HTMLElement {
  const section = container.querySelector<HTMLElement>('section.customization-panel');
  if (section === null) {
    throw new Error('customization panel section missing');
  }
  return section;
}

/** The authoritative `.lootbox-reveal` region (AC-7). */
function revealRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('.lootbox-reveal');
  if (region === null) {
    throw new Error('lootbox reveal region missing');
  }
  return region;
}

/** jsdom serializes inline hex colours as `rgb(r, g, b)`. */
function cssRgb(hex: string): string {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgb(${red}, ${green}, ${blue})`;
}

/** Every attribute value and text node inside `root`, for raw-string leak checks. */
function domStrings(root: HTMLElement): string[] {
  const values: string[] = [];
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    for (const attribute of Array.from(element.attributes)) {
      values.push(attribute.value);
    }
    if (element.children.length === 0 && element.textContent !== null) {
      values.push(element.textContent);
    }
  }
  return values;
}

describe('SpaceshipCustomizationPanel slots (AC-21, AC-29)', () => {
  it('renders exactly ten slot rows in SLOT_CATALOG order with the section contract', () => {
    const { container } = renderPanel();

    const section = panelRoot(container);
    expect(section.getAttribute('aria-label')).toBe('Spaceship customization');
    expect(section.getAttribute('data-mode')).toBe('guest');
    expect(section.getAttribute('data-reveal-active')).toBe('false');

    const rows = Array.from(container.querySelectorAll<HTMLElement>('li.customization-slot'));
    expect(rows.map((row) => row.getAttribute('data-slot'))).toEqual([
      'hull',
      'nose',
      'cockpit',
      'wing-left',
      'wing-right',
      'engine-left',
      'engine-right',
      'ignition-left',
      'ignition-right',
      'tail-fin',
    ]);
    expect(rows).toHaveLength(10);
  });

  it('renders exactly three variants per row with catalog rarity and a colour swatch', () => {
    const { container } = renderPanel();
    const rows = Array.from(container.querySelectorAll<HTMLElement>('li.customization-slot'));

    for (const [index, row] of rows.entries()) {
      const slot = SLOT_CATALOG[index];
      if (slot === undefined) throw new Error('slot missing');
      const catalog = partsForSlot(slot.id);
      const variants = Array.from(
        row.querySelectorAll<HTMLElement>('li.customization-variant'),
      );
      expect(variants.map((variant) => variant.getAttribute('data-part'))).toEqual(
        catalog.map((part) => part.id),
      );
      expect(variants.map((variant) => variant.getAttribute('data-rarity'))).toEqual(
        catalog.map((part) => part.rarity),
      );
      expect(variants).toHaveLength(3);
      expect(variants.map((variant) => variant.getAttribute('data-owned'))).toEqual([
        'true',
        'false',
        'false',
      ]);
      expect(variants.map((variant) => variant.getAttribute('data-locked'))).toEqual([
        'false',
        'true',
        'true',
      ]);
      expect(variants.map((variant) => variant.getAttribute('data-equipped'))).toEqual([
        'true',
        'false',
        'false',
      ]);

      const swatches = variants.map((variant) =>
        variant.querySelector<HTMLElement>('.customization-swatch'),
      );
      expect(swatches.map((swatch) => swatch?.getAttribute('aria-hidden'))).toEqual([
        'true',
        'true',
        'true',
      ]);
      expect(swatches.map((swatch) => swatch?.style.background)).toEqual(
        catalog.map((part) => cssRgb(part.color)),
      );
      expect(swatches.map((swatch) => swatch?.textContent)).toEqual(['', '', '']);
    }
  });

  it('shows the slot display name and the equipped part name for every slot', () => {
    const { container } = renderPanel();
    const rows = Array.from(container.querySelectorAll<HTMLElement>('li.customization-slot'));

    expect(
      rows.map((row) => row.querySelector('.customization-slot-name')?.textContent),
    ).toEqual([
      'Hull',
      'Nose',
      'Cockpit',
      'Port Wing',
      'Starboard Wing',
      'Port Engine',
      'Starboard Engine',
      'Port Ignition',
      'Starboard Ignition',
      'Tail Fin',
    ]);
    expect(
      rows.map((row) => row.querySelector('.customization-equipped-name')?.textContent),
    ).toEqual([
      'Steel Hull',
      'Alloy Nose',
      'Teal Canopy',
      'Port Wing',
      'Starboard Wing',
      'Port Engine',
      'Starboard Engine',
      'Port Flame',
      'Starboard Flame',
      'Standard Fin',
    ]);
  });

  it('marks owned parts and exposes equipped/label states on the equip controls', () => {
    const { container } = renderPanel({
      customization: {
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-gold': 1 },
        appearance: { hull: 'hull-gold' },
      },
    });

    const hullRow = container.querySelector<HTMLElement>('li[data-slot="hull"]');
    if (hullRow === null) throw new Error('hull row missing');
    const variants = Array.from(
      hullRow.querySelectorAll<HTMLElement>('li.customization-variant'),
    );
    expect(variants.map((variant) => variant.getAttribute('data-part'))).toEqual([
      'hull-default',
      'hull-obsidian',
      'hull-gold',
    ]);
    expect(variants.map((variant) => variant.getAttribute('data-rarity'))).toEqual([
      'standard',
      'rare',
      'epic',
    ]);
    expect(variants.map((variant) => variant.getAttribute('data-owned'))).toEqual([
      'true',
      'false',
      'true',
    ]);
    expect(variants.map((variant) => variant.getAttribute('data-locked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(variants.map((variant) => variant.getAttribute('data-equipped'))).toEqual([
      'false',
      'false',
      'true',
    ]);

    const equipButtons = Array.from(
      hullRow.querySelectorAll<HTMLButtonElement>('button.customization-equip'),
    );
    expect(equipButtons).toHaveLength(2);
    expect(equipButtons[0]?.getAttribute('aria-pressed')).toBe('false');
    expect(equipButtons[0]?.getAttribute('aria-label')).toBe('Equip Steel Hull');
    expect(equipButtons[0]?.textContent).toBe('Equip');
    expect(equipButtons[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(equipButtons[1]?.hasAttribute('aria-label')).toBe(false);
    expect(equipButtons[1]?.textContent).toBe('Equipped');
    expect(hullRow.textContent).toContain('Locked');
    expect(
      hullRow.querySelector('li[data-part="hull-obsidian"] button.customization-equip'),
    ).toBeNull();
    expect(
      hullRow.querySelector('li[data-part="hull-obsidian"] .customization-locked')?.textContent,
    ).toBe('Locked');
  });

  it('renders a 44px-capable unequip control per slot, disabled at the standard part', () => {
    const { container } = renderPanel({
      customization: {
        lootboxes: 0,
        keys: 0,
        parts: {},
        appearance: { hull: 'hull-gold' },
      },
    });

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.customization-unequip'),
    );
    expect(buttons).toHaveLength(10);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Unequip Hull',
      'Unequip Nose',
      'Unequip Cockpit',
      'Unequip Port Wing',
      'Unequip Starboard Wing',
      'Unequip Port Engine',
      'Unequip Starboard Engine',
      'Unequip Port Ignition',
      'Unequip Starboard Ignition',
      'Unequip Tail Fin',
    ]);
    // The appearance map is authoritative for the equipped name even before the owned
    // count is present (a restored legacy row resolves the same way); unequip is enabled
    // because the slot is not at its standard part.
    expect(buttons.map((button) => button.disabled)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('calls onUnequip with the slot id only for an enabled control', () => {
    const onUnequip = vi.fn();
    renderPanel({
      customization: {
        lootboxes: 0,
        keys: 0,
        parts: {},
        appearance: { hull: 'hull-gold' },
      },
      onUnequip,
    });

    const hullButton = screen.getByRole('button', { name: 'Unequip Hull' }) as HTMLButtonElement;
    const noseButton = screen.getByRole('button', { name: 'Unequip Nose' }) as HTMLButtonElement;
    expect(hullButton.disabled).toBe(false);
    expect(noseButton.disabled).toBe(true);

    fireEvent.click(hullButton);
    fireEvent.click(noseButton);
    expect(onUnequip).toHaveBeenCalledTimes(1);
    expect(onUnequip).toHaveBeenCalledWith('hull');
  });

  it('normalizes legacy direct props into the v2 slot rows', () => {
    const { container } = renderPanel({
      parts: { 'engine-blue': 1 },
      appearance: { engine: 'engine-blue' },
    });

    for (const slot of ['ignition-left', 'ignition-right'] as const) {
      const row = container.querySelector<HTMLElement>(`li[data-slot="${slot}"]`);
      expect(row?.querySelector('.customization-equipped-name')?.textContent).toBe(
        slot === 'ignition-left' ? 'Port Blue Flame' : 'Starboard Blue Flame',
      );
      const expectedPart =
        slot === 'ignition-left' ? 'ignition-left-blue' : 'ignition-right-blue';
      expect(row?.querySelector(`li[data-part="${expectedPart}"]`)?.getAttribute('data-owned')).toBe(
        'true',
      );
    }
  });

  it('keeps every panel control at a 44px minimum pointer target (AC-28, AC-31)', () => {
    withPanelStyles(() => {
      const normal = renderPanel({
        customization: {
          lootboxes: 1,
          keys: 1,
          parts: {},
          appearance: {},
        },
      });

      const open = normal.container.querySelector<HTMLElement>('button.customization-open');
      expect(open?.textContent).toBe('Open lootbox');
      if (open === null) throw new Error('open control missing');
      expect(window.getComputedStyle(open).minHeight).toBe('44px');

      const targets = Array.from(
        normal.container.querySelectorAll<HTMLElement>(
          'button.customization-equip, button.customization-unequip',
        ),
      );
      expect(targets).toHaveLength(20);
      for (const target of targets) {
        const style = window.getComputedStyle(target);
        expect(style.minWidth).toBe('44px');
        expect(style.minHeight).toBe('44px');
      }

      normal.unmount();

      const revealing = renderPanel({ lastLootboxGrant: grant() });
      const revealTargets = Array.from(
        revealing.container.querySelectorAll<HTMLElement>(
          'button.customization-reveal-equip, button.customization-reveal-dismiss',
        ),
      );
      expect(revealTargets).toHaveLength(2);
      for (const target of revealTargets) {
        const style = window.getComputedStyle(target);
        expect(style.minWidth).toBe('44px');
        expect(style.minHeight).toBe('44px');
      }
      revealing.unmount();
    });
  });
});

describe('SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29)', () => {
  it('renders the hangar title, both gf chips and one Open lootbox control', () => {
    const { container } = renderPanel({ lootboxes: 3, keys: 2 });

    const section = panelRoot(container);
    expect(section.querySelector('h2.customization-title')?.textContent).toBe(
      'Spaceship hangar',
    );

    const chips = Array.from(section.querySelectorAll<HTMLElement>('.gf-chip'));
    expect(chips).toHaveLength(2);
    expect(chips.map((chip) => chip.textContent)).toEqual(['Lootboxes: 3', 'Keys: 2']);
    expect(chips.map((chip) => chip.getAttribute('data-lootboxes'))).toEqual(['3', null]);
    expect(chips.map((chip) => chip.getAttribute('data-keys'))).toEqual([null, '2']);

    const buttons = section.querySelectorAll<HTMLButtonElement>('button.customization-open');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.className).toBe('customization-open gf-cta');
    expect(buttons[0]?.textContent).toBe('Open lootbox');
    expect(buttons[0]?.disabled).toBe(false);
  });

  it('renders the accepted normal branch without the reveal (AC-13, AC-21)', () => {
    const { container } = renderPanel({ lootboxes: 1, keys: 1 });
    const section = panelRoot(container);

    expect(section.getAttribute('data-reveal-active')).toBe('false');
    expect(section.hasAttribute('data-part-id')).toBe(false);
    expect(section.querySelector('.lootbox-reveal')).toBeNull();
    expect(section.querySelectorAll('li.customization-slot')).toHaveLength(10);
    expect(section.querySelector('.spaceship-preview')?.getAttribute('aria-label')).toBe(
      'Spaceship preview',
    );
  });

  it('disables Open lootbox when lootboxes are zero', () => {
    const { container } = renderPanel({ lootboxes: 0, keys: 5 });
    const open = container.querySelector<HTMLButtonElement>('button.customization-open');
    expect(open?.disabled).toBe(true);
  });

  it('disables Open lootbox when keys are zero', () => {
    const { container } = renderPanel({ lootboxes: 5, keys: 0 });
    const open = container.querySelector<HTMLButtonElement>('button.customization-open');
    expect(open?.disabled).toBe(true);
  });

  it('disables Open lootbox while an account open is pending', () => {
    const { container } = renderPanel({ lootboxes: 1, keys: 1, pendingOpen: true });
    const open = container.querySelector<HTMLButtonElement>('button.customization-open');
    expect(open?.disabled).toBe(true);
  });

  it('enables Open lootbox with both counts and no pending open', () => {
    const { container } = renderPanel({ lootboxes: 1, keys: 1, pendingOpen: false });
    const open = container.querySelector<HTMLButtonElement>('button.customization-open');
    expect(open?.disabled).toBe(false);
  });

  it('calls onOpenLootbox once when the enabled control is clicked', () => {
    const onOpenLootbox = vi.fn();
    renderPanel({ lootboxes: 1, keys: 1, onOpenLootbox });

    fireEvent.click(screen.getByRole('button', { name: 'Open lootbox' }));
    expect(onOpenLootbox).toHaveBeenCalledTimes(1);
    expect(onOpenLootbox).toHaveBeenCalledWith();
  });

  it('keeps the pre-v2 onOpen alias working', () => {
    const onOpen = vi.fn();
    renderPanel({ lootboxes: 1, keys: 1, onOpenLootbox: undefined, onOpen });

    fireEvent.click(screen.getByRole('button', { name: 'Open lootbox' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('SpaceshipCustomizationPanel reveal branch (AC-7, AC-13, AC-14, AC-21)', () => {
  it('replaces the whole normal branch with the reveal while a grant is present', () => {
    const { container } = renderPanel({
      lootboxes: 1,
      keys: 1,
      lastLootboxGrant: grant(),
      parts: { 'wing-left-silver': 2 },
    });

    const section = panelRoot(container);
    expect(section.getAttribute('data-reveal-active')).toBe('true');
    expect(section.getAttribute('data-mode')).toBe('guest');
    expect(section.querySelectorAll('.lootbox-reveal')).toHaveLength(1);
    expect(section.querySelector('h2.customization-title')).toBeNull();
    expect(section.querySelector('.customization-counts')).toBeNull();
    expect(section.querySelector('button.customization-open')).toBeNull();
    expect(section.querySelector('ul.customization-slots')).toBeNull();
    expect(section.querySelector('li.customization-slot')).toBeNull();
    expect(section.querySelector('.spaceship-preview')).toBeNull();
    expect(section.querySelector('.customization-panel-scrim')).toBeNull();
    expect(section.querySelector('[role="dialog"]')).toBeNull();
    expect(section.querySelector('[aria-modal="true"]')).toBeNull();

    const region = revealRegion(container);
    expect(region.parentElement).toBe(section);
  });

  it('renders the rare/new reveal region with the pinned attributes and copy', () => {
    const { container } = renderPanel({
      lastLootboxGrant: grant(),
      parts: { 'wing-left-silver': 2 },
    });
    const region = revealRegion(container);

    expect(region.getAttribute('role')).toBe('group');
    expect(region.getAttribute('aria-live')).toBe('off');
    expect(region.getAttribute('aria-label')).toBe('Lootbox reveal: Port Silver Wing');
    expect(region.getAttribute('data-reveal-active')).toBe('true');
    expect(region.getAttribute('data-reveal-sequence')).toBe('1');
    expect(region.getAttribute('data-reveal-phase')).toBe('charge');
    expect(region.getAttribute('data-part-id')).toBe('wing-left-silver');
    expect(region.getAttribute('data-slot')).toBe('wing-left');
    expect(region.getAttribute('data-rarity')).toBe('rare');
    expect(region.getAttribute('data-duplicate')).toBe('false');
    expect(region.getAttribute('data-owned-count')).toBe('2');
    expect(region.getAttribute('data-reveal-3d')).toBe('unavailable');
    expect(region.getAttribute('data-reduced-motion')).toBe('false');
    const stage = region.querySelector<HTMLElement>('.lootbox-stage');
    expect(stage?.getAttribute('data-reveal-stage')).toBe('true');
    const card = region.querySelector<HTMLElement>('.lootbox-reveal-card');
    expect(card?.getAttribute('data-reveal-card')).toBe('true');
    expect(card?.querySelector('.lootbox-reveal-owned')?.textContent).toBe('Owned ×2');
    expect(region.textContent).toContain('Rare');
    expect(region.textContent).toContain('Port Silver Wing');
    expect(region.textContent).toContain('Port Wing');
    expect(region.textContent).toContain('New');
    expect(region.textContent).toContain('Owned ×2');
    expect(screen.getByRole('button', { name: 'Equip Port Silver Wing' }).className).toBe(
      'customization-reveal-equip',
    );
    expect(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }).className).toBe(
      'customization-reveal-dismiss',
    );
    expect(container.querySelector('[aria-live="polite"]')).toBeNull();
  });

  it('renders the epic duplicate copy and the epic rarity channel', () => {
    const { container } = renderPanel({
      lastLootboxGrant: grant({
        partId: 'hull-gold',
        slot: 'hull',
        rarity: 'epic',
        duplicate: true,
        sequence: 4,
      }),
      parts: { 'hull-gold': 3 },
    });
    const region = revealRegion(container);

    expect(region.getAttribute('data-rarity')).toBe('epic');
    expect(region.getAttribute('data-duplicate')).toBe('true');
    expect(region.getAttribute('data-reveal-sequence')).toBe('4');
    expect(region.getAttribute('data-owned-count')).toBe('3');
    expect(region.textContent).toContain('Epic');
    expect(region.textContent).toContain('Gold Hull');
    expect(region.textContent).toContain('Hull');
    expect(region.textContent).toContain('Duplicate');
    expect(region.textContent).toContain('Owned ×3');
    expect(panelRoot(container).getAttribute('data-rarity')).toBe('epic');
  });

  it('derives the slot from the catalog and never trusts the wire slot', () => {
    for (const wireSlot of ['hull', 'warp-core', '']) {
      const { container, unmount } = renderPanel({
        lastLootboxGrant: grant({ slot: wireSlot }),
      });
      const region = revealRegion(container);
      expect(region.getAttribute('data-slot')).toBe('wing-left');
      expect(region.textContent).toContain('Port Wing');
      expect(panelRoot(container).getAttribute('data-slot')).toBe('wing-left');
      if (wireSlot !== '') {
        for (const value of domStrings(container)) {
          expect(value).not.toBe(wireSlot);
        }
      }
      for (const value of domStrings(container)) {
        expect(value).not.toContain('warp-core');
      }
      unmount();
    }
  });

  it('sanitises an unknown part without leaking the raw server string', () => {
    const { container } = renderPanel({
      lastLootboxGrant: grant({ partId: 'mystery-part', slot: 'warp-core' }),
      parts: { 'mystery-part': 4 },
    });
    const region = revealRegion(container);

    expect(region.getAttribute('data-part-id')).toBe('unknown');
    expect(region.getAttribute('data-slot')).toBe('');
    expect(region.getAttribute('data-owned-count')).toBe('0');
    expect(region.getAttribute('data-reveal-3d')).toBe('unavailable');
    expect(region.getAttribute('aria-label')).toBe('Lootbox reveal: Unknown part');
    expect(region.textContent).toContain('Unknown part');
    expect(panelRoot(container).getAttribute('data-part-id')).toBe('unknown');
    expect(panelRoot(container).getAttribute('data-slot')).toBe('');

    for (const value of domStrings(container)) {
      expect(value).not.toContain('mystery-part');
      expect(value).not.toContain('warp-core');
    }
  });

  it('advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline', () => {
    vi.useFakeTimers();
    const { container } = renderPanel({ lastLootboxGrant: grant({ sequence: 9 }) });
    const phase = (): string | null =>
      revealRegion(container).getAttribute('data-reveal-phase');

    expect(phase()).toBe('charge');

    act(() => {
      vi.advanceTimersByTime(419);
    });
    expect(phase()).toBe('charge');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phase()).toBe('orb');

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(phase()).toBe('orb');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phase()).toBe('flash');

    act(() => {
      vi.advanceTimersByTime(119);
    });
    expect(phase()).toBe('flash');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phase()).toBe('reveal');

    act(() => {
      vi.advanceTimersByTime(359);
    });
    expect(phase()).toBe('reveal');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phase()).toBe('settle');

    act(() => {
      vi.advanceTimersByTime(139);
    });
    expect(phase()).toBe('settle');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phase()).toBe('rest');
  });

  it('restarts the timeline when the same part is reopened with a new sequence', () => {
    vi.useFakeTimers();
    const { container, rerender } = renderPanel({
      lastLootboxGrant: grant({ sequence: 11 }),
    });
    act(() => {
      vi.advanceTimersByTime(1290);
    });
    expect(revealRegion(container).getAttribute('data-reveal-phase')).toBe('rest');

    rerender(
      <SpaceshipCustomizationPanel
        customization={EMPTY}
        mode="guest"
        {...HANDLERS}
        lastLootboxGrant={grant({ sequence: 12 })}
      />,
    );

    const region = revealRegion(container);
    expect(region.getAttribute('data-reveal-sequence')).toBe('12');
    expect(region.getAttribute('data-reveal-phase')).toBe('charge');
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(revealRegion(container).getAttribute('data-reveal-phase')).toBe('orb');
  });

  it('renders the settled reveal instantly under reduced motion without phase timers', () => {
    // Fake only the phase timers: the panel's timeline is `setTimeout`-based, while the
    // React scheduler keeps its own `setImmediate` message loop that is not a phase timer.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { container } = renderPanel({
      lastLootboxGrant: grant({ sequence: 3 }),
      reducedMotion: true,
    });
    const region = revealRegion(container);

    expect(region.getAttribute('data-reveal-phase')).toBe('rest');
    expect(region.getAttribute('data-reduced-motion')).toBe('true');
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1290);
    });
    expect(revealRegion(container).getAttribute('data-reveal-phase')).toBe('rest');
  });

  it('does not mutate the appearance prop while the reveal is mounted (AC-5)', () => {
    vi.useFakeTimers();
    const appearance = { hull: 'hull-gold' };
    const before = { ...appearance };
    const { container, rerender } = renderPanel({
      customization: {
        lootboxes: 1,
        keys: 1,
        parts: { 'wing-left-silver': 1 },
        appearance,
      },
      lastLootboxGrant: grant(),
    });

    expect(revealRegion(container).getAttribute('data-part-id')).toBe('wing-left-silver');
    act(() => {
      vi.advanceTimersByTime(1290);
    });
    expect(appearance).toEqual(before);

    rerender(
      <SpaceshipCustomizationPanel
        customization={{
          lootboxes: 1,
          keys: 1,
          parts: { 'wing-left-silver': 1 },
          appearance,
        }}
        mode="guest"
        {...HANDLERS}
        lastLootboxGrant={null}
      />,
    );
    expect(container.querySelector('li[data-slot="hull"] .customization-equipped-name')?.textContent)
      .toBe('Gold Hull');
    expect(container.querySelector('li[data-slot="wing-left"] .customization-equipped-name')?.textContent)
      .toBe('Port Wing');
    expect(appearance).toEqual(before);
  });
});

describe('SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13)', () => {
  it('focuses the reveal Equip control on mount', () => {
    renderPanel({
      lastLootboxGrant: grant(),
      parts: { 'wing-left-silver': 1 },
    });

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Equip Port Silver Wing' }),
    );
  });

  it('dismisses the reveal through onDismissReveal exactly once', () => {
    const onDismissReveal = vi.fn();
    renderPanel({ lastLootboxGrant: grant(), parts: { 'wing-left-silver': 1 }, onDismissReveal });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }));
    expect(onDismissReveal).toHaveBeenCalledTimes(1);
    expect(onDismissReveal).toHaveBeenCalledWith();
  });

  it('dismisses the reveal on Escape exactly once', () => {
    const onDismissReveal = vi.fn();
    renderPanel({ lastLootboxGrant: grant(), parts: { 'wing-left-silver': 1 }, onDismissReveal });

    fireEvent.keyDown(screen.getByRole('button', { name: 'Equip Port Silver Wing' }), {
      key: 'Escape',
    });
    expect(onDismissReveal).toHaveBeenCalledTimes(1);
  });

  it('equips the granted part, then dismisses, and flashes the reappearing row', () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const onEquip = vi.fn((partId: string) => {
      calls.push(`equip:${partId}`);
    });
    const onDismissReveal = vi.fn(() => {
      calls.push('dismiss');
    });

    const { container, rerender } = renderPanel({
      customization: {
        lootboxes: 0,
        keys: 0,
        parts: { 'wing-left-silver': 1 },
        appearance: {},
      },
      lastLootboxGrant: grant(),
      onEquip,
      onDismissReveal,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Equip Port Silver Wing' }));
    expect(calls).toEqual(['equip:wing-left-silver', 'dismiss']);
    expect(onDismissReveal).toHaveBeenCalledTimes(1);

    rerender(
      <SpaceshipCustomizationPanel
        customization={{
          lootboxes: 0,
          keys: 0,
          parts: { 'wing-left-silver': 1 },
          appearance: {},
        }}
        mode="guest"
        {...HANDLERS}
        lastLootboxGrant={null}
        onEquip={onEquip}
        onDismissReveal={onDismissReveal}
      />,
    );

    const row = (): HTMLElement | null =>
      container.querySelector<HTMLElement>('li[data-slot="wing-left"]');
    expect(row()?.getAttribute('data-equipping')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(MOTION.equipRowFlashMs);
    });
    expect(row()?.getAttribute('data-equipping')).toBeNull();
  });

  it('restores focus to Open lootbox after an in-panel dismissal', () => {
    const onDismissReveal = vi.fn();
    const customization: CustomizationState = {
      lootboxes: 1,
      keys: 1,
      parts: { 'wing-left-silver': 1 },
      appearance: {},
    };
    const { container, rerender } = renderPanel({
      customization,
      lastLootboxGrant: grant(),
      onDismissReveal,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }));
    rerender(
      <SpaceshipCustomizationPanel
        customization={customization}
        mode="guest"
        {...HANDLERS}
        lastLootboxGrant={null}
        onDismissReveal={onDismissReveal}
      />,
    );

    expect(panelRoot(container).getAttribute('data-reveal-active')).toBe('false');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open lootbox' }));
  });

  it('restores focus to Open lootbox after Escape', () => {
    const onDismissReveal = vi.fn();
    const customization: CustomizationState = {
      lootboxes: 1,
      keys: 1,
      parts: { 'wing-left-silver': 1 },
      appearance: {},
    };
    const { rerender } = renderPanel({
      customization,
      lastLootboxGrant: grant(),
      onDismissReveal,
    });

    fireEvent.keyDown(screen.getByRole('button', { name: 'Equip Port Silver Wing' }), {
      key: 'Escape',
    });
    rerender(
      <SpaceshipCustomizationPanel
        customization={customization}
        mode="guest"
        {...HANDLERS}
        lastLootboxGrant={null}
        onDismissReveal={onDismissReveal}
      />,
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open lootbox' }));
  });

  it('dismisses exactly once when the panel unmounts while revealing', () => {
    const onDismissReveal = vi.fn();
    const { unmount } = renderPanel({ lastLootboxGrant: grant(), onDismissReveal });

    expect(onDismissReveal).toHaveBeenCalledTimes(0);
    unmount();
    expect(onDismissReveal).toHaveBeenCalledTimes(1);
    expect(onDismissReveal).toHaveBeenCalledWith();
  });

  it('reopens the normal panel after the unmount dismissal cleared the grant', () => {
    const onDismissReveal = vi.fn();
    const first = renderPanel({ lastLootboxGrant: grant(), onDismissReveal });
    first.unmount();

    const reopened = renderPanel({ lastLootboxGrant: null, onDismissReveal });
    const section = panelRoot(reopened.container);
    expect(section.getAttribute('data-reveal-active')).toBe('false');
    expect(section.querySelector('.lootbox-reveal')).toBeNull();
    expect(section.querySelector('h2.customization-title')?.textContent).toBe(
      'Spaceship hangar',
    );
    expect(onDismissReveal).toHaveBeenCalledTimes(1);
  });

  it('never dismisses on a grant-to-grant replacement, but does once on unmount', () => {
    const onDismissReveal = vi.fn();
    const customization: CustomizationState = {
      lootboxes: 2,
      keys: 2,
      parts: { 'wing-left-silver': 1, 'hull-gold': 1 },
      appearance: {},
    };
    const { container, rerender, unmount } = renderPanel({
      customization,
      lastLootboxGrant: grant({ sequence: 1 }),
      onDismissReveal,
    });

    rerender(
      <SpaceshipCustomizationPanel
        customization={customization}
        mode="guest"
        {...HANDLERS}
        lastLootboxGrant={grant({
          partId: 'hull-gold',
          slot: 'hull',
          rarity: 'epic',
          sequence: 2,
        })}
        onDismissReveal={onDismissReveal}
      />,
    );

    expect(onDismissReveal).toHaveBeenCalledTimes(0);
    expect(revealRegion(container).getAttribute('data-reveal-sequence')).toBe('2');
    expect(revealRegion(container).getAttribute('data-part-id')).toBe('hull-gold');

    unmount();
    expect(onDismissReveal).toHaveBeenCalledTimes(1);
  });

  it('does not restore focus to the absent Open lootbox on unmount', () => {
    const onDismissReveal = vi.fn();
    const { unmount } = renderPanel({
      lastLootboxGrant: grant(),
      parts: { 'wing-left-silver': 1 },
      onDismissReveal,
    });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Equip Port Silver Wing' }),
    );

    unmount();
    expect(document.activeElement).toBe(document.body);

    renderPanel({ lastLootboxGrant: null, onDismissReveal });
    expect(document.activeElement).toBe(document.body);
    expect(onDismissReveal).toHaveBeenCalledTimes(1);
  });

  it('keeps the reveal mounted with no input for 10 seconds (no auto-dismiss)', () => {
    vi.useFakeTimers();
    const onDismissReveal = vi.fn();
    const { container } = renderPanel({
      lastLootboxGrant: grant(),
      parts: { 'wing-left-silver': 1 },
      onDismissReveal,
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(revealRegion(container).getAttribute('data-reveal-phase')).toBe('rest');
    expect(onDismissReveal).toHaveBeenCalledTimes(0);
  });
});

describe('SpaceshipCustomizationPanel equip-row flash (AC-43)', () => {
  it('sets data-equipping on the equipped slot for exactly 260 ms', () => {
    vi.useFakeTimers();
    const onEquip = vi.fn();
    const { container } = renderPanel({
      customization: {
        lootboxes: 0,
        keys: 0,
        parts: { 'wing-left-silver': 1 },
        appearance: {},
      },
      onEquip,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Equip Port Silver Wing' }));
    expect(onEquip).toHaveBeenCalledWith('wing-left-silver');

    const row = (): HTMLElement | null =>
      container.querySelector<HTMLElement>('li[data-slot="wing-left"]');
    expect(row()?.getAttribute('data-equipping')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(259);
    });
    expect(row()?.getAttribute('data-equipping')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(row()?.getAttribute('data-equipping')).toBeNull();
  });

  it('adds no row flash under reduced motion', () => {
    vi.useFakeTimers();
    const { container } = renderPanel({
      customization: {
        lootboxes: 0,
        keys: 0,
        parts: { 'wing-left-silver': 1 },
        appearance: {},
      },
      reducedMotion: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Equip Port Silver Wing' }));
    expect(
      container.querySelector('li[data-slot="wing-left"]')?.getAttribute('data-equipping'),
    ).toBeNull();
  });

  it('uses the pinned 260 ms flash token', () => {
    expect(MOTION.equipRowFlashMs).toBe(260);
  });
});

describe('SpaceshipCustomizationPanel preview (AC-31)', () => {
  it('keeps the labeled live-preview canvas inside the normal panel', () => {
    const html = panel();
    expect(html).toContain('<canvas');
    expect(html).toContain('class="spaceship-preview"');
    expect(html).toContain('aria-label="Spaceship preview"');
    expect(html).toContain('data-preview-slot-hull="hull-default"');
    expect(html).toContain('data-preview-slot-tail-fin="tail-fin-default"');
  });

  it('renders no preview canvas while revealing (one panel canvas at most)', () => {
    vi.useFakeTimers();
    const { container } = renderPanel({ lastLootboxGrant: grant() });
    expect(container.querySelector('.spaceship-preview')).toBeNull();
    expect(container.querySelector('[data-preview-slot-hull]')).toBeNull();
    expect(revealRegion(container).getAttribute('data-part-id')).toBe('wing-left-silver');
  });
});

describe('SpaceshipCustomizationPanel mode', () => {
  it('records the authenticated mode on the section', () => {
    const html = panel({ mode: 'account', lootboxes: 1, keys: 1 });
    expect(html).toContain('data-mode="account"');
  });

  it('records the authenticated mode on the section while revealing', () => {
    const { container } = renderPanel({ mode: 'account', lastLootboxGrant: grant() });
    expect(panelRoot(container).getAttribute('data-mode')).toBe('account');
  });
});
