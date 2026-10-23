---
feature: multiplayer-cube-sync
kind: spec
iteration: 2
verdict: approved
blocking: 0
---

# Spec Review — r2

## Summary

✅ approved — 0 blocking findings. All 16 round-1 findings (F1–F16) are closed with concrete, testable changes; the revised spec/plan/tasks are internally consistent, the task graph is acyclic with disjoint `[P]` file sets, the 17 ACs are binary-testable with named evidence files, and the real-time and containerization contracts are preserved.

## F1–F16 closure table

| # | r1 severity | r1 finding (short) | r2 resolution | Location in r2 | Closed? |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | Codec range vs. server clamp contradiction | Codec validates integer type only for `rotate` (non-integer → `bad_message`); range is server-clamped per AC-4. Server-originated fields remain range-validated. Plan validation line matches. | `spec.md` AC-3, AC-4, Security; `plan.md` § Interfaces/contracts (Codec rule) | ✅ |
| F2 | MAJOR | Rate-limit order unspecified | Rate check precedes clamp/update/broadcast; dropped silently (no state, broadcast, reply). Plan order: size → codec → duplicate guard → joined → rate limit → semantic. | `spec.md` AC-6; `plan.md` § Backend hub handling | ✅ |
| F3 | MAJOR | Latest-wins scope vs. LWW boundary | Latest-wins scoped to a single member's own orientation only; never contested shared state. Boundary reworded. | `spec.md` Q-5, Boundaries, Assumptions | ✅ |
| F4 | MAJOR | Wrong pinned duration (200 ms) | Pinned to `timingsFor(false).rotationMs` = 300 ms for all receivers (remote rendering independent of receiver motion preference). | `spec.md` AC-7, Assumptions; `effects.ts` `DEFAULT_TIMINGS.rotationMs = 300` | ✅ |
| F5 | MAJOR | "Unmodified suites" impossible | Reworded: inherited suites pass after mechanical field addition, no behavioral regression, no weakening/deletion; fixture touch-up allowed. | `spec.md` AC-1 | ✅ |
| F6 | MAJOR | `cubeRotated` missing from `applyMessage` | `WorldView.applyMessage` handles `cubeRotated`: update matching member's orientation + start animator; no-op unknown. T6 retains AC-5 (world half). | `spec.md` AC-5; `plan.md` § World view rotation animator | ✅ |
| F7 | MAJOR | Backend orientation storage unspecified | `Member` carries `yawSteps`/`pitchSteps`; `handleJoin` init `(0,0)`; `handleCompletion` resets; `cubeState`/`memberState` project; `cubes.ts`/`servers.ts` unchanged. | `spec.md` Assumptions; `plan.md` § Backend hub handling, File inventory | ✅ |
| F8 | MAJOR | Self-adopt ambiguity | Reducer self branch defensive only; engine does not adopt orientation from `cubeRotated` (own orientation corrected via `welcome`/`stateSync`). | `spec.md` AC-5, AC-13 | ✅ |
| F9 | MAJOR | Reconnect/spectate reset | Spectate state reset on every `welcome` (regardless of identity) and on `resume_failed`; view resets to own cube instantly. Folds predecessor N1 into T7. | `spec.md` AC-12, AC-14; `plan.md` § Session | ✅ |
| F10 | MINOR | Coalescing vs. face fade | Explicitly independent layers governing different concerns. | `spec.md` Assumptions; `plan.md` Risks | ✅ |
| F11/F12 | MINOR | "Vision range" wording | AC-11 renamed "No vision-range culling"; non-goals clarify no distance/frustum culling. | `spec.md` AC-11, Non-goals | ✅ |
| F13 | MINOR | `stateSync` orientation | `CubeSync` + `stateSyncMessage` carry `yawSteps`/`pitchSteps`; reducer `withSync` adopts; T1 covers it. | `spec.md` AC-13; `plan.md` § Interfaces/contracts; `tasks.md` T1 errata | ✅ |
| F14 | MINOR | Smoke-test scope | Non-goals + errata: no `smoke.mjs`/compose/Dockerfile/README change. | `spec.md` Non-goals; `tasks.md` errata | ✅ |
| F15 | INFO | Dependency confirmation | No new dependencies; stack unchanged. | `spec.md` Non-goals, Assumptions | ✅ |
| F16 | INFO | Predecessor backlog overlap | N1 folded into T7; N2 remains in inherited `world.test.ts`. | `spec.md` Assumptions (last line) | ✅ |

## Per-AC table

| AC | Binary-testable? | Concrete expected values? | Named evidence file(s)? | Verdict |
| --- | --- | --- | --- | --- |
| AC-1 Baseline preserved | ✅ | Inherited suite names + fixture touch-up rule | `protocol.test.ts`, `servers.test.ts`, `cubes.test.ts`, `hub.test.ts`, `app.test.ts` (backend); `protocol.test.ts`, `server-state.test.ts`, `world.test.ts`, `scene.test.ts`, `session.test.ts`, `engine.test.ts` (frontend) | ✅ |
| AC-2 Orientation on wire | ✅ | Valid `(0,0),(3,1),(2,-1)`; invalid `1.5,4,-1` (yaw), `2,-2` (pitch) | `protocol.test.ts` (both) | ✅ |
| AC-3 Client `rotate` | ✅ | `{1.5,0}` → `bad_message`; `{5,0}` accepted | `protocol.test.ts` (both) | ✅ |
| AC-4 Server handles `rotate` | ✅ | Clamp `5→1`, `-1→3`, pitch `5→1`, `-5→-1`; `not_joined` for non-joined | `hub.test.ts` | ✅ |
| AC-5 `cubeRotated` broadcast | ✅ | Reducer + `WorldView.applyMessage` handling; self defensive only | `protocol.test.ts`, `server-state.test.ts`, `world.test.ts` | ✅ |
| AC-6 Rate limit | ✅ | 20/21 boundary in 1000 ms; reset after 1000 ms | `hub.test.ts` (fake timers) | ✅ |
| AC-7 Remote cubes rotate | ✅ | Group rotation at t = 0/150/300 ms + settled matrix; identical = no-op | `world.test.ts` | ✅ |
| AC-8 Initial orientation sync | ✅ | New members at reported orientation (no animation); existing animate only if differs | `server-state.test.ts`, `world.test.ts` | ✅ |
| AC-9 Level advance resets orientation | ✅ | `(0,0)` + identity rebuild (backend + remote) | `world.test.ts`, `hub.test.ts` | ✅ |
| AC-10 Full spectating | ✅ | View-only gating; camera identity quaternion; target cube rotations visible | `session.test.ts`, `scene.test.ts` | ✅ |
| AC-11 No vision-range culling | ✅ | All members (≤ X, X ≤ 24) rendered incl. rotations | `world.test.ts` + bound X ≤ 24 | ✅ |
| AC-12 Completion across level advance | ✅ | Same-server rebuild vs. cross-server move; orientation reset; spectate reset rules | `session.test.ts`, `world.test.ts` | ✅ |
| AC-13 Own-cube adopts server orientation | ✅ | `adoptCubeState` settled, `rotationFrom = null`; stats not rolled back | `engine.test.ts`, `session.test.ts` | ✅ |
| AC-14 Reconnection convergence | ✅ | Resume within grace → adopt own + remote orientations; view resets instantly | `session.test.ts` | ✅ |
| AC-15 Loss tolerance | ✅ | Group rotation matrix unchanged after dropped packet; converges on next accepted | `world.test.ts` | ✅ |
| AC-16 No containerization impact | ✅ | `git diff` on container paths empty | git diff | ✅ |
| AC-17 Coverage gate | ✅ | ≥ 80% statements/branches/functions/lines both workspaces | coverage transcripts | ✅ |

## Task graph

- Dependency overview: `T1 → T2, T3; T3 → T4, T5, T6; T4, T5, T6 → T7; T2, T7 → T8`. Acyclic: ✅ (no task depends on a later-numbered task; T8 is the sole sink).
- `[P]` tasks (T3, T4, T5, T6) own disjoint file sets: frontend protocol, server-state, engine, world respectively — no shared files: ✅.
- Shared files single-owner: backend `protocol.ts` (T1), backend `hub.ts` (T2), frontend `protocol.ts` (T3), `server-state.ts` (T4), `engine.ts` (T5), `world.ts` (T6), `session.ts` (T7). The T2/T3 merge erratum keeps `hub.ts` to one owner: ✅.
- Every AC maps to at least one task (T1: AC-2/3/5/13-wire; T2: AC-4/5/6/9-backend/14-backend; T3: AC-2/3/5; T4: AC-5/8/9/14; T5: AC-13; T6: AC-5/7/8/9/11/15; T7: AC-10/12/13/14; T8: AC-1/16/17): ✅.

## Real-time contract

- Connection lifecycle: unchanged (hello-first, heartbeat, grace) plus `rotate` handled inside the existing frame path; rate limit precedes store update: ✅.
- Reconnection: spectate state cleared on every `welcome` and `resume_failed`; view resets to own cube instantly; orientation adopted via `adoptCubeState`: ✅.
- Multi-client: `cubeRotated` broadcasts to all other members; roster/memberJoined carry orientation; server-scoped: ✅.
- Server-authoritative shared state: orientation is client-reported intent, clamped + latest-wins for a member's own cube only; no LWW for contested state: ✅.
- Loss tolerance: dropped `cubeRotated` leaves previous orientation; next message converges; no error raised: ✅.

## Containerization contract

- No new service, image, port, env var, health signal, Dockerfile, or compose change; `podman compose up` and `npm run smoke` unchanged; AC-16 evidence is an empty diff on container paths: ✅.

## Findings

### MINOR

- **M1 — AC-2 evidence scope wording.** `spec.md` AC-2 says the codec matrix runs in "`protocol.test.ts` (both workspaces)", but server-originated range validation is a frontend decode path (`parseServerMessage`); the backend has no server-message decoder, so it can only assert builder/shape outputs, not `bad_message` decoding of server frames. *Required action (non-blocking):* clarify AC-2 evidence so the range-decode matrix is pinned to the frontend workspace, with the backend asserting in-range builder output (or note that backend range validation is structural via clamped storage). Location: `spec.md` § AC-2.
- **M2 — AC-3 evidence conflates codec acceptance with server clamping.** The evidence line "`{ yawSteps: 5, pitchSteps: 0 }` → accepted (clamped to 1)" implies the codec produces `1`, but per AC-3/AC-4 the codec accepts the out-of-range integer and the server clamps it to `1` in the broadcast. *Required action (non-blocking):* split the evidence so AC-3 asserts codec acceptance only (`ok: true`) and AC-4 asserts the clamped broadcast value `1`. Location: `spec.md` § AC-3, § AC-4.

### INFO

- **I1 — Constant home for the 50 ms client throttle.** The throttle value (50 ms) is pinned in Q-2/Boundaries but has no single "home" module named. Recommend documenting it in `session.ts` as a named constant to keep the pinned-constant discipline explicit. Location: `spec.md` Q-2; `plan.md` § Session send-on-change.

## Verdict

No BLOCKER or MAJOR findings. All round-1 findings are closed. The spec is approved for the build phase. Minor items M1/M2 are documentation clarifications only and do not affect implementability or testability of the ACs.

blocking: 0
nonblocking: 3 (2 MINOR, 1 INFO)