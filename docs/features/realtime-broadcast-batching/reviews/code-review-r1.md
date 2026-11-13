---
feature: realtime-broadcast-batching
phase: code_review
round: 1
verdict: approved
reviewed: 2026-11-13
blocking: 0
nonblocking: 1
---

# Code Review — r1

## Summary

✅ approved — 0 blocking (0 BLOCKER, 0 MAJOR), 1 MINOR, 3 INFO. The T1–T5 implementation matches the approved r4 spec: encode-once fan-out, O(1) registry index and no-copy visitor, 40 ms removal batching with the legacy single-id shape and synchronous boundaries, 250 ms economy coalescing with absolute totals and highest-revision-wins, independent economy/purchase revision guards, one DB write per event, shutdown and deferred-join guards, frontend batch consumption, the AC-18 real-transport integration chain, the smoke burst and the before/after benchmark.

I reproduced the full gate independently: lint, typecheck, tests (backend 959, frontend 1844), coverage (backend 94.63/87.35/99.46/94.63; frontend 96.47/96.14/97.54/96.47), build (budget OK), the in-process and wire benchmarks, and `npm run smoke` (21/21 after rebuilding `frontend-prod`). The only non-blocking defect is that the T5 build log's recorded smoke output was captured against a stale `frontend-prod` image; the shipped tree passes when rebuilt, so this is an evidence/acceptance bookkeeping item (F1), not a product defect.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `hub.test.ts:2906` (two-id batch: `encodeCallsFor(..., 'miniCubesRemoved')` length 1, all ten peers get the identical pinned text) and `hub.test.ts:2931` (`memberLeft` encoded once for ten peers); benchmark `encodeCallsPerBroadcast: 1`. |
| AC-2 | ✅ | `hub.test.ts:2955` — a throwing peer is closed, a two-id batch reaches the other 9 peers unchanged, `connectionCount()` 9. `deliver` isolates a synchronous throw at `hub.ts:416-420`. |
| AC-3 | ✅ | `hub.test.ts:2994` — three connections receive one encode each of `economyUpdate`, `upgradesUpdate`, `customizationUpdate`, with byte-identical pinned text. `broadcastAccount` collects targets before encoding (`hub.ts:464-488`). |
| AC-4 | ✅ | `servers.test.ts` deterministic 200-operation assign/remove/move parity test plus unknown-member `null`; `locationOf` reads the maintained index (`servers.ts:312-317`), updated by assign/remove/move (`:343`, `:355`, `:385`). |
| AC-5 | ✅ | `servers.test.ts` `forEachMember` cases (ascending occupied slots, holes skipped, unknown/destroyed server visits nothing, primitives only); implementation at `servers.ts:319-330`. |
| AC-6 | ✅ | `servers.ts:308-310` still returns fresh `{ id, members: [...members] }` objects; the pre-existing snapshot test is present and green in the suite. |
| AC-7 | ✅ | `hub.test.ts:3775` CountingRegistry test asserts zero `registry.servers()` calls across join/explode/completion/rotate/leave; benchmark `registrySnapshotsPerBroadcast: 0`, `registrySnapshots: 0`. |
| AC-8 | ✅ | `hub.test.ts:3050`, `:3069-3087` exact `miniCubesRemoved` ids in acceptance order; `app.test.ts:248-252` live-socket 30-click batch. |
| AC-9 | ✅ | `hub.test.ts:3059-3067` one pending id yields the legacy `miniCubeRemoved` on both peers; hub chooses the shape at `hub.ts:370-373`. |
| AC-10 | ✅ | `hub.test.ts:3090` (30 clicks → one frame, ≤ 1024 B), `:3109` (two members, one batch each, never per click). |
| AC-11 | ✅ | `hub.test.ts:3136` (completion: removal → `levelAdvanced`), `:3169` (join: removal → `memberJoined`), `:3189` (grace: removal → `memberLeft`); boundary calls at `hub.ts:625`, `:826`, `:900`, `:1079`. |
| AC-12 | ✅ | `hub.test.ts:3212` — mover's last removal goes to the old server before `worldEntered`; the new server receives only `memberJoined`; batcher pins the first-enqueue server (`broadcast.ts:8-11`, `:117-123`). |
| AC-13 | ✅ | `hub.test.ts:3247` — rotate does not flush; a drop during the window still shows both ids in the rejoin `welcome` self and roster; `stateSync` test suites remain green. |
| AC-14 | ✅ | `hub.test.ts:3090-3107` 30-id frame ≤ 1024 B; `protocol.test.ts:510` pins the 30-id bound; `MAX_MESSAGE_BYTES` remains 1024 (`protocol.ts:37`). |
| AC-15 | ✅ | `hub.test.ts:3654-3681` (close clears both revision maps, zero timers, no sends after advance), `:3683` (late credit inert), `:3714` (deferred join inert); `close()` at `hub.ts:1451-1473`. |
| AC-16 | ✅ | Backend `protocol.test.ts:350` (ordered copy), `:461` (pinned exact frame), `:493` (missing/empty player, non-array/empty ids, non-string/empty ids all throw `TypeError`), `:510`; frontend `protocol.test.ts:318` decodes the pinned frame twice with copied arrays and rejects the same invalid set. |
| AC-17 | ✅ | `server-state.test.ts:294` (batch folds every id once, duplicate/replay returns the same reference, self and remote), `world.test.ts:389`, `:441`; `session.test.ts:2584` (self reconciliation only); `world.ts:378-386`. |
| AC-18 | ✅ | `session.test.ts:2643-2738` — real `createTransport` with fake WebSocket sockets, real decoder, real reducer/session, delegating fake scene to a real `createWorldView`: two ids, self and remote, duplicate, unknown member, empty frame dropped with no state change. |
| AC-19 | ✅ | `hub.test.ts:3283` — 30 accepted clicks produce one `economyUpdate` per joined connection with `coins: 3`, `clicks: 30`, `facesDestroyed: 3`, `cubesDestroyed: 0`, and exactly 30 `creditWithRevision` writes. |
| AC-20 | ✅ | `hub.test.ts:3315` (t=0/t=100 one frame; t=0/t=300 two; 1000 ms stream at most four); `broadcast.test.ts:222-341` cadence suite; benchmark `economyFramesPer100Clicks: 4` (≤ 16). |
| AC-21 | ✅ | `hub.test.ts:3404` (purchase immediate flush, exactly one economy frame, auto window cancelled), `:3437` (join idle credit immediate pre-`welcome`), `:3458` (older purchase dropped, newer multiplier used), `:3503` (newest purchase upgrades after a newer credit); `handlePurchaseUpgrade` at `hub.ts:1175-1201`. |
| AC-22 | ✅ | `hub.test.ts:3574` (flush with no joined connection returns before `JSON.stringify`), `:3592` (rejoin welcome has latest totals during a pending window), `:3617` (joining tab seeded from a newer applied revision than its own read); `broadcastAccount` early return at `hub.ts:481-483`. |
| AC-23 | ✅ | Click credit at `hub.ts:962`, completion credit at `:1101`, purchase at `:1175`, customization grant at `:1114` — same call sites/timing as before; no `economyRepo.credit(` call remains in the hub; SQL bumps `economy_revision` inside the same INSERT/UPDATE (`economy-repository.ts:623-698`). |
| AC-24 | ✅ | Both documented commands exit 0 and emit one JSON object with all required fields; `countersResetAfterSetup: true`; no dependency beyond Node 24/`tsx` (`tests/bench/realtime-broadcast.mjs`). |
| AC-25 | ✅ | In-process: encode 1 (baseline 10), registry 0, removal frames 4/100 (≤ 8), economy 4/100 (≤ 16), DB credits 100 (unchanged), max frame 351 B (≤ 1024). Wire: p95 42.11 ms ≤ 62.45 ms (baseline 2.45 + 60); 4 removal frames per recipient. Recorded T5 p95 41.24 ms also within target (F4 variance). |
| AC-26 | ✅ | `npm run smoke` exit 0, `SMOKE PASS (21/21)`, including `multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)` and the "never a single frame" check; existing single-click `miniCubeRemoved` check stays green. See F1 for the stale T5 recorded image. |
| AC-27 | ✅ | `docs/architecture/realtime.md` has the five exact headings, 3 relative links resolve; `README.md:55-56` documents both benchmark commands; claims match the implementation (fan-out, 40 ms, 250 ms, boundaries, reconnect, benchmark definitions). |
| AC-28 | ✅ | Lint/typecheck/test/coverage/build/smoke all exit 0 (numbers below); `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles, `package.json` and `package-lock.json` diff empty vs `db488e1`. |
| AC-29 | ✅ | `hub.test.ts:3363` (older credit last → highest revision wins), `:3458` (two-purchase out-of-order: one `upgradesUpdate` level 2, coins 70, later credit delta 0.12 — no under-credit), `:3503` (purchase vs newer credit), `:3539` (late credit race); `migration-007.test.ts:271-359` proves the column and both repository methods against PostgreSQL; `hub.ts:999-1042` independent guards; one `purchaseUpgrade` write (`hub.ts:1175`). |
| AC-30 | ✅ | `hub.test.ts:3654`, `:3683`, `:3714`, `:3748`; per-await `closed` checks in `handleJoin` (`hub.ts:747`, `:763`, `:777`, `:781`, `:786`, `:794`); `discard()` makes scheduler calls inert (`broadcast.ts:135-142`, `:229-239`). |

Deviations: none beyond the documented compatibility-only adaptations in `app.test.ts` and `migration-006.test.ts` (see checklist).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `docs/features/realtime-broadcast-batching/build-log-T5.md:242-282` (hash line `:278`) | The recorded T5 `npm run smoke` output was captured against a stale `frontend-prod` image: it shows `Container cubeclicker-frontend-prod-1 Running` and serves `assets/index-Cu7lmcVH.js` (87,059 B, the T3 bundle), while the same log's T5 build (`:224-235`) produced the T4 bundle `assets/index-BiM91p6y.js` (87,485 B). The recorded evidence therefore does not prove AC-26/AC-28 for the final frontend. This reviewer rebuilt `frontend-prod` from the current tree, smoke recreated the container, and `npm run smoke` passed 21/21 with the current entry bundle, so the shipped behavior is verified; only the recorded log evidence is stale. | Rebuild `frontend-prod` and re-run `npm run smoke`, then replace the T5 log's smoke section with the actual final-image output (or clearly annotate the rebuild and the current hash). Acceptance-time action; no source change. | open |
| F2 | INFO | `docs/features/realtime-broadcast-batching/status.md:52` | The final bullet still says “Spec approved r4 (0 blockers); awaiting Q-1..Q-5 user confirmation. No code, protocol, test or feature state has been changed,” which is stale after T1–T5. The builder correctly did not edit orchestrator-owned status content. | Orchestrator: replace this bullet with the code-review/acceptance state when applying the transition. No gate impact. | open |
| F3 | INFO | `docs/features/realtime-broadcast-batching/build-log-T5.md:313` | The proposed feature-index row says `planning`; the feature is at code review with all gates green. | Orchestrator: add the row as `accepted` with the acceptance date when updating `docs/features/README.md`. No gate impact. | open |
| F4 | INFO | `build-log-T5.md` benchmark section vs independent run | Recorded T5 p95 is 41.24 ms; the independent wire rerun measured 42.11 ms. Both are far below the ≤ baseline + 60 ms target (62.45 ms). The benchmark is evidence-only and machine-dependent (Q-4). | No action; keep the recorded after-run and the threshold interpretation. | closed |

## Verification performed

All commands were run by the reviewer in the repository worktree at `HEAD 53f7cbd`; no source, test, doc, config or git state was modified by this review.

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0.
- `npm test` → exit 0: backend 26 files / 959 tests passed; frontend 69 files / 1844 tests passed (2,803 total).
- `npm run coverage` → exit 0: backend `All files` 94.63 statements / 87.35 branches / 99.46 functions / 94.63 lines; frontend 96.47 / 96.14 / 97.54 / 96.47. All ≥ 80 per workspace. Exclusions and thresholds unchanged vs `db488e1`; no production module excluded beyond the justified composition-root entrypoints.
- `npm run build` → exit 0: entry `assets/index-BiM91p6y.js` raw 87,485 B / gzip 27,049 B; initial gzip 96,005 B ≤ 150,000; total gzip 273,980 B ≤ 300,000; lazy three chunk gzip 154,323 B ≤ 165,000.
- `node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json` → exit 0: `encodeCallsPerBroadcast: 1`, `registrySnapshotsPerBroadcast: 0`, `removalFramesPer100Clicks: 4`, `economyFramesPer100Clicks: 4`, `dbCreditsPer100Clicks: 100`, `maxRemovalFrameBytes: 351`, `totalFramesPer100Clicks: 8`, `economyWriteMethod: "creditWithRevision"`, `acceptedClicks: 100`.
- `node tests/bench/realtime-broadcast.mjs --mode wire --json` (backend already running on `ws://localhost:8080/ws`) → exit 0: 2 clients, 100/100 accepted, `p95AckLatencyMs: 42.11`, `removalFramesPerRecipient: [4,4]`, `totalFramesPerRecipient: [4,4]`, `frameTypes: {"miniCubesRemoved":4}`, `maxRemovalFrameBytes: 351`, `errors: []`.
- `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` then `npm run smoke` → exit 0, `SMOKE PASS (21/21 checks)`; the run recreated `frontend-prod` and exercised the current bundle. (The builder's T5 log recorded an older bundle — F1.)
- Docs/scope: `docs/architecture/realtime.md` exists with the five exact `##` headings and 3/3 relative links resolve; `README.md:55-56` has the benchmark commands; `git status --porcelain -- docs/features/README.md` empty; `git diff --exit-code db488e1..HEAD -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json` empty.
- Diff hygiene: no `.github/**`, `.env*`, deleted tests or changed coverage config; commits `b38d71b`, `b47af70`, `728d930`, `6dab4f0`, `50bc999`, `18dea2d`, `53f7cbd` are conventional and scoped; the only tracked working-tree change is the pre-existing orchestrator edit to `status.md`.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Spec compliance | ✅ | AC-1…AC-30 met with direct tests/commands above; no unguarded upgrade path, no skipped flush boundary, no per-server reordering, no economy/upgrade regression. |
| DB timing | ✅ | One `creditWithRevision` per accepted click/completion, one `purchaseUpgrade` per purchase, `grantCustomization` per completion at the original sites; migration 007 is additive/idempotent (`007_economy_revision.sql:8`); no write-behind, no identity change, no extra hot-path reads. |
| Documentation | ✅ | `docs/architecture/realtime.md` and the README benchmark subsection reflect shipped behavior; no doc claim contradicts the code; `docs/features/README.md` untouched. F2/F3 are orchestrator bookkeeping. |
| Code quality | ✅ | Encode-once is structural (one `encodeServerMessage` per broadcast/account fan-out), schedulers are pure with injected timers, no dead/debug code, no drive-by refactors; the 40 ms/250 ms constants are exported and pinned. |
| Out-of-scope compatibility edits | ✅ | `app.test.ts` (live-socket expectations adapted to the batch frame) and `migration-006.test.ts` (pins the pre-007 migration universe) are compatibility-only, preserve assertions/behavior, and are documented in `build-log-T3.md` § Deviations. No other out-of-scope source files changed. |
| Security | ✅ | New frame is server→client only, runtime-validated and copied in both mirrors; decoder rejects malformed payloads with no state change; no secrets/PII/dependency/endpoint changes; DB integrity and server authority unchanged. |
| Testing | ✅ | Concrete-value assertions; no banned matchers/snapshots/assertion-free/tautological tests in changed suites; every AC has direct evidence; timers/clock are injected and deterministic; negative cases (throwing peer, malformed frame, deferred joins, out-of-order writes) are exercised. |
| Real-time / multi-client | ✅ | Two-client smoke proves shared state and batch convergence; reconnect/welcome authority and late-frame shutdown are tested; no client-derived authority is introduced; WS endpoint unchanged. |
| Containers | ✅ | No service, image, port, env-var or deployable change; single-command local run and the backend `/ws` endpoint are preserved; `npm run smoke` passes through the compose path. |
| Coverage | ✅ | Both workspaces exceed 80% on all four metrics with unchanged exclusions/thresholds; raw numbers recorded above. |

## Previous gate verification

The spec gate approved at r4 with 0 blockers. The shipped code verifies its final findings: the T3 purchase path uses `applyUpgradeSnapshot` for upgrades and `applyEconomySnapshot` for economy with one `purchaseUpgrade` write (`hub.ts:1183-1201`); `upgradeRevisions` is in `close()` (`hub.ts:1472`) and the shutdown test (`hub.test.ts:3671-3674`); the benchmark counts `creditWithRevision` when present (`tests/bench/realtime-broadcast.mjs:245-270`, output `economyWriteMethod: "creditWithRevision"`); no unguarded upgrade sentence or stale smoke id remains in the spec/tasks.

## Notes / backlog (non-blocking)

- **F1 is evidence-only.** The product behavior is verified by the reviewer's rebuilt smoke run; the stale T5 image in the log is the one item to correct before acceptance.
- **Compatibility edits are acceptable.** The two out-of-scope test files adapt to the intentional frame-shape change and to the new migration count; they do not weaken assertions or change production code.
- **Benchmark evidence is reproducible.** Both modes exited 0 with the pinned JSON fields reset after setup; the wire mode used the existing `127.0.0.1:8080` compose backend; p95 variance is expected and far inside the target.
- **No source, test, config, spec or status edits by this review.** Only this review artifact is written.

## Acceptance-time actions

1. Rebuild `frontend-prod` and rerun `npm run smoke`; update `build-log-T5.md:242-282` with the actual final-image output (current entry `assets/index-BiM91p6y.js`) to close F1.
2. Set `docs/features/realtime-broadcast-batching/status.md` to `accepted` (date 2026-11-13) and replace the stale final bullet (F2).
3. Add the `docs/features/README.md` row: `realtime-broadcast-batching` — real-time broadcast batching — `accepted` — 2026-11-13 (F3).
4. Commit the review artifact (and the corrected T5 log/status/index updates in the same acceptance change); no post-acceptance source edits.
