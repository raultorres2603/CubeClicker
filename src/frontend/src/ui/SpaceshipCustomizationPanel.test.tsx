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
import {
  PART_CATALOG_V3,
  SLOT_CATALOG_V3,
  catalogForSlotForm,
  type SlotIdV3,
} from '../game/parts-v3';
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
  readonly slots: readonly SlotIdV3[];
}

const TABS: readonly TabFixture[] = [
  { id: 'frame', label: 'Frame', slots: ['hull', 'tail-fin'] },
  { id: 'front', label: 'Front', slots: ['nose', 'cockpit'] },
  { id: 'wings', label: 'Wings', slots: ['wing-left', 'wing-right'] },
  { id: 'engines', label: 'Engines', slots: ['engine-left', 'engine-right'] },
  { id: 'ignitions', label: 'Ignitions', slots: ['ignition-left', 'ignition-right'] },
  { id: 'shots', label: 'Shots', slots: ['shot'] },
];

/** The eleven catalog slot ids in `SLOT_CATALOG_V3` order (AC-27's union target). */
const CATALOG_SLOTS = SLOT_CATALOG_V3.map((slot) => slot.id);

/** The pinned per-tab badge maxima (AC-27). */
const TAB_TOTALS: Readonly<Record<HangarTabId, number>> = {
  frame: 244,
  front: 244,
  wings: 244,
  engines: 244,
  ignitions: 244,
  shots: 120,
};

/** Slot display names pinned independently of the component. */
const SLOT_NAME: Readonly<Record<SlotIdV3, string>> = {
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
  shot: 'Shot',
};

/** Standard part display names pinned independently of the component. */
const STANDARD_NAME: Readonly<Record<SlotIdV3, string>> = {
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
  shot: 'Standard Bolt',
};

/** The eleven form labels in `FORM_CATALOG` order (pinned independently). */
const FORM_LABELS = [
  'Classic',
  'Dart',
  'Lance',
  'Needle',
  'Manta',
  'Hauler',
  'Bulwark',
  'Arrow',
  'Orca',
  'Talon',
  'Kite',
];

const FORM_IDS = [
  'classic',
  'dart',
  'lance',
  'needle',
  'manta',
  'hauler',
  'bulwark',
  'arrow',
  'orca',
  'talon',
  'kite',
];

/** The active row's form strip (the 11-button group). */
function formStrip(row: HTMLElement): HTMLElement {
  const strip = row.querySelector<HTMLElement>('.customization-forms');
  if (strip === null) {
    throw new Error('form strip missing');
  }
  return strip;
}

/** Every form button of one row, in `FORM_CATALOG` order. */
function formButtons(row: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    formStrip(row).querySelectorAll<HTMLButtonElement>('button.customization-form'),
  );
}

/** Selects a form on one row the way a player does. */
function selectForm(row: HTMLElement, form: string): void {
  const button = formStrip(row).querySelector<HTMLButtonElement>(
    `button.customization-form[data-form="${form}"]`,
  );
  if (button === null) {
    throw new Error(`form button missing: ${form}`);
  }
  fireEvent.click(button);
}

/** The rendered variant cells of one row, in finish order. */
function variantCells(row: HTMLElement): HTMLElement[] {
  return Array.from(row.querySelectorAll<HTMLElement>('li.customization-variant'));
}

/** The row of one slot on the active tab. */
function slotRow(container: HTMLElement, slot: string): HTMLElement {
  const row = container.querySelector<HTMLElement>(`li[data-slot="${slot}"]`);
  if (row === null) {
    throw new Error(`slot row missing: ${slot}`);
  }
  return row;
}

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

/** The map fixture that owns all 1,351 v3 catalog parts exactly once. */
function allOwnedParts(): Record<string, number> {
  return Object.fromEntries(PART_CATALOG_V3.map((part) => [part.id, 1]));
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

describe('SpaceshipCustomizationPanel hangar tabs (AC-27, AC-30)', () => {
  it('renders one six-tab tablist with the pinned ARIA contract in the normal state', () => {
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
    expect(buttons).toHaveLength(6);
    expect(buttons.map((button) => button.tagName)).toEqual([
      'BUTTON',
      'BUTTON',
      'BUTTON',
      'BUTTON',
      'BUTTON',
      'BUTTON',
    ]);
    expect(buttons.map((button) => button.type)).toEqual([
      'button',
      'button',
      'button',
      'button',
      'button',
      'button',
    ]);
    expect(buttons.map((button) => button.className)).toEqual([
      'customization-tab',
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
      'Frame0/244',
      'Front0/244',
      'Wings0/244',
      'Engines0/244',
      'Ignitions0/244',
      'Shots0/120',
    ]);
    expect(buttons.map((button) => button.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Frame, 0 of 244 parts owned',
      'Front, 0 of 244 parts owned',
      'Wings, 0 of 244 parts owned',
      'Engines, 0 of 244 parts owned',
      'Ignitions, 0 of 244 parts owned',
      'Shots, 0 of 120 parts owned',
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
      expect(ownedBadge.getAttribute('data-total')).toBe(String(TAB_TOTALS[tab.id]));
      expect(ownedBadge.textContent).toBe(`0/${TAB_TOTALS[tab.id]}`);
      expect(button.lastElementChild).toBe(ownedBadge);
    }
  });

  it('renders the same tab-strip contract on the server', () => {
    const container = ssrPanel();

    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('frame');
    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    expect(tablist(container).getAttribute('aria-label')).toBe('Spaceship part groups');
    expect(tabButtons(container)).toHaveLength(6);
    expect(tabButtons(container).map((button) => button.id)).toEqual(
      TABS.map((tab) => `customization-tab-${tab.id}`),
    );
    expect(tabButtons(container).map((button) => button.getAttribute('aria-label'))).toEqual(
      TABS.map((tab) => `${tab.label}, 0 of ${TAB_TOTALS[tab.id]} parts owned`),
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
      expect(rows).toHaveLength(tab.id === 'shots' ? 1 : 2);
      expect(rows.map((row) => row.getAttribute('data-slot'))).toEqual([...tab.slots]);
      seen.push(...rows.map((row) => row.getAttribute('data-slot') ?? ''));

      for (const row of rows) {
        expect(row.getAttribute('data-form')).toBe('classic');
        expect(formButtons(row)).toHaveLength(11);
        const variants = variantCells(row);
        const classicRows = catalogForSlotForm(
          row.getAttribute('data-slot') as SlotIdV3,
          'classic',
        );
        expect(variants.map((variant) => variant.getAttribute('data-part'))).toEqual(
          classicRows.map((part) => part.id),
        );
        expect(variants).toHaveLength(tab.id === 'shots' ? 1 : 3);
        expect(variants.map((variant) => variant.getAttribute('data-owned'))).toEqual(
          classicRows.map((part) => (part.rarity === 'standard' ? 'true' : 'false')),
        );
        expect(variants.map((variant) => variant.getAttribute('data-locked'))).toEqual(
          classicRows.map((part) => (part.rarity === 'standard' ? 'false' : 'true')),
        );
        expect(variants.map((variant) => variant.getAttribute('data-equipped'))).toEqual(
          classicRows.map((part) => (part.rarity === 'standard' ? 'true' : 'false')),
        );
        expect(
          variants.map(
            (variant) =>
              variant.querySelector('.customization-swatch')?.getAttribute('aria-hidden'),
          ),
        ).toEqual(classicRows.map(() => 'true'));
      }
    }

    expect(seen).toHaveLength(11);
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
      expect(slotRows(container)).toHaveLength(tab.id === 'shots' ? 1 : 2);
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
    expect(press('ArrowRight')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('shots');
    expect(document.activeElement).toBe(tabButton(container, 'shots'));
    expect(slotIds(container)).toEqual(['shot']);

    // Right wraps shots → frame.
    expect(press('ArrowRight')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('frame');
    expect(document.activeElement).toBe(tabButton(container, 'frame'));

    // Left wraps frame → shots.
    expect(press('ArrowLeft')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('shots');
    expect(document.activeElement).toBe(tabButton(container, 'shots'));

    expect(press('Home')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('frame');
    expect(document.activeElement).toBe(tabButton(container, 'frame'));

    expect(press('End')).toBe(true);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('shots');
    expect(document.activeElement).toBe(tabButton(container, 'shots'));

    // Unhandled keys change nothing and are not prevented.
    expect(press('a')).toBe(false);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('shots');
    expect(document.activeElement).toBe(tabButton(container, 'shots'));
    expect(press('ArrowDown')).toBe(false);
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('shots');

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

describe('SpaceshipCustomizationPanel tab badges (AC-27, AC-30)', () => {
  it('renders 0/244 for the ship tabs and 0/120 for Shots when nothing is owned', () => {
    const { container } = renderPanel({ parts: {} });

    expect(badgeValues(container)).toEqual(['0', '0', '0', '0', '0', '0']);
    expect(tabButtons(container).map((button) => button.textContent)).toEqual([
      'Frame0/244',
      'Front0/244',
      'Wings0/244',
      'Engines0/244',
      'Ignitions0/244',
      'Shots0/120',
    ]);
    expect(tabButtons(container).map((button) => button.getAttribute('aria-label'))).toEqual(
      TABS.map((tab) => `${tab.label}, 0 of ${TAB_TOTALS[tab.id]} parts owned`),
    );
    expect(TABS.map((tab) => badge(container, tab.id).getAttribute('data-total'))).toEqual([
      '244',
      '244',
      '244',
      '244',
      '244',
      '120',
    ]);
  });

  it('counts only owned lootable v3 parts, per tab', () => {
    const { container } = renderPanel({
      parts: {
        'hull-gold': 2,
        'nose-crimson': 1,
        'cockpit-oracle': 1,
        'wing-left-silver': 1,
        'engine-right-nova': 3,
        'ignition-right-blue': 1,
        'ignition-right-plasma': 1,
        'shot-orca-violet': 1,
      },
    });

    expect(badgeValues(container)).toEqual(['1', '2', '1', '1', '2', '1']);
    expect(TABS.map((tab) => badge(container, tab.id).textContent)).toEqual([
      '1/244',
      '2/244',
      '1/244',
      '1/244',
      '2/244',
      '1/120',
    ]);
    expect(tabButtons(container).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Frame, 1 of 244 parts owned',
      'Front, 2 of 244 parts owned',
      'Wings, 1 of 244 parts owned',
      'Engines, 1 of 244 parts owned',
      'Ignitions, 2 of 244 parts owned',
      'Shots, 1 of 120 parts owned',
    ]);
  });

  it('counts generated v3 ids (form-finish) without normalizing them away', () => {
    const { container } = renderPanel({
      parts: {
        'hull-dart-chrome': 1,
        'tail-fin-dart-chrome': 1,
        'nose-needle-ivory': 1,
        'wing-right-kite-solar': 1,
        'shot-dart-chrome': 1,
      },
    });

    expect(badgeValues(container)).toEqual(['2', '1', '1', '0', '0', '1']);
    expect(badge(container, 'frame').textContent).toBe('2/244');
    expect(badge(container, 'shots').textContent).toBe('1/120');
  });

  it('reaches every badge maximum for a full 1,351-row inventory', () => {
    const { container } = renderPanel({ parts: allOwnedParts() });

    expect(badgeValues(container)).toEqual(['244', '244', '244', '244', '244', '120']);
    expect(TABS.map((tab) => badge(container, tab.id).textContent)).toEqual([
      '244/244',
      '244/244',
      '244/244',
      '244/244',
      '244/244',
      '120/120',
    ]);
    expect(tabButton(container, 'frame').getAttribute('aria-label')).toBe(
      'Frame, 244 of 244 parts owned',
    );
    expect(tabButton(container, 'shots').getAttribute('aria-label')).toBe(
      'Shots, 120 of 120 parts owned',
    );
  });

  it('never counts standard parts, zero counts or unknown ids', () => {
    const { container } = renderPanel({
      parts: {
        'hull-default': 2,
        'tail-fin-default': 1,
        'nose-crimson': 0,
        'cockpit-oracle': 0,
        'shot-default': 3,
        'not-a-part': 5,
      },
    });

    expect(badgeValues(container)).toEqual(['0', '0', '0', '0', '0', '0']);
    expect(tabButton(container, 'frame').getAttribute('aria-label')).toBe(
      'Frame, 0 of 244 parts owned',
    );
    expect(tabButton(container, 'shots').getAttribute('aria-label')).toBe(
      'Shots, 0 of 120 parts owned',
    );
  });

  it('counts a bilateral legacy wing id for both wings after normalization', () => {
    const { container } = renderPanel({ parts: { 'wings-silver': 1 } });

    expect(badgeValues(container)).toEqual(['0', '0', '2', '0', '0', '0']);
    expect(badge(container, 'wings').textContent).toBe('2/244');
  });

  it('counts the legacy engine id for both ignitions after normalization', () => {
    const { container } = renderPanel({ parts: { 'engine-blue': 3 } });

    expect(badgeValues(container)).toEqual(['0', '0', '0', '0', '2', '0']);
    expect(badge(container, 'ignitions').textContent).toBe('2/244');
  });

  it('counts a single-slot legacy hull id once after normalization', () => {
    const { container } = renderPanel({ parts: { 'body-obsidian': 1 } });

    expect(badgeValues(container)).toEqual(['1', '0', '0', '0', '0', '0']);
    expect(badge(container, 'frame').textContent).toBe('1/244');
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

  it('lands on the shots tab for a shot grant in that same single mutation (AC-31)', async () => {
    const landing = await observeLanding(
      {
        lastLootboxGrant: grant({
          partId: 'shot-orca-violet',
          slot: 'shot',
          rarity: 'epic',
          sequence: 6,
        }),
      },
      { lastLootboxGrant: null },
    );

    expect(landing.values).toEqual(['shots']);
    expect(landing.oldValues).toEqual([null]);
    expect(landing.addedTabpanels).toBe(1);
    expect(panelRoot(landing.container).getAttribute('data-active-tab')).toBe('shots');
    expect(slotIds(landing.container)).toEqual(['shot']);
    expect(tabButton(landing.container, 'shots').getAttribute('aria-selected')).toBe('true');
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

describe('SpaceshipCustomizationPanel slots (AC-28, AC-29, AC-30)', () => {
  it('renders the active tab rows (two, one on Shots) and reaches all eleven catalog slots', () => {
    const { container } = renderPanel();

    expect(slotIds(container)).toEqual(['hull', 'tail-fin']);

    const seen: string[] = [];
    for (const tab of TABS) {
      selectTab(container, tab.id);
      const ids = slotIds(container);
      expect(ids).toHaveLength(tab.id === 'shots' ? 1 : 2);
      expect(ids).toEqual([...tab.slots]);
      seen.push(...ids);
    }

    expect(seen).toHaveLength(11);
    expect(new Set(seen)).toEqual(new Set(CATALOG_SLOTS));
    expect(seen.slice().sort()).toEqual(CATALOG_SLOTS.slice().sort());
    expect(panelRoot(container).getAttribute('data-active-tab')).toBe('shots');
  });

  it('renders the classic finish cells with catalog rarity, finish and colour swatch', () => {
    const { container } = renderPanel();

    for (const tab of TABS) {
      selectTab(container, tab.id);
      const rows = slotRows(container);
      expect(rows.map((row) => row.getAttribute('data-slot'))).toEqual([...tab.slots]);

      for (const row of rows) {
        const slot = row.getAttribute('data-slot') as SlotIdV3;
        const catalog = catalogForSlotForm(slot, 'classic');
        const variants = variantCells(row);
        expect(variants.map((variant) => variant.getAttribute('data-part'))).toEqual(
          catalog.map((part) => part.id),
        );
        expect(variants.map((variant) => variant.getAttribute('data-finish'))).toEqual(
          catalog.map((part) => part.finish),
        );
        expect(variants.map((variant) => variant.getAttribute('data-rarity'))).toEqual(
          catalog.map((part) => part.rarity),
        );
        expect(variants).toHaveLength(slot === 'shot' ? 1 : 3);
        expect(variants.map((variant) => variant.getAttribute('data-owned'))).toEqual(
          catalog.map((part) => (part.rarity === 'standard' ? 'true' : 'false')),
        );
        expect(variants.map((variant) => variant.getAttribute('data-locked'))).toEqual(
          catalog.map((part) => (part.rarity === 'standard' ? 'false' : 'true')),
        );
        expect(variants.map((variant) => variant.getAttribute('data-equipped'))).toEqual(
          catalog.map((part) => (part.rarity === 'standard' ? 'true' : 'false')),
        );

        const swatches = variants.map((variant) =>
          variant.querySelector<HTMLElement>('.customization-swatch'),
        );
        expect(swatches.map((swatch) => swatch?.getAttribute('aria-hidden'))).toEqual(
          catalog.map(() => 'true'),
        );
        expect(swatches.map((swatch) => swatch?.style.background)).toEqual(
          catalog.map((part) => cssRgb(part.color)),
        );
        expect(swatches.map((swatch) => swatch?.textContent)).toEqual(
          catalog.map(() => ''),
        );
      }
    }
  });

  it('carries the per-slot owned lootable count and total (122 ship / 120 shot) on the header', () => {
    const { container } = renderPanel({
      parts: {
        'hull-obsidian': 1,
        'hull-dart-chrome': 1,
        'tail-fin-default': 1,
        'shot-orca-violet': 1,
      },
    });

    const frameRows = slotRows(container);
    expect(frameRows.map((row) => row.querySelector('.customization-slot-header')?.getAttribute('data-owned'))).toEqual([
      '2',
      '0',
    ]);
    expect(frameRows.map((row) => row.querySelector('.customization-slot-header')?.getAttribute('data-total'))).toEqual([
      '122',
      '122',
    ]);

    selectTab(container, 'shots');
    const shotRow = slotRows(container)[0];
    if (shotRow === undefined) throw new Error('shot row missing');
    expect(shotRow.querySelector('.customization-slot-header')?.getAttribute('data-owned')).toBe(
      '1',
    );
    expect(shotRow.querySelector('.customization-slot-header')?.getAttribute('data-total')).toBe(
      '120',
    );
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

    const hullRow = slotRow(container, 'hull');
    const variants = variantCells(hullRow);
    expect(variants.map((variant) => variant.getAttribute('data-part'))).toEqual([
      'hull-default',
      'hull-obsidian',
      'hull-gold',
    ]);
    expect(variants.map((variant) => variant.getAttribute('data-finish'))).toEqual([
      'classic',
      'classic',
      'classic',
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

  it('renders one unequip control per slot, disabled at the standard part', () => {
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
      expect(buttons).toHaveLength(tab.id === 'shots' ? 1 : 2);
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

  it('normalizes legacy direct props into the v3 slot rows', () => {
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

  it('keeps a v3 inventory and appearance intact (never normalizing to {})', () => {
    const { container } = renderPanel({
      customization: {
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-dart-chrome': 1 },
        appearance: { hull: 'hull-dart-chrome' },
      },
    });

    const row = slotRow(container, 'hull');
    expect(row.querySelector('.customization-equipped-name')?.textContent).toBe(
      'Chrome Dart Hull',
    );
    expect(row.querySelector('.customization-slot-header')?.getAttribute('data-owned')).toBe(
      '1',
    );
    selectForm(row, 'dart');
    const variant = row.querySelector<HTMLElement>('li[data-part="hull-dart-chrome"]');
    expect(variant).not.toBeNull();
    expect(variant?.getAttribute('data-owned')).toBe('true');
    expect(variant?.getAttribute('data-finish')).toBe('chrome');
    expect(badge(container, 'frame').textContent).toBe('1/244');
  });

  it('keeps every panel control at a 44px minimum pointer target (AC-28, AC-30)', () => {
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
            'button.customization-form, button.customization-equip, button.customization-unequip',
          ),
        );
        expect(targets).toHaveLength(tab.id === 'shots' ? 13 : 26);
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

describe('SpaceshipCustomizationPanel form picker (AC-28, AC-29)', () => {
  it('renders one eleven-button form strip per row in FORM_CATALOG order', () => {
    const { container } = renderPanel();

    for (const tab of TABS) {
      selectTab(container, tab.id);
      for (const row of slotRows(container)) {
        const slot = row.getAttribute('data-slot') as SlotIdV3;
        const strip = formStrip(row);
        expect(strip.getAttribute('role')).toBe('group');
        expect(strip.getAttribute('aria-label')).toBe(`${SLOT_NAME[slot]} forms`);
        const buttons = formButtons(row);
        expect(buttons).toHaveLength(11);
        expect(buttons.map((button) => button.type)).toEqual([
          'button',
          'button',
          'button',
          'button',
          'button',
          'button',
          'button',
          'button',
          'button',
          'button',
          'button',
        ]);
        expect(buttons.map((button) => button.getAttribute('data-form'))).toEqual(FORM_IDS);
        expect(buttons.map((button) => button.textContent)).toEqual(FORM_LABELS);
        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
          'true',
          'false',
          'false',
          'false',
          'false',
          'false',
          'false',
          'false',
          'false',
          'false',
          'false',
        ]);
        expect(buttons.map((button) => button.tabIndex)).toEqual([
          0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        ]);
      }
    }
  });

  it('selects a form on click: aria-pressed, data-form and a keyed twelve-cell grid', () => {
    const { container } = renderPanel({ parts: allOwnedParts() });
    const hullRow = slotRow(container, 'hull');
    const tailRow = slotRow(container, 'tail-fin');
    const preview = container.querySelector('.spaceship-preview');
    const classicList = hullRow.querySelector('.customization-variants');
    expect(hullRow.getAttribute('data-form')).toBe('classic');
    expect(variantCells(hullRow)).toHaveLength(3);

    selectForm(hullRow, 'dart');

    expect(hullRow.getAttribute('data-form')).toBe('dart');
    expect(
      formButtons(hullRow).map((button) => button.getAttribute('aria-pressed')),
    ).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(formButtons(hullRow).map((button) => button.tabIndex)).toEqual([
      -1, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    ]);
    const cells = variantCells(hullRow);
    expect(cells).toHaveLength(12);
    expect(cells.map((cell) => cell.getAttribute('data-part'))).toEqual(
      catalogForSlotForm('hull', 'dart').map((part) => part.id),
    );
    expect(cells[0]?.getAttribute('data-part')).toBe('hull-dart-chrome');
    expect(cells[0]?.getAttribute('data-finish')).toBe('chrome');
    expect(cells[0]?.getAttribute('data-rarity')).toBe('rare');
    expect(cells[0]?.getAttribute('data-owned')).toBe('true');
    expect(cells[11]?.getAttribute('data-part')).toBe('hull-dart-solar');
    // The list is keyed by the form id: the classic list element is replaced.
    expect(hullRow.querySelector('.customization-variants')).not.toBe(classicList);
    // Selection persists per slot: the sibling row keeps its classic form.
    expect(tailRow.getAttribute('data-form')).toBe('classic');
    expect(variantCells(tailRow)).toHaveLength(3);
    // The preview element identity is unchanged across a form selection.
    expect(container.querySelector('.spaceship-preview')).toBe(preview);
  });

  it('selects the shot classic (1 cell) and a generated shot form (12 cells)', () => {
    const { container } = renderPanel({ parts: allOwnedParts() });
    selectTab(container, 'shots');
    const row = slotRow(container, 'shot');
    expect(variantCells(row)).toHaveLength(1);
    expect(variantCells(row)[0]?.getAttribute('data-part')).toBe('shot-default');
    expect(variantCells(row)[0]?.getAttribute('data-rarity')).toBe('standard');
    expect(formStrip(row).getAttribute('aria-label')).toBe('Shot forms');

    selectForm(row, 'orca');
    expect(row.getAttribute('data-form')).toBe('orca');
    const cells = variantCells(row);
    expect(cells).toHaveLength(12);
    expect(cells.map((cell) => cell.getAttribute('data-part'))).toEqual(
      catalogForSlotForm('shot', 'orca').map((part) => part.id),
    );
    expect(cells[0]?.getAttribute('data-part')).toBe('shot-orca-chrome');
    expect(cells.map((cell) => cell.getAttribute('data-rarity'))).toEqual(
      catalogForSlotForm('shot', 'orca').map((part) => part.rarity),
    );
    expect(cells.map((cell) => cell.getAttribute('data-owned'))).toEqual(
      cells.map(() => 'true'),
    );
    // One roving tab stop remains in the strip after switching.
    expect(formButtons(row).filter((button) => button.tabIndex === 0)).toHaveLength(1);
  });

  it('moves form selection and focus with ArrowRight, ArrowLeft, Home and End', () => {
    const onOpenLootbox = vi.fn();
    const onOpen = vi.fn();
    const onEquip = vi.fn();
    const onEquipPart = vi.fn();
    const onUnequip = vi.fn();
    const onDismissReveal = vi.fn();
    const { container } = renderPanel({
      parts: allOwnedParts(),
      onOpenLootbox,
      onOpen,
      onEquip,
      onEquipPart,
      onUnequip,
      onDismissReveal,
    });
    const section = panelRoot(container);

    let scrollTop = 40;
    Object.defineProperty(section, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });

    const hullRow = slotRow(container, 'hull');
    const press = (key: string): boolean => {
      const target = document.activeElement;
      if (!(target instanceof HTMLElement)) {
        throw new Error('no focused element');
      }
      const event = createEvent.keyDown(target, { key });
      fireEvent(target, event);
      return event.defaultPrevented;
    };

    formButtons(hullRow)[0]?.focus();
    expect(document.activeElement).toBe(formButtons(hullRow)[0]);

    expect(press('ArrowRight')).toBe(true);
    expect(hullRow.getAttribute('data-form')).toBe('dart');
    expect(document.activeElement).toBe(formButtons(hullRow)[1]);
    expect(formButtons(hullRow)[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(formButtons(hullRow)[0]?.tabIndex).toBe(-1);
    expect(formButtons(hullRow)[1]?.tabIndex).toBe(0);

    expect(press('ArrowLeft')).toBe(true);
    expect(hullRow.getAttribute('data-form')).toBe('classic');
    expect(document.activeElement).toBe(formButtons(hullRow)[0]);

    // Left wraps classic → kite.
    expect(press('ArrowLeft')).toBe(true);
    expect(hullRow.getAttribute('data-form')).toBe('kite');
    expect(document.activeElement).toBe(formButtons(hullRow)[10]);

    // Right wraps kite → classic.
    expect(press('ArrowRight')).toBe(true);
    expect(hullRow.getAttribute('data-form')).toBe('classic');
    expect(document.activeElement).toBe(formButtons(hullRow)[0]);

    expect(press('End')).toBe(true);
    expect(hullRow.getAttribute('data-form')).toBe('kite');
    expect(document.activeElement).toBe(formButtons(hullRow)[10]);

    expect(press('Home')).toBe(true);
    expect(hullRow.getAttribute('data-form')).toBe('classic');
    expect(document.activeElement).toBe(formButtons(hullRow)[0]);

    // Unhandled keys change nothing and are not prevented.
    expect(press('a')).toBe(false);
    expect(hullRow.getAttribute('data-form')).toBe('classic');
    expect(press('ArrowDown')).toBe(false);
    expect(hullRow.getAttribute('data-form')).toBe('classic');

    // Every handled key prevented the default: the panel's scroll offset never moves.
    expect(section.scrollTop).toBe(40);

    // Selection never reports a command.
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

describe('SpaceshipCustomizationPanel control matrix (AC-28, AC-30)', () => {
  interface ControlCounts {
    forms: number;
    equip: number;
    unequip: number;
    controls: number;
  }

  function counts(container: HTMLElement): ControlCounts {
    const forms = container.querySelectorAll('button.customization-form').length;
    const equip = container.querySelectorAll('button.customization-equip').length;
    const unequip = container.querySelectorAll('button.customization-unequip').length;
    return { forms, equip, unequip, controls: forms + equip + unequip };
  }

  function perTabCounts(container: HTMLElement): ControlCounts[] {
    return TABS.map((tab) => {
      selectTab(container, tab.id);
      return counts(container);
    });
  }

  it('renders 26 controls per ship tab and 13 on Shots for the empty inventory', () => {
    const { container } = renderPanel({ parts: {} });

    expect(perTabCounts(container)).toEqual([
      { forms: 22, equip: 2, unequip: 2, controls: 26 },
      { forms: 22, equip: 2, unequip: 2, controls: 26 },
      { forms: 22, equip: 2, unequip: 2, controls: 26 },
      { forms: 22, equip: 2, unequip: 2, controls: 26 },
      { forms: 22, equip: 2, unequip: 2, controls: 26 },
      { forms: 11, equip: 1, unequip: 1, controls: 13 },
    ]);
  });

  it('renders 30 controls per ship tab and 13 on Shots with an all-owned classic inventory', () => {
    const { container } = renderPanel({ parts: allOwnedParts() });

    expect(perTabCounts(container)).toEqual([
      { forms: 22, equip: 6, unequip: 2, controls: 30 },
      { forms: 22, equip: 6, unequip: 2, controls: 30 },
      { forms: 22, equip: 6, unequip: 2, controls: 30 },
      { forms: 22, equip: 6, unequip: 2, controls: 30 },
      { forms: 22, equip: 6, unequip: 2, controls: 30 },
      { forms: 11, equip: 1, unequip: 1, controls: 13 },
    ]);

    // Every classic variant of the inspected tab is owned, and only the equipped one lacks
    // a label.
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

  it('renders 48 controls per ship tab and 24 on Shots with a generated form on every row', () => {
    const { container } = renderPanel({ parts: allOwnedParts() });

    for (const tab of TABS) {
      selectTab(container, tab.id);
      for (const row of slotRows(container)) {
        selectForm(row, 'dart');
        const cells = variantCells(row);
        expect(cells).toHaveLength(12);
        expect(cells.map((cell) => cell.getAttribute('data-owned'))).toEqual(
          cells.map(() => 'true'),
        );
        expect(row.getAttribute('data-form')).toBe('dart');
      }
    }

    expect(perTabCounts(container)).toEqual([
      { forms: 22, equip: 24, unequip: 2, controls: 48 },
      { forms: 22, equip: 24, unequip: 2, controls: 48 },
      { forms: 22, equip: 24, unequip: 2, controls: 48 },
      { forms: 22, equip: 24, unequip: 2, controls: 48 },
      { forms: 22, equip: 24, unequip: 2, controls: 48 },
      { forms: 11, equip: 12, unequip: 1, controls: 24 },
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
