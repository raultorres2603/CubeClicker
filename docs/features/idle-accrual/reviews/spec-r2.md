---
feature: idle-accrual
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 0
---

# Spec Review — r2

## Summary

✅ approved — Revision 2 addresses all thirteen findings from r1 (F1–F13) with concrete, auditable changes: atomic compare-and-swap eligibility (AC-19), corrected guest `welcome.economy` semantics (AC-10), pinned idle-helper threshold contract (AC-6), in-memory `lastSeenAt` preservation, typed nullable repository state with conversion, supersessions section, reconciled task dependencies, explicit rejoin/touch semantics, shared-clock note, statement-level migration timestamp, pinned broadcast/welcome ordering, approval-gated constants note, and the crash over-credit note. The dependency graph is acyclic, `[P]` ownership is disjoint, and real-time/container contracts are defined. No new BLOCKER or MAJOR findings.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| — | — | — | No open findings. | — | — |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All request asks covered by AC-1…AC-19 or explicit non-goals; supersessions recorded. |
| Testability | ✅ | Each AC is binary-testable with named evidence files; `idleCoins` threshold/cap pinned (AC-6, AC-4). |
| Boundaries | ✅ | Three tiers present; non-goals listed; approval-gated constants flagged (F12). |
| Dependency graph | ✅ | Acyclic; T1→T2/T3, T4 after T2+T3, T5 after T4, T6 after T1–T5; every AC mapped. |
| Parallel safety | ✅ | T2 `[P]` owns `economy.ts`/`economy.test.ts`, disjoint from T3 repository files. |
| Security | ✅ | CAS eligibility (AC-19), server authority (AC-5), parameterized SQL, atomic `credit`, bounded cap/threshold. |
| Testing | ✅ | Unit + integration tiers named; `npm run coverage` ≥ 80% per workspace; assertion bar stated. |
| Consistency | ✅ | Aligns with coin-economy/spending-upgrades; reuses `user_economy` + migration runner; no container impact. |
| Real-time | ✅ | Connection lifecycle, reconnection, multi-client away detection, server authority, broadcast ordering pinned. |
| Containers | ✅ | No new service/image/port/env; migration 004 + schema mirror; `podman compose up`/smoke unchanged. |

## Previous round verification (r1 → r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (MAJOR) concurrent-join double credit | fixed | spec.md § Acceptance criteria AC-19; plan.md § Interfaces (repository, `touchLastSeen` CAS); tasks.md T3/T4. |
| F2 (MAJOR) guest `welcome.economy` factual error | fixed | spec.md § AC-10 (present with zeros, unchanged). |
| F3 (MAJOR) idle-helper threshold contract | fixed | spec.md § AC-6 (`idleCoins` returns `0` below threshold); plan.md § Interfaces (helper). |
| F4 (MAJOR) in-memory `lastSeenAt` wipe by `credit` | fixed | plan.md § Interfaces (in-memory `credit` carries `lastSeenAt`; new row `null`). |
| F5 (MAJOR) `StoredRow.lastSeenAt` type/conversion ambiguity | fixed | plan.md § Interfaces (`StoredRow.lastSeenAt: number \| null`; signatures + Pg conversion). |
| F6 (MINOR) missing supersessions section | fixed | spec.md § Supersessions of accepted behaviors. |
| F7 (MINOR) T2 dependency wording | fixed | tasks.md T2 `depends_on: T1`; dependency overview reconciled. |
| F8 (MINOR) rejoin touch semantics | fixed | spec.md § AC-11/AC-14; plan.md § Data flow (rejoin never touches). |
| F9 (MINOR) shared clock alignment | fixed | plan.md § Risks (clock alignment); tasks.md T4/T5 notes. |
| F10 (MINOR) per-row migration timestamp | fixed | plan.md § Migration (statement-level `UPDATE … SET last_seen_at = now()`). |
| F11 (MINOR) broadcast/welcome ordering | fixed | plan.md § Data flow 1 (touch → credit → update members → broadcast → welcome). |
| F12 (INFO) approval-gated constants note | fixed | spec.md § Boundaries (⚠️) and § Assumptions. |
| F13 (INFO) crash over-credit note | fixed | spec.md § Open questions Q-11 and § Assumptions. |

## Notes / backlog (non-blocking)

- Q-1..Q-5 remain approval-gated before T2/T4; proposed defaults are used in the interim and flagged in tasks (no spec change to defaults).
- Plan pseudocode in `handleJoin` is illustrative; the builder must keep the `coins` eligibility value in scope across the touch/credit/broadcast steps (F11 ordering).
- Postgres `touchLastSeen` CAS depends on consistent millisecond conversion between `findLastSeenAt` and the stored `TIMESTAMPTZ`; the builder should follow the existing session-repository ISO round-trip pattern (or truncate migration timestamps to milliseconds) so pre-existing rows do not miss the first touch.
- No frontend changes are required; existing `session.test.ts` economy adoption covers the resulting totals. Documentation pass stays minimal per `docs/architecture/documentation.md`.