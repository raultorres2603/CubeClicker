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

describe('SpaceshipCustomizationPanel slots (AC-29)', () => {
  it('renders exactly ten slot rows in SLOT_CATALOG order with the section contract', () => {
    const { container } = renderPanel();

    const section = container.querySelector('section');
    expect(section?.getAttribute('aria-label')).toBe('Spaceship customization');
    expect(section?.getAttribute('data-mode')).toBe('guest');

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

  it('renders exactly three variants per row in standard → rare → epic order', () => {
    const { container } = renderPanel();
    const rows = Array.from(container.querySelectorAll<HTMLElement>('li.customization-slot'));

    for (const [index, row] of rows.entries()) {
      const slot = SLOT_CATALOG[index];
      if (slot === undefined) throw new Error('slot missing');
      const variants = Array.from(
        row.querySelectorAll<HTMLElement>('li.customization-variant'),
      );
      expect(variants.map((variant) => variant.getAttribute('data-part'))).toEqual(
        partsForSlot(slot.id).map((part) => part.id),
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
});

describe('SpaceshipCustomizationPanel lootbox controls (AC-29)', () => {
  it('renders the lootbox/key counts and one Open lootbox button', () => {
    const html = panel({ lootboxes: 3, keys: 2 });
    expect(html).toContain('Lootboxes: 3');
    expect(html).toContain('Keys: 2');
    expect(html).toContain('Open lootbox');
    expect((html.match(/customization-open/g) ?? []).length).toBe(1);
  });

  it('disables Open lootbox when lootboxes are zero', () => {
    const html = panel({ lootboxes: 0, keys: 5 });
    expect(html).toContain(
      '<button type="button" class="customization-open" disabled="">Open lootbox</button>',
    );
  });

  it('disables Open lootbox when keys are zero', () => {
    const html = panel({ lootboxes: 5, keys: 0 });
    expect(html).toContain(
      '<button type="button" class="customization-open" disabled="">Open lootbox</button>',
    );
  });

  it('disables Open lootbox while an account open is pending', () => {
    const html = panel({ lootboxes: 1, keys: 1, pendingOpen: true });
    expect(html).toContain(
      '<button type="button" class="customization-open" disabled="">Open lootbox</button>',
    );
  });

  it('enables Open lootbox with both counts and no pending open', () => {
    const html = panel({ lootboxes: 1, keys: 1, pendingOpen: false });
    expect(html).toContain(
      '<button type="button" class="customization-open">Open lootbox</button>',
    );
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

describe('SpaceshipCustomizationPanel reveal (AC-32, AC-41)', () => {
  it('renders the rare/new grant region with the pinned data attributes and copy', () => {
    const { container } = renderPanel({ lastLootboxGrant: grant() });
    const region = container.querySelector<HTMLElement>('[data-reveal-active="true"]');

    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('data-part-id')).toBe('wing-left-silver');
    expect(region?.getAttribute('data-slot')).toBe('wing-left');
    expect(region?.getAttribute('data-rarity')).toBe('rare');
    expect(region?.getAttribute('data-duplicate')).toBe('false');
    expect(region?.getAttribute('data-reveal-sequence')).toBe('1');
    expect(region?.getAttribute('data-reveal-phase')).toBe('charge');
    expect(region?.textContent).toContain('Rare');
    expect(region?.textContent).toContain('Port Silver Wing');
    expect(region?.textContent).toContain('Port Wing');
    expect(region?.textContent).toContain('New');
    expect(screen.getByRole('button', { name: 'Equip Port Silver Wing' })).toBeTruthy();
  });

  it('renders the epic/duplicate copy and the wireframe orb with an orange core', () => {
    const { container } = renderPanel({
      lastLootboxGrant: grant({
        partId: 'hull-gold',
        slot: 'hull',
        rarity: 'epic',
        duplicate: true,
        sequence: 4,
      }),
    });
    const region = container.querySelector<HTMLElement>('[data-reveal-active="true"]');

    expect(region?.getAttribute('data-rarity')).toBe('epic');
    expect(region?.getAttribute('data-duplicate')).toBe('true');
    expect(region?.getAttribute('data-reveal-sequence')).toBe('4');
    expect(region?.textContent).toContain('Epic');
    expect(region?.textContent).toContain('Gold Hull');
    expect(region?.textContent).toContain('Hull');
    expect(region?.textContent).toContain('Duplicate');

    const orb = region?.querySelector('svg[data-reveal-orb="true"]');
    expect(orb?.getAttribute('aria-hidden')).toBe('true');
    expect(orb?.querySelectorAll('circle')).toHaveLength(2);
    expect(orb?.querySelectorAll('ellipse')).toHaveLength(2);
    expect(orb?.querySelector('.lootbox-orb-core')?.getAttribute('r')).toBe('6');
    expect(region?.querySelector('[data-reveal-flash="true"]')).not.toBeNull();
  });

  it('renders no reveal region without a grant', () => {
    const html = panel();
    expect(html).not.toContain('data-reveal-active');
    expect(html).not.toContain('role="status"');
  });

  it('advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline', () => {
    vi.useFakeTimers();
    const { container } = renderPanel({ lastLootboxGrant: grant({ sequence: 9 }) });
    const region = (): HTMLElement | null =>
      container.querySelector<HTMLElement>('[data-reveal-active="true"]');

    expect(region()?.getAttribute('data-reveal-phase')).toBe('charge');

    act(() => {
      vi.advanceTimersByTime(419);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('charge');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('orb');

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('orb');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('flash');

    act(() => {
      vi.advanceTimersByTime(119);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('flash');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('reveal');

    act(() => {
      vi.advanceTimersByTime(359);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('reveal');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('settle');

    act(() => {
      vi.advanceTimersByTime(139);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('settle');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('rest');
  });

  it('keeps the reveal, orb and card non-shrinking and fully visible at the reveal phase', () => {
    vi.useFakeTimers();
    withPanelStyles(() => {
      const { container } = renderPanel({ lastLootboxGrant: grant({ sequence: 21 }) });
      act(() => {
        vi.advanceTimersByTime(
          MOTION.lootboxChargeMs + MOTION.orbOvershootMs + MOTION.lootboxFlashMs,
        );
      });

      const panel = container.querySelector<HTMLElement>('section.customization-panel');
      const region = container.querySelector<HTMLElement>('[data-reveal-active="true"]');
      const orb = region?.querySelector<SVGSVGElement>('svg[data-reveal-orb="true"]');
      const card = region?.querySelector<HTMLElement>('[data-reveal-card="true"]');

      expect(region?.getAttribute('data-reveal-phase')).toBe('reveal');
      expect(region?.getAttribute('role')).toBe('status');
      expect(panel).not.toBeNull();
      expect(region).not.toBeNull();
      expect(orb).not.toBeNull();
      expect(card).not.toBeNull();
      if (panel === null || !region || !orb || !card) {
        throw new Error('reveal layout elements missing');
      }

      // The panel remains the scroll container; its 60vh cap resolves to 460.8px in
      // jsdom's 1024x768 viewport (432px at the failed 1280x720 capture).
      const panelStyle = window.getComputedStyle(panel);
      expect(panelStyle.display).toBe('flex');
      expect(panelStyle.flexDirection).toBe('column');
      expect(panelStyle.overflowY).toBe('auto');
      expect(panelStyle.maxHeight).toBe('460.8px');

      const revealStyle = window.getComputedStyle(region);
      expect(revealStyle.display).toBe('flex');
      expect(revealStyle.flexDirection).toBe('column');
      expect(revealStyle.flexShrink).toBe('0');
      expect(revealStyle.flexBasis).toBe('auto');
      expect(revealStyle.overflow).toBe('visible');
      expect(revealStyle.minHeight).toBe('288px');
      expect(revealStyle.paddingTop).toBe('8px');
      expect(revealStyle.paddingBottom).toBe('8px');

      const orbStyle = window.getComputedStyle(orb);
      expect(orbStyle.flexShrink).toBe('0');
      expect(orbStyle.width).toBe('80px');
      expect(orbStyle.height).toBe('80px');
      expect(orbStyle.minWidth).toBe('80px');
      expect(orbStyle.minHeight).toBe('80px');

      const cardStyle = window.getComputedStyle(card);
      expect(cardStyle.flexShrink).toBe('0');
      expect(cardStyle.overflow).toBe('visible');
      expect(card.querySelector('.lootbox-reveal-part')?.textContent).toBe('Port Silver Wing');
      expect(card.querySelector('.lootbox-reveal-slot')?.textContent).toBe('Port Wing');

      const revealMinBox =
        Number.parseFloat(revealStyle.minHeight) +
        Number.parseFloat(revealStyle.paddingTop) +
        Number.parseFloat(revealStyle.paddingBottom);
      expect(revealMinBox).toBe(304);
      expect(revealMinBox).toBeLessThanOrEqual(Number.parseFloat(panelStyle.maxHeight));
    });
  });

  it('restarts the timeline when the same part is reopened with a new sequence', () => {
    vi.useFakeTimers();
    const { container, rerender } = renderPanel({
      lastLootboxGrant: grant({ sequence: 11 }),
    });
    act(() => {
      vi.advanceTimersByTime(1290);
    });
    expect(
      container.querySelector('[data-reveal-active="true"]')?.getAttribute('data-reveal-phase'),
    ).toBe('rest');

    rerender(
      <SpaceshipCustomizationPanel
        customization={EMPTY}
        mode="guest"
        {...HANDLERS}
        lastLootboxGrant={grant({ sequence: 12 })}
      />,
    );

    const region = container.querySelector<HTMLElement>('[data-reveal-active="true"]');
    expect(region?.getAttribute('data-reveal-sequence')).toBe('12');
    expect(region?.getAttribute('data-reveal-phase')).toBe('charge');
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(
      container.querySelector('[data-reveal-active="true"]')?.getAttribute('data-reveal-phase'),
    ).toBe('orb');
  });

  it('renders the settled reveal instantly under reduced motion', () => {
    vi.useFakeTimers();
    const { container } = renderPanel({
      lastLootboxGrant: grant({ sequence: 3 }),
      reducedMotion: true,
    });
    const region = (): HTMLElement | null =>
      container.querySelector<HTMLElement>('[data-reveal-active="true"]');

    expect(region()?.getAttribute('data-reveal-phase')).toBe('rest');
    expect(region()?.getAttribute('data-reduced-motion')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(1290);
    });
    expect(region()?.getAttribute('data-reveal-phase')).toBe('rest');
  });

  it('dismisses the reveal through onDismissReveal', () => {
    const onDismissReveal = vi.fn();
    renderPanel({ lastLootboxGrant: grant(), onDismissReveal });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }));
    expect(onDismissReveal).toHaveBeenCalledTimes(1);
  });

  it('equips the revealed part through the panel command', () => {
    const onEquip = vi.fn();
    renderPanel({ lastLootboxGrant: grant(), onEquip });

    fireEvent.click(screen.getByRole('button', { name: 'Equip Port Silver Wing' }));
    expect(onEquip).toHaveBeenCalledTimes(1);
    expect(onEquip).toHaveBeenCalledWith('wing-left-silver');
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
  it('keeps the labeled live-preview canvas inside the panel', () => {
    const html = panel();
    expect(html).toContain('<canvas');
    expect(html).toContain('class="spaceship-preview"');
    expect(html).toContain('aria-label="Spaceship preview"');
    expect(html).toContain('data-preview-slot-hull="hull-default"');
    expect(html).toContain('data-preview-slot-tail-fin="tail-fin-default"');
  });
});

describe('SpaceshipCustomizationPanel mode', () => {
  it('records the authenticated mode on the section', () => {
    const html = panel({ mode: 'account', lootboxes: 1, keys: 1 });
    expect(html).toContain('data-mode="account"');
  });
});
