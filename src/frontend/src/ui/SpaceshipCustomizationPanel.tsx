/**
 * Granular spaceship customization panel (T12; spec AC-29, AC-30, AC-31, AC-32, AC-41,
 * AC-43) with the in-panel hangar tabs (hangar-tabs-and-menu-motion T3; spec AC-2…AC-6,
 * AC-8, AC-10, AC-15, AC-16) and the 3D lootbox reveal branch (game-feel-overhaul T5;
 * spec AC-5, AC-7, AC-8, AC-13, AC-14, AC-21).
 *
 * The normal state keeps the title, the two chips and `Open lootbox` unchanged, then the
 * five-button `role="tablist"` strip and exactly one keyed `role="tabpanel"` holding the
 * active group's two `SLOT_CATALOG` rows (the grouping comes from `ui/hangar-tabs`). Each row
 * shows the equipped part and the slot's three catalog variants with owned/locked/equipped
 * state, an equip control per owned variant and one unequip control per slot. The live preview
 * sits below the tab panel and is mounted once for the whole normal state, so browsing tabs
 * never remounts it and the panel keeps exactly one WebGL context.
 *
 * The active tab is panel-local state: `frame` on mount, never persisted, no live region. When
 * a grant clears while the panel stays mounted, the landing tab is derived **during render**
 * (React's "adjust state during render" pattern) from the departing grant, so the commit that
 * leaves the reveal branch already paints the landing group — no default-tab flash and a
 * single tab-swap fade (AC-6/AC-15). Selection moves focus with a roving `tabIndex` and
 * `ArrowRight`/`ArrowLeft`/`Home`/`End`, each `preventDefault`ed because the panel is the 60vh
 * scroll container.
 *
 * While `lastLootboxGrant` is present the panel renders the reveal branch — `<LootboxReveal>`
 * only, no title/counts/open control/tablist/tabpanel/slot rows/preview — so the panel owns
 * one live reveal. It owns the reveal state machine over the pinned 1290 ms timeline (charge
 * 420 + orb 250 + flash 120 + reveal 360 + settle 140); reduced motion renders the settled
 * result instantly.
 *
 * The panel is presentation-only: it never trusts or mutates catalog/ownership state. It
 * normalizes the supplied maps through the same v2 normalizers as the session so a restored
 * legacy row still renders, and reports every command through its callbacks. Closing the
 * panel while revealing is a dismissal (an unmount-only cleanup reads the latest grant from
 * a ref); a grant-to-grant replacement never dismisses. An in-panel dismissal (Dismiss,
 * Escape or Equip) restores focus to `Open lootbox`; an unmount never does, because that
 * button is gone (AC-13).
 */

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';

import { MOTION } from '../game/motion';
import {
  SLOT_CATALOG,
  defaultPartForSlot,
  isValidPartId,
  normalizeAppearance,
  normalizePartMap,
  partDefinition,
  partsForSlot,
  type PartDefV2,
  type SlotDef,
  type SlotId,
} from '../game/parts-v2';
import type { RevealUiPhase } from '../game/reveal-motion';
import type { CustomizationState, LootboxGrant } from '../game/types';
import {
  HANGAR_DEFAULT_TAB,
  HANGAR_TABS,
  HANGAR_TAB_LOOTABLE_TOTAL,
  tabForSlot,
  tabOwnedCount,
  type HangarTab,
  type HangarTabId,
} from './hangar-tabs';
import { LootboxReveal } from './LootboxReveal';
import { SpaceshipPreview } from './SpaceshipPreview';

type Mode = 'guest' | 'account';

/** The reveal timeline phases, in order (AC-41); `idle` is the pre-grant panel state. */
export type RevealPhase = RevealUiPhase;

export interface SpaceshipCustomizationPanelProps {
  customization?: CustomizationState;
  lootboxes?: number;
  keys?: number;
  parts?: Record<string, number>;
  appearance?: Record<string, string>;
  mode?: Mode;
  /** True while an account open is awaiting the server answer (AC-29, from the session). */
  pendingOpen?: boolean;
  /** The most recent grant; renders the reveal branch while non-null (AC-32). */
  lastLootboxGrant?: LootboxGrant | null;
  /** Skips the row flash and renders the settled reveal immediately (AC-48). */
  reducedMotion?: boolean;
  onOpenLootbox?: () => void;
  /** Pre-v2 alias kept for source compatibility. */
  onOpen?: () => void;
  onEquip?: (partId: string) => void;
  /** Pre-v2 alias kept for source compatibility. */
  onEquipPart?: (partId: string) => void;
  onUnequip?: (slotId: string) => void;
  /** Clears the reveal metadata through the session (AC-32). */
  onDismissReveal?: () => void;
}

interface NormalizedPanelState {
  lootboxes: number;
  keys: number;
  parts: Record<string, number>;
  appearance: Record<string, string>;
}

function normalize(props: SpaceshipCustomizationPanelProps): NormalizedPanelState {
  const c = props.customization;
  return {
    lootboxes: props.lootboxes ?? c?.lootboxes ?? 0,
    keys: props.keys ?? c?.keys ?? 0,
    parts: normalizePartMap(props.parts ?? c?.parts ?? {}),
    appearance: normalizeAppearance(props.appearance ?? c?.appearance ?? {}),
  };
}

/** The equipped part of one slot; a missing/invalid value resolves to the standard part. */
function equippedPart(appearance: Record<string, string>, slot: SlotId): PartDefV2 {
  const equipped = appearance[slot];
  if (equipped !== undefined && isValidPartId(equipped)) {
    const def = partDefinition(equipped);
    if (def.slot === slot) {
      return def;
    }
  }
  return partDefinition(defaultPartForSlot(slot));
}

function isOwned(def: PartDefV2, parts: Record<string, number>): boolean {
  if (def.rarity === 'standard') {
    return true;
  }
  const count = parts[def.id];
  return typeof count === 'number' && count > 0;
}

/**
 * The landing tab after a reveal (AC-6): the departing grant's catalog slot decides it, and
 * an absent grant or an unknown/invalid part lands on the default tab. `partDefinition`
 * throws for an unknown id, so the catalog guard runs first — never a raw wire string.
 */
function landingTabFor(grant: LootboxGrant | null): HangarTabId {
  if (grant === null || !isValidPartId(grant.partId)) {
    return HANGAR_DEFAULT_TAB;
  }
  return tabForSlot(partDefinition(grant.partId).slot);
}

/** The active tab row; `HANGAR_TABS` stays the single source of the grouping. */
function tabDefinition(id: HangarTabId): HangarTab {
  const tab = HANGAR_TABS.find((candidate) => candidate.id === id);
  if (tab === undefined) {
    throw new Error(`unknown tab: ${id}`);
  }
  return tab;
}

/**
 * The panel section is the reveal spotlight shell (`data-reveal-active`); the sanitised
 * grant identity lives only on the authoritative `.lootbox-reveal` root (AC-7), never
 * mirrored on the section.
 */

export function SpaceshipCustomizationPanel(
  props: SpaceshipCustomizationPanelProps,
): ReactElement {
  const { lootboxes, keys, parts, appearance } = normalize(props);
  const mode: Mode = props.mode ?? 'guest';
  const reducedMotion = props.reducedMotion ?? false;
  const grant = props.lastLootboxGrant ?? null;
  const sequence = grant?.sequence ?? null;

  const [equippingSlot, setEquippingSlot] = useState<SlotId | null>(null);
  const [activeTab, setActiveTab] = useState<HangarTabId>(HANGAR_DEFAULT_TAB);
  // AC-6: the last rendered reveal sequence plus the departing grant, so the landing tab can
  // be derived while rendering the first normal-state commit (no effect, no second commit).
  const [renderedSequence, setRenderedSequence] = useState<number | null>(sequence);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(false);
  const latestGrantRef = useRef<LootboxGrant | null>(grant);
  const previousGrantRef = useRef<LootboxGrant | null>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dismissRef = useRef(props.onDismissReveal);

  const [revealPhase, setRevealPhase] = useState<RevealPhase>(() => {
    if (grant === null) return 'idle';
    return reducedMotion ? 'rest' : 'charge';
  });

  useEffect(() => {
    if (sequence === null) {
      setRevealPhase('idle');
      return;
    }
    if (reducedMotion) {
      setRevealPhase('rest');
      return;
    }
    setRevealPhase('charge');
    const timers = [
      setTimeout(() => setRevealPhase('orb'), MOTION.lootboxChargeMs),
      setTimeout(
        () => setRevealPhase('flash'),
        MOTION.lootboxChargeMs + MOTION.orbOvershootMs,
      ),
      setTimeout(
        () => setRevealPhase('reveal'),
        MOTION.lootboxChargeMs + MOTION.orbOvershootMs + MOTION.lootboxFlashMs,
      ),
      setTimeout(
        () => setRevealPhase('settle'),
        MOTION.lootboxChargeMs +
          MOTION.orbOvershootMs +
          MOTION.lootboxFlashMs +
          MOTION.lootboxRevealMs,
      ),
      setTimeout(
        () => setRevealPhase('rest'),
        MOTION.lootboxChargeMs +
          MOTION.orbOvershootMs +
          MOTION.lootboxFlashMs +
          MOTION.lootboxRevealMs +
          MOTION.lootboxSettleMs,
      ),
    ];
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [sequence, reducedMotion]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!reducedMotion) {
      return;
    }
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    setEquippingSlot(null);
  }, [reducedMotion]);

  // The unmount-only dismissal reads the latest grant and callback through refs, so a
  // replacement refuses to inherit the previous callback while a grant-to-grant change (the
  // panel stays mounted, no cleanup) never dismisses.
  useEffect(() => {
    latestGrantRef.current = grant;
    dismissRef.current = props.onDismissReveal;
  });

  // Panel close is a dismissal (AC-13): closing while revealing calls `onDismissReveal`
  // exactly once, and never restores focus to the absent `Open lootbox` button.
  useEffect(() => {
    return () => {
      if (latestGrantRef.current !== null) {
        dismissRef.current?.();
      }
    };
  }, []);

  // In-panel dismissal (Dismiss/Escape/Equip) restores focus to `Open lootbox` (AC-8).
  // Only a dismissal initiated inside the panel arms this; unmount never runs the effect.
  useEffect(() => {
    if (sequence !== null) {
      restoreFocusRef.current = false;
      return;
    }
    if (!restoreFocusRef.current) {
      return;
    }
    restoreFocusRef.current = false;
    openButtonRef.current?.focus();
  }, [sequence]);

  // AC-6: the post-reveal landing tab is adjusted **during render** (React's "adjust state
  // when props change" pattern), never in an effect. The departing grant is cached while the
  // reveal branch renders; on the `non-null → null` transition React discards this render and
  // commits once with the landing tab already selected, so the default rows never paint and
  // the keyed tab panel fades in exactly once. The transition flag is state, so the block can
  // only fire once per transition (no render loop).
  if (grant !== null) {
    previousGrantRef.current = grant;
  }
  if (sequence !== renderedSequence) {
    setRenderedSequence(sequence);
    if (sequence === null) {
      setActiveTab(landingTabFor(previousGrantRef.current));
    }
  }

  const handleOpen = (): void => {
    if (props.onOpenLootbox !== undefined) {
      props.onOpenLootbox();
    } else if (props.onOpen !== undefined) {
      props.onOpen();
    }
  };

  const flashSlot = (slot: SlotId): void => {
    if (reducedMotion) {
      return;
    }
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
    }
    setEquippingSlot(slot);
    flashTimerRef.current = setTimeout(() => {
      setEquippingSlot(null);
      flashTimerRef.current = null;
    }, MOTION.equipRowFlashMs);
  };

  const handleEquip = (partId: string): void => {
    if (!isValidPartId(partId)) {
      return;
    }
    const def = partDefinition(partId);
    flashSlot(def.slot);
    if (props.onEquip !== undefined) {
      props.onEquip(partId);
    } else if (props.onEquipPart !== undefined) {
      props.onEquipPart(partId);
    }
  };

  const handleUnequip = (slot: SlotId): void => {
    props.onUnequip?.(slot);
  };

  const handleDismissReveal = (): void => {
    restoreFocusRef.current = true;
    props.onDismissReveal?.();
  };

  // AC-4: roving focus. Every handled key is `preventDefault`ed — the panel is the 60vh
  // scroll container, so an unprevented `Home`/`End` would scroll it — and selection and
  // focus move together. Any other key leaves the strip untouched. Selection never reports a
  // command: it only updates the panel-local tab state.
  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = HANGAR_TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % HANGAR_TABS.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + HANGAR_TABS.length) % HANGAR_TABS.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = HANGAR_TABS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTab = HANGAR_TABS[nextIndex];
    setActiveTab(nextTab.id);
    tabButtonRefs.current[nextTab.id]?.focus();
  };

  const canOpen = lootboxes > 0 && keys > 0 && !(props.pendingOpen ?? false);
  const activeTabDefinition = tabDefinition(activeTab);
  const activeSlots = SLOT_CATALOG.filter((slot) =>
    activeTabDefinition.slots.includes(slot.id),
  );

  const renderSlotRow = (slot: SlotDef): ReactElement => {
    const equipped = equippedPart(appearance, slot.id);
    const isDefault = equipped.id === defaultPartForSlot(slot.id);
    return (
      <li
        key={slot.id}
        className="customization-slot"
        data-slot={slot.id}
        {...(equippingSlot === slot.id ? { 'data-equipping': 'true' } : {})}
      >
        <div className="customization-slot-header">
          <span className="customization-slot-name">{slot.name}</span>
          <span className="customization-equipped-name" data-equipped-part={equipped.id}>
            {equipped.name}
          </span>
          <button
            type="button"
            className="customization-unequip"
            aria-label={`Unequip ${slot.name}`}
            disabled={isDefault}
            onClick={() => handleUnequip(slot.id)}
          >
            Unequip
          </button>
        </div>
        <ul className="customization-variants">
          {partsForSlot(slot.id).map((def) => {
            const owned = isOwned(def, parts);
            const isEquipped = equipped.id === def.id;
            return (
              <li
                key={def.id}
                className="customization-variant"
                data-part={def.id}
                data-rarity={def.rarity}
                data-owned={owned ? 'true' : 'false'}
                data-locked={owned ? 'false' : 'true'}
                data-equipped={isEquipped ? 'true' : 'false'}
              >
                <span
                  className="customization-swatch"
                  aria-hidden="true"
                  style={{ background: def.color }}
                />
                <span className="customization-variant-name">{def.name}</span>
                {owned ? (
                  <button
                    type="button"
                    className="customization-equip"
                    aria-pressed={isEquipped}
                    {...(isEquipped ? {} : { 'aria-label': `Equip ${def.name}` })}
                    onClick={() => handleEquip(def.id)}
                  >
                    {isEquipped ? 'Equipped' : 'Equip'}
                  </button>
                ) : (
                  <span className="customization-locked">Locked</span>
                )}
              </li>
            );
          })}
        </ul>
      </li>
    );
  };

  return (
    <section
      aria-label="Spaceship customization"
      className="customization-panel"
      data-mode={mode}
      data-reveal-active={grant === null ? 'false' : 'true'}
      {...(grant === null ? { 'data-active-tab': activeTab } : {})}
    >
      {grant === null ? (
        <>
          <h2 className="customization-title">Spaceship hangar</h2>
          <div className="customization-counts">
            <span
              className="gf-chip"
              data-lootboxes={lootboxes}
              data-lootbox-count={lootboxes}
              data-lootbox={lootboxes}
            >
              {`Lootboxes: ${lootboxes}`}
            </span>
            <span className="gf-chip" data-keys={keys} data-key-count={keys} data-key={keys}>
              {`Keys: ${keys}`}
            </span>
          </div>
          <button
            type="button"
            ref={openButtonRef}
            className="customization-open gf-cta"
            disabled={!canOpen}
            onClick={() => {
              if (canOpen) {
                handleOpen();
              }
            }}
          >
            Open lootbox
          </button>
          <div
            className="customization-tabs"
            role="tablist"
            aria-label="Spaceship part groups"
            onKeyDown={handleTabKeyDown}
          >
            {HANGAR_TABS.map((tab) => {
              const owned = tabOwnedCount(tab, parts);
              const selected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className="customization-tab"
                  id={`customization-tab-${tab.id}`}
                  data-tab={tab.id}
                  aria-selected={selected ? 'true' : 'false'}
                  tabIndex={selected ? 0 : -1}
                  aria-label={`${tab.label}, ${owned} of ${HANGAR_TAB_LOOTABLE_TOTAL} parts owned`}
                  ref={(element) => {
                    tabButtonRefs.current[tab.id] = element;
                  }}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                >
                  {tab.label}
                  <span
                    className="customization-tab-badge"
                    data-owned={owned}
                    data-total={HANGAR_TAB_LOOTABLE_TOTAL}
                    aria-hidden="true"
                  >
                    {`${owned}/${HANGAR_TAB_LOOTABLE_TOTAL}`}
                  </span>
                </button>
              );
            })}
          </div>
          <div
            key={activeTab}
            className="customization-tabpanel"
            role="tabpanel"
            id="customization-tabpanel"
            data-tabpanel={activeTab}
            aria-labelledby={`customization-tab-${activeTab}`}
          >
            <ul className="customization-slots">{activeSlots.map(renderSlotRow)}</ul>
          </div>
          <SpaceshipPreview appearance={appearance} />
        </>
      ) : (
        <LootboxReveal
          grant={grant}
          appearance={appearance}
          parts={parts}
          phase={revealPhase}
          reducedMotion={reducedMotion}
          onEquip={handleEquip}
          onDismiss={handleDismissReveal}
        />
      )}
    </section>
  );
}
