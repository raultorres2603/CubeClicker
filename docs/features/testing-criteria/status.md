---
feature: testing-criteria
state: accepted
spec_review_round: 2
build_round: 1
created: 2026-10-18
updated: 2026-10-18
---
# Status — Testing Acceptance Criteria

## Summary
Reflect new testing acceptance criteria in the AI agent framework: builder must create integration + unit tests covering at least 80%, no useless tests, and all assertions use concrete ("real") data — no ItIsAny-style wildcard matchers.

## Task board
- [x] T1 — Coverage tooling + baseline measurement (deps: —)
- [x] T2 — Frontend tests: close baseline gap (deps: T1)
- [x] T3 — Backend tests: close baseline gap (deps: T1)
- [x] T4 — AGENTS.md + README + stack.md mirror (deps: T1)
- [x] T5 — Planner-facing guidance (deps: T1)
- [x] T6 — Builder-facing guidance (deps: T1)
- [x] T7 — Reviewer-facing guidance (deps: T1)
- [x] T8 — Orchestration guidance (deps: T1)
- [x] T9 — Verify & integrate (deps: T1–T8)

## Loop log
- 2026-10-18 — created → planning — request: "builder agent should create integration tests and unit tests to cover, at least, 80% of coverage … not ItIsAny or something like that" — "Update AI agent framework we built to reflect this new acceptance criteria".
- 2026-10-18 — note: user checkpoint waived for this feature per framework-autonomy directive (2026-10-16; trace: online-realtime-workflow/spec.md Q-1) — framework/workflow-file operation runs under reviewer oversight; user consulted only for genuine blockers or materially user-owned decisions.
- 2026-10-18 — planning → spec_review — spec r1 + plan + tasks (9 tasks) written — docs/features/testing-criteria/{spec.md,plan.md,tasks.md}
- 2026-10-18 — spec_review → planning — spec-r1 verdict changes_requested (F1 BLOCKER; F2 MAJOR; F3–F6 MINOR; F7–F8 INFO) — docs/features/testing-criteria/reviews/spec-r1.md
- 2026-10-18 — planning → spec_review — revision completed (spec r2; F1–F8 addressed; AC-24 added; 16-replacement trace) — docs/features/testing-criteria/spec.md
- 2026-10-18 — note: revision finished in a continuation dispatch after a step-limit interruption; artifacts verified on disk before round 2.
- 2026-10-18 — spec_review → building — spec-r2 verdict approved (blocking: 0; 3 non-blocking items carried as backlog); awaiting_approval checkpoint waived per the autonomy directive — docs/features/testing-criteria/reviews/spec-r2.md
- 2026-10-18 — building — T1 completed (commit e07d7a1; baseline: backend 100×4 exit 0; frontend stmts 71.17 / branch 85.18 / funcs 80.00 / lines 71.17 exit 1 — binding gap statements/lines via un-imported App.tsx) — docs/features/testing-criteria/build-log-T1.md
- 2026-10-18 — building — batch 1 dispatched in parallel (background): T2, T3, T4.
- 2026-10-18 — building — T3 completed (record-only: backend 100×4 exit 0, no tests added; commit 08a952d) — docs/features/testing-criteria/build-log-T3.md
- 2026-10-18 — building — T4 completed (commit d9f163a; AGENTS.md/README/stack.md doctrine; 6.A–6.E, 7, 22.A–22.C applied) — docs/features/testing-criteria/build-log-T4.md
- 2026-10-18 — building — batch 2a dispatched in parallel (background): T5, T6 (T2 still running; 3-concurrent cap).
- 2026-10-18 — building — T2 completed (frontend coverage 71.17→92.79 stmts / 85.18→92.85 branch / 80.00→100 funcs / 71.17→92.79 lines, exit 0; root `npm run coverage` exit 0; AC-24 discovery proof in transcript; `stubGlobal` top-up present; commit 8e5eb33) — docs/features/testing-criteria/build-log-T2.md
- 2026-10-18 — note: branch convention check — prior features used `feat/<slug>`; T1–T4/T2 landed on `main` (deviation, local-only, nothing pushed). Corrective: create `feat/testing-criteria` once in-flight T5/T6 complete; T7–T9 + packaging proceed on it; ff-merge to `main` at acceptance; no history rewrite.
- 2026-10-18 — building — T5 completed (commit 0784d00; contracts 10, 16.A, 17.A, 18.A, 19.A, 20.A; per-file token evidence recorded) — docs/features/testing-criteria/build-log-T5.md
- 2026-10-18 — building — T6 completed (commit 4e2a651; contracts 8.A, 12.A/B/C, 13.A; builder.md carries both AC-6 tokens per-file) — docs/features/testing-criteria/build-log-T6.md
- 2026-10-18 — building — branch corrective dispatched (mechanical: create/switch `feat/testing-criteria` at current HEAD; T7+ proceed there).
- 2026-10-18 — building — branch corrective done: `feat/testing-criteria` created + checked out at `0784d00` (== `main` tip); working tree unchanged; no history rewrite; T7–T9 proceed on the branch.
- 2026-10-18 — building — batch 2b dispatched in parallel (background, on `feat/testing-criteria`): T7, T8.
- 2026-10-18 — building — T8 completed (commit 3166fd5; contracts 11.A/11.B/21.A/21.B; 4 lines replaced, 2 per file; 21.B wording variance recorded, permitted by baseline rule) — docs/features/testing-criteria/build-log-T8.md
- 2026-10-18 — building — T7 completed (commit af451c1; contracts 9.A, 14.A, 15.A/15.B; testing.md gains `## Coverage gate`, `## Assertion quality (real-data rule)`, `## No useless tests`; N-1 note recorded) — docs/features/testing-criteria/build-log-T7.md
- 2026-10-18 — building — batch 2b complete; T9 (final gate) dispatched (foreground, on `feat/testing-criteria`).
- 2026-10-18 — building — T9 completed (commit `40acd35`; `npm ci`/lint/typecheck/test/coverage all exit 0; transcripts list `✓ src/App.test.tsx (1 test)` executed; per-AC table AC-1…AC-24 all met; accepted residual recorded; 6 mechanical line touches + N-1/21.B variance flagged for review) — docs/features/testing-criteria/build-log-T9.md
- 2026-10-18 — building → code_review — all tasks `[x]`; behavior-change tasks' logs record coverage runs (T2/T9; T3 record-only); code review round 1 dispatched (build_round: 1).
- 2026-10-18 — code_review → accepted — verdict **approved** (`reviews/code-r1.md`: blocking 0; all AC-1…AC-24 verified met with reviewer-run evidence; 4 INFO findings F-1…F-4 backlogged) — packaging dispatched (builder; features-index row, artifacts commit, ff-only merge to `main`; no push).
- 2026-10-18 — packaging complete — commit 7a10bf6 on `feat/testing-criteria` (docs-only: spec/plan/tasks/status/reviews + index row + build-log-PKG.md) → `main` fast-forwarded `0784d00..7a10bf6` (0 merge commits; nothing pushed) — docs/features/testing-criteria/build-log-PKG.md
- 2026-10-18 — residue fold — build-log-PKG.md merge evidence folded; working tree clean; nothing pushed.

## Blockers / open questions
- Backlog (non-blocking, for final summary): N-1/F-1 testing.md section-name suffix (ruled acceptable-as-derived); N-2 stubGlobal "-style" wording (no deviation arose); N-3/F-3 `VITE_WS_URL` undefined under vitest (harmless; note for future render tests); F-2 21.B wording variance (permitted by plan baseline rule); F-4 branch deviation (early commits on `main`, corrected mid-build; ff-merge at acceptance; nothing pushed). Q-1…Q-6 remain user-owned with recommendations. Reviews: `spec-r1.md` (changes_requested), `spec-r2.md` (approved), `code-r1.md` (approved, blocking 0).
