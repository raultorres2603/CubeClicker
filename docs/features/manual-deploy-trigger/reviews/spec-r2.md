---
feature: manual-deploy-trigger
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 2
---

# Spec Review — r2

## Summary

✅ approved — All seven r1 findings (F1 MAJOR, F2–F7 MINOR) are genuinely resolved in r2 with concrete, matching edits; no BLOCKER or MAJOR remains. Two new MINOR anchor-precision gaps (F10, F11) are documented below for build-time tightening; they do not block approval (consistent with the r1 F9 precedent) and the core ACs are verifiable as written by inspection.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F10 | MINOR | tasks.md T1 `verify:` and spec.md § AC-1 | AC-1's evidence anchor `grep -n "push:" .github/workflows/deploy.yml` (no match) cannot produce "no match" after the trigger edit: the deploy job is named `build-and-push` (line 19 of the current file), so `push:` is always a substring match. The intent (no `push:` *trigger key* under `on:`) is sound, but the pinned command is contradictory and would make the builder report AC-1 unmet. | Tighten the anchor to a standalone-key pattern, e.g. `grep -nE '^\s+push:\s*$' .github/workflows/deploy.yml` (no match) — or inspect the `on:` block — and record the chosen command in `build-log-T1.md`. Apply the same tightening in T-final `verify:` if that anchor is re-listed there. | open |
| F11 | MINOR | tasks.md T2 `verify:` | The stale-trigger guard for deployment.md uses `grep -n "push to \`main\`"` (lowercase `push`), but the actual stale wording in `docs/architecture/deployment.md` line 28 is capitalized ("Push to `main` → gates…"). A case-sensitive grep will not match, so the anchor cannot detect/clean the stale wording; the matching README anchor correctly uses the capitalized form. | Change the deployment.md anchor to the capitalized form `grep -n "Push to \`main\`" docs/architecture/deployment.md` (no match), or make it case-insensitive (`grep -ni "push to \`main\`"`), so it is consistent with the README anchor and actually guards the stale wording. Record in `build-log-T2.md`. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Raw request fully covered (CI auto on push/PR via AC-4; CD manual via AC-1; reason documented via AC-5/AC-6); non-goals explicit and consistent with `aws-deploy-pipeline`. |
| Testability | ✅ | All ACs are binary grep/inspection anchors; AC-1's `push:` sub-check and AC-10's tracked/untracked split are now evidenced. Two anchor-precision refinements remain (F10, F11) — tightenable at build time. |
| Boundaries | ✅ | Three tiers present (Always/Ask first/Never); out-of-scope list explicit; `docs/features/README.md` row note present (F7). |
| Dependency graph | ✅ | Acyclic `T1 → T2 → T-final`; dependencies point forward; every AC mapped to at least one task; tasks sized to one builder session. |
| Parallel safety | ✅ | All tasks `[seq]`; `files_owned` disjoint (deploy.yml / deployment.md+README.md / build log). No `[P]` misuse. |
| Security | ✅ | No secrets introduced; SHA-pinned actions retained (T1 leaves jobs untouched); OIDC unchanged; `id-token: write` scoped to deploy jobs only (AC-9, F1 resolved and pinned in T1/T-final verify). |
| Testing | ✅ | actionlint wrapper on changed workflow (AC-7), Terraform wrapper regression (AC-8), coverage gate (T-final `npm run coverage`) all pinned; credential audit + inventory audit pinned. |
| Consistency | ✅ | Aligns with `aws-deploy-pipeline` (supersedes only the trigger sentence of AC-12; other AC-12 content in force); no contradiction with AGENTS.md; builder permissions cover `.github/**` and docs (route (a)). |
| Real-time | ✅ (N/A) | Explicitly out of scope with justification; WebSocket edge untouched (containerization/real-time impact section present). |
| Containers | ✅ (N/A) | Explicitly out of scope with justification; no services/images/ports/config added. |

## Previous round verification (iteration 2)

| Finding (r1) | Status | Evidence |
| --- | --- | --- |
| F1 (MAJOR) — `id-token: write` grep not pinned | fixed | tasks.md T1 `verify:` and T-final `verify:` now include `grep -n "id-token: write" .github/workflows/deploy.yml` with the deploy-job-scoping inspection note; spec.md AC-9 carries the same. |
| F2 (MINOR) — vacuous deployment.md grep | fixed | The `grep -c "no provider is chosen" docs/architecture/deployment.md` anchor is removed from T2 `verify:`; replaced with `grep -n "push to \`main\`" docs/architecture/deployment.md` (no match) (see F11 for case precision). |
| F3 (MINOR) — `git diff --name-only` misses untracked build logs | fixed | T-final `verify:` adds `git status --porcelain` alongside `git diff --name-only` with documented coverage split (tracked vs. untracked) in the task description; spec.md AC-10 updated. |
| F4 (MINOR) — Summary "merge commit" wording | fixed | spec.md § Summary now reads "re-run on the selected ref (typically the merge commit on `main` for the default flow)". |
| F5 (MINOR) — bare `workflow_dispatch`/no `inputs:` anchor | fixed | T1 `verify:` adds `grep -n "inputs:" .github/workflows/deploy.yml` (no match) with the inspection note confirming `workflow_dispatch:` is bare. |
| F6 (MINOR) — README reason-phrase anchor | fixed | T2 `verify:` adds `grep -ni "manual.*production\|only.*production environment" README.md` (reason phrase present). |
| F7 (MINOR) — `docs/features/README.md` row note | fixed | spec.md § Boundaries and § Assumptions both state the acceptance doc pass proposes the `docs/features/README.md` row per `docs/architecture/documentation.md`, consistent with `aws-deploy-pipeline`. |
| F8 (INFO) — Q-1/Q-2 well-posedness | n/a | No action required; unchanged. |
| F9 (INFO) — presence-based anchors | n/a | Optional build-time tightening; two refinements surfaced as F10/F11. |

## Notes / backlog (non-blocking)

- F10/F11 are anchor-precision refinements analogous to r1 F2/F9; the builder can tighten the grep patterns at build time and record the chosen commands in the build logs without a spec revision. The AC intent (no `push:` trigger key; no stale "push to main" wording in deployment.md) is unambiguous and verifiable by inspection of the `on:` block / doc diff.
- Q-1 (no `workflow_dispatch` input) and Q-2 (verify re-runs all gates on manual trigger) remain well-posed with stated defaults; confirm or override at approval.
- The documentation pass on acceptance (per `docs/architecture/documentation.md`) should propose the `docs/features/README.md` row for this feature; the orchestrator owns the index.