---
feature: multiplayer-cube-sync
phase: spec
iteration: 1
verdict: changes_requested
blocking: 9
nonblocking: 6
---

# Spec Review — r1

## Summary

❌ changes requested — 9 blocking findings (1 BLOCKER, 8 MAJOR). The spec's core feature (orientation sync) is well-scoped and feasible against the existing codebase, but the protocol contract contradicts itself on range validation vs. server clamping (unverifiable acceptance), several pinned constants/wordings conflict with the real code (rotationMs 300 ms, not 200 ms), and the plan leaves backend orientation storage and `cubeRotated` world-view handling unspecified. All findings below must be resolved before building.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | `spec.md § AC-2`, `§ AC-3`, `§ AC-4`, `§ Security considerations`; `plan.md § Interfaces/contracts` (Validation line) | AC-2/AC-3 require that non-integer **or out-of-range** values decode to `bad_message`, while AC-4 requires the server to clamp out-of-range `rotate` values, and Security says orientation is "clamped server-side". If the codec rejects out-of-range frames, the server's clamp path is unreachable and the AC-4 "clamping cases" cannot be exercised through `handleMessage`/socket tests (unverifiable acceptance). | Reconcile: either (recommended) amend AC-2/AC-3 so the codec validates integer type only (non-integer → `bad_message`) and range is server-clamped per AC-4, updating plan.md's validation line to match; or keep codec range rejection and remove the server-clamp claim from AC-4/Security. Pick one and make both workspaces' codec + hub tests agree. | open |
| F2 | MAJOR | `spec.md § AC-4`, `§ AC-6`; `plan.md § Backend hub handling` (pseudocode lines 39–45) | The plan updates `member.cube` orientation **before** checking the rate limit, while AC-6 says additional messages are "dropped silently (no broadcast, no reply)". It is unspecified whether a rate-limited `rotate` still mutates stored orientation / is later broadcast, which changes convergence and test expectations. | Specify that a rate-limited `rotate` is dropped **before** clamp/update/broadcast (no state change, no broadcast, no reply), and rewrite the plan pseudocode so the rate check precedes the store update. | open |
| F3 | MAJOR | `spec.md § Open questions Q-5`, `§ Boundaries` (🚫 Never: "add LWW for shared state") | Q-5 recommends "server-relay with clamping + **latest-wins**" for orientation, which reads as violating the inherited boundary that forbids last-write-wins for shared state. Orientation is single-writer (each member owns their own cube), so latest-wins is safe there, but the spec never scopes the exception. | Clarify in Q-5 and Boundaries that latest-wins applies **only** to a member's own orientation (single writer) and never to contested shared state; reword the boundary to state that exception explicitly. | open |
| F4 | MAJOR | `spec.md § AC-7` ("over the active profile's `rotationMs` (default profile: 200 ms)"); `§ Assumptions`; `src/frontend/src/game/effects.ts` `DEFAULT_TIMINGS.rotationMs` (= 300) | The pinned "default profile: 200 ms" conflicts with the actual default profile (`rotationMs: 300`) and with the assumption that remote rendering uses `timingsFor(false).rotationMs`. "Active profile" is also ambiguous under reduced motion on the receiver. | Pin the duration to `timingsFor(false).rotationMs` (300 ms) for all receivers (remote rendering stays independent of the receiver's motion preference), and update AC-7/Assumptions; do not deviate the pinned constant without approval. | open |
| F5 | MAJOR | `spec.md § AC-1` ("existing test suites pass unmodified") | AC-1 claims the inherited suites pass **unmodified**, but AC-2 adds **required** `yawSteps`/`pitchSteps` to `CubeState`/`MemberState`. Every existing fixture/test that constructs those shapes must be updated to include the new fields, so "unmodified" is impossible; the wording invites a false regression claim. | Reword AC-1 to: inherited suites pass after the mechanical addition of the new fields, with no behavioral regression and no assertion weakening; record the fixture touch-up as allowed (not a weakening). | open |
| F6 | MAJOR | `plan.md § Interfaces/contracts — World view rotation animator` (applyMessage not listed); `spec.md § AC-7` | The plan's `WorldView.applyMessage` contract lists `miniCubeRemoved`, `levelAdvanced`, `memberJoined`, `memberLeft` but not `cubeRotated`, yet AC-7 requires a `cubeRotated` broadcast to make the matching remote `CubeView` rotate. Without an explicit case the handler is likely omitted. | Add `cubeRotated` to the `applyMessage` contract (and to the `WorldView` interface comment): update the matching member's orientation and start the animator; no-op for unknown members. | open |
| F7 | MAJOR | `plan.md § File inventory` (servers.ts "default orientation on member creation"); `spec.md § AC-9` (backend half); `src/backend/src/game/hub.ts` (`Member`, `cubeState`, `memberState`, `handleJoin`, `handleCompletion`) | The backend has no cube-orientation field today: `Member.cube` is the board `CubeState` (cubes.ts) and `servers.ts` owns no cube state, so "servers.ts default orientation" is not implementable as written. The storage location and the level-advance reset are unspecified. | Specify that the backend `Member` carries `yawSteps`/`pitchSteps` (or that cubes.ts `CubeState` gains them, with `createNextCube` resetting to `(0,0)`), that `handleJoin` initialises `(0,0)`, that `hub.rotate` updates and clamps them, that `handleCompletion` resets them, and that `cubeState`/`memberState` map them onto the wire; correct the file inventory (hub.ts/cubes.ts, not servers.ts). | open |
| F8 | MAJOR | `spec.md § AC-5` ("apply to self if `playerId === self.playerId`, as a no-op-safe adopt"); `§ AC-4` (broadcast "to all other members (not the sender)"); `§ AC-13` | AC-5 asks the reducer to adopt a self `cubeRotated` "as a no-op-safe adopt", but AC-4 broadcasts `cubeRotated` to **other** members only, so a self frame never arrives in normal flow. The intended reducer/engine behaviour for a self frame (and whether the engine must adopt orientation on `cubeRotated` at all) is ambiguous and conflicts with AC-13 (own orientation adopted via `welcome`/`stateSync`). | Clarify that the self branch in the reducer is defensive only (orientation updated if a self frame is ever received), that the engine does **not** adopt orientation from `cubeRotated` (own orientation is authoritative locally and corrected via `welcome`/`stateSync`), and adjust AC-5/AC-13 wording accordingly. | open |
| F9 | MAJOR | `spec.md § AC-12`, `§ AC-14`; `src/frontend/src/game/session.ts:396–404` (predecessor residual N1) | Reconnection while spectating is not fully specified: `handleWelcome` resets spectate state only when `previousSelfId === message.playerId`. A fresh-identity reconnect (drop → `resume_failed` → `join`) can retain a stale spectate `viewing` state and its input gate until "Return to my cube" is pressed, contradicting AC-12/AC-14 ("view resets to the own cube instantly") and predecessor AC-19 d. | Require that spectate state is reset on **every** `welcome` (and on `resume_failed`), regardless of identity, and add a spectating → new-identity welcome test to the session evidence. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All raw-request asks (remote turns visible, full spectating, vision-range actions, completion replacement) are covered by AC-7/10/11/12. |
| Testability | ❌ | F1 (AC-4 clamping unverifiable as written), F4 (wrong pinned duration), F5 (unmodified suites), F11 below (optional loss-tolerance test). |
| Boundaries | ✅ | Three tiers present; non-goals listed. F3 scopes the LWW exception. |
| Dependency graph | ✅ | Acyclic; dependencies point at earlier tasks; every AC mapped. |
| Parallel safety | ✅ | `[P]` tasks (T2, T4) own disjoint file sets; shared files owned by exactly one task. |
| Security | ✅ | Clamping/rate limit/size & connection caps unchanged; F1 resolves the codec/clamp contradiction. |
| Testing | ✅ | Unit + integration tiers, `npm run coverage`, ≥ 80% thresholds, concrete-assertion bar referenced. |
| Consistency | ❌ | F1, F4, F5, F8; message names/rate limits otherwise agree across spec/plan/tasks. |
| Real-time | ❌ | F2 (rate-limit order), F3 (LWW scope), F8, F9 (reconnect/spectate reset). |
| Containers | ✅ | No service/image/port/env change; AC-16 and predecessor AC-25 preserved. |

## Previous round verification (if iteration > 1)

N/A — iteration 1.

## Notes / backlog (non-blocking)

- F10 (MINOR) — `spec.md § AC-15`: loss-tolerance evidence is "documented; optional test in `world.test.ts`". Make it a concrete optional/required test with an asserted settled matrix so the claim is evidence-able.
- F11 (MINOR) — `spec.md § Open questions Q-1..Q-9`: questions remain open while the plan silently adopts the defaults. Either resolve them in the spec (pinning 20/s, 50 ms, `timingsFor(false).rotationMs`, absolute, relay+clamp, no remote auto-rotate, no culling, orientation in `stateSync`, no smoke change) or keep them open and mark the plan's choices as provisional.
- F12 (MINOR) — `spec.md § AC-11` / `§ Non-goals`: "vision range" wording implies proximity culling while the decision is "render every member (≤ X)". Rename/clarify (e.g. "no vision-range culling; all server members are rendered") to avoid a contradiction with AC-13's one-view-per-member bound.
- F13 (MINOR) — `tasks.md` T6 acceptance lists AC-10/AC-11, but T6 owns only `world.ts`; spectating camera behaviour lives in `scene.ts`/`session.ts` (T8). Re-map AC-10/AC-11 to T6+T8 or add `scene.ts` to a task's `files_owned`.
- F14 (MINOR) — `plan.md` World-view animator says `t = elapsed/duration` (linear) while AC-7 says "smooth animation". Confirm linear is intended (matching the engine's `rotationProgress`) or specify an easing; the test's t=0/100/200 ms expectations depend on it.
- F15 (INFO) — Rotation bandwidth at X = 10: 10 members × 20 rotate/s = 200/s plus clicks; within Node's capacity, but the spec should note the throttle (50 ms) is what bounds it (already in Q-2).
- F16 (INFO) — Predecessor residual backlog (N1/N2 from `multiplayer-servers/reviews/code-r2.md`) overlaps this feature's scope (spectate reset on reconnect, `faceCleared` replay coverage). Either fold the fixes into T8/T7 or record them as explicitly out of scope; do not let them silently carry over.