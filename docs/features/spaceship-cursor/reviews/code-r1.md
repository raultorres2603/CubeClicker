---
feature: spaceship-cursor
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 0
---

# Code Review — r1

## Summary

✅ approved — Frontend-only spaceship cursor feature verified against spec r3 and tasks T1–T4. All verification commands pass per build-log-T4 (lint, typecheck, tests, coverage, build); coverage ≥ 80% in both workspaces; no container/backend diff (AC-10). No BLOCKER or MAJOR findings.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `scene-spaceship.test.ts` — spaceship group named `'spaceship'` with ≥1 Mesh in `scene.children`, survives `levelChanged` rebuild; build log T4. |
| AC-2 | ✅ | `spaceship.test.ts`, `effects-spaceship.test.ts`, `scene-spaceship.test.ts` — follow factor `1 - exp(-dtMs/120)`, tau pinned 120; reduced motion snaps (factor 1 incl. dtMs 0); no-pointer rests at `(0,0,6)`. |
| AC-3 | ✅ | `spaceship.test.ts`, `effects-spaceship.test.ts` — offsets pinned (-0.05, -0.08), plane distance 6; default camera yields `(-0.139757, -0.223611, 6.005798)`. |
| AC-4 | ✅ | `scene-spaceship.test.ts` — explosion intent defers pop/burst, no immediate hide, one shot added; `SceneView.shots` accessor; start/target captured at fire time. |
| AC-5 | ✅ | `scene-spaceship.test.ts` — after 180 ms shot removed, mini-cube hidden, burst spawned; midpoint position is average; burst uses `lastFrameTime` (default 0). |
| AC-6 | ✅ | `scene-spaceship.test.ts` — reduced motion applies instantly, no shot; `update` spawns nothing. |
| AC-7 | ✅ | `session-spaceship.test.ts` — pointermove NDC conversion/clamp and `GameSession.setPointerTarget`. |
| AC-8 | ✅ | `scene-spaceship.test.ts` — `dispose()` clears spaceship + shots; exactly one spaceship group after rebuild. |
| AC-9 | ✅ | build-log-T4: `npm run coverage` exit 0; backend 94.66/84.32/99.6/94.66; frontend 94.88/94.71/96.37/94.88 (≥80). |
| AC-10 | ✅ | build-log-T4: `git diff` for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, Dockerfiles empty. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| — | — | — | None. | — | — |

## Verification performed

- `npm run lint` → exit 0 (build-log-T4)
- `npm run typecheck` → exit 0, backend + frontend `tsc --noEmit` (build-log-T4)
- `npm test` → exit 0; backend 18 files/492 passed, frontend 40 files/849 passed (build-log-T4)
- `npm run coverage` → exit 0; backend 94.66% stmts / 84.32% branches / 99.6% funcs / 94.66% lines; frontend 94.88% stmts / 94.71% branches / 96.37% funcs / 94.88% lines, ≥80 all metrics both workspaces (build-log-T4)
- `npm run build` → exit 0, backend tsc + frontend vite (build-log-T4)
- AC-10: empty diff for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, Dockerfiles (build-log-T4)

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new deps; procedural geometry only; no user data/storage/network; shots bounded and cleared on dispose; no container/backend change. |
| Quality | ✅ | Pure math in `spaceship.ts`/`effects.ts` separated from rendering; diff traceable to T1–T4; no drive-by refactors reported. |
| Testing | ✅ | AC-1..AC-10 each have direct test/command evidence; coverage thresholds met; assertion-quality bar per spec. |

## Previous round verification (if iteration > 1)

n/a (first code review iteration).

## Notes / backlog (non-blocking)

- INFO: orchestrator-owned carry-over from spec review F10 — `docs/features/spaceship-cursor/status.md` frontmatter still has a duplicate `spec_review_round` key; collapse to a single key. Not a code finding; does not affect ACs.
- INFO: Q-1/Q-2 user checkpoints (cross-client visibility; state vs. visual timing) remain flagged per spec; defaults (local-only, visual-only delay) implemented.
- INFO: in-flight shots are not explicitly capped; acceptable at click rates (spec Security/Notes). Future enhancement candidate.
- INFO: `docs/features/README.md` row proposed in build-log-T4 for orchestrator application on acceptance.
