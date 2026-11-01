---
feature: workflow-hygiene
revision: 1
---

# Plan — Workflow Hygiene

## Architecture

A documentation-and-hygiene change with no application modules, no data flow, and no state. Two text files gain a single trailing byte; one architecture document gains a canonical, scoped credential-audit command in its Secret posture section. No build, runtime, or container behavior changes.

## Interfaces / contracts

- **Trailing newline contract.** `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` must each end with exactly one `0x0A` byte (no `0x0A 0x0A` at EOF).
- **Scoped credential-audit command (canonical).** `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` — must print nothing. Recorded in `docs/architecture/deployment.md` § Secret posture, replacing any reliance on the unscoped form.
- **Scoped audit rationale (documented alongside the command).** `docs/features/**` contains benign references to the audit pattern (review/build-log artifacts quoting it); excluding `docs/` prevents false positives while keeping the audit effective over `src/`, `infra/`, `.github/`, and all other tracked non-doc files.
- **Verification tooling (unchanged, pinned).** `docker.io/rhysd/actionlint:1.7.12` and `docker.io/hashicorp/terraform:1.15.9` via Podman wrappers; `npm run coverage` for the TS regression guard.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Edit | Append one trailing newline (F6). |
| `.github/workflows/deploy.yml` | Edit | Append one trailing newline (F6). |
| `docs/architecture/deployment.md` | Edit | Add the canonical scoped credential-audit command + rationale in § Secret posture (F5/F7). |
| `docs/features/workflow-hygiene/build-log-T1.md` | New | Raw verify evidence for T1 (untracked). |
| `docs/features/workflow-hygiene/build-log-T2.md` | New | Raw verify evidence for T2 (untracked). |
| `docs/features/workflow-hygiene/build-log-T3.md` | New | Raw verify evidence for T3 (untracked). |
| `docs/features/workflow-hygiene/build-log-T-final.md` | New | Raw verify evidence for T-final (untracked). |

No other files are touched. `status.md` is orchestrator-owned and is not overwritten by this plan.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Append a single `0x0A` byte to each workflow file; do not reformat or reflow. | Minimal change; preserves SHA pins, job structure, and `actionlint` cleanliness (F6 is hygiene only). | Rewriting files through an editor (risk of whitespace/line-ending drift). |
| D-2 | Canonical audit form excludes all of `docs/` via the `:(exclude)docs/` pathspec. | The benign references live under `docs/features/**`; excluding `docs/` is simple, future-proof, and still audits every non-doc tracked file. | Scope to `src/ infra/ .github/` only (narrower; would miss future top-level config files). Listed as Q-1. |
| D-3 | Do not rewrite historical accepted-feature artifacts. | They are recorded evidence; the scoped command is canonical going forward (Q-2). | Migrate old verify anchors (touches accepted artifacts; out of default scope). |
| D-4 | Run `npm run coverage` once in T-final as a regression guard. | No TS changes are introduced; the gate must stay green. | Per-task coverage runs (redundant for doc/config tasks). |

## Risks & mitigations

- **Risk:** appending a newline accidentally doubles it. **Mitigation:** verify with `tail -c 2` (must not be `10 10`) in every affected task and T-final.
- **Risk:** `actionlint` or the Terraform wrappers regress due to an unrelated environment issue. **Mitigation:** run them as regression guards in T-final and record raw output.
- **Risk:** the scoped form is mis-copied into `deployment.md`. **Mitigation:** T3 verify greps for the `:(exclude)docs/` pathspec and the `docs/features/**` rationale; T-final re-checks.

## Open questions

- Q-1 — Scoped form choice (exclude `docs/` vs. scope to `src/ infra/ .github/`). Default: exclude `docs/`.
- Q-2 — Migration of historical accepted-feature anchors. Default: no.

See `spec.md` § Open questions for the full statements.