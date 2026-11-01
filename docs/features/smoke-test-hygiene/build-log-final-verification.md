# Build log — T3 — Full verification sweep & evidence consolidation

Task: T3 (2026-11-01)
Files changed: docs/features/smoke-test-hygiene/build-log-final-verification.md
What changed & why: Recorded the full verification gate suite and AC walk for `smoke-test-hygiene`. No source code changed; this is the final verification/evidence task. The two source edits (trailing newline in `compose.smoke.yaml`, `MAILPIT_TIMEOUT_MS` scoping in `tests/e2e/smoke.mjs`) were delivered by T1/T2 and are already in the tree.
Decisions: Evidence captured from the live host. The running container stack was used for both smoke runs and left running (all four services healthy) per the no-teardown constraint. `compose.smoke.yaml` (T1) is already committed, so it does not appear in `git diff --name-only`; `tests/e2e/smoke.mjs` (T2) is still uncommitted and does appear. `docs/features/README.md` carries a pre-existing orchestrator-owned pending row (smoke-mailpit-ordering) unrelated to this feature. The unprimed smoke was run as a true cold start (all containers stopped, then `npm run smoke` recreated them) and passed 12/12.
Evidence:

## Gate suite

### `tail -c 2 compose.smoke.yaml | od -c` (AC-1)
```
$ tail -c 2 compose.smoke.yaml | od -c
0000000   d  \n
0000002
```
Final byte is `\n`; preceding byte is `d` (not `\n`) — exactly one trailing newline. EXIT=0

### `git diff -- compose.smoke.yaml` (AC-2)
```
(no output — compose.smoke.yaml is already committed from T1; no uncommitted diff)
```
The only byte-level change vs. pre-change content is the single added trailing newline (per T1 build log). EXIT=0

### `podman compose -f compose.yaml -f compose.smoke.yaml config` (AC-7)
```
$ podman compose -f compose.yaml -f compose.smoke.yaml config
EXIT=0
```
(stderr only the podman external-provider notice.) Merged config shows `smoke.depends_on` with `backend`, `frontend`, `mailpit` all `condition: service_started`. EXIT=0

### `node --check tests/e2e/smoke.mjs` (AC-6)
```
$ node --check tests/e2e/smoke.mjs
EXIT=0
```

### `npm run lint` (AC-8)
```
> lint
> eslint .
EXIT=0
```

### `npm run typecheck` (AC-8)
```
> typecheck
> npm run typecheck --workspaces --if-present
> tsc --noEmit   (backend)
> tsc --noEmit   (frontend)
EXIT=0
```

### `npm test` (AC-8)
```
backend: Test Files 21 passed (21), Tests 630 passed (630)
frontend: Test Files 44 passed (44), Tests 1099 passed (1099)
EXIT=0
```

### `npm run coverage` (AC-8; thresholds ≥ 80% per workspace)
```
backend  All files | % Stmts 94.97 | % Branch 86.19 | % Funcs 99.65 | % Lines 94.97
frontend All files | % Stmts 95.19 | % Branch 95.09 | % Funcs 96.89 | % Lines 95.19
EXIT=0
```

### `npm run build` (AC-8)
```
backend: tsc (no emit errors)
frontend: vite build — ✓ built in 1.39s
EXIT=0
```

### Unprimed one-shot `npm run smoke` (AC-9) — true cold start (all containers stopped, then smoke recreated them)
```
Container cubeclicker-mailpit-1 Starting ... Started
Container cubeclicker-db-1 ... Healthy
Container cubeclicker-backend-1 ... Started
Container cubeclicker-frontend-1 ... Started
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
SMOKE PASS (12/12 checks)
EXIT=0
```

### Primed `npm run smoke` (AC-10) — Mailpit pre-started (all containers already running)
```
Container cubeclicker-mailpit-1 Running
Container cubeclicker-backend-1 Running
Container cubeclicker-frontend-1 Running
Container cubeclicker-db-1 Running ... Healthy
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 4
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 5
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1001ms
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
SMOKE PASS (12/12 checks)
EXIT=0
```

### `git diff --name-only`
```
docs/features/README.md
tests/e2e/smoke.mjs
EXIT=0
```
`compose.smoke.yaml` is already committed (T1) so it is not in the uncommitted diff; `tests/e2e/smoke.mjs` (T2) is uncommitted and present. `docs/features/README.md` carries a pre-existing orchestrator-owned pending row (smoke-mailpit-ordering) unrelated to this feature. No file under `src/` is changed (AC-8).

### `git status --porcelain` (evidences the untracked build-log set)
```
 M docs/features/README.md
 M tests/e2e/smoke.mjs
?? docs/features/smoke-mailpit-ordering/plan.md
?? docs/features/smoke-mailpit-ordering/reviews/
?? docs/features/smoke-mailpit-ordering/spec.md
?? docs/features/smoke-mailpit-ordering/status.md
?? docs/features/smoke-mailpit-ordering/tasks.md
?? docs/features/smoke-test-hygiene/build-log-T2.md
?? docs/features/smoke-test-hygiene/plan.md
?? docs/features/smoke-test-hygiene/reviews/
?? docs/features/smoke-test-hygiene/spec.md
?? docs/features/smoke-test-hygiene/status.md
?? docs/features/smoke-test-hygiene/tasks.md
```
(After this commit, `docs/features/smoke-test-hygiene/build-log-final-verification.md` is added to the untracked set.)

## Source inspection (AC-3, AC-4, AC-5)

```
$ grep -n "MAILPIT_TIMEOUT_MS\|READY_TIMEOUT_MS\|pollUntilReady(url, validate" tests/e2e/smoke.mjs
38:const READY_TIMEOUT_MS = Number(process.env.READY_TIMEOUT_MS ?? 30000);
55:const MAILPIT_TIMEOUT_MS = 10000;
75:async function pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS) {
602:  }, MAILPIT_TIMEOUT_MS);
```
- `pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS)` — optional third positional parameter defaulting to `READY_TIMEOUT_MS` (AC-3). Backend/frontend health polls omit it, retaining the 30 s budget.
- Mailpit readiness call site passes `MAILPIT_TIMEOUT_MS` (AC-4).
- `MAILPIT_TIMEOUT_MS` is defined with value `10000` and is the budget used by the Mailpit readiness poll (AC-5).

## Acceptance audit

- AC-1 — met. `tail -c 2 compose.smoke.yaml | od -c` → `d  \n` (single trailing newline). Evidence above.
- AC-2 — met. `git diff -- compose.smoke.yaml` shows only the added newline (T1 build log); no other bytes modified.
- AC-3 — met. Source inspection: `pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS)` (line 75); default preserves existing callers' 30 s budget.
- AC-4 — met. Source inspection: Mailpit call site passes `MAILPIT_TIMEOUT_MS` (line 602).
- AC-5 — met. Source inspection: `MAILPIT_TIMEOUT_MS = 10000` (line 55) and it is the budget used by the Mailpit readiness poll.
- AC-6 — met. `node --check tests/e2e/smoke.mjs` exits 0.
- AC-7 — met. `podman compose -f compose.yaml -f compose.smoke.yaml config` exits 0; merged config valid.
- AC-8 — met. `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` all exit 0 (coverage ≥ 80% per workspace); `npm run build` exits 0; no file under `src/` changed.
- AC-9 — met. Unprimed (cold start) `npm run smoke` → `SMOKE PASS (12/12 checks)`, exit 0.
- AC-10 — met. Primed `npm run smoke` → `SMOKE PASS (12/12 checks)`, exit 0.

Deviations from spec: none. Final container state: all four services (mailpit, db, backend, frontend) running and healthy.
