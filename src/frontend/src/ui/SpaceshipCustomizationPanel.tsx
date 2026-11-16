/**
 * Granular spaceship customization panel (T12; spec AC-29, AC-30, AC-31, AC-32, AC-41,
 * AC-43) with the 3D lootbox reveal branch (game-feel-overhaul T5; spec AC-5, AC-7, AC-8,
 * AC-13, AC-14, AC-21).
 *
 * Ten slot rows generated from `SLOT_CATALOG`; each row shows the equipped part and the
 * slot's three catalog variants with owned/locked/equipped state, an equip control per
 * owned variant and one unequip control per slot. While `lastLootboxGrant` is present the
 * panel renders the reveal branch — `<LootboxReveal>` only, no title/counts/open control/
 * slot rows/preview — so the panel owns exactly one WebGL context and one live reveal. The
 * panel owns the reveal state machine over the pinned 1290 ms timeline (charge 420 + orb 250
 * + flash 120 + reveal 360 + settle 140); reduced motion renders the settled result instantly.
 *
 * The panel is presentation-only: it never trusts or mutates catalog/ownership state. It
 * normalizes the supplied maps through the same v2 normalizers as the session so a restored
 * legacy row still renders, and reports every command through its callbacks. Closing the
 * panel while revealing is a dismissal (an unmount-only cleanup reads the latest grant from
 * a ref); a grant-to-grant replacement never dismisses. An in-panel dismissal (Dismiss,
 * Escape or Equip) restores focus to `Open lootbox`; an unmount never does, because that
 * button is gone (AC-13).
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';

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
  type SlotId,
} from '../game/parts-v2';
import type { RevealUiPhase } from '../game/reveal-motion';
import type { CustomizationState, LootboxGrant } from '../game/types';
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
 * The section-level identity of the revealed grant (catalog authority; AC-5/AC-7).
 *
 * The panel section is the reveal spotlight shell, so it mirrors the sanitised grant
 * identity next to `data-reveal-active` while `.lootbox-reveal` stays the authoritative card
 * region. The slot is always catalog-derived (`partDefinition(partId).slot`), an unknown part
 * keeps the reveal's `unknown`/`''` values, and the raw wire slot/part string is never copied.
 */
function revealSectionIdentity(grant: LootboxGrant): {
  partId: string;
  slot: string;
  rarity: 'rare' | 'epic';
  duplicate: 'true' | 'false';
} {
  const def = isValidPartId(grant.partId) ? partDefinition(grant.partId) : null;
  return {
    partId: def?.id ?? 'unknown',
    slot: def?.slot ?? '',
    rarity: grant.rarity,
    duplicate: grant.duplicate ? 'true' : 'false',
  };
}

export function SpaceshipCustomizationPanel(
  props: SpaceshipCustomizationPanelProps,
): ReactElement {
  const { lootboxes, keys, parts, appearance } = normalize(props);
  const mode: Mode = props.mode ?? 'guest';
  const reducedMotion = props.reducedMotion ?? false;
  const grant = props.lastLootboxGrant ?? null;
  const sequence = grant?.sequence ?? null;

  const [equippingSlot, setEquippingSlot] = useState<SlotId | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(false);
  const latestGrantRef = useRef<LootboxGrant | null>(grant);
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

  const canOpen = lootboxes > 0 && keys > 0 && !(props.pendingOpen ?? false);
  const sectionIdentity = grant === null ? null : revealSectionIdentity(grant);

  return (
    <section
      aria-label="Spaceship customization"
      className="customization-panel"
      data-mode={mode}
      data-reveal-active={grant === null ? 'false' : 'true'}
      data-part-id={sectionIdentity?.partId}
      data-slot={sectionIdentity?.slot}
      data-rarity={sectionIdentity?.rarity}
      data-duplicate={sectionIdentity?.duplicate}
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
          <ul className="customization-slots">
            {SLOT_CATALOG.map((slot) => {
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
            })}
          </ul>
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
