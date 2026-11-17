/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs';

import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOTION } from '../game/motion';
import { PART_CATALOG_V2, SLOT_CATALOG, partsForSlot, type SlotId } from '../game/parts-v2';
import type { CustomizationState, LootboxGrant } from '../game/types';
import type { HangarTabId } from './hangar-tabs';
import {
  SpaceshipCustomizationPanel,
  type SpaceshipCustomizationPanelProps,
} from './SpaceshipCustomizationPanel';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const EMPTY: CustomizationState = { lootboxes: 0, keys: 0, parts: {}, appearance: {} };

/** A normal panel with stock counts and one owned wing part for the reveal scenarios. */
const CUSTOMIZATION: CustomizationState = {
  lootboxes: 1,
  keys: 1,
  parts: { 'wing-left-silver': 1 },
  appearance: {},
};

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

/** Parses the server markup into a detached DOM so SSR can reuse the DOM helpers. */
function ssrPanel(overrides: Partial<SpaceshipCustomizationPanelProps> = {}): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = panel(overrides);
  return host;
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

/**
 * The pinned spec § Tab set table, written out here so the DOM assertions never read the
 * module under test: a grouping change must fail this table, not silently rewrite it.
 */
interface TabFixture {
  readonly id: HangarTabId;
  readonly label: string;
  readonly slots: readonly SlotId[];
}

const TABS: readonly TabFixture[] = [
  { id: 'frame', label: 'Frame', slots: ['hull', 'tail-fin'] },
  { id: 'front', label: 'Front', slots: ['nose', 'cockpit'] },
  { id: 'wings', label: 'Wings', slots: ['wing-left', 'wing-right'] },
  { id: 'engines', label: 'Engines', slots: ['engine-left', 'engine-right'] },
  { id: 'ignitions', label: 'Ignitions', slots: ['ignition-left', 'ignition-right'] },
];

/** The ten catalog slot ids in `SLOT_CATALOG` order (AC-3's union target). */
const CATALOG_SLOTS = SLOT_CATALOG.map((slot) => slot.id);

/** Slot display names pinned independently of the component. */
const SLOT_NAME: Readonly<Record<SlotId, string>> = {
  hull: 'Hull',
  nose: 'Nose',
  cockpit: 'Cockpit',
  'wing-left': 'Port Wing',
  'wing-right': 'Starboard Wing',
  'engine-left': 'Port Engine',
  'engine-right': 'Starboard Engine',
  'ignition-left': 'Port Ignition',
  'ignition-right': 'Starboard Ignition',
  'tail-fin': 'Tail Fin',
};

/** Standard part display names pinned independently of the component. */
const STANDARD_NAME: Readonly<Record<SlotId, string>> = {
  hull: 'Steel Hull',
  nose: 'Alloy Nose',
  cockpit: 'Teal Canopy',
  'wing-left': 'Port Wing',
  'wing-right': 'Starboard Wing',
  'engine-left': 'Port Engine',
  'engine-right': 'Starboard Engine',
  'ignition-left': 'Port Flame',
  'ignition-right': 'Starboard Flame',
  'tail-fin': 'Standard Fin',
};

/** The tab strip (the single `role="tablist"`). */
function tablist(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>('.customization-tabs');
  if (element === null) {
    throw new Error('tab strip missing');
  }
  return element;
}

/** Every tab button, in DOM order. */
function tabButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('.customization-tabs [role="tab"]'),
  );
}

/** One tab button by its stable `data-tab` id. */
function tabButton(container: HTMLElement, id: HangarTabId): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `button.customization-tab[data-tab="${id}"]`,
  );
  if (button === null) {
    throw new Error(`tab button missing: ${id}`);
  }
  return button;
}

/** Selects a tab the way a player does. */
function selectTab(container: HTMLElement, id: HangarTabId): void {
  fireEvent.click(tabButton(container, id));
}

/** The single `role="tabpanel"`. */
function tabpanel(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>('.customization-tabpanel');
  if (element === null) {
    throw new Error('tab panel missing');
  }
  return element;
}

/** The one owned-count badge of a tab. */
function badge(container: HTMLElement, id: HangarTabId): HTMLElement {
  const element = tabButton(container, id).querySelector<HTMLElement>(
    '.customization-tab-badge',
  );
  if (element === null) {
    throw new Error(`tab badge missing: ${id}`);
  }
  return element;
}

/** Every rendered slot row, in DOM order. */
function slotRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('li.customization-slot'));
}

/** The rendered rows' `data-slot` values, in DOM order. */
function slotIds(container: HTMLElement): string[] {
  return slotRows(container).map((row) => row.getAttribute('data-slot') ?? '');
}

/** Per-tab owned badge values, in tab-strip order. */
function badgeValues(container: HTMLElement): (string | null)[] {
  return TABS.map((tab) => badge(container, tab.id).getAttribute('data-owned'));
}

/** The map fixture that owns all 30 catalog parts exactly once (AC-10 all-owned). */
function allOwnedParts(): Record<string, number> {
  return Object.fromEntries(PART_CATALOG_V2.map((part) => [part.id, 1]));
}

interface LandingObservation {
  readonly values: (string | null)[];
  readonly oldValues: (string | null)[];
  readonly addedTabpanels: number;
  readonly container: HTMLElement;
}

/**
 * Renders the reveal branch, arms a MutationObserver on the section's `data-active-tab`
 * attribute and on tabpanel insertions, then rerenders the normal branch and flushes the
 * observer queue. Exactly one attribute record (with a `null` old value) and exactly one
 * inserted tabpanel prove the landing tab was committed in a single render: no default-tab
 * commit and no second tab-swap fade (AC-6/AC-15).
 */
async function observeLanding(
  revealing: Partial<SpaceshipCustomizationPanelProps>,
  cleared: Partial<SpaceshipCustomizationPanelProps>,
): Promise<LandingObservation> {
  const { container, rerender } = renderPanel(revealing);
  const section = panelRoot(container);
  const values: (string | null)[] = [];
  const oldValues: (string | null)[] = [];
  let addedTabpanels = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.attributeName === 'data-active-tab') {
        oldValues.push(record.oldValue);
        values.push(
          record.target instanceof Element
            ? record.target.getAttribute('data-active-tab')
            : null,
        );
      }
      if (record.type === 'childList') {
        for (const node of Array.from(record.addedNodes)) {
          if (!(node instanceof Element)) {
            continue;
          }
          if (
            node.matches('.customization-tabpanel') ||
            node.querySelector('.customization-tabpanel') !== null
          ) {
            addedTabpanels += 1;
          }
        }
      }
    }
  });
  observer.observe(section, {
    attributes: true,
    attributeFilter: ['data-active-tab'],
    attributeOldValue: true,
    childList: true,
    subtree: true,
  });
  rerender(
    <SpaceshipCustomizationPanel
      customization={EMPTY}
      mode="guest"
      {...HANDLERS}
      {...revealing}
      {...cleared}
    />,
  );
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  observer.disconnect();
  return { values, oldValues, addedTabpanels, container };
}

describe('SpaceshipCustomizationPanel hangar tabs (AC-2, AC-3)', () => {
  it('renders one five-tab tablist with the pinned ARIA contract in the normal state', () => {
    const { container } = renderPanel();

    const section = panelRoot(container);
    expect(section.getAttribute('aria-label')).toBe('Spaceship customization');
    expect(section.getAttribute('data-mode')).toBe('guest');
    expect(section.getAttribute('data-reveal-active')).toBe('false');
    expect(section.getAttribute('data-active-tab')).toBe('frame');

    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    const strip = tablist(container);
    expect(strip.getAttribute('role')).toBe('tablist');
    expect(strip.getAttribute('aria-label')).toBe('Spaceship part groups');
    expect(strip.hasAttribute('aria-live')).toBe(false);
    expect(strip.hasAttribute('aria-labelledby')).toBe(false);

    const buttons = tabButtons(container);
    expect(buttons).toHaveLength(5);
    expect(buttons.map((button) => button.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON', 'BUTTON']);
    expect(buttons.map((button) => button.type)).toEqual(['button', 'button', 'button', 'button', 'button']);
    expect(buttons.map((button) => button.className)).toEqual([
      'customization-tab',
      'customization-tab',
      'customization-tab',
      'customization-tab',
      'customization-tab',
    ]);
    expect(buttons.map((button) => button.id)).toEqual(
      TABS.map((tab) => `customization-tab-${tab.id}`),
    );
    expect(buttons.map((button) => button.getAttribute('data-tab'))).toEqual(
      TABS.map((tab) => tab.id),
    );
    expect(buttons.map((button) => button.firstChild?.textContent)).toEqual(
      TABS.map((tab) => tab.label),
    );
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Frame0/4',
      'Front0/4',
      'Wings0/4',
      'Engines0/4',
      'Ignitions0/4',
    ]);
    expect(buttons.map((button) => button.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Frame, 0 of 4 parts owned',
      'Front, 0 of 4 parts owned',
      'Wings, 0 of 4 parts owned',
      'Engines, 0 of 4 parts owned',
      'Ignitions, 0 of 4 parts owned',
    ]);

    const selected = buttons.filter(
      (button) => button.getAttribute('aria-selected') === 'true',
    );
    const focusable = buttons.filter((button) => button.tabIndex === 0);
    expect(selected).toHaveLength(1);
    expect(focusable).toHaveLength(1);
    expect(selected[0]).toBe(focusable[0]);
    expect(selected[0]?.getAttribute('data-tab')).toBe('frame');

    // One panel exists, so no tab points at a panel id and no IDREF dangles.
    expect(container.querySelectorAll('[aria-controls]')).toHaveLength(0);

    for (const tab of TABS) {
      const button = tabButton(container, tab.id);
      const badges = button.querySelectorAll('.customization-tab-badge');
      expect(badges).toHaveLength(1);
      const ownedBadge = badge(container, tab.id);
      expect(ownedBadge.tagName).toBe('SPAN');
      expect(ownedBadge.getAttribute('aria-hidden')).toBe('true');
      expect(ownedBadge.getAttribute('data-owned')).toBe('0');
      expect(ownedBadge.getAttribute('data-total')).toBe('4');
      expect(ownedBadge.textContent).toBe('0/4');
      expect(button.lastElementChild).toBe(ownedBadge);
    }
  });

  it('renders the same tab-strip contract on the server', () => {
    const container = ssrPanel();

    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('frame');
    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    expect(tablist(container).getAttribute('aria-label')).toBe('Spaceship part groups');
    expect(tabButtons(container)).toHaveLength(5);
    expect(tabButtons(container).map((button) => button.id)).toEqual(
      TABS.map((tab) => `customization-tab-${tab.id}`),
    );
    expect(tabButtons(container).map((button) => button.getAttribute('aria-label'))).toEqual(
      TABS.map((tab) => `${tab.label}, 0 of 4 parts owned`),
    );
    expect(container.querySelectorAll('[aria-controls]')).toHaveLength(0);
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
  });

  it('renders exactly one tabpanel wrapping only the active group rows', () => {
    const { container } = renderPanel();

    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(1);
    const activePanel = tabpanel(container);
    expect(activePanel.className).toBe('customization-tabpanel');
    expect(activePanel.id).toBe('customization-tabpanel');
    expect(activePanel.hasAttribute('tabindex')).toBe(false);
    expect(activePanel.getAttribute('data-tabpanel')).toBe('frame');
    expect(activePanel.getAttribute('aria-labelledby')).toBe('customization-tab-frame');
    expect(activePanel.parentElement).toBe(panelRoot(container));
    const list = activePanel.querySelector('ul');
    expect(list?.className).toBe('customization-slots');
    expect(slotIds(container)).toEqual(['hull', 'tail-fin']);

    // The IDREF resolves to exactly the selected tab button.
    expect(container.querySelectorAll('#customization-tab-frame')).toHaveLength(1);
    expect(container.querySelector('#customization-tab-frame')).toBe(
      tabButton(container, 'frame'),
    );

    const seen: string[] = [];
    for (const tab of TABS) {
      selectTab(container, tab.id);
      expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
      expect(tabpanel(container).getAttribute('data-tabpanel')).toBe(tab.id);
      expect(tabpanel(container).getAttribute('aria-labelledby')).toBe(
        `customization-tab-${tab.id}`,
      );
      expect(container.querySelector(`#customization-tab-${tab.id}`)).toBe(
        tabButton(container, tab.id),
      );

      const rows = slotRows(container);
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.getAttribute('data-slot'))).toEqual([...tab.slots]);
      seen.push(...rows.map((row) => row.getAttribute('data-slot') ?? ''));

      for (const row of rows) {
        const variants = Array.from(
          row.querySelectorAll<HTMLElement>('li.customization-variant'),
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
        expect(
          variants.map(
            (variant) =>
              variant.querySelector('.customization-swatch')?.getAttribute('aria-hidden'),
          ),
        ).toEqual(['true', 'true', 'true']);
      }
    }

    expect(seen).toHaveLength(10);
    expect(seen.slice().sort()).toEqual(CATALOG_SLOTS.slice().sort());
    expect(new Set(seen)).toEqual(new Set(CATALOG_SLOTS));
  });
});

describe('SpaceshipCustomizationPanel tab activation (AC-4)', () => {
  it('selects a tab on click in the same commit', () => {
    const { container } = renderPanel();

    for (const tab of TABS) {
      selectTab(container, tab.id);
      expect(tabButtons(container).map((button) => button.getAttribute('aria-selected'))).toEqual(
        TABS.map((candidate) => (candidate.id === tab.id ? 'true' : 'false')),
      );
      expect(tabButtons(container).map((button) => button.tabIndex)).toEqual(
        TABS.map((candidate) => (candidate.id === tab.id ? 0 : -1)),
      );
      expect(panelRoot(container).getAttribute('data-active-tab')).toBe(tab.id);
      expect(tabpanel(container).getAttribute('data-tabpanel')).toBe(tab.id);
      expect(tabpanel(container).getAttribute('aria-labelledby')).toBe(
        `customization-tab-${tab.id}`,
      );
      expect(slotIds(container)).toEqual([...tab.slots]);
      expect(slotRows(container)).toHaveLength(2);
    }
  });

  it('moves selection and focus with ArrowRight, ArrowLeft, Home and End, and prevents the default', () => {
    const onOpenLootbox = vi.fn();
    const onOpen = vi.fn();
    const onEquip = vi.fn();
    const onEquipPart = vi.fn();
    const onUnequip = vi.fn();
    const onDismissReveal = vi.fn();
    const { container } = renderPanel({
      onOpenLootbox,
      onOpen,
      onEquip,
      onEquipPart,
      onUnequip,
      onDismissReveal,
    });
    const section = panelRoot(container);

    // jsdom renders no layout: pin the offset so the assertion is concrete rather than
    // depending on jsdom's scroll implementation.
    let scrollTop = 40;
    Object.defineProperty(section, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    expect(section.scrollTop).toBe(40);

    tabButton(container, 'frame').focus();
    expect(document.activeElement).toBe(tabButton(container, 'frame'));

    const press = (key: string): boolean => {
      const target = document.activeElement;
      if (!(target instanceof HTMLElement)) {
        throw new Error('no focused element');
      }
      const event = createEvent.keyDown(target, { key });
      fireEvent(target, event);
      return event.defaultPrevented;
    };

    expect(press('ArrowRight')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('front');
    expect(document.activeElement).toBe(tabButton(container, 'front'));
    expect(tabButton(container, 'front').getAttribute('aria-selected')).toBe('true');
    expect(tabButton(container, 'front').tabIndex).toBe(0);
    expect(tabButton(container, 'frame').getAttribute('aria-selected')).toBe('false');
    expect(tabButton(container, 'frame').tabIndex).toBe(-1);
    expect(slotIds(container)).toEqual(['nose', 'cockpit']);

    expect(press('ArrowRight')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('wings');
    expect(press('ArrowRight')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('engines');
    expect(press('ArrowRight')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('ignitions');
    expect(document.activeElement).toBe(tabButton(container, 'ignitions'));

    // Right wraps ignitions → frame.
    expect(press('ArrowRight')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('frame');
    expect(document.activeElement).toBe(tabButton(container, 'frame'));

    // Left wraps frame → ignitions.
    expect(press('ArrowLeft')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('ignitions');
    expect(document.activeElement).toBe(tabButton(container, 'ignitions'));

    expect(press('Home')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('frame');
    expect(document.activeElement).toBe(tabButton(container, 'frame'));

    expect(press('End')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('ignitions');
    expect(document.activeElement).toBe(tabButton(container, 'ignitions'));

    // Unhandled keys change nothing and are not prevented.
    expect(press('a')).toBe(false);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('ignitions');
    expect(document.activeElement).toBe(tabButton(container, 'ignitions'));
    expect(press('ArrowDown')).toBe(false);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('ignitions');

    // The panel is the 60vh scroll container: every handled key prevented the default, so
    // its scroll offset never moves.
    expect(section.scrollTop).toBe(40);

    for (const handler of [
      onOpenLootbox,
      onOpen,
      onEquip,
      onEquipPart,
      onUnequip,
      onDismissReveal,
    ]) {
      expect(handler).toHaveBeenCalledTimes(0);
    }
  });
});

describe('SpaceshipCustomizationPanel tab swap (AC-15, AC-16)', () => {
  it('mounts a new tabpanel per switch while the strip and the preview stay mounted', () => {
    const { container } = renderPanel();
    const strip = tablist(container);
    const preview = container.querySelector('.spaceship-preview');
    if (preview === null) {
      throw new Error('preview missing');
    }
    const framePanel = tabpanel(container);
    const frameTab = tabButton(container, 'frame');

    selectTab(container, 'wings');
    const wingsPanel = tabpanel(container);
    expect(wingsPanel).not.toBe(framePanel);
    expect(wingsPanel.getAttribute('data-tabpanel')).toBe('wings');
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    expect(tablist(container)).toBe(strip);
    expect(container.querySelector('.spaceship-preview')).toBe(preview);
    expect(tabButton(container, 'frame')).toBe(frameTab);

    selectTab(container, 'frame');
    const returnedPanel = tabpanel(container);
    expect(returnedPanel).not.toBe(framePanel);
    expect(returnedPanel).not.toBe(wingsPanel);
    expect(returnedPanel.getAttribute('data-tabpanel')).toBe('frame');
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
  });

  it('adds no timer and no closing state for a tab switch', () => {
    vi.useFakeTimers();
    const { container } = renderPanel();

    expect(vi.getTimerCount()).toBe(0);
    selectTab(container, 'wings');
    selectTab(container, 'ignitions');
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('[data-closing]')).toBeNull();
    expect(panelRoot(container).hasAttribute('data-closing')).toBe(false);
  });
});

describe('SpaceshipCustomizationPanel tab badges (AC-5)', () => {
  it('renders 0/4 for every tab when nothing is owned', () => {
    const { container } = renderPanel({ parts: {} });

    expect(badgeValues(container)).toEqual(['0', '0', '0', '0', '0']);
    expect(tabButtons(container).map((button) => button.textContent)).toEqual([
      'Frame0/4',
      'Front0/4',
      'Wings0/4',
      'Engines0/4',
      'Ignitions0/4',
    ]);
    expect(tabButtons(container).map((button) => button.getAttribute('aria-label'))).toEqual(
      TABS.map((tab) => `${tab.label}, 0 of 4 parts owned`),
    );
    expect(TABS.map((tab) => badge(container, tab.id).getAttribute('data-total'))).toEqual([
      '4',
      '4',
      '4',
      '4',
      '4',
    ]);
  });

  it('counts only owned lootable parts, per tab', () => {
    const { container } = renderPanel({
      parts: {
        'hull-gold': 2,
        'nose-crimson': 1,
        'cockpit-oracle': 1,
        'wing-left-silver': 1,
        'engine-right-nova': 3,
        'ignition-right-blue': 1,
        'ignition-right-plasma': 1,
      },
    });

    expect(badgeValues(container)).toEqual(['1', '2', '1', '1', '2']);
    expect(TABS.map((tab) => badge(container, tab.id).textContent)).toEqual([
      '1/4',
      '2/4',
      '1/4',
      '1/4',
      '2/4',
    ]);
    expect(tabButtons(container).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Frame, 1 of 4 parts owned',
      'Front, 2 of 4 parts owned',
      'Wings, 1 of 4 parts owned',
      'Engines, 1 of 4 parts owned',
      'Ignitions, 2 of 4 parts owned',
    ]);
  });

  it('reaches the 4/4 badge maximum when both rare and both epic parts are owned', () => {
    const { container } = renderPanel({
      parts: {
        'hull-obsidian': 1,
        'hull-gold': 1,
        'tail-fin-split': 1,
        'tail-fin-comet': 1,
      },
    });

    expect(badgeValues(container)).toEqual(['4', '0', '0', '0', '0']);
    expect(badge(container, 'frame').textContent).toBe('4/4');
    expect(tabButton(container, 'frame').getAttribute('aria-label')).toBe(
      'Frame, 4 of 4 parts owned',
    );
  });

  it('never counts standard parts, zero counts or unknown ids', () => {
    const { container } = renderPanel({
      parts: {
        'hull-default': 2,
        'tail-fin-default': 1,
        'nose-crimson': 0,
        'cockpit-oracle': 0,
        'not-a-part': 5,
      },
    });

    expect(badgeValues(container)).toEqual(['0', '0', '0', '0', '0']);
    expect(tabButton(container, 'frame').getAttribute('aria-label')).toBe(
      'Frame, 0 of 4 parts owned',
    );
  });

  it('counts a bilateral legacy wing id for both wings after normalization', () => {
    const { container } = renderPanel({ parts: { 'wings-silver': 1 } });

    expect(badgeValues(container)).toEqual(['0', '0', '2', '0', '0']);
    expect(badge(container, 'wings').textContent).toBe('2/4');
  });

  it('counts the legacy engine id for both ignitions after normalization', () => {
    const { container } = renderPanel({ parts: { 'engine-blue': 3 } });

    expect(badgeValues(container)).toEqual(['0', '0', '0', '0', '2']);
    expect(badge(container, 'ignitions').textContent).toBe('2/4');
  });

  it('counts a single-slot legacy hull id once after normalization', () => {
    const { container } = renderPanel({ parts: { 'body-obsidian': 1 } });

    expect(badgeValues(container)).toEqual(['1', '0', '0', '0', '0']);
    expect(badge(container, 'frame').textContent).toBe('1/4');
  });
});

describe('SpaceshipCustomizationPanel post-reveal landing (AC-6)', () => {
  it('opens on frame and resets to frame after a full reveal cycle', () => {
    const { container, rerender, unmount } = renderPanel({
      customization: CUSTOMIZATION,
      lastLootboxGrant: grant(),
    });
    expect(panelRoot(container).hasAttribute('data-active-tab')).toBe(false);

    rerender(
      <SpaceshipCustomizationPanel
        customization={CUSTOMIZATION}
        mode="guest"
        {...HANDLERS}
        lastLootboxGrant={null}
      />,
    );
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('wings');
    expect(slotIds(container)).toEqual(['wing-left', 'wing-right']);
    unmount();

    const reopened = renderPanel({ customization: CUSTOMIZATION });
    expect(panelRoot(reopened.container).getAttribute('data-active-tab')).toBe('frame');
    expect(slotIds(reopened.container)).toEqual(['hull', 'tail-fin']);
  });

  it('lands on the wings tab in one commit with no frame value (AC-6)', async () => {
    const landing = await observeLanding(
      { customization: CUSTOMIZATION, lastLootboxGrant: grant() },
      { lastLootboxGrant: null },
    );

    expect(landing.values).toEqual(['wings']);
    expect(landing.oldValues).toEqual([null]);
    expect(landing.values).not.toContain('frame');
    expect(landing.addedTabpanels).toBe(1);
    expect(landing.container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    expect(panelRoot(landing.container).getAttribute('data-active-tab')).toBe('wings');
    expect(tabButton(landing.container, 'wings').getAttribute('aria-selected')).toBe('true');
    expect(tabButton(landing.container, 'wings').tabIndex).toBe(0);
    expect(slotIds(landing.container)).toEqual(['wing-left', 'wing-right']);
    expect(landing.container.querySelectorAll('li[data-slot="hull"]')).toHaveLength(0);
  });

  it('lands on frame for a hull grant in that same single mutation (AC-6)', async () => {
    const landing = await observeLanding(
      {
        customization: CUSTOMIZATION,
        lastLootboxGrant: grant({
          partId: 'hull-gold',
          slot: 'hull',
          rarity: 'epic',
          sequence: 4,
        }),
      },
      { lastLootboxGrant: null },
    );

    expect(landing.values).toEqual(['frame']);
    expect(landing.oldValues).toEqual([null]);
    expect(landing.addedTabpanels).toBe(1);
    expect(panelRoot(landing.container).getAttribute('data-active-tab')).toBe('frame');
    expect(slotIds(landing.container)).toEqual(['hull', 'tail-fin']);
  });

  it('lands on frame for an unknown or invalid part (AC-6)', async () => {
    const landing = await observeLanding(
      {
        lastLootboxGrant: grant({ partId: 'mystery-part', slot: 'warp-core' }),
      },
      { lastLootboxGrant: null },
    );

    expect(landing.values).toEqual(['frame']);
    expect(landing.addedTabpanels).toBe(1);
    expect(panelRoot(landing.container).getAttribute('data-active-tab')).toBe('frame');
  });
});

describe('SpaceshipCustomizationPanel slots (AC-21, AC-29)', () => {
  it('renders two rows for the active tab and reaches all ten catalog slots through the strip', () => {
    const { container } = renderPanel();

    expect(slotIds(container)).toEqual(['hull', 'tail-fin']);

    const seen: string[] = [];
    for (const tab of TABS) {
      selectTab(container, tab.id);
      const ids = slotIds(container);
      expect(ids).toHaveLength(2);
      expect(ids).toEqual([...tab.slots]);
      seen.push(...ids);
    }

    expect(seen).toHaveLength(10);
    expect(new Set(seen)).toEqual(new Set(CATALOG_SLOTS));
    expect(seen.slice().sort()).toEqual(CATALOG_SLOTS.slice().sort());
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('ignitions');
  });

  it('renders exactly three variants per row with catalog rarity and a colour swatch', () => {
    const { container } = renderPanel();

    for (const tab of TABS) {
      selectTab(container, tab.id);
      const rows = slotRows(container);
      expect(rows.map((row) => row.getAttribute('data-slot'))).toEqual([...tab.slots]);

      for (const [index, row] of rows.entries()) {
        const slot = tab.slots[index];
        if (slot === undefined) throw new Error('slot missing');
        const catalog = partsForSlot(slot);
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
    }
  });

  it('shows the slot display name and the equipped part name for every slot', () => {
    const { container } = renderPanel();

    for (const tab of TABS) {
      selectTab(container, tab.id);
      const rows = slotRows(container);
      expect(
        rows.map((row) => row.querySelector('.customization-slot-name')?.textContent),
      ).toEqual(tab.slots.map((slot) => SLOT_NAME[slot]));
      expect(
        rows.map((row) => row.querySelector('.customization-equipped-name')?.textContent),
      ).toEqual(tab.slots.map((slot) => STANDARD_NAME[slot]));
    }
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

    for (const tab of TABS) {
      selectTab(container, tab.id);
      const buttons = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button.customization-unequip'),
      );
      expect(buttons).toHaveLength(2);
      expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(
        tab.slots.map((slot) => `Unequip ${SLOT_NAME[slot]}`),
      );
      // The appearance map is authoritative for the equipped name even before the owned
      // count is present (a restored legacy row resolves the same way); unequip is enabled
      // because the slot is not at its standard part.
      expect(buttons.map((button) => button.disabled)).toEqual(
        tab.slots.map((slot) => slot !== 'hull'),
      );
    }
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
    const tailFinButton = screen.getByRole('button', {
      name: 'Unequip Tail Fin',
    }) as HTMLButtonElement;
    expect(hullButton.disabled).toBe(false);
    expect(tailFinButton.disabled).toBe(true);

    fireEvent.click(hullButton);
    fireEvent.click(tailFinButton);
    expect(onUnequip).toHaveBeenCalledTimes(1);
    expect(onUnequip).toHaveBeenCalledWith('hull');
  });

  it('normalizes legacy direct props into the v2 slot rows', () => {
    const { container } = renderPanel({
      parts: { 'engine-blue': 1 },
      appearance: { engine: 'engine-blue' },
    });
    selectTab(container, 'ignitions');

    for (const slot of ['ignition-left', 'ignition-right'] as const) {
      const row = container.querySelector<HTMLElement>(`li[data-slot="${slot}"]`);
      expect(row?.querySelector('.customization-equipped-name')?.textContent).toBe(
        slot === 'ignition-left' ? 'Port Blue Flame' : 'Starboard Blue Flame',
      );
      const expectedPart =
        slot === 'ignition-left' ? 'ignition-left-blue' : 'ignition-right-blue';
      expect(
        row?.querySelector(`li[data-part="${expectedPart}"]`)?.getAttribute('data-owned'),
      ).toBe('true');
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

      for (const tab of TABS) {
        selectTab(normal.container, tab.id);
        const targets = Array.from(
          normal.container.querySelectorAll<HTMLElement>(
            'button.customization-equip, button.customization-unequip',
          ),
        );
        expect(targets).toHaveLength(4);
        for (const target of targets) {
          const style = window.getComputedStyle(target);
          expect(style.minWidth).toBe('44px');
          expect(style.minHeight).toBe('44px');
        }
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

describe('SpaceshipCustomizationPanel control matrix (AC-10)', () => {
  interface ControlCounts {
    equip: number;
    unequip: number;
  }

  function counts(container: HTMLElement): ControlCounts {
    return {
      equip: container.querySelectorAll('button.customization-equip').length,
      unequip: container.querySelectorAll('button.customization-unequip').length,
    };
  }

  function perTabCounts(container: HTMLElement): ControlCounts[] {
    return TABS.map((tab) => {
      selectTab(container, tab.id);
      return counts(container);
    });
  }

  function totals(perTab: ControlCounts[]): ControlCounts {
    return {
      equip: perTab.reduce((sum, entry) => sum + entry.equip, 0),
      unequip: perTab.reduce((sum, entry) => sum + entry.unequip, 0),
    };
  }

  it('exposes 10 equip + 10 unequip controls across the five tabs for the empty inventory', () => {
    const { container } = renderPanel({ parts: {} });

    const perTab = perTabCounts(container);
    expect(perTab).toEqual([
      { equip: 2, unequip: 2 },
      { equip: 2, unequip: 2 },
      { equip: 2, unequip: 2 },
      { equip: 2, unequip: 2 },
      { equip: 2, unequip: 2 },
    ]);
    expect(totals(perTab)).toEqual({ equip: 10, unequip: 10 });
    expect(totals(perTab).equip + totals(perTab).unequip).toBe(20);
  });

  it('exposes 30 equip + 10 unequip controls across the five tabs when all parts are owned', () => {
    const { container } = renderPanel({ parts: allOwnedParts() });

    const perTab = perTabCounts(container);
    expect(perTab).toEqual([
      { equip: 6, unequip: 2 },
      { equip: 6, unequip: 2 },
      { equip: 6, unequip: 2 },
      { equip: 6, unequip: 2 },
      { equip: 6, unequip: 2 },
    ]);
    expect(totals(perTab)).toEqual({ equip: 30, unequip: 10 });
    expect(totals(perTab).equip + totals(perTab).unequip).toBe(40);

    // Every variant of the inspected tab is owned, and only the equipped one lacks a label.
    selectTab(container, 'front');
    const variants = Array.from(
      container.querySelectorAll<HTMLElement>('li.customization-variant'),
    );
    expect(variants.map((variant) => variant.getAttribute('data-owned'))).toEqual([
      'true',
      'true',
      'true',
      'true',
      'true',
      'true',
    ]);
    const equipButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.customization-equip'),
    );
    expect(equipButtons.map((button) => button.textContent)).toEqual([
      'Equipped',
      'Equip',
      'Equip',
      'Equipped',
      'Equip',
      'Equip',
    ]);
    expect(
      equipButtons.map((button) => button.getAttribute('aria-label') ?? null),
    ).toEqual([
      null,
      'Equip Crimson Lance',
      'Equip Emerald Photon',
      null,
      'Equip Amber Razor',
      'Equip Oracle Canopy',
    ]);
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

  it('keeps the pinned normal-state order: title, counts, open control, tablist, tabpanel, preview', () => {
    const { container } = renderPanel();

    expect(Array.from(panelRoot(container).children).map((child) => child.className)).toEqual([
      'customization-title',
      'customization-counts',
      'customization-open gf-cta',
      'customization-tabs',
      'customization-tabpanel',
      'spaceship-preview',
    ]);
  });

  it('renders the accepted normal branch without the reveal (AC-13, AC-21)', () => {
    const { container } = renderPanel({ lootboxes: 1, keys: 1 });
    const section = panelRoot(container);

    expect(section.getAttribute('data-reveal-active')).toBe('false');
    expect(section.hasAttribute('data-part-id')).toBe(false);
    expect(section.querySelector('.lootbox-reveal')).toBeNull();
    expect(section.querySelectorAll('li.customization-slot')).toHaveLength(2);
    expect(section.querySelector('[role="tablist"]')).toBe(tablist(container));
    expect(section.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
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

describe('SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21)', () => {
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
    expect(section.hasAttribute('data-active-tab')).toBe(false);
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

    // AC-8: no tab strip, no tab panel, no tab button while revealing.
    expect(section.querySelector('[role="tablist"]')).toBeNull();
    expect(section.querySelector('[role="tabpanel"]')).toBeNull();
    expect(section.querySelector('.customization-tab')).toBeNull();
    expect(section.querySelector('.customization-tabpanel')).toBeNull();
    expect(section.querySelectorAll('[aria-controls]')).toHaveLength(0);

    const region = revealRegion(container);
    expect(region.parentElement).toBe(section);
  });

  it('renders no tab markup and no data-active-tab in the server reveal branch (AC-8)', () => {
    const html = panel({ lastLootboxGrant: grant() });

    expect(html).toContain('class="lootbox-reveal"');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tabpanel"');
    expect(html).not.toContain('class="customization-tab');
    expect(html).not.toContain('data-active-tab');
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
  });

  it('derives the slot from the catalog and never trusts the wire slot', () => {
    for (const wireSlot of ['hull', 'warp-core', '']) {
      const { container, unmount } = renderPanel({
        lastLootboxGrant: grant({ slot: wireSlot }),
      });
      const region = revealRegion(container);
      expect(region.getAttribute('data-slot')).toBe('wing-left');
      expect(region.textContent).toContain('Port Wing');
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

    for (const value of domStrings(container)) {
      expect(value).not.toContain('mystery-part');
      expect(value).not.toContain('warp-core');
    }
  });

  it('keeps the grant identity on the reveal root, not a section-level mirror (D-1)', () => {
    const { container } = renderPanel({
      lastLootboxGrant: grant(),
      parts: { 'wing-left-silver': 2 },
    });
    const section = panelRoot(container);
    const region = revealRegion(container);

    expect(section.getAttribute('data-reveal-active')).toBe('true');
    for (const attribute of ['data-part-id', 'data-slot', 'data-rarity', 'data-duplicate']) {
      expect(section.hasAttribute(attribute)).toBe(false);
    }
    expect(region.getAttribute('data-part-id')).toBe('wing-left-silver');
    expect(region.getAttribute('data-slot')).toBe('wing-left');
    expect(region.getAttribute('data-rarity')).toBe('rare');
    expect(region.getAttribute('data-duplicate')).toBe('false');
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
    // The panel lands on the grant's tab (wings), so the hull row is reached through Frame.
    expect(slotIds(container)).toEqual(['wing-left', 'wing-right']);
    expect(
      container.querySelector('li[data-slot="wing-left"] .customization-equipped-name')
        ?.textContent,
    ).toBe('Port Wing');
    selectTab(container, 'frame');
    expect(
      container.querySelector('li[data-slot="hull"] .customization-equipped-name')?.textContent,
    ).toBe('Gold Hull');
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

    // The Equip dismissal lands on the granted part's tab, so its row is the flashed one.
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('wings');
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
    const { container, rerender } = renderPanel({
      customization: CUSTOMIZATION,
      lastLootboxGrant: grant(),
      onDismissReveal,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss lootbox reveal' }));
    rerender(
      <SpaceshipCustomizationPanel
        customization={CUSTOMIZATION}
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
    const { rerender } = renderPanel({
      customization: CUSTOMIZATION,
      lastLootboxGrant: grant(),
      onDismissReveal,
    });

    fireEvent.keyDown(screen.getByRole('button', { name: 'Equip Port Silver Wing' }), {
      key: 'Escape',
    });
    rerender(
      <SpaceshipCustomizationPanel
        customization={CUSTOMIZATION}
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
    expect(section.getAttribute('data-active-tab')).toBe('frame');
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

    selectTab(container, 'wings');
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

    selectTab(container, 'wings');
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
