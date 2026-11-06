---
feature: spaceship-customization
phase: code
iteration: 1
verdict: approved
blocking_count: 0
nonblocking_count: 3
---

# Code Review — r1

## Summary

✅ approved — Verification suite reproduced green (lint, typecheck, tests, coverage ≥ 80% both workspaces, build, container diff gate); all AC-1..AC-18 met with evidence; 2 MINOR cleanups and 1 INFO recorded, none blocking.

## Verification (reproduced)

- `npm run lint` → exit 0
- `npm run typecheck` → exit 0 (both workspaces)
- `npm test` → backend 22 files / 700 tests passed; frontend 47 files / 1191 tests passed
- `npm run coverage` → backend 94.34% stmts / 85.93% branches / 99.68% funcs / 94.34% lines; frontend 94.89% / 94.89% / 95.65% / 94.89% (thresholds ≥ 80% met both)
- `npm run build` → backend tsc exit 0; frontend vite build ✓
- `git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile src/backend/src/server.ts` → exit 0 (AC-18)

## AC audit (AC-1..AC-18 met)

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | hub.test.ts — grant on cube completion, member `customization` update, scoped `customizationUpdate` |
| AC-2 | ✅ | engine.test.ts, hub.test.ts — engine increments local counts and publishes snapshot |
| AC-3 | ✅ | hub.test.ts, protocol.test.ts — open success decrements counts, increments part, member update before broadcast |
| AC-4 | ✅ | hub.test.ts — `no_lootbox`/`no_key` order, no state change; discriminated `applyLootboxOpen` |
| AC-5 | ✅ | engine.test.ts — guest open via engine RNG, no-op when insufficient |
| AC-6 | ✅ | hub.test.ts — equip updates `appearance[category]`, member update before broadcast |
| AC-7 | ✅ | hub.test.ts, protocol.test.ts — `unknown_part` / `not_owned`, no state change |
| AC-8 | ✅ | engine.test.ts — guest equip validates catalog + ownership, publishes snapshot |
| AC-9 | ✅ | migration 005 + schema.sql mirror (idempotent `ADD COLUMN IF NOT EXISTS`) |
| AC-10 | ✅ | hub.test.ts, session.test.ts — load on join, welcome/worldEntered carry customization, `adoptCustomization` replaces whole state |
| AC-11 | ✅ | protocol.test.ts (both workspaces) — messages, error codes, codec rules, `customizationUpdateMessage`, `copyCustomizationState`, parity |
| AC-12 | ✅ | SpaceshipCustomizationPanel.test.tsx (SSR) — counts, open button disabled state, owned parts + equip, preview |
| AC-13 | ✅ | parts.test.ts / spaceship.test.ts — `appearanceToSpaceshipParams` mapping (default + equipped) |
| AC-14 | ✅ | scene-spaceship.test.ts — cursor rebuilt/material updated on appearance change via `EngineSnapshot.customization` |
| AC-15 | ✅ | hub.test.ts — broadcast only to joined connections whose `accountSession.userId` equals owner |
| AC-16 | ✅ | hub.test.ts — forged/unowned `equipPart` yields `not_owned` |
| AC-17 | ✅ | coverage ≥ 80% both workspaces (see above) |
| AC-18 | ✅ | container diff gate exit 0 |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | src/backend/src/game/protocol.ts (mirror: src/frontend/src/multiplayer/protocol.ts) | Optional `customization` on `welcome`/`worldEntered` (and `Placement`) type possibly omitted/inconsistent across both protocol mirrors | Align both mirrors' types with the spec's `Placement.customization` rule (optional, follows codec rules) | open |
| F2 | MINOR | src/frontend/src/game/engine.ts (grant path) | Engine grant reuses `parts`/`appearance` references rather than defensive copies | Use `copyCustomizationState` (or equivalent) on grant to avoid shared mutable state | open |
| F3 | INFO | docs/features/spaceship-customization/build-log-T13.md | Documentation pass (T13) recorded | none | recorded |

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | User-controlled `partId` validated server-side; parameterized SQL; no new secrets; abuse bounds via `MAX_MESSAGE_BYTES` |
| Quality | ✅ | Lint/typecheck green; container assets and server.ts unchanged (AC-18) |
| Testing | ✅ | 921 total tests passed; coverage ≥ 80% both workspaces; no banned matchers noted |

## Verdict approved

Approved — no open BLOCKER or MAJOR findings. MINOR (F1, F2) and INFO (F3) are non-blocking and may be addressed in a follow-up.