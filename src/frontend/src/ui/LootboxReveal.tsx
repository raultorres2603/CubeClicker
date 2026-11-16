/**
 * 3D lootbox reveal (game-feel-overhaul T3; spec AC-7, AC-8, AC-9, AC-10, AC-12, AC-31).
 *
 * Layer: UI boundary (`ui/**`). The component owns the browser resources of the reveal —
 * exactly one `WebGLRenderer`, one resized stage canvas, one bounded `requestAnimationFrame`
 * loop and the keyboard/focus behaviour — while the stage factory (`render/lootbox-reveal`)
 * owns the scene graph and the pure pose module (`game/reveal-motion`) owns the timeline.
 *
 * Pinned contract:
 *
 * - **Non-live region.** The root is `role="group" aria-live="off"` labelled
 *   `Lootbox reveal: <part name>`; it never adds a polite live region, a scrim, `aria-modal`
 *   or a focus trap. The canvas is decorative (`aria-hidden`); the card is the readable
 *   content (AC-7/AC-31).
 * - **Phase mapping.** The panel may still be `idle` on the first grant render; the component
 *   maps `idle → charge` (or `idle → rest` under reduced motion), so `data-reveal-phase` is
 *   never `idle` (AC-7/AC-9).
 * - **Catalog authority.** A valid `grant.partId` resolves its catalog row, and the
 *   **catalog-derived** slot (`partDefinition(partId).slot`) is the only slot rendered or
 *   staged; the wire `slot` is never trusted or displayed. An unknown part never reaches the
 *   stage: the card renders the fixed `unknown` sanitised values and `Unknown part`, with no
 *   raw server string anywhere in the DOM (AC-7/AC-10).
 * - **One context, 30 fps.** The renderer and stage are created once per grant sequence and
 *   disposed together on replacement/unmount (stage first, then renderer). The loop renders
 *   at most 30 frames per second and pauses while `document.hidden`; a visible tab resets the
 *   frame baseline and resumes (AC-12).
 * - **Reduced motion.** One static frame is rendered immediately and no frame is scheduled
 *   (AC-9).
 * - **Fallback.** A renderer or stage construction error switches the stage to the inline-SVG
 *   fallback and keeps the full card and controls; no error escapes the component (AC-10).
 * - **Dismiss.** `Escape`, `Dismiss` and `Equip` are the only dismissal paths; there is no
 *   auto-dismiss timer. `Equip` calls `onEquip(partId)` then `onDismiss`, and focus moves to
 *   `Equip` (or `Dismiss` when it is disabled) on mount and on every new sequence (AC-8).
 */

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';
import { WebGLRenderer } from 'three';

import {
  SLOT_CATALOG,
  isValidPartId,
  normalizeAppearance,
  partDefinition,
} from '../game/parts-v2';
import type { RevealStagePhase, RevealUiPhase } from '../game/reveal-motion';
import type { LootboxGrant } from '../game/types';
import { createRevealStage, type RevealStage } from '../render/lootbox-reveal';

/** Hard frame-rate cap of the reveal loop (AC-12/AC-15). */
export const REVEAL_MAX_FPS = 30;

/** Minimum interval between two rendered frames: 1000 / 30 ≈ 33.33 ms (AC-15). */
export const REVEAL_FRAME_INTERVAL_MS = 1000 / REVEAL_MAX_FPS;

/** Pixel-ratio cap of the reveal context, matching the preview (AC-12). */
export const REVEAL_MAX_PIXEL_RATIO = 2;

/** Card/accessibility label used for a grant whose part is not in the catalog (AC-7). */
export const REVEAL_UNKNOWN_PART_NAME = 'Unknown part';

export interface LootboxRevealProps {
  grant: LootboxGrant;
  appearance: Record<string, string>;
  parts: Record<string, number>;
  /** The panel's phase; may be `idle` on the first grant render. */
  phase: RevealUiPhase;
  reducedMotion?: boolean;
  onEquip?: (partId: string) => void;
  onDismiss: () => void;
  /** Test seam; production uses `WebGLRenderer`. */
  createRenderer?: (canvas: HTMLCanvasElement) => WebGLRenderer;
  /** Test seam; production uses `createRevealStage`. */
  createStage?: (appearance: Record<string, string>, grant: LootboxGrant) => RevealStage;
}

/** Production renderer factory: the component's single WebGL context. */
function defaultCreateRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  return new WebGLRenderer({ canvas, antialias: true, alpha: true });
}

/** Production stage factory: the pinned four-child reveal scene. */
function defaultCreateStage(
  appearance: Record<string, string>,
  grant: LootboxGrant,
): RevealStage {
  return createRevealStage(appearance, grant);
}

/** The slot's catalog display name; an unknown slot yields an empty string. */
function slotDisplayName(slotId: string): string {
  return SLOT_CATALOG.find((slot) => slot.id === slotId)?.name ?? '';
}

/** The post-adoption owned count; anything but a non-negative integer reads as `0`. */
function ownedCountFor(parts: Record<string, number>, partId: string): number {
  const count = parts[partId];
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    return 0;
  }
  return count;
}

/**
 * The 3D lootbox reveal: non-modal spotlight stage plus the readable result card.
 *
 * The component is presentation-only: it never mutates the appearance, the parts map or the
 * grant, and it reports every command through `onEquip`/`onDismiss`.
 */
export function LootboxReveal(props: LootboxRevealProps): ReactElement {
  const { grant, appearance, parts, phase, reducedMotion = false, onEquip, onDismiss } = props;

  // Catalog authority: only a known part id yields a slot, a name and a stage (AC-7/AC-10).
  const catalogPart = isValidPartId(grant.partId) ? partDefinition(grant.partId) : null;
  const resolvedSlot = catalogPart?.slot ?? null;
  const partName = catalogPart?.name ?? REVEAL_UNKNOWN_PART_NAME;
  const slotName = resolvedSlot === null ? '' : slotDisplayName(resolvedSlot);
  const normalizedAppearance = normalizeAppearance(appearance);
  const isEquipped =
    resolvedSlot !== null && normalizedAppearance[resolvedSlot] === grant.partId;
  const ownedCount = catalogPart === null ? 0 : ownedCountFor(parts, catalogPart.id);

  // `idle` is a panel-internal state: the DOM phase is never `idle` (AC-7/AC-9).
  const effectivePhase: RevealStagePhase =
    phase === 'idle' ? (reducedMotion ? 'rest' : 'charge') : phase;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const equipRef = useRef<HTMLButtonElement | null>(null);
  const dismissRef = useRef<HTMLButtonElement | null>(null);
  const propsRef = useRef(props);
  const [failedSequence, setFailedSequence] = useState<number | null>(null);

  // Latest props for the sequence-keyed stage effect: appearance/parts objects are
  // re-normalized by the panel on every render, so they must not restart the WebGL setup.
  useEffect(() => {
    propsRef.current = props;
  });

  // One renderer, one stage and one loop per grant sequence (AC-12).
  useEffect(() => {
    if (resolvedSlot === null) {
      // An invalid part never reaches the stage (AC-10).
      return;
    }
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const latest = propsRef.current;
    const reduced = latest.reducedMotion ?? false;
    const createRenderer = latest.createRenderer ?? defaultCreateRenderer;
    const createStage = latest.createStage ?? defaultCreateStage;
    const sequence = latest.grant.sequence;
    const stagedAppearance: Record<string, string> = {
      ...normalizeAppearance(latest.appearance),
      [resolvedSlot]: latest.grant.partId,
    };

    let renderer: WebGLRenderer | null = null;
    let stage: RevealStage | null = null;
    try {
      renderer = createRenderer(canvas);
      stage = createStage(stagedAppearance, latest.grant);
    } catch {
      // A missing context or a failed scene build keeps the card and renders the fallback;
      // the renderer exists only if the stage construction was the failing step.
      stage?.dispose();
      renderer?.dispose();
      setFailedSequence(sequence);
      return;
    }
    const activeRenderer: WebGLRenderer = renderer;
    const activeStage: RevealStage = stage;

    const resize = (): void => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      activeRenderer.setPixelRatio(
        Math.min(REVEAL_MAX_PIXEL_RATIO, window.devicePixelRatio || 1),
      );
      activeRenderer.setSize(width, height, false);
      activeStage.camera.aspect = width / height;
      activeStage.camera.updateProjectionMatrix();
    };
    resize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    }

    const renderFrame = (elapsedMs: number): void => {
      activeStage.update(elapsedMs, reduced);
      activeRenderer.render(activeStage.scene, activeStage.camera);
    };

    let frameHandle: number | null = null;
    let startMs: number | null = null;
    let lastRenderMs = Number.NEGATIVE_INFINITY;

    const frame = (nowMs: number): void => {
      frameHandle = null;
      // Hidden tab: skip the render and stop scheduling; `visibilitychange` resumes (AC-12).
      if (document.hidden) {
        return;
      }
      if (startMs === null) {
        startMs = nowMs;
      }
      if (nowMs - lastRenderMs >= REVEAL_FRAME_INTERVAL_MS) {
        lastRenderMs = nowMs;
        renderFrame(nowMs - startMs);
      }
      frameHandle = requestAnimationFrame(frame);
    };

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        if (frameHandle !== null) {
          cancelAnimationFrame(frameHandle);
          frameHandle = null;
        }
        return;
      }
      lastRenderMs = Number.NEGATIVE_INFINITY;
      if (frameHandle === null) {
        frameHandle = requestAnimationFrame(frame);
      }
    };

    if (reduced) {
      // Exactly one static frame and no scheduled frame at all (AC-9).
      renderFrame(0);
    } else {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      frameHandle = requestAnimationFrame(frame);
    }

    return () => {
      if (frameHandle !== null) {
        cancelAnimationFrame(frameHandle);
        frameHandle = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver?.disconnect();
      activeStage.dispose();
      activeRenderer.dispose();
    };
  }, [grant.sequence, resolvedSlot]);

  // Focus lands inside the reveal on mount and on every new grant (AC-8). `Equip` is the
  // primary action; when it is disabled (already equipped, or an unknown part) `Dismiss` is.
  useEffect(() => {
    const target = isEquipped || resolvedSlot === null ? dismissRef.current : equipRef.current;
    target?.focus();
  }, [grant.sequence, isEquipped, resolvedSlot]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      onDismiss();
    }
  };

  const handleEquip = (): void => {
    if (catalogPart === null || isEquipped) {
      return;
    }
    onEquip?.(catalogPart.id);
    onDismiss();
  };

  const handleDismiss = (): void => {
    onDismiss();
  };

  const stageUnavailable = catalogPart === null || failedSequence === grant.sequence;

  return (
    <div
      className="lootbox-reveal"
      role="group"
      aria-live="off"
      aria-label={`Lootbox reveal: ${partName}`}
      data-reveal-active="true"
      data-reveal-phase={effectivePhase}
      data-reveal-sequence={grant.sequence}
      data-part-id={catalogPart?.id ?? 'unknown'}
      data-slot={resolvedSlot ?? ''}
      data-rarity={grant.rarity}
      data-duplicate={grant.duplicate ? 'true' : 'false'}
      data-owned-count={ownedCount}
      data-reveal-3d={stageUnavailable ? 'unavailable' : 'ready'}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
    >
      {resolvedSlot === null ? null : (
        <div className="lootbox-stage" data-reveal-stage="true">
          {stageUnavailable ? (
            <svg
              className="lootbox-fallback-ship"
              data-fallback-ship="true"
              data-slot={resolvedSlot}
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 120 72"
            >
              <polygon points="60,4 74,32 66,32 66,48 54,48 54,32 46,32" />
              <polygon points="28,42 46,38 46,50 32,56" />
              <polygon points="92,42 74,38 74,50 88,56" />
              <rect x="54" y="52" width="12" height="14" rx="2" />
            </svg>
          ) : (
            <canvas ref={canvasRef} className="lootbox-stage-canvas" aria-hidden="true" />
          )}
          {reducedMotion ? null : (
            <span className="lootbox-flash" data-reveal-flash="true" aria-hidden="true" />
          )}
        </div>
      )}
      <div className="lootbox-reveal-card" data-reveal-card="true">
        <p className="lootbox-reveal-rarity">{grant.rarity === 'epic' ? 'Epic' : 'Rare'}</p>
        <p className="lootbox-reveal-part">{partName}</p>
        {resolvedSlot === null ? null : <p className="lootbox-reveal-slot">{slotName}</p>}
        <p className="lootbox-reveal-duplicate">{grant.duplicate ? 'Duplicate' : 'New'}</p>
        <p className="lootbox-reveal-owned">{`Owned ×${ownedCount}`}</p>
        <div className="lootbox-reveal-actions">
          <button
            type="button"
            ref={equipRef}
            className="customization-reveal-equip"
            disabled={isEquipped || resolvedSlot === null}
            {...(isEquipped ? {} : { 'aria-label': `Equip ${partName}` })}
            onClick={handleEquip}
          >
            {isEquipped ? 'Equipped' : 'Equip'}
          </button>
          <button
            type="button"
            ref={dismissRef}
            className="customization-reveal-dismiss"
            aria-label="Dismiss lootbox reveal"
            onClick={handleDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
