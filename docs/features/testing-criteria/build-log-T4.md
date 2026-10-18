# Build log — T4 — Project-level doctrine: AGENTS.md + README + stack.md mirror

Task: T4 (2026-10-18)
Files changed: `AGENTS.md`, `README.md`, `docs/architecture/stack.md`, `docs/features/testing-criteria/build-log-T4.md`
What changed & why: statement of the 80% testing bar in the three project-level documents. AGENTS.md gains the `npm run coverage` command bullet (6.A), the § Conventions testing-bar line (6.B replacement), the ✅ Always coverage clause (6.C replacement), the 🚫 Never append (6.D addition), and the `.test.tsx` colocation pattern (6.E replacement). README.md gains one § Commands row (7.A). stack.md gains the same row (22.A), the canonical-commands parenthetical (22.B replacement), and the colocation phrase (22.C replacement) — a commands mirror only; no stack decision touched.

## Build-start baselines (pinned rule: content at build start)

Captured with `git show HEAD:<path>` at build start (HEAD = `e07d7a14796aea5601927224394a9785f2538148`), copied to `/tmp/opencode/t4-baseline/` for the diffs below.

```
$ git rev-parse HEAD
e07d7a14796aea5601927224394a9785f2538148

$ for f in AGENTS.md README.md docs/architecture/stack.md; do git show HEAD:$f > /tmp/opencode/t4-baseline/$(echo $f|tr '/' '_'); done
AGENTS.md -> 51 lines
README.md -> 68 lines
docs/architecture/stack.md -> 51 lines

$ sha256sum /tmp/opencode/t4-baseline/*
0184239fd82d1c450a628c526433c115a06418c291c616f723b3b44b1514b96b  AGENTS.md
187c78ef9f56b1be5c1772649dc98d8bd92cc56b0eb65d819d9db74b8189f549  README.md
1390adfd5ed46e3dd6b3f4c49f7222ddd5467a2a10158fb36c975e2e9008e84c  docs_architecture_stack.md
```

Baseline lines that T4 touches/replaces, verbatim:

```
AGENTS.md:18  - `npm test` — Vitest unit tests, all workspaces.
AGENTS.md:32  Unit tests are colocated beside the sources they cover (`*.test.ts`, inside each workspace).
AGENTS.md:45  - Tests accompany every behavior change.
AGENTS.md:49  - ✅ Always: run lint, typecheck, and tests before reporting done; keep artifacts under `docs/features/<slug>/`; follow existing patterns.
AGENTS.md:51  - 🚫 Never: commit secrets or API keys; edit `.env*`; `git push`; edit outside your role's write scope; rewrite a spec to match buggy code.
README.md:37  | `npm test` | Vitest unit tests, all workspaces |
docs/architecture/stack.md:13  - **Package manager:** npm (workspaces) — layout `src/backend` + `src/frontend`; unit tests colocated as `*.test.ts` beside the sources they cover; cross-service e2e tests in `tests/e2e/`.
docs/architecture/stack.md:29  | `npm test` | Vitest, all workspaces |
docs/architecture/stack.md:51  ...the canonical commands (lint / typecheck / test / build / dev / smoke) are listed above and mirrored in `AGENTS.md` § Commands.
```

## Decisions

- Contract wording used verbatim (substance + tokens pinned); each edit kept minimal — 5 line touches + 1 added line in AGENTS.md, 1 added row in README.md, 3 line touches in stack.md.
- 6.D implemented as an append to the existing 🚫 Never bullet (semicolon-separated clause, final period preserved) — an addition, never counted as a replacement (F6/D-11).
- stack.md edited as a commands mirror only (22.A–22.C); the stack decision, § Status/§ Hard constraints, and every DECIDED line are untouched (F3).
- No stack/tooling dependency introduced; docs-only diff, so `lint`/`typecheck`/`test`/`coverage` results are unaffected by this change (full gate at T9).

## Evidence

`grep -n "npm run coverage" AGENTS.md README.md docs/architecture/stack.md`
```
AGENTS.md:19:- `npm run coverage` — Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace; part of the build gate).
AGENTS.md:46:- Tests accompany every behavior change: unit tests and integration tests with concrete expected values (no wildcard matchers), and no useless tests; coverage stays ≥ 80% (statements, branches, functions, lines) per workspace, verified with `npm run coverage`.
README.md:38:| `npm run coverage` | Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace) |
docs/architecture/stack.md:30:| `npm run coverage` | Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace) |
```

`grep -n "integration" AGENTS.md`
```
AGENTS.md:46:- Tests accompany every behavior change: unit tests and integration tests with concrete expected values (no wildcard matchers), and no useless tests; coverage stays ≥ 80% (statements, branches, functions, lines) per workspace, verified with `npm run coverage`.
```

`grep -n "80" AGENTS.md README.md docs/architecture/stack.md`
```
AGENTS.md:19:- `npm run coverage` — Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace; part of the build gate).
AGENTS.md:46:- Tests accompany every behavior change: unit tests and integration tests with concrete expected values (no wildcard matchers), and no useless tests; coverage stays ≥ 80% (statements, branches, functions, lines) per workspace, verified with `npm run coverage`.
README.md:21:| Backend | http://localhost:8080 |
README.md:22:| WebSocket | ws://localhost:8080/ws |
README.md:38:| `npm run coverage` | Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace) |
README.md:47:| `BACKEND_PORT` | `8080` | host port published for the backend container (`127.0.0.1:${BACKEND_PORT}:8080`) |
README.md:49:| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL the frontend connects to |
docs/architecture/stack.md:30:| `npm run coverage` | Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace) |
```
(README lines 21/22/47/49 are pre-existing port/URL occurrences — no change to them.)

`grep -n "test.tsx" AGENTS.md docs/architecture/stack.md`
```
AGENTS.md:33:Unit tests are colocated beside the sources they cover (`*.test.ts` / `*.test.tsx`, inside each workspace).
docs/architecture/stack.md:13:- **Package manager:** npm (workspaces) — layout `src/backend` + `src/frontend`; unit tests colocated as `*.test.ts` / `*.test.tsx` beside the sources they cover; cross-service e2e tests in `tests/e2e/`.
```

`diff -u <build-start baseline> <file>` (raw; only the pinned contracts appear)

`AGENTS.md`
```diff
@@ -16,6 +16,7 @@
 - `npm test` — Vitest unit tests, all workspaces.
+- `npm run coverage` — Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace; part of the build gate).
 - `npm run build` — build all workspaces.
@@ -29,7 +30,7 @@
-Unit tests are colocated beside the sources they cover (`*.test.ts`, inside each workspace).
+Unit tests are colocated beside the sources they cover (`*.test.ts` / `*.test.tsx`, inside each workspace).
@@ -42,10 +43,10 @@
-- Tests accompany every behavior change.
+- Tests accompany every behavior change: unit tests and integration tests with concrete expected values (no wildcard matchers), and no useless tests; coverage stays ≥ 80% (statements, branches, functions, lines) per workspace, verified with `npm run coverage`.
@@ -47,6 +49 @@
-- ✅ Always: run lint, typecheck, and tests before reporting done; keep artifacts under `docs/features/<slug>/`; follow existing patterns.
+- ✅ Always: run lint, typecheck, tests, and the coverage command before reporting done; keep artifacts under `docs/features/<slug>/`; follow existing patterns.
-- 🚫 Never: commit secrets or API keys; edit `.env*`; `git push`; edit outside your role's write scope; rewrite a spec to match buggy code.
+- 🚫 Never: commit secrets or API keys; edit `.env*`; `git push`; edit outside your role's write scope; rewrite a spec to match buggy code; weaken assertions (wildcard matchers, snapshot-only or assertion-free tests) or exclude production code from coverage without a justified, reviewer-approved reason.
```
(AGENTS.md: 5 touched lines — 1 added line for 6.A + 4 modified lines for 6.E, 6.B, 6.C, 6.D; the 6.D line shows as *modified* only because the clause is appended to the existing 🚫 bullet, so it is an addition, never counted as a replacement — F6/D-11. Forbidden-pattern audit: the diff removes no other content and adds no unrelated edit.)

`README.md`
```diff
@@ -35,6 +35,7 @@
 | `npm test` | Vitest unit tests, all workspaces |
+| `npm run coverage` | Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace) |
 | `npm run build` | build all workspaces |
```
(1 added row, nothing else.)

`docs/architecture/stack.md`
```diff
@@ -10,7 +10,7 @@
-- **Package manager:** npm (workspaces) — layout `src/backend` + `src/frontend`; unit tests colocated as `*.test.ts` beside the sources they cover; cross-service e2e tests in `tests/e2e/`.
+- **Package manager:** npm (workspaces) — layout `src/backend` + `src/frontend`; unit tests colocated as `*.test.ts` / `*.test.tsx` beside the sources they cover; cross-service e2e tests in `tests/e2e/`.
@@ -27,6 +27,7 @@
 | `npm test` | Vitest, all workspaces |
+| `npm run coverage` | Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace) |
 | `npm run build` | build all workspaces |
@@ -48,4 +49,4 @@
-...the canonical commands (lint / typecheck / test / build / dev / smoke) are listed above and mirrored in `AGENTS.md` § Commands.
+...the canonical commands (lint / typecheck / test / coverage / build / dev / smoke) are listed above and mirrored in `AGENTS.md` § Commands.
```
(2 line touches + 1 added row; § Status, § Application stack decision lines, § Containerized delivery path, § Hard constraints untouched.)

`npm run lint` → exit 0 (docs-only diff; run as an extra hygiene check at build time — the full lint/typecheck/test/coverage gate is T9's).

## Amendment trace (D-11)

| Contract | Kind | File | Site |
| --- | --- | --- | --- |
| 6.A | addition | `AGENTS.md` | § Commands bullet after `npm test` (line 19) |
| 6.B | **in-place replacement** | `AGENTS.md` | § Conventions testing line (line 46) |
| 6.C | **in-place replacement** | `AGENTS.md` | § Boundaries ✅ Always (line 49) |
| 6.D | addition (append) | `AGENTS.md` | § Boundaries 🚫 Never (line 51) |
| 6.E | **in-place replacement** | `AGENTS.md` | § Project structure colocation line (line 33) |
| 7.A | addition | `README.md` | § Commands row (line 38) |
| 22.A | addition | `docs/architecture/stack.md` | § Commands table row (line 30) |
| 22.B | **in-place replacement** | `docs/architecture/stack.md` | canonical-commands parenthetical (line 51) |
| 22.C | **in-place replacement** | `docs/architecture/stack.md` | § Application stack colocation phrase (line 13) |

No replacement outside the pinned 16-replacement set; no out-of-scope edit. No permission block, `.env*`, CI, container, or production-source change.

## Acceptance audit

- **AC-19 → met.** AGENTS.md: § Commands row with `npm run coverage` + `≥ 80% statements/branches/functions/lines per workspace` (grep line 19); § Conventions line replaced with unit + integration + concrete expected values (no wildcard matchers) + no useless tests + coverage ≥ 80 verified with `npm run coverage` (grep lines 19/46; `integration` present at line 46); § Boundaries ✅ adds the coverage command (line 49); 🚫 Never adds the assertion-weakening/exclusion clause (line 51); § Project structure pattern line covers `.test.ts` / `.test.tsx` (grep line 33). No other AGENTS.md section changed (diff above shows 5 touch sites only).
- **AC-20 → met.** README.md § Commands table gains exactly one `npm run coverage` row with the V8/threshold purpose (grep line 38; diff shows a single added row).
- **AC-22 → met.** Per-file diff vs. build-start baseline contains only pinned contracts: additions 6.A, 6.D, 7.A, 22.A; in-place replacements exactly 6.B, 6.C, 6.E, 22.B, 22.C — all inside the D-11 enumerated set. No pre-existing content otherwise removed, no unrelated edit.
- **Supports AC-23 → met.** stack.md's canonical-commands list now names `coverage` (22.B, line 51) and its § Commands table mirrors the AGENTS.md/README row (22.A), so the "mirrored in `AGENTS.md` § Commands" claim stays true; the documented command token (`npm run coverage`) and metric (`80` × four) are identical across the three files (greps above). No stack decision line touched.

Deviations from spec: none.
