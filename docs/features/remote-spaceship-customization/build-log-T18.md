# Build log — T18 — Verify & integrate

Task: T18 (2026-11-19)
Files changed: `docs/features/remote-spaceship-customization/build-log-T18.md` (this log; verification only — no source, test, spec, plan, task, status, review, container, dependency or `.env*` change)
Branch: `feat/remote-spaceship-customization`
Commits: pre-step `65606be` — `docs: record coin-economy acceptance`; this task's log commit — `docs: record T18 final verification` (hash in `git log`; not pushed)

## Sketch (≤5 lines)

- Prove T17 did not edit the orchestrator-owned feature index, then commit the three pre-existing
  coin-economy/bookkeeping paths as the pre-step commit (nothing else staged).
- Determine the feature BASE from T1's first feature commit (`b0f3261`) and record its parent.
- Run the full T18 recipe (`lint`, `typecheck`, `test`, `coverage`, `build`, `smoke`), measure the
  bundle against a BASE worktree build, and re-run the focused scene suites.
- Collect the catalog-hash literals, AC-34 doc greps, untouched-path diff gates, the `parts-v2`
  consumer grep and the `docs/features` status gate; audit AC-32…AC-36.
- Write this log and commit only it.

## Feature BASE

```
$ git rev-parse b0f3261^
4233147ff512d8988c4c8dc7774eef158f9469b5
$ git rev-parse b0f3261
b0f32614d7ca492547616d8fa62bbeaf0c463007
$ git show --stat --oneline b0f3261 | head -3
b0f3261 feat: add backend spaceship catalog v3
 src/backend/src/game/parts-v3.test.ts | 1048 +++++++++++++++++++++++++++++++++
 src/backend/src/game/parts-v3.ts      |  622 ++++++++++++++++++
```

**BASE = `4233147ff512d8988c4c8dc7774eef158f9469b5`** — the parent of T1's first feature commit
`b0f3261` (`feat: add backend spaceship catalog v3`), exactly as recorded in `build-log-T1.md`.
Every `BASE...HEAD` gate below uses this hash.

## Pre-step bookkeeping commit

The worktree carried three pre-existing orchestrator/coin-economy paths that are not this feature's
code. Before the feature gates, T17's non-edit of the index was proven:

```
$ git diff --exit-code daf40e3..e0b2fbb -- docs/features/README.md
(no output)
INDEX_PROOF_EXIT:0
```

`daf40e3` is T16's commit (the last commit before T17) and `e0b2fbb` is T17's head: the index file is
byte-identical between them, so **T17 did not edit `docs/features/README.md`**; the pending
modification is the orchestrator-owned coin-economy acceptance row.

Only the three pre-existing paths were staged and committed:

```
$ git add -- docs/features/README.md docs/features/coin-economy/status.md docs/features/coin-economy/reviews/code-r2.md
$ git diff --cached --name-status
M	docs/features/README.md
M	docs/features/coin-economy/reviews/code-r2.md
M	docs/features/coin-economy/status.md
$ git commit -m "docs: record coin-economy acceptance"
[feat/remote-spaceship-customization 65606be] docs: record coin-economy acceptance
 3 files changed, 65 insertions(+), 60 deletions(-)
```

The staged diff is the coin-economy `building → accepted` status/review text and the index row
`| coin-economy | … | accepted | 2026-11-18 |`. No feature source, test, container or package path
is part of this commit.

Immediately after the pre-step commit the required status gate is **empty**:

```
$ git status --porcelain -- docs/features ':(exclude)docs/features/remote-spaceship-customization'
(no output)
GATE_EMPTY_EXIT:0
```

## Verification environment

```
$ node --version
v24.22.3
$ npm --version
11.19.1
$ podman --version
podman version 6.1.3
$ git branch --show-current
feat/remote-spaceship-customization
$ git rev-parse HEAD
65606be3cbca00a1ab68b65705618d37c85575f1   # pre-step commit, before this log
```

Test runs are the default (non-verbose) Vitest reporters; the jsdom `HTMLCanvasElement.getContext()`
/ `THREE.WebGLRenderer` stderr lines in the frontend run are the pre-existing WebGL-fallback noise
from the UI suites, not failures.

## Evidence

### `npm run lint` — EXIT 0

```
> lint
> eslint .

LINT_EXIT:0
```

### `npm run typecheck` — EXIT 0

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT:0
```

### `npm test` — EXIT 0 (both workspaces)

```
> test
> npm run test --workspaces --if-present

> test
> vitest run            # src/backend

 Test Files  38 passed (38)
      Tests  1694 passed (1694)
   Start at  11:04:19
   Duration  3.55s (transform 4.60s, setup 0ms, collect 13.00s, tests 13.86s, environment 7ms, prepare 3.77s)

> test
> vitest run            # src/frontend

 Test Files  83 passed (83)
      Tests  2844 passed (2844)
   Start at  11:04:23
   Duration  4.49s (transform 9.64s, setup 0ms, collect 30.31s, tests 17.81s, environment 13.13s, prepare 7.40s)

TEST_EXIT:0
```

Per-workspace test counts: **backend 38 files / 1,694 tests**, **frontend 83 files / 2,844 tests**
(4,538 tests total), all passing. The new modules are exercised inline: `parts-v3.test.ts`
(63 backend / 71 frontend), `remote-ship.test.ts` (44), `scene.test.ts` (100),
`scene-spaceship.test.ts` (34), `ship-forms.test.ts` (19), `hangar-tabs.test.ts` (17),
`SpaceshipCustomizationPanel.test.tsx` (75), `session.test.ts` (144), `hub.test.ts` (212),
`protocol.test.ts` (533 backend / 633 frontend), `economy-repository.test.ts` (124).

### `npm run coverage` — EXIT 0 (thresholds ≥ 80 statements/branches/functions/lines per workspace)

```
> coverage
> npm run coverage --workspaces --if-present

> coverage
> vitest run --coverage            # src/backend

 Test Files  38 passed (38)
      Tests  1694 passed (1694)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.46 |    90.49 |   99.59 |   96.46 |

> coverage
> vitest run --coverage            # src/frontend

 Test Files  83 passed (83)
      Tests  2844 passed (2844)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.15 |    96.75 |   98.36 |   97.15 |

COVERAGE_EXIT:0
```

| Workspace | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| backend (`src/backend`) | **96.46** | **90.49** | **99.59** | **96.46** |
| frontend (`src/frontend`) | **97.15** | **96.75** | **98.36** | **97.15** |

Every metric is above the 80 gate in both workspaces. The new feature modules are included and
well covered (frontend rows from the same report): `game/parts-v3.ts` 100/100/100/100,
`game/ship-forms.ts` 100/100/100/100, `render/remote-ship.ts` 100/97.93/100/100,
`render/scene.ts` 97.32/100/96/97.32, `render/world.ts` 97.56/90.98/100/97.56,
`render/cube-view.ts` 99.29/100/100/99.29, `render/cursor-ship.ts` 99.58/98.18/100/99.58,
`render/preview.ts` 100/100/100/100, `render/shot-visuals.ts` 100/100/100/100,
`ui/hangar-tabs.ts` 100/100/100/100, `ui/SpaceshipCustomizationPanel.tsx` 96.35/91.33/100/96.35,
`ui/SpaceshipPreview.tsx` 86.99/77.41/75/86.99, `game/session.ts` 91.51/98.96/97.61/91.51.
(`SpaceshipPreview.tsx`'s per-file branches/functions are below 80, but the gate is the workspace
aggregate, which passes at 96.75/98.36; no per-file threshold or exclusion was changed.)

No coverage config/threshold/exclusion was changed by this feature:

```
$ git diff --stat 4233147ff512d8988c4c8dc7774eef158f9469b5...HEAD -- src/backend/vitest.config.ts src/frontend/vitest.config.ts src/frontend/vite.config.ts
(no output)
CONFIG_DIFF_EXIT:0
$ grep -A5 "thresholds" src/backend/vitest.config.ts src/frontend/vitest.config.ts
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
```

### `npm run build` — EXIT 0 (HEAD)

```
> build
> npm run build --workspaces --if-present

> build
> tsc

> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
✓ 117 modules transformed.
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-laKoxB0N.css                        45.63 kB │ gzip:   8.21 kB
dist/assets/cursor-ship-CYbML0fs.js                    8.41 kB │ gzip:   2.74 kB
dist/assets/SpaceshipCustomizationPanel-DZfa07sQ.js   17.90 kB │ gzip:   6.38 kB
dist/assets/browser-env-wuGf4aCr.js                   57.26 kB │ gzip:  20.84 kB
dist/assets/index-CouI9G8n.js                        108.81 kB │ gzip:  33.03 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-Ddozhxko.js                        610.56 kB │ gzip: 154.65 kB
✓ built in 1.54s
entry index assets/index-CouI9G8n.js raw=108805 gzip=33034
initial files=2 raw=330504 gzip=101990 budget=150000
three assets/three-Ddozhxko.js raw=610563 gzip=154647 budget=165000
total files=6 raw=1024637 gzip=286599 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-DZfa07sQ.js raw=17903 gzip=6382 initial=false
chunk browser-env assets/browser-env-wuGf4aCr.js raw=57261 gzip=20844 initial=false
chunk cursor-ship assets/cursor-ship-CYbML0fs.js raw=8406 gzip=2736 initial=false
chunk index assets/index-CouI9G8n.js raw=108805 gzip=33034 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-Ddozhxko.js raw=610563 gzip=154647 initial=false

Bundle budget OK.
BUILD_EXIT:0
```

`src/frontend/dist/bundle-report.json` (HEAD) records `initial.gzipBytes 101990`,
`three.gzipBytes 154647`, `total.gzipBytes 286599`.

### Bundle deltas against BASE

BASE was checked out in a throwaway worktree
(`/tmp/opencode/cubeclicker-base-T18`, `git worktree add --detach … 4233147…`, node_modules
symlinked because the lockfile is unchanged) and built with the same command:

```
$ npm run build --workspace @cubeclicker/frontend
vite v7.3.7 building client environment for production...
✓ 114 modules transformed.
dist/assets/index-BpDQzfgT.css                        44.24 kB │ gzip:   8.06 kB
dist/assets/cursor-ship-B5FCETDh.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-6AKSL-yz.js   18.01 kB │ gzip:   6.38 kB
dist/assets/browser-env-CCnWcNPn.js                   49.34 kB │ gzip:  18.21 kB
dist/assets/index-QB8amDhR.js                        101.64 kB │ gzip:  31.01 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4kUmpljF.js                        610.31 kB │ gzip: 154.62 kB
entry index assets/index-QB8amDhR.js raw=101641 gzip=31014
initial files=2 raw=323340 gzip=99970 budget=150000
three assets/three-4kUmpljF.js raw=610310 gzip=154617 budget=165000
total files=6 raw=1007729 gzip=281381 budget=300000
Bundle budget OK.
BASE_BUILD_EXIT:0
```

| Metric | BASE (`4233147`) | HEAD (`65606be`) | Delta |
| --- | --- | --- | --- |
| initial closure (gzip) | 99,970 B | **101,990 B** | **+2,020 B** |
| `three` chunk (gzip) | 154,617 B | **154,647 B** | **+30 B** |
| total (gzip) | 281,381 B | **286,599 B** | **+5,218 B** |
| entry chunk `index` (gzip) | 31,014 B | 33,034 B | +2,020 B |
| `cursor-ship` chunk (gzip) | 2,211 B | 2,736 B | +525 B |
| `browser-env` chunk (gzip) | 18,205 B | 20,844 B | +2,639 B |
| `SpaceshipCustomizationPanel` chunk (gzip) | 6,378 B | 6,382 B | +4 B |
| total (raw) | 1,007,729 B | 1,024,637 B | +16,908 B |

Ceilings: initial **101,990 ≤ 150,000** (48,010 B headroom), three **154,647 ≤ 165,000**
(10,353 B headroom), total **286,599 ≤ 300,000** (**13,401 B headroom**). `Bundle budget OK.`

**Catalog cost, measured:** the generated v3 catalog costs **+2,020 B gzip in the initial closure**
and **+5,218 B gzip in total** (the remainder of the total delta is the lazily loaded chunks:
`browser-env` +2,639 B, `cursor-ship` +525 B, panel +4 B, three +30 B). This is well **below** the
spec's planning estimate (≈ 14.4 KB gzip ⇒ ≈ 114.4 KB initial / ≈ 295.8 KB total / ≈ 4 KB
headroom) because the catalog is generated at module load from the small pinned tables rather than
shipped as 1,351 literal rows; the actual headroom is 13,401 B. The user-facing ceilings, which are
the AC-33 gate, pass. The spec's `≈` estimate is not a ceiling and is not missed from above.

### `npm run smoke` — PASS (29/29), `SMOKE EXIT: 0`

```
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-backend-1 Running 
 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-frontend-prod-1 Running 
 Container cubeclicker-db-1 Running 
 Container cubeclicker-mailpit-1 Running 
 Container cubeclicker-db-1 Waiting 
 Container cubeclicker-db-1 Healthy 
 Container cubeclicker-smoke-run-4eb4593d33df Creating 
 Container cubeclicker-smoke-run-4eb4593d33df Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 5
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 5; memberJoined id 1 for p8
PASS appearance projection: guest B's 11-slot setAppearance yields exactly one memberAppearance on guest A, and an unknown slot key yields bad_message without a broadcast — playerId p9; 11 slots; unknown slot key rejected with bad_message; 1 memberAppearance frame(s) seen by A
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 5
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 6
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p9
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 0ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 5; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=18 cubeclicker_ws_messages_received_total{type="join"}=14 cubeclicker_ws_frames_sent_total{type="hello"}=18
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-6XwuB9OH.js is served gzip with immutable caching — content-encoding gzip; 101707 B decompressed
PASS prod /assets/three-4kUmpljF.js is served gzip with immutable caching — content-encoding gzip; 610310 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (29/29 checks)
SMOKE_EXIT:0
```

The AC-35 appearance check is the `PASS appearance projection: …` line: guest B's 11-slot
`setAppearance` produced exactly one `memberAppearance` on guest A with the same record, B's roster
entry started `{}`, and the unknown-slot-key frame produced `bad_message` with no extra broadcast.
The run reused the already-running compose services (note `Running` rather than `Starting`): the
dev `backend`/`frontend` services bind-mount `./src/backend` and `./src/frontend` (compose.yaml
lines 63–64/81–82), so they execute the current worktree; the smoke client itself (read-only
`./tests/e2e` mount, `compose.smoke.yaml` lines 26–31) was created fresh and executed T16's check.
The prod static checks passed against the existing `frontend-prod` image; the current tree's build
is independently proven by `npm run build` above. No container path was changed by this feature.

### Focused scene suites — EXIT 0 (2 files / 134 tests)

```
$ npx vitest run src/render/scene.test.ts src/render/scene-spaceship.test.ts --root src/frontend --reporter=verbose
...
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > mounts nothing before welcome, during a camera flight, or for a non-spectated member 13ms
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > disposes exactly once on memberLeft, welcome, worldEntered and scene disposal 17ms
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > re-skins the mounted model in place for a live memberAppearance and roster refresh 12ms
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > fires at the removed tile origin for the mounted member, at the frame time 10ms
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > takes the first id of a batch and falls back to (px, py, 2.75) for a hidden tile 13ms
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > keeps the accepted 135/146/210/322 counts until a ship mounts, then 182/246/358 (AC-22) 70ms
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > reaches the two-bolt 184/248/360 and peak 185/249/361 fixtures (AC-22) 61ms
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > forwards the tier hidden-mesh list and never gives the ship a trail or reticle (AC-22) 9ms
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > fires one reduced-motion impact flash instead of a travelling bolt (AC-21) 9ms
 ✓ src/render/scene.test.ts > spectated remote ship (T12: AC-15, AC-17, AC-20, AC-22, AC-25, AC-26) > resolves null when the pick ray hits only the remote ship (AC-22) 11ms
 ✓ src/render/scene-spaceship.test.ts > own-ship chassis scale through SceneView.update (AC-17) > keeps the generated hull chassis at rest and at the 130 ms pulse peak 7ms
 ✓ src/render/scene-spaceship.test.ts > own-ship chassis scale through SceneView.update (AC-17) > preserves the accepted classic [1, 1, 1] chassis through the pulse 7ms
...
 Test Files  2 passed (2)
      Tests  134 passed (134)
   Start at  11:05:21
   Duration  1.68s (transform 461ms, setup 0ms, collect 798ms, tests 1.40s, environment 0ms, prepare 118ms)
SCENE_EXIT:0
```

The fixture assertions read (pinned by the two tests above):

- `keeps the accepted 135/146/210/322 counts until a ship mounts, then 182/246/358`:
  135 with no world; 146/210/322 with 1/9/23 remote members **and no `remote-ships` manager**;
  mounting `p2` adds **exactly 36 objects** (manager 1 + root 1 + body 1 + model 32 + shots 1) and
  **21 meshes (draws)** ⇒ **182 / 246 / 358**; `setSpectatedMember(null)` restores the accepted
  count exactly (`accepted`), and the manager group is gone.
- `reaches the two-bolt 184/248/360 and peak 185/249/361 fixtures`: per fixture the peak is
  `idle + 3` objects and **24 meshes** (**185 / 249 / 361**, 39 objects / 24 draws — two bolts and
  the second shot's live muzzle); after the muzzle's 80 ms flash expires the two-bolt fixture is
  `idle + 2` objects and **23 meshes** (**184 / 248 / 360**, 38 objects / 23 draws); disposal with
  shots in flight restores `idle − 36` (the accepted world counts) and removes the manager.
- `own-ship chassis scale through SceneView.update`: generated `hull-dart-chrome` at rest is exactly
  `[0.95, 0.9, 1.25]` and at the 130 ms pulse peak `[0.988, 0.936, 1.3]` (1e-9); classic
  `hull-gold` is `[1, 1, 1]` at rest and `[1.04, 1.04, 1.04]` at peak — the chassis survives the
  `update` pulse composition (AC-17 N2).

### Catalog-hash literals (AC-6)

Both workspaces compute the pinned literal `4a8df5e0` independently:

```
$ npx tsx -e "import { CATALOG_ROWS_HASH, PART_CATALOG_V3 } from './src/backend/src/game/parts-v3.ts'; console.log(CATALOG_ROWS_HASH, PART_CATALOG_V3.length);"
4a8df5e0 1351
$ npx tsx -e "import { CATALOG_ROWS_HASH, PART_CATALOG_V3 } from './src/frontend/src/game/parts-v3.ts'; console.log(CATALOG_ROWS_HASH, PART_CATALOG_V3.length);"
4a8df5e0 1351
$ grep -n "CATALOG_ROWS_HASH).toBe" src/backend/src/game/parts-v3.test.ts src/frontend/src/game/parts-v3.test.ts
src/backend/src/game/parts-v3.test.ts:584:    expect(CATALOG_ROWS_HASH).toBe('4a8df5e0');
src/frontend/src/game/parts-v3.test.ts:587:    expect(CATALOG_ROWS_HASH).toBe('4a8df5e0');
```

T1's log literal: `4a8df5e0` (`build-log-T1.md` lines 30, 115, 118). T2's log literal:
`4a8df5e0` (`build-log-T2.md` lines 19, 92, 96). Both recorded literals are byte-identical to each
other and to the runtime values above; `PART_CATALOG_V3.length` is 1,351 in both workspaces.

### AC-34 documentation greps (all exit 0)

```
$ grep -F "remote player spaceships" README.md
Players earn points by clicking the cube … The world also renders **remote player spaceships**: while spectating another member, you see their ship with their equipped parts, chassis form and shot style, idling and firing as they clear tiles. …
grep1_exit:0
$ grep -F "1,351 spaceship parts" README.md
Players earn points by clicking the cube … The catalog now holds **1,351 spaceship parts** across eleven **part slots** …
grep2_exit:0
$ grep -F "form and finish picker" README.md
Players earn points by clicking the cube … a **form and finish picker** narrows each row to its 3 classic or 12 finish cells instead of a thousand-row list …
grep3_exit:0
$ grep -F "shot styles" README.md
Players earn points by clicking the cube … `shot` adds 120 generated **shot styles** … the equipped **shot styles**. …
grep4_exit:0
$ grep -F "## Public appearance projection" docs/architecture/realtime.md
## Public appearance projection
grep5_exit:0
$ grep -F "## Remote ships" docs/architecture/frontend-rendering.md
## Remote ships
grep6_exit:0
$ grep -F "setAppearance" docs/architecture/observability.md
| `cubeclicker_ws_messages_received_total` | counter | `type`: …, `unequipPart`, `setAppearance`, `ping`, … |
The received list also includes the guest `setAppearance` frame …
grep7_exit:0
```

Negated stale-text grep (the T17 command uses `!`, which succeeds when no match exists):

```
$ grep -E "five part-group tabs|ten part slots|n/4" README.md
(no output)
stale_grep_exit:1   # no matches; `! grep -E …` → EXIT 0
```

Retained phrases (each exactly one match):

```
$ grep -cF "granular spaceship parts" README.md          → 1
$ grep -cF "animated 3D lootbox reveal" README.md       → 1
$ grep -cF "Neon Forge HUD" README.md                   → 1
$ grep -cF "detailed blue/orange hero spaceship" README.md → 1
```

The full README paragraph also names the six tabs (`Frame`, `Front`, `Wings`, `Engines`,
`Ignitions`, `Shots`), the 244/120 per-tab counts and the eleven part slots. The three
documentation sections/greps above are T17's content, unchanged by T18.

### Untouched-path diff gates against BASE

**Gate A — the T18 path list, with `docs/features/README.md` excluded per the dispatch brief (the
orchestrator-owned index legitimately changed for coin-economy; see the pre-step proof):**

```
$ BASE=4233147ff512d8988c4c8dc7774eef158f9469b5
$ git diff --exit-code "$BASE"...HEAD -- \
    compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' \
    package.json package-lock.json \
    src/backend/src/game/parts-v2.ts src/backend/src/game/parts-v2.test.ts \
    src/frontend/src/game/parts-v2.ts src/frontend/src/game/parts-v2.test.ts \
    src/backend/src/server.ts src/backend/src/db
GATE_A_EXIT:0
```

All of `compose.yaml`, `compose.smoke.yaml`, both `Dockerfile`s, the root `package.json`,
`package-lock.json`, both `parts-v2.ts` + `parts-v2.test.ts` pairs, `src/backend/src/server.ts` and
`src/backend/src/db/**` are byte-identical to BASE. Both workspace `package.json` files are also
unchanged (`src/backend/package.json src/frontend/package.json → WS_PACKAGE_EXIT:0`).

**Gate B — the literal `tasks.md` T18 command, which still includes `docs/features/README.md`:**

```
$ git diff --name-only "$BASE"...HEAD -- …(same list)… docs/features/README.md
docs/features/README.md
$ git diff --exit-code "$BASE"...HEAD -- …(same list)… docs/features/README.md
diff --git a/docs/features/README.md b/docs/features/README.md
@@ -25,7 +25,7 @@
-| coin-economy | Coin Economy (coins from destroyed cubes, speed bonus, persistent per-user stats) | building | 2026-10-30 |
+| coin-economy | Coin Economy (coins from destroyed cubes, speed bonus, persistent per-user stats) | accepted | 2026-11-18 |
GATE_B_EXIT:1
```

This is the **one recorded deviation** from the literal T18 verify command. The only diff is the
orchestrator-owned coin-economy acceptance row, committed by this task's pre-step commit
`65606be` (not by any feature task). T17 did not edit the file — proven by
`git diff --exit-code daf40e3..e0b2fbb -- docs/features/README.md` → `INDEX_PROOF_EXIT:0` at the
top of this log. Gate A therefore replaces README's inclusion, per the dispatch brief; after the
pre-step commit the feature-side status gate is empty (below).

### `parts-v2` consumer grep

```
$ grep -rn "parts-v2" src/backend/src src/frontend/src --include=*.ts --include=*.tsx \
    | grep -v "parts-v2.test.ts" | grep -v "src/game/parts-v2.ts"
src/backend/src/game/parts-v3.ts:24:} from './parts-v2.js';
src/backend/src/game/parts-v3.test.ts:3:import { PART_CATALOG_V2, type CustomizationState } from './parts-v2.js';
src/backend/src/game/hub.test.ts:19:import type { CustomizationState, PartIdV2 } from './parts-v2.js';
src/frontend/src/game/engine.test.ts:15:import { isValidPartId } from './parts-v2';
src/frontend/src/game/engine.test.ts:2313:  it('openLootbox draws a generated v3 row that parts-v2 does not know (guest)', () => {
src/frontend/src/game/parts-v3.ts:25:} from './parts-v2.js';
src/frontend/src/game/parts-v3.test.ts:3:import { PART_CATALOG_V2, SLOT_CATALOG, appearanceToCursorShipParams } from './parts-v2.js';
src/frontend/src/render/spaceship.ts:56:import { type SlotId } from '../game/parts-v2';
src/frontend/src/render/cursor-ship.ts:44:import { SLOT_CATALOG, type SlotId } from '../game/parts-v2';
src/frontend/src/render/cursor-ship.test.ts:40:} from '../game/parts-v2';
src/frontend/src/render/lootbox-reveal.test.ts:33:import { normalizeAppearance } from '../game/parts-v2';
src/frontend/src/render/lootbox-reveal.test.ts:372:      expect(source).not.toMatch(/parts-v2/);
GREP_EXIT:0
$ grep -rln "parts-v2" src/backend/src src/frontend/src | sort
src/backend/src/game/hub.test.ts
src/backend/src/game/parts-v2.test.ts
src/backend/src/game/parts-v3.test.ts
src/backend/src/game/parts-v3.ts
src/frontend/src/game/engine.test.ts
src/frontend/src/game/parts-v2.test.ts
src/frontend/src/game/parts-v2.ts
src/frontend/src/game/parts-v3.test.ts
src/frontend/src/game/parts-v3.ts
src/frontend/src/render/cursor-ship.test.ts
src/frontend/src/render/cursor-ship.ts
src/frontend/src/render/lootbox-reveal.test.ts
src/frontend/src/render/spaceship.ts
```

Production references are exactly four, all inside AC-5's allowed classic subset and none a v3
validation/equip/loot/render-resolution consumer:

- `game/parts-v3.ts` (both workspaces) imports `parts-v2.ts` **to reconstruct the 30 verbatim
  classic rows** (AC-3 requires v2 rows to stay byte-identical inside v3).
- `render/cursor-ship.ts` imports `SLOT_CATALOG` + `SlotId` for the **ten classic slot groups and
  the v2 shape-table resolution helper** that plan decision #17 pins in this module; the v3
  appearance/geometry resolution goes through `appearanceToShipParamsV3`/`ship-forms.ts`.
- `render/spaceship.ts` imports `SlotId` **as a type only**.

`hub.ts`, `engine.ts`, `economy-repository.ts`, `SpaceshipCustomizationPanel.tsx`,
`SpaceshipPreview.tsx`, `reveal-motion.ts`, `lootbox-reveal.ts` and `preview.ts` have no
`parts-v2` reference at all. The plan's R9 sentence "a verification grep for `parts-v2` imports
outside `parts-v2.ts`/its tests must be empty" is therefore not literally satisfied, but AC-5's
actual rule ("no production module reads `parts-v2` outside the classic subset") is. See
Deviations.

### Feature status gate after the pre-step commit

```
$ git status --porcelain -- docs/features ':(exclude)docs/features/remote-spaceship-customization'
(no output)
GATE_EMPTY_EXIT:0
$ git status --porcelain            # before writing this log
?? docs/features/remote-spaceship-customization/plan.md
?? docs/features/remote-spaceship-customization/reviews/
?? docs/features/remote-spaceship-customization/spec.md
?? docs/features/remote-spaceship-customization/status.md
?? docs/features/remote-spaceship-customization/tasks.md
$ git diff --check
DIFF_CHECK_EXIT:0
```

The only worktree entries are the untracked orchestrator-owned feature artifacts
(`spec.md`/`plan.md`/`tasks.md`/`status.md`/`reviews/`); no tracked file outside this feature is
modified. This task staged only this log for its commit.

### Frame traces — `not applicable`

T18's task text mentions "frame traces with a spectating ship firing". The repository has no
frame-trace/perf script or command (only the runtime perf overlay `src/perf/overlay.ts` and the
`quality.ts` window statistics, exercised by their own unit tests); nothing was measured or
claimed here. The automated scene budgets (object/draw fixtures above) and the bundle gate are the
executable budgets for this feature. Recorded as `not applicable`, per the task's rule for
commands that cannot run.

## Acceptance audit

- **AC-32 — met.** `npm run coverage` exits 0: backend **96.46 / 90.49 / 99.59 / 96.46** and
  frontend **97.15 / 96.75 / 98.36 / 97.15** for statements/branches/functions/lines, all ≥ 80 in
  both workspaces. Every new module is included (`parts-v3.ts`, `ship-forms.ts`,
  `remote-ship.ts`, `scene.ts`, `world.ts`, `cube-view.ts`, `shot-visuals.ts`, `hangar-tabs.ts`,
  the panel/preview); no exclusion, threshold, or config changed (`vitest.config.ts` diff empty,
  thresholds still 80).
- **AC-33 — met.** `npm run lint` (EXIT 0), `npm run typecheck` (EXIT 0), `npm test` (backend
  38/1,694, frontend 83/2,844 — all pass), `npm run coverage` (EXIT 0), `npm run build` (EXIT 0,
  `Bundle budget OK.`) and `npm run smoke` (**29/29**, `SMOKE EXIT: 0`) all ran. Budgets:
  initial **101,990 ≤ 150,000**, three **154,647 ≤ 165,000**, total **286,599 ≤ 300,000**. Exact
  deltas against BASE (built from `4233147`): **+2,020 B** initial, **+30 B** three,
  **+5,218 B** total; the measured catalog cost is below the spec's ≈ 14.4 KB planning estimate,
  leaving 13,401 B of total headroom. No Podman-unavailable case: Podman 6.1.3 ran the smoke
  recipe.
- **AC-34 — met.** README contains `remote player spaceships`, `1,351 spaceship parts`,
  `form and finish picker` and `shot styles`; the customization paragraph names six tabs, the
  244/120 per-tab counts, the eleven slots and the form + finish picker; the stale-text grep
  (`five part-group tabs`, `ten part slots`, `n/4`) has no match; the four retained phrases are
  present. `docs/architecture/realtime.md` has `## Public appearance projection`,
  `docs/architecture/frontend-rendering.md` has `## Remote ships` and
  `docs/architecture/observability.md` carries `setAppearance` in the received allow-list and
  explains the new encode/frames-sent values. The docs are T17's; this task only re-verified the
  greps. `docs/features/README.md` was not edited by T17 (pre-step proof, exit 0); the proposed row
  is below.
- **AC-35 — met (evidence from T16 + this run).** `npm run smoke` passes **29/29** including
  `PASS appearance projection: guest B's 11-slot setAppearance yields exactly one memberAppearance
  on guest A, and an unknown slot key yields bad_message without a broadcast — playerId p9; 11
  slots; unknown slot key rejected with bad_message; 1 memberAppearance frame(s) seen by A`.
  No container path changed against BASE: `compose.yaml`, `compose.smoke.yaml`, both `Dockerfile`s
  and `src/backend/src/server.ts` (which owns `GET /ws`) are byte-identical (`GATE_A_EXIT:0`), so
  there is no new service/image/port/host mapping/environment variable/health signal and
  `podman compose up` is unchanged.
- **AC-36 — met.** `src/backend/src/db/**` is byte-identical to BASE (`GATE_A_EXIT:0`; includes
  `schema.sql` and all seven migrations, so no schema or migration change); `schema.sql` still
  declares `customization_version INT NOT NULL DEFAULT 2` and migration `006` is untouched. Root
  `package.json`, `package-lock.json` and both workspace `package.json` files are unchanged;
  `parts-v2.ts`/`parts-v2.test.ts` are byte-identical. The repository keeps its storage shape and
  round-trips v3 ids: `economy-repository.test.ts` passes (124 tests) with
  `round-trips a persisted v3 row through find, setSlotAppearance and find` (lines 1215/2008) and
  the v3 shot-slot write. Rollback degradation is the accepted spec behavior (older normalizer
  drops v3 ids); no new dependency was added.

## Deviations / notes

1. **`docs/features/README.md` excluded from the BASE diff gate (briefed).** The literal
   `tasks.md` T18 command exits 1 on the coin-economy index row, committed in the pre-step
   `65606be`. T17 did not touch the file — `git diff --exit-code daf40e3..e0b2fbb --
   docs/features/README.md` → 0. The feature-path gate (Gate A) is empty; the status gate is
   empty after the pre-step commit. The orchestrator owns the row and the final state.
2. **Catalog cost below the planning estimate.** The spec predicted ≈ 14.4 KB gzip (≈ 114.4 KB
   initial / ≈ 295.8 KB total, ≈ 4 KB headroom); the measured deltas are **+2,020 B** initial and
   **+5,218 B** total (13,401 B headroom) because the catalog is generated from tables at module
   load. This is a favourable measurement of the same gate, not a missed ceiling; no fallback
   (moving shot-style resolution behind the scene chunk) is needed.
3. **`parts-v2` grep vs plan R9 wording.** The grep is not literally empty (four justified
   production references: the AC-3 classic-subset import in both `parts-v3.ts` files, the pinned
   v2 shape-table owner `cursor-ship.ts`, and a `SlotId` type-only import in `spaceship.ts`), but
   AC-5's rule — no production v3 consumer reads `parts-v2` outside the classic subset — holds.
4. **Frame traces `not applicable`.** No frame-trace command/harness exists in the repository;
   none was claimed. The scene object/draw fixtures and bundle gate are the executable budgets.
5. **Smoke reused the running compose services.** The transcript shows `Running` for the five
   services and a freshly created smoke client. The dev backend/frontend bind-mount the current
   tree, and the smoke check is the current `tests/e2e/smoke.mjs`; the static prod checks passed
   against the existing `frontend-prod` image. The current build is proven separately by
   `npm run build`. No container file was changed by this feature.
6. **No source/test/spec/plan/tasks/status/review edit.** This task's only file change is this log;
   no dependency, container, schema or `.env*` change. The pre-step commit contains exactly the
   three pre-existing bookkeeping paths and nothing else.

## Proposed `docs/features/README.md` row (proposal only — the orchestrator applies it)

```diff
@@ after the `hangar-tabs-and-menu-motion` row
 | hangar-tabs-and-menu-motion | Hangar Tabs & Menu Motion (tabbed spaceship hangar, glitch menu boot, screenshot polish) | accepted | 2026-11-17 |
+| remote-spaceship-customization | Remote Spaceship Customization (spectated remote ships + 1,351-part catalog) | code_review | 2026-11-19 |
```

T17 proposed the same row with state `building`; T18 completes the building phase, so the proposed
post-T18 state is `code_review`. The orchestrator owns the final state/date (it may set `accepted`
on acceptance) and the actual index edit.
