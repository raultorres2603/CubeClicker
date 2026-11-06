---
feature: spaceship-customization
phase: spec
iteration: 3
verdict: approved
blocking: 0
nonblocking: 0
---

# Spec Review — r3

## Summary

✅ approved — Final re-review: all three open findings from spec-r2 (F17 guest-vs-account session branching, F18 member `customization` update on open/equip before broadcast, F19 `SpaceshipPreview.test.tsx` SSR contract in testing strategy) are resolved in spec r3 / plan r3, with matching revision-history entries. The full checklist holds; no new blockers or majors. Ready for build.

## Findings

(none)

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All request asks (lootboxes from cube completion, keys to open, appearance editor menu, live preview, server-authoritative persistence, guest ephemeral) covered by ACs or non-goals; no scope invented. |
| Testability | ✅ | ACs binary-testable with concrete values/pinned fixtures/seams; evidence files named; F19 naming gap closed. |
| Boundaries | ✅ | Three tiers present; non-goals listed (trading, multiplayer visibility, key purchase, guest persistence, rarity/pity, animation, deps). |
| Dependency graph | ✅ | Acyclic; dependencies point earlier; every AC mapped to a task (AC-1…AC-18). |
| Parallel safety | ✅ | `[P]` task (T6) has disjoint `files_owned`; no shared-file contact. |
| Security | ✅ | User-controlled `partId` validated server-side; parameterized SQL; no new secrets; abuse bounds via `MAX_MESSAGE_BYTES`. |
| Testing | ✅ | Unit + integration tiers; `npm run coverage` ≥80% named; concrete-assertion bar referenced; edge cases named; preview SSR contract named (F19). |
| Consistency | ✅ | Reuses upgrades/economy pattern, containerization unchanged, accounts optional; aligns with vision and AGENTS.md. |
| Real-time impact | ✅ | Connection lifecycle/reconnection/multi-client/authority described; member `customization` updated on grant (AC-1) and on open/equip before broadcast (F18). |
| Containers | ✅ | No new services/images/ports; migration 005 via existing runner; AC-18 guards container paths. |

## Previous round verification (r2 → r3)

| Finding | Status | Evidence |
| --- | --- | --- |
| F17 (r2) MAJOR — guest-vs-account branching in session contract | fixed | plan.md § Session (OnlineGameSession) now states `joinedMode` tracking, guest branch (`engine.openLootbox()` / `engine.equipPart(partId)` + publish, no-ops on invalid), account branch (send `openLootbox`/`equipPart`), errors leave state unchanged; T11 acceptance covers AC-3/AC-5/AC-6/AC-8/AC-10; testing strategy names session guest open/equip branch tests. |
| F18 (r2) MAJOR — member `customization` update on open/equip before broadcast | fixed | spec.md AC-3 and AC-6 now require the hub to update `customization` on every member whose `accountId` equals the owning account before broadcasting `customizationUpdate` (mirroring AC-1 and upgrades `purchaseUpgrade`); plan.md § Hub states the same ordering. |
| F19 (r2) MINOR — `SpaceshipPreview.test.tsx` SSR contract not named | fixed | spec.md § Testing strategy frontend unit list now names `SpaceshipPreview.test.tsx` (SSR contract); file remains in plan file inventory (T10). |

All 16 findings from spec-r1 were already verified as fixed in spec-r2 and remain fixed in r3 (part catalog pinned, protocol contract extended, reactive seam pinned, discriminated `applyLootboxOpen`, grant/adopt semantics, interface placement, broadcast wording, params shape, RNG/missing-row defaults, T6 AC ownership, guest equip validation, `partCategory` contract, Q statuses).

## Notes / backlog (non-blocking)

- The documentation pass at acceptance (per `docs/architecture/documentation.md`) should also propose the `docs/features/README.md` row update (orchestrator-owned) and glossary terms for lootbox/key/part/appearance, matching upgrades.
- Consider adding an integration test for `customizationUpdate` end-to-end in `app.test.ts` (optional, as in upgrades).
- Guest/server double-grant is mitigated by `adoptCustomization` overwriting on `customizationUpdate`, matching the economy/upgrades pattern.