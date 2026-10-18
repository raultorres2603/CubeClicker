---
feature: testing-criteria
phase: code
iteration: 1
verdict: approved
blocking: 0
---
# Code Review — r1

## Summary

✅ **approved** (blocking findings: 0) — All 24 ACs verified met against the working tree with evidence I produced myself: `npm test` (exit 0, `src/App.test.tsx` discovered and executed), `npm run coverage` (exit 0; backend 100×4, frontend 92.79/92.85/100/92.79), `npm run lint` / `npm run typecheck` (exit 0), plus an independent threshold-enforcement experiment. The amendment trace was re-enumerated line-by-line (23 deleted lines → 16 pinned replacements + 1 additive append + 6 derived mechanical touches). The bar's own subject — assertion quality — holds: every added/changed test pins concrete values; zero banned matchers in the complete current test files, not just the diff. The accepted residual matches the spec's declared lines exactly, and nothing (threshold, exclusion, include, assertion) was weakened to pass. No production module, container asset, CI, `.env*`, or permission-block change; exactly one dependency.

## Reviewer-own verification runs (this checkout, branch `feat/testing-criteria` @ `40acd35`)

| Command | Exit | Key evidence |
| --- | --- | --- |
| `npm test` | **0** | backend `✓ src/app.test.ts (4 tests)`; frontend `✓ src/ws/connection.test.ts (10 tests)` + `✓ src/App.test.tsx (1 test)` — the frontend transcript **lists `src/App.test.tsx` as an executed test file with 1 passing test** (AC-24 discovery proof, my own run) |
| `npm run coverage` | **0** | backend `All files 100/100/100/100` (`app.ts` only module); frontend `All files 92.79 / 92.85 / 100 / 92.79`; uncovered: `App.tsx 19-22`, `connection.ts 53-54,99-100` — matches T9's recorded numbers exactly |
| `npm run lint` | 0 | `eslint .` clean |
| `npm run typecheck` | 0 | both workspaces `tsc --noEmit` clean |
| `npx vitest run --coverage --coverage.thresholds.lines=100` (in `src/frontend`; CLI override only — no file edited) | **1** | `ERROR: Coverage for lines (92.79%) does not meet global threshold (100%)` — thresholds are enforced by the run (AC-3), independently of the T1 baseline transcript |
| `npm ls vitest @vitest/coverage-v8` | 0 | both workspaces `vitest@3.2.7` and `@vitest/coverage-v8@3.2.7` (identical resolved versions, exact peer requirement) |
| `git rev-parse HEAD` / `git branch --show-current` | — | `40acd35c5430f19b12902568a23276f15d696bd7` = expected tip "docs: record T9 verification pass for testing-criteria (T9)"; branch `feat/testing-criteria`; `main` at `0784d00` as briefed; 9 feature commits present (`e07d7a1 → 40acd35`) |
| push check | — | `feat/testing-criteria` has no upstream; `origin/main` = `7bc89bf` (pre-feature base) — **nothing pushed** |

## Scope discipline (AC-21) — verified

- Whole-feature diff (base `7bc89bf`): **34 files**, 2914 insertions / 23 deletions. The file list is exactly the plan inventory + build logs — no other file.
- Production modules: `git diff --name-only 7bc89bf..HEAD -- app.ts server.ts App.tsx main.tsx connection.ts` → **empty** (`src/` diff contains only the two `package.json`s, the two `vitest.config.ts`, and the two test files; `app.test.ts` unchanged — T3's zero-change claim verified directly).
- No `compose.yaml` / Dockerfile / `tests/e2e` / CI / `.env*` path appears in the diff; no untracked `.env*` / `coverage/` artifacts (`git status --short -uall`); containerization contract untouched (single-command run, env-based config, WS endpoint — all pre-existing and unmodified).
- `.opencode/agents` diff contains no `permissions:`/frontmatter change (verified two ways: grep of the diff and per-file greps).
- **Exactly one dependency**: all 48 added `package-lock.json` `node_modules/…` entries enumerated — `@vitest/coverage-v8` plus its istanbul/test-exclude/glob-10 transitive dev tree only; 0 deletion lines in the lockfile diff (0 existing entries changed; `vitest` stays 3.2.7). Coverage scripts are script lines, not dependencies.

## Amendment trace (AC-22) — independently re-enumerated

All 23 deleted lines of the feature diff, mapped:

- **16 pinned replacements, exact and present**: `3.C` (frontend `vitest.config.ts:6` → `['src/**/*.test.ts', 'src/**/*.test.tsx']`; backend's line 6 unchanged), `6.B` (AGENTS.md:46), `6.C` (AGENTS.md:49 ✅ line), `6.E` (AGENTS.md:33), `11.A` (orchestrator.md:75), `11.B` (orchestrator.md:81), `12.A` (web-impl SKILL:15 step 4), `12.B` (web-impl SKILL:50 DoD item), `14.A` (code-review SKILL step 3), `16.A` (spec-authoring SKILL:18 step 7), `19.A` (spec-review SKILL:22), `20.A` (task-decomposition SKILL:13 rule 2; rule 7 intact at line 18), `21.A` (playbook:33), `21.B` (playbook:101 — wording variance ruled below), `22.B` (stack.md:52 canonical parenthetical now `(lint / typecheck / test / coverage / build / dev / smoke)`), `22.C` (stack.md:13 colocation phrase).
- **Additive append**: AGENTS.md:51 🚫 Never line (6.D — append, never a replacement; F6/D-11), plus additions 6.A (AGENTS.md:19), 7.A (README.md:38), 22.A (stack.md:30), and the checked-additive skill sections — all present with pinned substance.
- **6 mechanical line touches** — judged in "Rulings" below: code-review SKILL steps `6.`→`7.`/`7.`→`8.` (renumber from additive 14.B insert; text unchanged), backend+frontend `package.json` `"test": "vitest run",` trailing comma (JSON necessity from 2.A), backend+frontend `vitest.config.ts` import line extended with `coverageConfigDefaults` (necessity from 3.A's standards spread).

No deleted line and no added line was left unmapped; nothing unrelated appears anywhere in the diff.

## Per-AC verification (AC-1 … AC-24)

| AC | Status | Reviewer evidence (my run / file:line) |
| --- | --- | --- |
| AC-1 scripts + dep + version alignment | **met** | `package.json:14` `"coverage": "npm run coverage --workspaces --if-present"`; both workspaces `"coverage": "vitest run --coverage"` + `"@vitest/coverage-v8": "^3.2.7"` devDep; `npm ls` 3.2.7=3.2.7; root run executes |
| AC-2 v8 config, all-files, extend-defaults exclude | **met** | both configs read: `provider: 'v8'`, coverage `include: ['src/**/*.{ts,tsx}']`, `exclude = [test patterns, <entrypoint>, ...coverageConfigDefaults.exclude]` (`src/server.ts` backend / `src/main.tsx` frontend), `all: true`; current report lists `App.tsx` (imported by no test) — un-imported files count; my threshold-experiment table listed it too |
| AC-3 80×4 thresholds, enforced, text-only | **met** | configs:24-29 `statements/branches/functions/lines = 80`; enforcement proven by my own CLI-override run (exit 1 + threshold ERROR); no `autoUpdate`/`perFile` keys; `reporter: ['text']`; no `coverage/` dir, `.gitignore:6` safety net |
| AC-4 end state green | **met** | my `npm run coverage` exit 0: backend 100×4; frontend 92.79/92.85/100/92.79 |
| AC-5 gap closed by meaningful tests, no banned matchers | **met** | `App.test.tsx` = full static markup pinned in one `toBe` (heading + `data-status="connecting"` + exact label) via `react-dom/server`, no new dep; `connection.test.ts:214-273` mandated 5.A top-up (`vi.stubGlobal` fake class, `unstubAllGlobals()` in `afterEach`, no network) — `defaultSocketFactory` (`connection.ts:33-35`) now covered (uncovered list shrunk from `33-35,53-54,99-100` to `53-54,99-100`); backend gap empty → record-only (contract-compliant); banned-matcher grep over the **complete current test files** (stronger than the pinned diff-scope grep) → zero matches; 0 exception uses |
| AC-6 builder.md rule + tokens | **met** | `.opencode/agents/builder.md:115` (unit + integration, `ItIsAny`-equivalents banned list, no useless tests, coverage gate ≥ 80); per-file greps: `coverage=1`, `integration=1` in builder.md itself |
| AC-7 web-implementation SKILL | **met** | step 4 (line 15), DoD replaced item + 3 added items (51-53), `## Testing bar` before Definition of Done with two tiers / banned list incl. weak existentials / ≤1-per-task exception / determinism / no-useless / coverage metric / retroactivity / depth pointer |
| AC-8 engineering-principles § Testing principles | **met** | `## Testing principles` present with all pinned areas incl. the sanctioned `vi.stubGlobal` ambient-default pattern reconciled with the real-time rule |
| AC-9 reviewer.md rule + token | **met** | `.opencode/agents/reviewer.md:57` (rerun coverage; shortfall/missing tiers unmet; weak assertions findings; exclusion gaming; logs are claims); per-file `coverage=1` |
| AC-10 code-review SKILL | **met** | step 3 names `npm run coverage` (14.A); additive step 6 (banned-matcher/no-useless inspection + exclusion-vs-justified-list check); severity rules: coverage shortfall = unmet; unjustified banned matcher / exclusion gaming = MAJOR unless justified |
| AC-11 testing.md three sections; pre-existing retained | **met** | `## Coverage gate` (:5), `## Assertion quality (real-data rule)` (:29), `## No useless tests` (:37); `## Coverage of the feature` retained unchanged (:11); ✅/❌ + `- [ ]` conventions preserved. Name carries the N-1 suffix — ruled below |
| AC-12 spec-authoring SKILL step + tokens | **met** | line 18 names tiers + `npm run coverage` + ≥ 80 + assertion/no-useless bar; per-file `coverage=1`, `integration=1` |
| AC-13 spec-checklist items | **met** | § Testing strategy gains the four items (lines 29-32); pre-existing command/edge-case items retained |
| AC-14 templates/spec.md lines | **met** | `- Integration: …` after Unit, `- Coverage: npm run coverage — thresholds ≥ 80% …` after E2E; Unit/E2E/Verification-commands retained |
| AC-15 spec-review SKILL Testing item | **met** | line 22 checks tiers, AGENTS.md commands, `npm run coverage` ≥ 80, assertion/no-useless bars, edge cases |
| AC-16 task-decomposition rule 2; rest unchanged | **met** | rule 2 carries test-files + coverage verify; whole-file diff = 1 replacement only; rule 7 intact |
| AC-17 orchestrator gate + summary | **met** | lines 75/81 exactly per contracts 11.A/11.B |
| AC-18 playbook transition + §7 summary | **met** | lines 33/101; 21.B variance ruled below (still satisfies "command + per-workspace numbers" literally) |
| AC-19 AGENTS.md edits; nothing else | **met** | 4 touch sites + 1 addition, all verified per contract text; no other section changed (per-file -U0 diff clean) |
| AC-20 README row | **met** | `README.md:38`, single added row |
| AC-21 scope discipline | **met** | see Scope section above — one dependency, no prod/container/CI/.env/permission change |
| AC-22 non-destructive pinned edits | **met** | full deleted-line enumeration → exactly the 16 IDs + 6.D + 6 derived mechanical touches (ruled acceptable); no other removal, no unrelated edit |
| AC-23 self-consistency + all commands pass | **met** | `npm run coverage` present in AGENTS.md/README/stack.md (canonical list names `coverage`)/skills; thresholds 80 in both configs; documented exclusions (test patterns + one entrypoint, defaults extended, `.test.tsx` discovery) match configs verbatim; my lint/typecheck/test/coverage all exit 0 |
| AC-24 discovery reaches the new test | **met** | frontend `vitest.config.ts:6` covers `.test.tsx`, backend:6 unchanged; **my own** `npm test` transcript lists `✓ src/App.test.tsx (1 test)` |

## Accepted residual — checked line-by-line, matches spec § Testing strategy exactly

- `src/frontend/src/App.tsx:19-22` — the `useEffect` callback body and cleanup (effect block at 17-23); SSR never runs effects. Report: `App.tsx 84/100/100/84, uncovered 19-22`. Same lines the spec pre-declared.
- `src/frontend/src/ws/connection.ts:53-54` and `99-100` — the two post-`close()` `if (closed) return;` guard arms (`grep -n 'if (closed)'` → 52, 98; the uncovered spans are the `return;`/brace pairs). Report: `connection.ts 95.34/92.59/100/95.34`.
- Nothing was weakened to accommodate them: thresholds still 80×4, exclude lists untouched, include set untouched, zero banned matchers, zero exception uses. Both excluded files (entrypoints) compensated by the containerized smoke, which stays untouched and covers both composition roots.
- Note (measured ground truth): v8's function census reports frontend functions at 100%, above the spec's estimated 11/13 ≈ 84.6% ceiling — favorable, but the estimate was never used as evidence; T1's baseline (recorded exit 1 at stmts/lines 71.17, functions exactly 80.00) is the honest cold-start record and the gate was cleared by adding tests, not numbers.

## Rulings on carried items and mechanical touches

- **N-1** (testing.md:29 `## Assertion quality (real-data rule)` vs AC-11 short form): **acceptable-as-derived — backlog, not a finding**. Plan contract 15.B and tasks.md T7 both specify the suffix; the build followed the normative build-time docs, and spec-r2 explicitly permitted resolving it at T7 in the task's favor. Substance is fully pinned (three distinct sections, retained `## Coverage of the feature`). Carried as backlog for the final summary.
- **T8 contract 21.B wording variance** (playbook:101 names `npm run coverage` explicitly instead of "the coverage run"): **acceptable-as-derived**. The plan's baseline rule permits slight variance when tokens/concepts hold; the tokens are present and AC-18's "(command + per-workspace numbers)" holds more literally. Single in-place line.
- **N-2** (`stubGlobal` "-style" vs literal): **no deviation arose** — the canonical `vi.stubGlobal`/`vi.unstubAllGlobals` APIs are used (`connection.test.ts:242,249`). Acceptable-as-recorded.
- **N-3** (`VITE_WS_URL` undefined under vitest): **validated and harmless** — `App.tsx:6` reads `import.meta.env.VITE_WS_URL` outside the tested render path (only the skipped effect at 19-22 uses it); the pinned SSR assertion passed unchanged. No widening of P lean scope occurred. Keep as builder awareness for future render-test extensions.
- **6 mechanical line touches**: **accepted-as-derived from pinned additive contracts** (AC-22 substance holds: no unrelated edit, no content removed): (a) SKILL step renumbering is the forced consequence of additive 14.B; text verified unchanged; (b) JSON trailing commas are required by valid JSON when 2.A appends after the last key; (c) the import extension is required by 3.A's `...coverageConfigDefaults.exclude` spread. None is a welcome candidate for future exclusion-list creep — each is auditable in the -U0 diffs.

## Findings

No BLOCKER/MAJOR findings. Backlog only (accepted state, non-blocking):

| # | Severity | Location | Finding | Required action |
| --- | --- | --- | --- | --- |
| F-1 | INFO | `.opencode/skills/code-review/checklists/testing.md:29` | N-1 section-name suffix vs AC-11 short form (ruled acceptable; tasks/plan specify the suffix) | Backlog: align one line in a future docs touch |
| F-2 | INFO | `.opencode/skills/orchestration-playbook/SKILL.md:101` | 21.B wording variance (command named explicitly) — permitted by the plan baseline rule | None |
| F-3 | INFO | `src/frontend/src/App.tsx:6` | N-3: `import.meta.env.VITE_WS_URL` is `undefined` under vitest — harmless today, matters if a future render test drives the effect | None now; future tasks must stub or extend within a new spec |
| F-4 | INFO | git history (`main` contains T1–T5 commits) | T1–T5 initially landed on `main` (process deviation), corrected mid-build per `status.md` — feature work now on `feat/testing-criteria`; plan is ff-merge at acceptance; verified nothing pushed (`origin/main` = `7bc89bf`) | None; orchestrator bookkeeping continues |

## Verdict reasoning

The gate defined by the brief's spec r2: AC-1…AC-24 all verified met with direct evidence (command outputs and file:line readings in this checkout), zero assertions taken from build logs for anything I could reproduce; coverage, test, lint and typecheck exit codes are mine. Test quality — the feature's own subject — satisfies the bar: every added/changed test can fail on a real regression (markup changes break the SSR test; factory/url/state/teardown changes break the 5.A test; retry/backoff/cap behavior tests fail on their named regressions), all assertions pin concrete values, no banned forms anywhere, no tautologies (the FakeGlobalWebSocket assertions are teardown/state outcomes of the production module, not mock-config echoes), zero count-inflating tests (T3 record-only is contract-compliant, not coverage-chasing). Scope discipline and the amendment trace hold. → **approved**.

*Deliverable: docs/features/testing-criteria/reviews/code-r1.md — reviewer did not modify any source, test, spec, plan, task, or log.*
