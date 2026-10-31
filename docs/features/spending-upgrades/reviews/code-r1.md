---
feature: spending-upgrades
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 1
---

# Code Review — r1

## Summary

Implementation matches spec r3: catalog, effects, atomic purchase, broadcasts, persistence, reconnect/sync, engine snapshot, shop UI and HUD all present and wired. Full verification suite passes (lint, typecheck, tests 584/1099, coverage ≥ 80% both workspaces, build); container and doc gates pass. One minor correctness nit in the guest purchase path (float rounding).

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `src/backend/src/game/upgrades.ts:30-33`, `src/frontend/src/game/upgrades.ts:30-33` (3 pinned upgrades); tests `upgrades.test.ts` both workspaces (20/20) |
| AC-2 | ✅ | `hub.ts:640` `roundCoins(COINS_PER_MINI_CUBE * miniCubeMultiplier(member.upgrades))`; `engine.ts:655` same; `upgrades.ts:72-74` |
| AC-3 | ✅ | `hub.ts:714` `roundCoins(COINS_PER_CUBE * cubeMultiplier(member.upgrades) * (bonus ? 2 : 1))`; `engine.ts:670-671` same |
| AC-4 | ✅ | `hub.ts:697-698` `elapsedMs <= (thresholdSeconds(previousGridSize) + speedWindowSeconds(member.upgrades)) * 1000`; `engine.ts:665-666` same (inclusive) |
| AC-5 | ✅ | Effects read current `upgrades` only on new credit; no retroactive coin change; `adoptUpgrades` only swaps levels (`engine.ts:1127-1130`) |
| AC-6 | ✅ | `protocol.ts` (backend/frontend): `purchaseUpgrade { upgradeId: string }`; codec `isNonEmptyString` (`backend protocol.ts:254-258`, frontend `:319-323`) |
| AC-7 | ✅ | `hub.ts:748-787`: guest/unknown/max/insufficient paths send `unknown_upgrade`/`max_level`/`insufficient_funds`; null repo result → `insufficient_funds`; no broadcast on rejection |
| AC-8 | ✅ | `economy-repository.ts:207-231` conditional `UPDATE ... WHERE user_id=$1 AND coins>=$2 AND COALESCE((upgrades->>'<id>')::int,0)=$4 ... RETURNING ...`; in-memory mirrors (`:99-121`) |
| AC-9 | ✅ | `hub.ts:779-786` updates members and calls `broadcastEconomyUpdate` + `broadcastUpgradesUpdate`; `session.ts:627-646` adopts both |
| AC-10 | ✅ | Guest early guard `hub.ts:750-752`; session guest path `session.ts:838-864` adopts debited coins + level, no message; mode signal `MultiplayerSnapshot.mode` (`session.ts:324-337`) |
| AC-11 | ✅ | `hub.ts:354` includes `upgrades` for accounts; `handleJoin` loads via `findUpgradesByUserId` (`:512-519`); optional in wire, always present for accounts |
| AC-12 | ✅ | `upgradesUpdate { upgrades }` in both protocols; frontend `parseUpgradeState` requires integer levels (`frontend protocol.ts:442-459`) |
| AC-13 | ✅ | `session.ts:640-646` `handleUpgradesUpdate` → `engine.adoptUpgrades` + publish; `engine.ts:1127-1130` |
| AC-14 | ✅ | `hub.ts:672-685` `broadcastUpgradesUpdate` to all joined account connections incl. origin |
| AC-15 | ✅ | `session.ts:525-527` adopts `message.upgrades` on welcome; hub rejoin sends placement with upgrades (`hub.ts:589`) |
| AC-16 | ✅ | `engine.ts:487` `upgrades` state; `adoptUpgrades` (`:1127-1130`); multipliers applied in `explode`/completion |
| AC-17 | ✅ | `EngineSnapshot.upgrades?` (`engine.ts:249`), `OnlineEngineSnapshot.upgrades` required (`:260`); `buildSnapshot` populates (`:544`) |
| AC-18 | ✅ | `upgrades.ts` (both): `upgradeCost = baseCost * (currentLevel + 1)`, `Infinity` at max; base costs 10/50/25 |
| AC-19 | ✅ | `UpgradesPanel.tsx` lists name/level-max/effect/cost/buy; calls `onPurchase(id)` when affordable; `mode` prop; `App.tsx:456-463` wiring |
| AC-20 | ✅ | HUD coins line retained (`App.tsx:425-432`); `Hud.test.tsx` passes |
| AC-21 | ✅ | Speed bonus uses `deps.now()`/`cubeStartedAtMs` (`hub.ts:695-698`); client timing never trusted |
| AC-22 | ✅ | Cost/level/credits derived server-side from catalog + DB; only `upgradeId` validated (`hub.ts:761`, `isValidUpgradeId`) |
| AC-23 | ✅ | Migration `003_upgrades.sql` + schema mirror; container diff gate empty (build log); no compose/Dockerfile change |
| AC-24 | ✅ | `npm run coverage` → backend 94.83/85.99/99.29/94.83, frontend 95.19/95.09/96.89/95.19 (all ≥ 80) |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `src/frontend/src/game/session.ts:855-856` | Guest purchase debits coins as `coins - cost` without `roundCoins`, while every other coin mutation (engine rewards, server credits) is rounded to 2 decimals; a 2-decimal balance minus an integer cost can retain float artifacts (e.g. `0.3 - 0` → `0.29999999999999999`). | Wrap the debited total in `roundCoins(...)` (import from `./economy`) for parity with the server path. | open |

## Verification performed

- `npm run lint` → exit 0
- `npm run typecheck` → exit 0 (both workspaces)
- `npm test` → backend 21 files / 584 tests passed; frontend 44 files / 1099 tests passed
- `npm run coverage` → exit 0; backend All files 94.83% stmts / 85.99% branch / 99.29% funcs / 94.83% lines; frontend 95.19% / 95.09% / 96.89% / 95.19%
- `npm run build` → exit 0
- Container diff gate on `compose.yaml`, `compose.smoke.yaml`, Dockerfiles → empty (exit 0)
- Doc gate `grep -q "upgrade" docs/product/glossary.md` → OK
- Coverage config review: exclusions are test files + one composition-root entrypoint per workspace (`server.ts`/`main.tsx`) only; thresholds pinned at 80 on all four metrics; `all: true`

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Parameterized SQL; `upgradeId` validated against pinned catalog; atomic conditional update with level guard; no secrets; migration idempotent; inbound messages validated in frontend codec (integer levels, non-empty keys) |
| Quality | ✅ | Pure logic separated; single connection owner; server clock for effects; no trust in client values; one minor float-rounding nit (F1) |
| Testing | ✅ | Coverage ≥ 80% both workspaces; no banned matchers; concrete expected values; edge cases (max level, insufficient funds, stale level, reconnect, guest) covered |

## Previous round verification (if iteration > 1)

n/a (first code review round)

## Notes / backlog (non-blocking)

- In-flight purchase disabling (Q-9 deferred) is intentionally omitted in v1; repeated clicks are guarded server-side by the level guard. Recorded default-with-notice in spec.<|end|><|start|>starter to=assistant<|channel|>analysis<|message|>Now final report. Need return Subagent Report with status completed, verdict frontmatter echoed, artifact paths.<|end|><|start|><|start|>assistant<|channel|>final<|message|>Subagent Report
status: completed
verdict: approved
blocking: 0
nonblocking: 1
artifact: docs/features/spending-upgrades/reviews/code-r1.md