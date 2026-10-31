---
feature: aws-deploy-pipeline
phase: spec
iteration: 2
verdict: changes_requested
blocking: 1
nonblocking: 4
---

# Spec Review — r2

## Summary

❌ changes requested — F1–F5, F7–F16 are genuinely resolved with evidence (containerized wrappers with verified tags, Mailpit-pre-start smoke pin, permission route + AC-22, deploy-chain wiring, single-production default, idle_timeout=90, ALB path+matcher health checks, provider-neutrality doc amendments, typo/mermaid/acceptance/grep fixes). One MAJOR is unresolved: **F6 is papered over** — the pinned one-line `ARG VITE_WS_URL` amendment cannot actually bake `PUBLIC_WS_URL` into the bundle because `vite.config.ts` resolves the value via `process.env.VITE_WS_URL` at build time, and a bare Docker `ARG` is not a process env var; the unchanged `RUN npm run build` would silently fall back to `ws://localhost:8080/ws`, reproducing the exact broken-real-time-product failure F6 was raised to prevent. Three MINOR verification-command defects and one INFO version note follow.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F17 | MAJOR | spec.md Q-4/AC-12/AC-21; plan.md § File inventory (T10 row); tasks.md T10 `verify:`; spec.md Non-goals "one pinned exception" | F6 is unresolved — the pinned one-line `ARG VITE_WS_URL="ws://localhost:8080/ws"` amendment cannot make the deploy bake work. Verified against the committed `src/frontend/vite.config.ts`: `define: { 'import.meta.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL ?? DEFAULT_WS_URL) }` — Vite reads `process.env.VITE_WS_URL` at build time. A Docker `ARG` is a build-time variable available to Dockerfile instructions as `$VAR` text substitution, but it is **not** automatically exported into the build container's process environment, so `process.env.VITE_WS_URL` stays `undefined` and Vite falls back to `ws://localhost:8080/ws`. The pinned `RUN npm run build -w @cubeclicker/frontend` is unchanged (T10 owns only the ARG line), and no `ENV` bridges the arg, so `--build-arg VITE_WS_URL=${{ vars.PUBLIC_WS_URL }}` is silently ignored — precisely the F6 failure mode the spec explicitly rejects (Q-4 option (b)). As pinned, the pipeline passes its ACs while shipping a frontend whose only WS target is localhost, violating the real-time contract (stack.md § Hard constraints) and the spec's own rejection of option (b). | Amend the pinned contract so the arg reaches Vite's process env: add `ENV VITE_WS_URL=$VITE_WS_URL` immediately after the `ARG VITE_WS_URL="ws://localhost:8080/ws"` line (two lines total), **or** scope the build as `RUN VITE_WS_URL=$VITE_WS_URL npm run build -w @cubeclicker/frontend`. Update Q-4, AC-12, AC-21 carve-out, Non-goals, T10 `files_owned`/`verify:` (grep both lines; "exactly one added line" → "exactly the pinned lines"), and the T10 `git diff` guard accordingly. Keep the change minimal and behavior-preserving (local builds without the arg keep the localhost default; compose dev builds target the `dev` stage — unaffected). | open |
| F18 | MINOR | tasks.md T1 verify; spec.md AC-3 | Ineffective verification command. `git ls-files \| grep '(^|/)\.terraform/'` uses basic grep, where `|` is literal, so `(^|/)` is treated as the literal characters `(`, `^`, `|`, `/`, `)` — the pattern never matches and the check prints nothing vacuously, so a committed `.terraform/` directory would not be caught. (Contrast the correct `grep -E` form used elsewhere.) | Change to `git ls-files \| grep -E '(^|/)\.terraform/'` in T1 `verify:` and in the AC-3 pinned command. | open |
| F19 | MINOR | tasks.md T7 verify | Ineffective secret/credential check. `grep -n "create_access_key" infra/terraform/modules/cicd-iam/*` searches for an AWS API action name; the Terraform resource that would create a static key is `aws_iam_access_key`, so a committed `aws_iam_access_key` resource would pass the check. (AC-8 and AC-15's broader `git grep` audit still cover the repo, but the task-level anchor is wrong.) | Change the T7 anchor to `grep -rn "aws_iam_access_key" infra/terraform/modules/cicd-iam/*` (must print nothing), keeping the AC-15 tracked-files audit as the backstop. | open |
| F20 | MINOR | tasks.md dependency overview + mermaid graph; shared-file discipline notes | Parallel-safety gap on the only cross-task file. Both T0 and T13 edit `.opencode/agents/builder.md` (T0: permissions block; T13: Verify bullet). The notes state "T0 first, T13 last of the framework pair," but the DAG has no `T0 → T13` edge — T0 has `depends_on: —` and T13 depends only on T12 — so an orchestrator scheduling by the graph could dispatch T0 and the T12→T13 chain concurrently, risking a collision on the shared file. (Neither task is marked `[P]`, so a strict reader would serialize, but the ordering is not encoded.) | Add an explicit `T0 → T13` edge (or state `T13 depends_on: T0, T12` under Q-9 route (a); under route (b) T0 is `n/a` and the edge is dropped) and reflect it in the mermaid graph and the dependency-overview line. | open |
| F21 | INFO | spec.md Assumptions ("Podman 4.x") | Version drift vs. the verified host. The host runs Podman 5.8.9 (verified this round), not 4.x as the assumption states. Not material to the wrappers (the C-1 commands are version-agnostic), but the assumption text should match reality. | Amend the assumption to "Podman 5.x (verified 5.8.9 on the build host)" or drop the minor version. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All three clusters covered; every r1 finding F1–F9 addressed in r2 (F6's resolution is technically insufficient → F17). |
| Testability | ⚠️ | AC-4/AC-8/AC-10 now binary and assertable; AC-3's second pinned command is ineffective (F18). |
| Boundaries | ✅ | Three tiers present; non-goals explicit; the single src/** carve-out is well-scoped (but its one-line pin is insufficient — F17). |
| Dependency graph | ⚠️ | Acyclic and AC-mapped; missing T0→T13 edge (F20). |
| Parallel safety | ⚠️ | T11/T12 `[P]` remain disjoint; the two-phase builder.md relies on an unencoded ordering (F20). |
| Security | ✅ | OIDC + SHA pinning + least-privilege + keyless audit preserved; permission surface regulated via Q-9/AC-22; T7 anchor weak (F19). |
| Testing | ✅ | Coverage bar preserved and pinned (AC-10, T-final); credential-less fmt/validate + actionlint + Mailpit-primed smoke all runnable on this host (verified: tags pull, wrappers execute, cold smoke = 9/12 FAIL / pre-started = 12/12 PASS). |
| Consistency | ⚠️ | Framework contracts align with the 8-state machine and autonomy directive; Q-4's implementability claim is false as pinned (F17). |
| Risks | ⚠️ | F17 is a mid-build dead end the risk table does not own (the "Frontend WS URL bake drift" mitigation assumes the ARG alone works). |
| Real-time (when applicable) | ⚠️ | Edge WS passthrough + idle_timeout=90 + health checks are correctly pinned; the production WS bake is not actually achieved (F17). |
| Containers (when applicable) | ✅ | Containerization contract honored: app/compose/Dockerfiles otherwise untouched; deferrals resolved via AC-21; image-name/tag parity pinned. |

## Previous round verification (r1 → r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (BLOCKER, tooling absent) | fixed | C-1 wrappers (`docker.io/hashicorp/terraform:1.15.9`, `docker.io/rhysd/actionlint:1.7.12`) pinned in AC-1/AC-2/AC-14 and every affected `verify:`; tags verified to pull and run on this host this round. |
| F2 (BLOCKER, smoke gate red) | fixed | AC-10 + plan § Interfaces pin `up -d mailpit` before `run --rm smoke`; T9 verify enforces ordering; cold run verified 9/12 FAIL, pre-started 12/12 PASS this round. |
| F3 (MAJOR, permission surface) | fixed | Q-9 route (a)/(b) + T0 bootstrap + AC-22; accounting note covers the Dockerfile touch; builder allowlist verified to lack `infra/**`/`.github/**` (two entries to be added). |
| F4 (MAJOR, deploy chain) | fixed | AC-9/AC-12 pin `-var-file=envs/production.tfvars`, `-backend-config bucket/region`, literal state key, apply-time `-var image_uri_*`; Q-2 reconciled to one shared bucket. |
| F5 (MAJOR, staging contradiction) | fixed | Single `production` default; no staging roles/jobs/tfvars (T8 verify greps staging = 0); additive recipe documented. |
| F6 (MAJOR, Q-4 unimplementable) | **not fixed** | r2's route (a) adds only `ARG VITE_WS_URL`, but Vite reads `process.env.VITE_WS_URL` (vite.config.ts `define`); a bare ARG never reaches process env → silent localhost fallback. See F17. |
| F7 (MAJOR, idle-timeout inequality) | fixed | AC-4 pins `idle_timeout = 90` (> 2× the verified 30 s heartbeat at hub.test.ts:556). |
| F8 (MAJOR, ALB health checks) | fixed | AC-4 pins backend `/healthz` matcher 200 and frontend `/` matcher 200 (path+status only). |
| F9 (MAJOR, provider-neutrality docs) | fixed | AC-21(c)/(d)/(e) amend the stale sentences; T13/T14 own them; T14 verify greps count = 0. |
| F10 (MINOR, typo) | fixed | plan.md contract 1 now reads `npm run coverage`. |
| F11 (MINOR, lockfile wording) | fixed (minor residual) | AC-3 reworded; T1 verify checks lockfile present; `.terraform/` grep ineffective (F18). |
| F12 (MINOR, mermaid edges) | fixed | Graph now includes T9→T11, T10→T11, T8→T14. |
| F13 (MINOR, T13 acceptance) | fixed | T13 acceptance = `AC-16, AC-17, AC-20`. |
| F14 (MINOR, credential audit surface) | fixed | T-final uses `git grep -nE "AKIA\|aws_secret_access_key\|AWS_SESSION_TOKEN"`. |
| F15 (INFO, plan role unused) | fixed | README/deployment doc mark the plan role "provisioned for the plan-on-PR follow-up; consumed by no workflow today". |
| F16 (INFO, double gate run) | fixed | deployment.md notes the deliberate double run on main. |

## Notes / backlog (non-blocking)

- Verified-good this round: heartbeat 30 s at `src/backend/src/game/hub.test.ts:556`; cold smoke 9/12 FAIL / Mailpit-primed 12/12 PASS; terraform/actionlint images pull and run; `src/frontend/Dockerfile` has no `ARG VITE_WS_URL` (confirmed); builder allowlist lacks `infra/**`/`.github/**` (confirmed); 8-state machine unchanged; autonomy directive respected; `docs/features/README.md` has no aws-deploy-pipeline row yet (builder proposes — correct).
- The Vite bake (F17) is the only thing standing between this spec and approval; the fix is a one-line addition plus verify updates. Once amended, re-review can be a quick delta check.
- Minor verification-command defects (F18, F19) should be corrected in the same edit pass so the code gate's pinned anchors are actually effective.
- Podman version assumption (F21) is cosmetic; update if touching the assumptions block.