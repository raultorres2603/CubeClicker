---
feature: spaceship-customization
phase: spec
iteration: 2
verdict: changes_requested
blocking: 2
nonblocking: 1
---

# Spec Review — r2

## Summary

❌ changes requested — All 16 findings from spec-r1 are addressed (part catalog pinned, protocol/customization contract extended, reactive seam pinned, discriminated `applyLootboxOpen`, grant/adopt semantics clarified, interface placement, broadcast wording, params shape, RNG/missing-row defaults, T6 AC ownership, Q statuses). Two new MAJOR gaps remain: (1) the session contract does not specify guest-vs-account branching for `openLootbox`/`equipPart`, so the guest end-to-end flow is unspecified; (2) open/equip do not specify updating in-memory `customization` on every member of the owning account, leaving reconnect/multi-tab state stale. One MINOR test-strategy gap. Verdict changes_requested.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F17 | MAJOR | plan.md § Session (OnlineGameSession); tasks.md T11 | The session contract only says "add `openLootbox(): void`, `equipPart(partId): void`; handle inbound `customizationUpdate` → `engine.adoptCustomization`". It does not specify guest-vs-account branching. AC-5 (guest open) and AC-8 (guest equip) are engine-level, but the UI entry point is `session.openLootbox`/`equipPart` (mirroring upgrades T9, which explicitly branched on `joinedMode`: guest calls `engine.openLootbox()`/`equipPart()` locally; account sends the transport message). Without this, a builder implementing only the account path leaves guests unable to open/equip through the panel. | Extend plan § Session and T11 acceptance to state the branch: track `joinedMode` (already from upgrades), guest → `engine.openLootbox()`/`engine.equipPart(partId)` + publish, account → send `{ type: 'openLootbox' }` / `{ type: 'equipPart', partId }`; handle errors by leaving state unchanged. Add session-level tests for the guest branch. | open |
| F18 | MAJOR | spec.md § Acceptance criteria (AC-3, AC-6); plan.md § Interfaces (Hub) | AC-1 explicitly requires the hub to "update every member with that accountId's customization state" on grant, but AC-3 (open) and AC-6 (equip) only specify the broadcast. If only the acting member's in-memory `customization` is updated, a reconnecting tab of the same account (different member) receives a stale `customization` in `welcome`/`worldEntered`, and multi-tab state diverges. The upgrades precedent (`purchaseUpgrade`) updates all members with the same accountId. | Add to AC-3/AC-6 (and plan § Hub) that the hub updates `customization` on every member whose `accountId` equals the owning account on open/equip (mirroring AC-1 and upgrades purchase), before broadcasting `customizationUpdate`. | open |
| F19 | MINOR | spec.md § Testing strategy (frontend unit list); plan.md file inventory | `SpaceshipPreview.test.tsx` is listed in the file inventory and AC-13 references the preview, but the testing strategy's frontend unit list names only `SpaceshipCustomizationPanel.test.tsx` (SSR contract) and omits the preview's SSR contract. Coverage of a new render component should be named explicitly. | Add `SpaceshipPreview.test.tsx` (SSR contract) to the frontend unit list in the testing strategy (or fold its assertions into the panel test and remove the file from the inventory). | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All request asks (lootboxes from cube completion, keys to open, appearance editor menu, live preview, server-authoritative persistence, guest ephemeral) covered by ACs or non-goals; no scope invented. |
| Testability | ⚠️ | AC-3/AC-6/AC-14 are now concrete; one test-strategy naming gap (F19). ACs are binary-testable with pinned fixtures/seams. |
| Boundaries | ✅ | Three tiers present; non-goals listed (trading, multiplayer visibility, key purchase, guest persistence, rarity/pity, animation, deps). |
| Dependency graph | ✅ | Acyclic; dependencies point earlier; every AC mapped. |
| Parallel safety | ✅ | `[P]` task (T6) has disjoint `files_owned`; no shared-file contact. |
| Security | ✅ | User-controlled `partId` validated server-side; parameterized SQL; no new secrets; abuse bounds via MAX_MESSAGE_BYTES. |
| Testing | ✅ | Unit + integration tiers; `npm run coverage` ≥80% named; concrete-assertion bar referenced; edge cases (insufficient counts, unknown/unowned parts, missing rows, unknown partCategory) named. |
| Consistency | ✅ | Reuses upgrades/economy pattern, containerization unchanged, accounts optional; aligns with vision and AGENTS.md. |
| Real-time impact | ⚠️ | Connection lifecycle/reconnection/multi-client/authority described; in-memory member-update gap on open/equip (F18). |
| Containers | ✅ | No new services/images/ports; migration 005 via existing runner; AC-18 guards container paths. |

## Previous round verification (r1 → r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) MAJOR — part catalog unpinned | fixed | spec.md § Part catalog table (12 parts, 5 categories, ids/names/colors); Q-2 marked pinned. |
| F2 (r1) MAJOR — protocol contract incomplete | fixed | AC-11 extended (`customization?` on `Placement`, codec rules, `customizationUpdateMessage` + `copyCustomizationState`); plan § Interfaces updated. |
| F3 (r1) MAJOR — reactive seam unspecified | fixed | AC-14 pins `EngineSnapshot.customization` + `SceneView` re-apply on appearance change; test path `scene-spaceship.test.ts`. |
| F4 (r1) MAJOR — `applyLootboxOpen` no failure reason | fixed | AC-4 + plan: discriminated result reporting `no_lootbox`/`no_key`; check order lootboxes first. |
| F5 (r1) MAJOR — engine grant/adopt semantics ambiguous | fixed | AC-2/AC-10 + plan: engine grants on every completion (guest + account), `customization?` optional on base but always populated by `createEngine`, `adoptCustomization` replaces whole state. |
| F6 (r1) MINOR — `isValidPartId` redundant predicate | fixed | Plan: `isValidPartId(id: string): id is PartId`, mirroring upgrades. |
| F7 (r1) MINOR — T6 claims AC-8 | fixed | tasks.md T6 acceptance now AC-13 only; T8 owns AC-8. |
| F8 (r1) MINOR — guest equip validation unspecified | fixed | AC-8 + plan: guest `equipPart` validates catalog + owned inventory, no-op on invalid/unowned. |
| F9 (r1) MINOR — `partCategory` unknown behavior | fixed | Plan: `partCategory` throws on unknown id. |
| F10 (r1) MINOR — openLootbox RNG injection | fixed | Plan: openLootbox RNG from `deps.random` factory; tests inject deterministic factory; frontend uses seeded LCG. |
| F11 (r1) MINOR — `findCustomizationByUserId` missing row | fixed | Plan: returns default zero state for missing rows. |
| F12 (r1) MINOR — broadcast scoping wording | fixed | AC-1 wording: "joined connections authenticated as that account". |
| F13 (r1) MINOR — `appearanceToSpaceshipParams` output shape | fixed | AC-13 + plan: returns `{ noseColor, bodyColor, wingColor, cockpitColor, engineColor }` hex strings. |
| F14 (r1) MINOR — interface placement + `CustomizationState` location | fixed | Plan: methods on `GameEngine`/`OnlineGameEngine`/`OnlineGameSession` (optional on base, implemented by createEngine/createGameSession); `CustomizationState` in backend `protocol.ts` and frontend `types.ts`. |
| F15 (r1) INFO — Q-2 blocking status | fixed | Q-2 marked pinned (no longer blocking); default list recorded. |
| F16 (r1) INFO — open questions default-with-notice | fixed | Q-1/Q-3/Q-4/Q-5/Q-6/Q-7/Q-8 marked default-with-notice. |

## Notes / backlog (non-blocking)

- The documentation pass at acceptance (per `docs/architecture/documentation.md`) should also propose the `docs/features/README.md` row update (orchestrator-owned) and glossary terms for lootbox/key/part/appearance, matching upgrades.
- Consider adding an integration test for `customizationUpdate` end-to-end in `app.test.ts` (optional, as in upgrades).
- F17/F18 should be resolved before build; F19 is cosmetic.