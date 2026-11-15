# Build log — T4 — Frontend dev overlay, session stats and WS RTT

Task: T4 (2026-11-15)
Files changed:
- `src/frontend/src/perf/overlay.ts` / `overlay.test.ts` (new) — strict `VITE_PERF_OVERLAY === 'true'` flag and `PerfStats`
- `src/frontend/src/ui/PerfOverlay.tsx` / `PerfOverlay.test.tsx` (new) — dev-only overlay with 250 ms stats and 1000 ms RTT polls
- `src/frontend/src/game/session.ts` / `session.test.ts` — `getPerfStats`, flag-agnostic `measureRtt`, frame-stat capture, pong handling
- `src/frontend/src/render/webgl.ts` / `webgl.test.ts` — adapter `stats()` + per-frame `renderer.info.reset()` with `autoReset = false`
- `src/frontend/src/multiplayer/protocol.ts` / `protocol.test.ts` — ping/pong codec mirrors and exact pong frame
- `src/frontend/src/App.tsx` / `App.test.tsx` — flag-gated overlay render, no polling when off
- `docs/features/runtime-observability/build-log-T4.md` (this file)

What changed & why (≤5 lines):
1. `perf/overlay.ts` exports the strict build-time flag (only the exact string `'true'` enables it; no session import) and the `PerfStats` shape (`frameMs`, `tier`, `drawCalls`, `triangles`); `App` calls `isPerfOverlayEnabled()` and renders `<PerfOverlay session={session} />` only when it is true, so flag-off means no overlay, no `getPerfStats`/`measureRtt` calls and no ping.
2. `session.ts` records `{ frameMs: dtMs, tier, drawCalls, triangles }` after every `adapter.render(...)` (adapter `stats(): { calls, triangles }` mapped to `drawCalls`; zeroes when absent), returns `null` before the first frame and after dispose, and implements `measureRtt` (connected-only `{ type: 'ping', t: Math.round(env.now()) }`, matching `pong` resolves elapsed ms, 2000 ms timeout → `null`, status change/dispose → `null`); `pong` is handled before world reduction and never touches state.
3. `webgl.ts` disables `renderer.info.autoReset`, resets `info` once at the start of every adapter `render` (plain and realistic), and exposes `stats()` reading `renderer.info.render.calls/triangles`, so composer passes accumulate into one frame total without changing rendered output.
4. `multiplayer/protocol.ts` mirrors the backend ping/pong exactly (finite numeric `t` only, exact `{"type":"pong","t":123}` via `pongMessage`), with the backend fixture set replayed verbatim.
5. `PerfOverlay.tsx` renders `<aside data-testid="perf-overlay" aria-live="off">` with the exact rows `Frame <n> ms`, `Quality <tier>`, `Draw calls <n>`, `Triangles <n>`, `WS RTT <n> ms` (`—` placeholders), polls stats at 250 ms and RTT at 1000 ms, clears both intervals on unmount, and uses inline styles only (no CSS file, dependency or Three.js import).

Decisions:
- **Overlay gate stays in `App`.** `session.measureRtt` is flag-agnostic (AC-19/AC-22); the overlay module never imports the session, and `session.ts` imports only `type PerfStats` from `perf/overlay` (type-only, erased at runtime).
- **`PerfStats` lives in `perf/overlay.ts`.** It is the overlay's read contract and avoids a runtime cycle (`overlay → render/quality` type only; `session → overlay` type only).
- **RTT settlement is list-based, not keyed by `t`.** Two calls in the same rounded millisecond still settle independently on `pong`; every pending entry is settled exactly once (pong match, 2000 ms timer, transport leaving `connected`, `retryConnection`, `dispose`), and `dispose` settles even when the session is detached.
- **`renderer.info.reset()` runs at the start of the adapter frame.** `autoReset = false` alone would accumulate forever; the per-frame reset makes the numbers a full-frame total including composer passes (plan Key decision 9).
- **Initial stats read runs in an effect, not during render.** The first paint shows the `—` placeholders; the effect reads immediately and starts both intervals, so side effects never run in render.
- **No new dependency, no new CSS.** The overlay is a static small component in the existing entry chunk; the bundle budget gate still passes (AC-24).

Evidence:

## Local gates

`npm run lint` → exit 0

```text

> lint
> eslint .

```

`npm run typecheck` → exit 0

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

```

`npm run test --workspace @cubeclicker/frontend` → exit 0 (72 files, 1902 tests)

```text
 ✓ src/App.test.tsx (43 tests) 866ms
 ✓ src/game/session.test.ts (106 tests) 1396ms
 ✓ src/multiplayer/protocol.test.ts (261 tests) 22ms
 ✓ src/perf/overlay.test.ts (4 tests) 6ms
 ✓ src/render/webgl.test.ts (25 tests) 23ms
 ✓ src/ui/PerfOverlay.test.tsx (5 tests) 93ms

 Test Files  72 passed (72)
      Tests  1902 passed (1902)
   Start at  17:31:13
   Duration  3.11s (transform 7.77s, setup 0ms, collect 19.90s, tests 10.64s, environment 7.48s, prepare 5.94s)
```

The stderr lines in the full run are the pre-existing jsdom `HTMLCanvasElement.getContext()` / WebGL-context warnings from other UI suites; no test failed and no warning comes from the new code.

`npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80/80/80/80; all four metrics ≥ 80)

```text
 ✓ src/render/webgl.test.ts (25 tests) 15ms
 ✓ src/multiplayer/protocol.test.ts (261 tests) 23ms
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.54 |    96.21 |   97.74 |   96.54 |
  App.tsx          |    86.3 |     82.1 |   96.42 |    86.3 | ...33-435,457-458
  session.ts       |   90.83 |    98.78 |   97.29 |   90.83 | ...1545,1665-1666
  protocol.ts      |   89.36 |    96.16 |    90.9 |   89.36 | ...1111,1115-1125
  overlay.ts       |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  PerfOverlay.tsx  |   98.52 |      100 |     100 |   98.52 | 84
-------------------|---------|----------|---------|---------|-------------------
 Test Files  72 passed (72)
      Tests  1902 passed (1902)
```

`npm run build --workspace @cubeclicker/frontend` → exit 0 (bundle budget output, AC-24)

```text
> build
> vite build && node scripts/check-bundle-budget.mjs
✓ 107 modules transformed.
entry index assets/index-Bu2ZFvtA.js raw=90584 gzip=28356
initial files=2 raw=312283 gzip=97312 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=987075 gzip=275342 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-CAub-nio.js raw=9537 gzip=3339 initial=false
chunk browser-env assets/browser-env-DlGieUPC.js raw=49189 gzip=18158 initial=false
chunk cursor-ship assets/cursor-ship-CBwqa_uz.js raw=6729 gzip=2210 initial=false
chunk index assets/index-Bu2ZFvtA.js raw=90584 gzip=28356 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false
Bundle budget OK.
```

Entry chunk delta vs T3 (`assets/index-ak4hpiiK.js` raw=88353 gzip=27426): +2231 raw / +930 gzip, dominated by the statically imported overlay component and the new session/protocol code; every budget (150000/165000/300000 gzip) has headroom.

## Acceptance audit

- **AC-19 — Flag off by default** → met. `overlay.test.ts` pins `isPerfOverlayEnabled({ VITE_PERF_OVERLAY: 'true' }) === true` and `false` for absent, `undefined`, `''`, `'1'`, `'TRUE'`, `'yes'`, boolean `true` and numeric `1`, plus the default `import.meta.env` read via `vi.stubEnv`. `App.test.tsx` renders the shell with `getPerfStats`/`measureRtt` spies and the flag unset: `queryByTestId('perf-overlay')` is `null`, both spies are never called (so no diagnostic ping), while `session.measureRtt` itself contains no flag reference (flag-agnostic, asserted by the session RTT suite).
- **AC-20 — Overlay content and refresh** → met. `PerfOverlay.test.tsx` renders `{ frameMs: 16.7, tier: 'high', drawCalls: 42, triangles: 1000 }` + RTT 24 and pins the exact concatenated text `Frame 16.7 msQuality highDraw calls 42Triangles 1000WS RTT 24 ms` inside `<aside data-testid="perf-overlay" aria-live="off">`; after 250 ms the next stats sample renders (`Frame 20.5 ms`, `Quality medium`, `Draw calls 31`, `Triangles 800`), after the next 1000 ms poll the RTT updates to `WS RTT 31 ms`; `null` stats/RTT render `Frame —`, `Quality —`, `Draw calls —`, `Triangles —`, `WS RTT —`; unmount clears both intervals (`vi.getTimerCount() === 0`, no further calls). `App.test.tsx` with `VITE_PERF_OVERLAY=true` renders the same exact five rows from a fake session.
- **AC-21 — Session frame stats** → met. `session.test.ts` injects an adapter whose `stats()` returns `{ calls: 7, triangles: 700 }`; before the first frame `getPerfStats()` is `null`; after a 16 ms frame it is exactly `{ frameMs: 16, tier: 'high', drawCalls: 7, triangles: 700 }`; the 60th 30 ms frame that downgrades high→medium reports `{ frameMs: 30, tier: 'medium', drawCalls: 3, triangles: 30 }` (tier current on that frame); an adapter without `stats()` reports zeroes; `dispose()` returns it to `null`.
- **AC-22 — WebSocket RTT** → met. `session.test.ts` (fake transport + injected clock): a connected `measureRtt()` sends exactly one `{ type: 'ping', t: 1235 }` for `env.now() = 1234.6` and resolves `24` on `{ type: 'pong', t: 1235 }`; a non-matching `pong` (`t: 499`) leaves the call pending and the matching `t: 500` resolves `7`; no pong resolves `null` after exactly 2000 ms (unsettled at 1999 ms, settled at 2000 ms, still one ping sent); a connecting transport and a no-transport offline session resolve `null` without sending anything; `disconnected` resolves every pending call with `null`; `dispose()` clears the timer (`vi.getTimerCount() === 0`) and resolves the pending call with `null`.
- **AC-23 — Diagnostic protocol mirrors (frontend half)** → met. `protocol.test.ts` replays the backend fixture set verbatim: `{"type":"ping","t":123}` → `{ type: 'ping', t: 123 }`, `t: 0`, `-4.5` with extra fields dropped; missing/null/string/boolean/`NaN`/`1e999` pings all `{ ok: false, error: 'bad_message' }`; the same accept/reject table for `pong`; `pongMessage(123)` is `{ type: 'pong', t: 123 }` and `encodeServerMessage` is exactly `{"type":"pong","t":123}`; `encodeClientMessage({ type: 'ping', t: 123 })` is exactly `{"type":"ping","t":123}`.
- **AC-24 — No production UI or bundle regression (frontend half)** → met. With the flag unset the shell renders no overlay and the overlay module performs no polling (AC-19 test); `npm run build --workspace @cubeclicker/frontend` exits 0 within the pinned gzip budgets (`initial 97312 / 150000`, `three 154323 / 165000`, `total 275342 / 300000`); the overlay adds no dependency and imports no Three.js (only React, `OnlineGameSession` type and `PerfStats` type). The README/`compose.yaml` half of AC-24 is T5-owned.
- **AC-19..AC-24 only.** AC-9 (joined-state smoke), AC-25 (docs) and the T5 root gate were not started; no T5 artifact is in this change.

## Assertion bar

- New tests use concrete values only: exact frame objects, exact text, exact sent frames, exact tick boundaries, exact null/timer counts. No `expect.anything()`/`expect.any()`, no `objectContaining`/`arrayContaining`/`stringMatching`, no snapshots, no floats needing the bounded exception.
- Each test can fail on a real regression (flag polarity, poll cadence, missing stats mapping, missing timer cleanup, wrong ping `t`, wrong pong matching, missing `info.reset()`).

Deviations from spec: none. No backend, compose, Dockerfile, Terraform, workflow, package/lockfile, `.env*` or `docs/features/README.md` edit; no new dependency; T5 not started.
