---
feature: spaceship-cursor
phase: spec
iteration: 3
verdict: approved
blocking: 0
nonblocking: 1
---

# Spec Review — r3

## Summary

✅ approved — F8, F9 and F11 are fixed in r3 (observable `SceneView.lastFrameTime`, reduced-motion `dtMs === 0` snap, pinned NDC conversion formula). F10 (status.md duplicate `spec_review_round` key) is still open as a MINOR, orchestrator-owned item; recommend collapsing it to a single `spec_review_round: 3` before the build starts. No BLOCKER or MAJOR remains.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F10 (r2) | MINOR | `docs/features/spaceship-cursor/status.md` (frontmatter) | The status frontmatter still contains a duplicate `spec_review_round` key (`3` then `2`). YAML parsers and the orchestrator's state tracking resolve duplicate keys ambiguously (last/first wins depending on parser), so the recorded round is unreliable. F10 was marked "fixed (orchestrator)" in r2 but the duplicate persists in r3 (now `3`/`2` instead of `2`/`1`). | Collapse to a single `spec_review_round: 3` key. (Orchestrator-owned; not a spec/plan/tasks edit.) | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every request ask (follow cursor, 3D ship, shoot minicube, explode) is covered by AC-1…AC-8 or listed as non-goal; no scope invented beyond reduced-motion collapse and local-only flag (both justified/flagged). |
| Testability | ✅ | AC-5 frame-time clause now has a pinned observable accessor (`SceneView.lastFrameTime: number`, default `0`); AC-2 pins reduced-motion factor for `dtMs === 0`; AC-7 pins the NDC conversion formula. All ACs are binary-testable with concrete expected values. |
| Boundaries | ✅ | Three tiers present; non-goals listed (no rules/state/protocol/persistence change, no multiplayer visibility, no audio/deps/assets/shaders, no customisation UI, no browser automation). |
| Dependency graph | ✅ | T1→T2→T3→T4 acyclic; every AC mapped (AC-1…AC-8 to T1–T3, AC-9/AC-10 to T4); tasks sized to one builder session. |
| Parallel safety | ✅ | All tasks `[seq]`; no `[P]` task, so no shared-file contact to collide. |
| Security | ✅ | No new dependencies; no user data/storage/network; procedural geometry only; shots bounded and cleared on dispose; no coverage gaming. |
| Testing | ✅ | Unit + integration tiers, commands from AGENTS.md, `npm run coverage` with ≥80% ×4 named, assertion-quality/no-useless-tests bar referenced, edge cases (reduced motion, disposal, rebuild) named. |
| Consistency | ✅ | Aligns with vision (local client visuals) and reuses existing scene/session architecture; only the orchestrator-owned status.md frontmatter item remains (F10). |
| Real-time | ✅ | Explicitly none for shared state; connection lifecycle/reconnection/multi-client/server authority stated as unaffected; Q-1 flags the cross-client alternative. |
| Containers | ✅ | Explicitly none; no services/images/ports/env/health changes; AC-10 guards container/backend paths. |

## Previous round verification (r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F8 (r2) MAJOR — retained frame-time observable accessor | fixed | `spec.md` § AC-5 now pins `SceneView.lastFrameTime: number` (default `0`) as the evidence path, recorded from the last `applyIntents`/`applySnapshot` and used as the burst's frame time at arrival; `plan.md` § Interfaces/contracts line 45 (`readonly lastFrameTime: number`) and decision D-8. |
| F9 (r2) MINOR — reduced-motion factor at `dtMs === 0` | fixed | `spec.md` § AC-2 now states the reduced-motion factor is `1` for any `dtMs >= 0` (including `dtMs === 0`), while the non-reduced `dtMs === 0` factor remains `0`. |
| F10 (r2) MINOR — status.md duplicate `spec_review_round` key | not fixed | `docs/features/spaceship-cursor/status.md` frontmatter still has `spec_review_round: 3` followed by `spec_review_round: 2`. Re-raised above as F10 (r2). |
| F11 (r2) MINOR — session NDC conversion formula | fixed | `spec.md` § AC-7 now pins `ndcX = (clientX - rect.left) / rect.width * 2 - 1`, `ndcY = 1 - (clientY - rect.top) / rect.height * 2`, clamped to `[-1, 1]`. |

## Carry-over verification (r1)

F1–F7 remain fixed in r3 (no regression observed): shot-count observable accessor (`SceneView.shots`), unprojection method + expected vector, fire-time origin/normal capture, Summary shape wording, constant-assertion evidence file, retained frame-time default, and no-pointer behaviour are all still present in `spec.md`/`plan.md`.

## Notes / backlog (non-blocking)

- Q-1…Q-5 are user checkpoints with stated defaults; none blocks building, but Q-1 (cross-client visibility) and Q-2 (state vs. visual timing) should be confirmed with the user before acceptance.
- The deferred-explosion queue and shot lifetime depend on `update` dt accumulation; tests should use fixed dt steps (already noted in plan Risks).
- INFO: in-flight shots are not explicitly capped; the spec asserts "no unbounded growth" on the basis that each shot is removed on arrival (~180 ms). Acceptable for the click rate, but a future enhancement could add a cap mirroring the particle pool. Not a blocker.
- F10 (status.md duplicate key) is the only open finding and is orchestrator-owned; it does not affect spec/plan/tasks content or acceptance testability. Collapse before transitioning to build to keep state tracking unambiguous.