/**
 * Granular spaceship customization panel (T12; spec AC-29, AC-30, AC-31, AC-32, AC-41,
 * AC-43).
 *
 * Ten slot rows generated from `SLOT_CATALOG`; each row shows the equipped part and the
 * slot's three catalog variants with owned/locked/equipped state, an equip control per
 * owned variant and one unequip control per slot. The lootbox reveal is a client-owned
 * state machine over the pinned 1290 ms timeline (charge 420 + orb 250 + flash 120 +
 * reveal 360 + settle 140); reduced motion renders the settled result instantly.
 *
 * The panel is presentation-only: it never trusts or mutates catalog/ownership state. It
 * normalizes the supplied maps through the same v2 normalizers as the session so a
 * restored legacy row still renders, and reports every command through its callbacks.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';

import { MOTION } from '../game/motion';
import {
  SLOT_CATALOG,
  defaultPartForSlot,
  isValidPartId,
  isValidSlotId,
  normalizeAppearance,
  normalizePartMap,
  partDefinition,
  partsForSlot,
  type PartDefV2,
  type SlotId,
} from '../game/parts-v2';
import type { CustomizationState, LootboxGrant } from '../game/types';
import { SpaceshipPreview } from './SpaceshipPreview';

type Mode = 'guest' | 'account';

/** The reveal timeline phases, in order (AC-41). */
export type RevealPhase = 'idle' | 'charge' | 'orb' | 'flash' | 'reveal' | 'settle' | 'rest';

export interface SpaceshipCustomizationPanelProps {
  customization?: CustomizationState;
  lootboxes?: number;
  keys?: number;
  parts?: Record<string, number>;
  appearance?: Record<string, string>;
  mode?: Mode;
  /** True while an account open is awaiting the server answer (AC-29, from the session). */
  pendingOpen?: boolean;
  /** The most recent grant; renders the reveal region while non-null (AC-32). */
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

function slotName(slot: SlotId): string {
  const def = SLOT_CATALOG.find((entry) => entry.id === slot);
  return def === undefined ? slot : def.name;
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

  const canOpen = lootboxes > 0 && keys > 0 && !(props.pendingOpen ?? false);

  const grantDef: PartDefV2 | null =
    grant !== null && isValidPartId(grant.partId) ? partDefinition(grant.partId) : null;
  const grantPartName = grantDef?.name ?? grant?.partId ?? '';
  const grantSlotName =
    grant !== null && isValidSlotId(grant.slot) ? slotName(grant.slot) : (grant?.slot ?? '');

  return (
    <section
      aria-label="Spaceship customization"
      className="customization-panel"
      data-mode={mode}
    >
      <div className="customization-counts">
        <span data-lootboxes={lootboxes} data-lootbox-count={lootboxes} data-lootbox={lootboxes}>
          {`Lootboxes: ${lootboxes}`}
        </span>
        <span data-keys={keys} data-key-count={keys} data-key={keys}>
          {`Keys: ${keys}`}
        </span>
      </div>
      <button
        type="button"
        className="customization-open"
        disabled={!canOpen}
        onClick={() => {
          if (canOpen) {
            handleOpen();
          }
        }}
      >
        Open lootbox
      </button>
      {grant !== null ? (
        <div
          key={grant.sequence}
          className="lootbox-reveal"
          role="status"
          aria-live="polite"
          data-reveal-active="true"
          data-reveal-phase={revealPhase}
          data-reveal-sequence={grant.sequence}
          data-part-id={grant.partId}
          data-slot={grant.slot}
          data-rarity={grant.rarity}
          data-duplicate={grant.duplicate ? 'true' : 'false'}
          data-reduced-motion={reducedMotion ? 'true' : 'false'}
        >
          <svg
            className="lootbox-orb"
            data-reveal-orb="true"
            viewBox="0 0 64 64"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="32" cy="32" r="26" />
            <ellipse cx="32" cy="32" rx="26" ry="10" />
            <ellipse cx="32" cy="32" rx="10" ry="26" />
            <circle className="lootbox-orb-core" cx="32" cy="32" r="6" />
          </svg>
          <span className="lootbox-flash" data-reveal-flash="true" aria-hidden="true" />
          <div className="lootbox-reveal-card" data-reveal-card="true">
            <p className="lootbox-reveal-rarity">
              {grant.rarity === 'epic' ? 'Epic' : 'Rare'}
            </p>
            <p className="lootbox-reveal-part">{grantPartName}</p>
            <p className="lootbox-reveal-slot">{grantSlotName}</p>
            <p className="lootbox-reveal-duplicate">
              {grant.duplicate ? 'Duplicate' : 'New'}
            </p>
            <button
              type="button"
              className="customization-reveal-equip"
              aria-label={`Equip ${grantPartName}`}
              onClick={() => {
                if (grantDef !== null) {
                  handleEquip(grantDef.id);
                }
              }}
            >
              Equip
            </button>
            <button
              type="button"
              className="customization-reveal-dismiss"
              aria-label="Dismiss lootbox reveal"
              onClick={() => props.onDismissReveal?.()}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
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
                      data-owned={owned ? 'true' : 'false'}
                      data-locked={owned ? 'false' : 'true'}
                      data-equipped={isEquipped ? 'true' : 'false'}
                    >
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
    </section>
  );
}
