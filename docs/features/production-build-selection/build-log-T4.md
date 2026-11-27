# Build log — T4 — Verify & integrate

Task: T4 (2026-11-27, r4/r4b optional-`build_sha` contract)
Branch: `feat/production-build-selection` (HEAD `bab1690`; post-merge base `2b7764f`)
Files changed: `docs/features/production-build-selection/build-log-T4.md`; `docs/features/production-build-selection/status.md` committed unchanged under orchestrator authorization.
Shortened evidence: 7–12 character SHAs; full SHAs only in the temporary run logs.

## What changed & why

- Ran the exact r4 T4 verify block against the merged optional-`build_sha` branch: full repository gate (`npm ci`, lint, typecheck, tests, coverage, build, containerized smoke with the documented `PODMAN_COMPOSE_PROVIDER` fallback), the 31-case workflow-gate harness, actionlint, the `vercel.json`/`render.yaml`/`deploy.yml` parses, the executed `ci.yml` parse, and the two Brevo guard fixtures.
- Reproduced the T3 live evidence from the recorded run IDs (`46066174413` pinned `build_sha`, `46066583737` latest, `46066138982` automatic development), re-checked the T3 provider read-backs, and confirmed the public `/healthz` 200.
- Re-ran the docs/stale-claim scans, the application/container diff guard (post-merge base; no `src` change; the harness exists), the `.env*` checks and the credential/connection-string audits (harness-only exclusion).
- No application, workflow, container, provider or environment change is made by this task; the only files in the T4 commit are this log and the orchestrator-owned `status.md` (unchanged).

## Decisions

- Used the documented environment-level smoke fallback `PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose` (the default `podman compose` provider hits the host `crun`/`OomScoreAdj` regression recorded in prior build logs). The fallback changes no repository file and the pinned compose recipe is unchanged.
- The T4 application/container guard uses the post-merge base (`2b7764f`): the diff is empty and the harness already exists, so T4 does not expect the harness as a new tests addition.
- Live proof is reproduction-only: `gh run view` on the three recorded T3 runs plus the public `/healthz`; no production dispatch, provider write or deploy was performed by T4.
- The orchestrator-owned `status.md` was committed unchanged with this log; its content was not edited by the builder.

## Evidence

### 1. Install and repository gate

```
npm ci → exit 0 (added/audited packages from the committed lockfile)
npm run lint → exit 0 (eslint ., no findings)
npm run typecheck → exit 0 (both workspaces, tsc --noEmit)
npm test → exit 0
  backend:  52 test files passed, 2093 tests passed
  frontend: 83 test files passed, 2867 tests passed
npm run build → exit 0 (vite build; Bundle budget OK: initial 102,616 B gzip / three 154,647 B gzip / total 287,223 B gzip)
npm run smoke (`PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose`) → exit 0
  SMOKE PASS (29/29 checks) — includes backend /healthz 200, WebSocket hello, multiplayer/leaderboard/activity,
  auth register → Mailpit → verify → login and the production static-delivery checks.
```

### 2. `npm run coverage` (gate ≥ 80 statements/branches/functions/lines per workspace)

```
backend:  Test Files 52 passed (52), Tests 2093 passed (2093)
backend  All files:  97.09 statements | 92.24–92.25 branches | 99.65 functions | 97.09 lines
frontend: Test Files 83 passed (83), Tests 2867 passed (2867)
frontend All files:  97.22 statements | 96.80 branches | 98.60 functions | 97.22 lines
```

Thresholds stay 80 on all four metrics per workspace; no production file was excluded to pass the gate. The backend branch metric recorded 92.25 in the first exact-block run and 92.24 in the final committed-tree re-run; the other metrics were identical, and every metric is far above the 80 threshold.

### 3. Workflow-gate harness (31/31)

`node tests/deploy/gate-fixtures.mjs` → exit 0; 31/31 cases PASS, including the 14 Render creation/completion cases:

```
Gate harness: PASS resolver-latest
Gate harness: PASS resolver-latest-unavailable
Gate harness: PASS resolver-exact
Gate harness: PASS resolver-malformed
Gate harness: PASS resolver-development-default
Gate harness: PASS resolver-development-non-default
Gate harness: PASS guard-success
Gate harness: PASS guard-ci-failure
Gate harness: PASS guard-missing
Gate harness: PASS guard-not-on-main
Gate harness: PASS contract-pass
Gate harness: PASS contract-changed
Gate harness: PASS contract-missing-pg
Gate harness: PASS schema-pass
Gate harness: PASS schema-missing-007
Gate harness: PASS schema-missing-table
Gate harness: PASS render-creation-201
Gate harness: PASS render-creation-202
Gate harness: PASS render-creation-non-dep
Gate harness: PASS render-creation-commit-mismatch
Gate harness: PASS render-completion-live
Gate harness: PASS render-completion-build-failed
Gate harness: PASS render-completion-update-failed
Gate harness: PASS render-completion-canceled
Gate harness: PASS render-completion-pre-deploy-failed
Gate harness: PASS render-completion-deactivated
Gate harness: PASS render-completion-timeout
Gate harness: PASS render-completion-transient-retry
Gate harness: PASS render-completion-current-match
Gate harness: PASS render-completion-current-mismatch
Gate harness: PASS ci-build-parse
```

### 4. Static config, workflow parses and Brevo guard

```
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml → exit 0, no findings
vercel.json: valid JSON
render.yaml: one development service, unchanged
deploy.yml: build_sha and automatic path pinned
ci.yml: verify-workflows 11-step list and build parse pinned
deploy.yml: build_sha contract pinned (resolver, guard, contract, schema, Render API/completion, Vercel and 21-step order)
```

The executed `ci.yml` parse (`Validate deploy build selection contract`) pins the exact `environment`/`build_sha` inputs (no `build`), the resolver/guard/checkout/confirm/contract/schema/Render/completion/Vercel steps, the 21-step deploy list and the 11-step `verify-workflows` list.

Brevo guard fixtures (unchanged contract):

```
development complete fixture → Deploy configuration OK: 11 value(s) present for the 'development' environment.
production placeholder fixture → exit 1, Deploy blocked: the 'production' environment has 6 unset or placeholder value(s).
```

### 5. Application/container diff guard (post-merge base)

```
base = 2b7764f (git merge-base origin/main HEAD)
git diff --exit-code <base> -- src compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json render.yaml src/frontend/vercel.json ':(exclude)tests' → empty
tests/deploy/gate-fixtures.mjs exists
git ls-files --others --exclude-standard -- src → empty
```

No application code change; the only test addition is the feature-owned harness tests/deploy/gate-fixtures.mjs

### 6. Docs and stale-claim scans (all pass)

Exact positive greps: the three new headings (`### Production build SHA selection`, `### Build SHA selection (production)`, `### Production deploy with build SHA selection`), the empty=latest/set=exact sentence, `Resolved build`/`CI run`, the lowercase full-SHA rule, the immutable-migration policy, both three-way containerization release-identity statements, and the exact supersession-ledger row in both architecture references.

Negative scans:

```
! grep -qF 'previous-1' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -qF 'The `build` dropdown offers' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -RniE 'dropdown|previous-[0-9]|relative label' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -RniE '### Production build selection|### Build selection \(production\)|### Production deploy with build selection' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -qF 'production dispatch always deploys the latest' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -qF 'the only revision production can deploy is' docs/architecture/deployment.md
! grep -qF 'production has no way to choose' docs/architecture/vercel-render-neon.md
! grep -qF 'cannot pass against the old instance' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md docs/architecture/containerization.md
! grep -qF 'The deployed commit SHA (`github.sha`) is the release identity' docs/architecture/containerization.md
! grep -qF 'release identity → the deployed commit SHA (`github.sha`) recorded by the pipeline' docs/architecture/containerization.md
```

The case-insensitive `dropdown|previous-[0-9]|relative label` scan and the three old-heading scans return no match; the removed UX is absent from the three operator docs.

### 7. Live evidence reproduction (T3 run IDs; shortened SHAs)

Run metadata (event / head branch / head short SHA / conclusion):

```
46066174413 workflow_dispatch main 2b7764f17 success   (pinned build_sha)
46066583737 workflow_dispatch main 2b7764f17 success   (latest restore, no build_sha)
46066138982 workflow_run      main 2b7764f17 success   (automatic development)
```

Pinned prior build (`build_sha=5209d804a`, run `46066174413`):

```
Resolved build: 5209d804a (pinned)
CI succeeded for 5209d804a
Deploy contract OK for 5209d804a (guard/migration/smoke identical to 2b7764f17).
Schema compatibility OK for 5209d804a: 7 migration(s) in build, 7 applied on the target branch.
Deploy configuration OK: 11 value(s) present for the 'production' environment.
Render deploy: dep-dc4uq1bl550s73ar170g build_in_progress for 5209d804a
Render current deploy: dep-dc4uq1bl550s73ar170g 5209d804a
Render deploy live: dep-dc4uq1bl550s73ar170g for 5209d804a
healthz OK after 0s: {"status":"ok"}
Vercel deployment: https://cubeclicker-5hbwhd1eu-raultorres2603s-projects.vercel.app for 5209d804a
DEPLOYED SMOKE PASS (8/8 checks)
```

All nine `SYNCED` lines were emitted, one per deployed name (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_TRANSPORT`, `BREVO_API_KEY`), each exactly `SYNCED <name> (value verified, not shown)`; the run has exactly nine `(value verified, not shown)` lines.

Latest restore (`46066583737`, no `build_sha`):

```
Resolved build: 2b7764f17 (latest)
CI run: 46065738044 2026-11-27T20:45:05Z
Render deploy: dep-dc4urudg1s2s73fuaa5g build_in_progress for 2b7764f17
Render current deploy: dep-dc4urudg1s2s73fuaa5g 2b7764f17
Render deploy live: dep-dc4urudg1s2s73fuaa5g for 2b7764f17
healthz OK after 0s: {"status":"ok"}
Vercel deployment: https://cubeclicker-ggl0ctjqb-raultorres2603s-projects.vercel.app for 2b7764f17
DEPLOYED SMOKE PASS (8/8 checks)
```

Automatic development (`46066138982`):

```
Deploying build 2b7764f17 to development
Deploy configuration OK: 11 value(s) present for the 'development' environment.
healthz OK after 14s: {"status":"ok"}
Vercel deployment: https://cubeclicker-development-4fx9pubd6-raultorres2603s-projects.vercel.app for 2b7764f17
DEPLOYED SMOKE PASS (8/8 checks)
```

The automatic path kept the hook and the existing 45 s head start (`Render deploy hook started; using the existing 45 s head start (no deploy id to poll).`); no live-poll claim is made for it.

Provider read-backs recorded in `build-log-T3.md` and re-verified by the T4 greps:

```
Render deploy id: dep-dc4uq1bl550s73ar170g
Render deploy status: live
Render deploy commit: 5209d804a
Render deploy trigger: api
Render current deploy: dep-dc4uq1bl550s73ar170g 5209d804a
Vercel deployment id: dpl_2bi37UEKh99U7E3Kh6quReJXAGED
Vercel deployment commit: 5209d804a
Vercel deployment state: READY
```

Latest restore read-back: `Render deploy id: dep-dc4urudg1s2s73fuaa5g`, `Render deploy status: live`, `Render deploy commit: 2b7764f17`, `Render current deploy: dep-dc4urudg1s2s73fuaa5g 2b7764f17`, `Vercel deployment id: dpl_CKdzBvUnpCCvQxzTQyDKzCREwm2X`, `Vercel deployment commit: 2b7764f17`, `Vercel deployment state: READY`.
Development read-back: `Render deploy id: dep-dc4upq6i0phs73bnn1ug`, `Render deploy status: live`, `Render deploy commit: 2b7764f17`, `Render deploy trigger: deploy_hook`, `Vercel deployment id: dpl_CJmfpfsugx3rVtmbpjPPxjF3cUS2`, `Vercel deployment commit: 2b7764f17`, `Vercel deployment state: READY`.

`No mixed revision` — for both production runs the resolver/checkout SHA equals the Render `.commit.id`/current deploy SHA and the Vercel deployment commit; the automatic development run matches the merge head on all three surfaces. `Protection gate: not bypassed` — both production runs waited at the `production` Environment gate and were approved through the authenticated owner API; the `main`-only branch policy and required reviewer remained in force; no production `push` deploy exists.

Anchored endpoints and post-run health:

```
production frontend: https://cubeclicker.vercel.app
production api: https://cubeclicker.onrender.com
POST-RUN HEALTH 200 {"status":"ok"}
PRODUCTION FRONTEND 200
```

### 8. No-edit, `.env*` and credential audits

```
git status --porcelain -- docs/features/README.md docs/features/production-build-selection/status.md → empty after the integration commit
git diff --name-only <base> -- docs/features/README.md → empty
git status --porcelain -- '.env*' → empty
git diff --name-only <base> -- '.env*' → empty
! git grep "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" (excluding docs) → no match
! git grep "postgres(ql)?://<user>:<password>@" -- .github infra src (excluding *.test.ts/*.test.tsx) → no match
! git grep token-shape (Brevo/SMTP/Render/Fly) tracked and untracked, excluding tests/deploy/gate-fixtures.mjs → no match
! git grep "<NAME>=<12+ credential chars>" tracked and untracked, excluding docs, tests and the harness → no match
! git diff <base>...HEAD and git log -p <base>..HEAD over the same exclusions → no match
build-log guards over all build-log-*.md: no 40-char hex, no connection string, no token shape
```

No secret value was read, printed or committed. The only credential-audit exclusion is the synthetic fixture harness `tests/deploy/gate-fixtures.mjs`.

## Acceptance audit

- AC-1 → met: the executed parses pin exactly `build_sha,environment`, the unchanged `environment` choice, the optional string `build_sha` with the exact description, no `build` input/choice/relative label, the two triggers and no `push` trigger.
- AC-2 → met: the harness executes the actual resolver for `resolver-latest` (exact `Resolved build` and `CI run` lines), `resolver-latest-unavailable` (real empty Actions shape + exact failure), `resolver-exact`, `resolver-malformed`, `resolver-development-default` and `resolver-development-non-default`; the live pinned run printed `Resolved build: 5209d804a (pinned)` and the latest run printed `Resolved build: 2b7764f17 (latest)` with `CI run`.
- AC-3 → met: the harness executes the actual guard for success/failure/missing/not-on-main; the live runs printed `CI succeeded for` the resolved SHA; the one `gh run list` retains `--repo "$GITHUB_REPOSITORY"`.
- AC-4 → met: the live pinned and latest runs show the same shortened SHA in the resolver line, checkout line (`Deploying build …`), Render `.commit.id`/current deploy and Vercel deployment metadata; `No mixed revision` holds.
- AC-5 → met: the 14 `render-*` harness cases PASS; the live runs show `Render deploy: …`, `Render deploy live: …` and `Render current deploy: …` for the selected deploy/SHA; the automatic path kept the hook and 45 s head start; no secret was printed.
- AC-6 → met: the harness executes the actual contract and schema blocks (pass/changed/missing-pg; pass/missing-007/missing-table); the live runs printed `Deploy contract OK for` and `Schema compatibility OK for …` before the migration/provider steps; no connection string was printed.
- AC-7 → met: the automatic development run `46066138982` is `workflow_run`/main/success, deployed the merge head `2b7764f17`, kept the hook + 45 s head start, passed the development 11-value guard and nine-name sync, `/healthz` 200 and smoke 8/8; a manual development dispatch with a non-empty `build_sha` is rejected by the harness case.
- AC-8 → met: the parses pin the exact 21-step order and one job; the live runs are both `workflow_dispatch`/main and the protection gate was not bypassed; the 23-name catalog, eleven-name guard and nine-name sync are unchanged (T3 read-back 15/8 names).
- AC-9 → met: both `ci.yml` parses pass and the build parse executes against the real workflow; pinned actionlint over both workflows exits 0; the post-merge application/container diff is empty and the harness exists.
- AC-10 → met: the README/deployment/vercel-render-neon/containerization positive greps pass; the case-insensitive `dropdown|previous-[0-9]|relative label` scan and the old-heading negatives return no match; the stale-claim negatives pass; the exact ledger rows are present; `docs/features/README.md` and `status.md` were not edited by the builder.
- AC-11 → met: the T3 live proof is reproduced from the recorded run IDs (pinned `build_sha`, latest restore, automatic development), with the Render live/current-deploy read-back, Vercel metadata, per-run smoke 8/8, `No mixed revision`, protection not bypassed, anchored URLs, shortened SHAs and post-run health 200.
- AC-12 → met: `npm ci`, lint, typecheck, tests, coverage (backend 97.09/92.24–92.25/99.65/97.09, frontend 97.22/96.80/98.60/97.22), build and smoke (29/29) pass; actionlint, the config parses, the executed `ci.yml` parse, the 31-case harness and the two Brevo fixtures pass; no application/container change relative to the post-merge base; `.env*` untouched; credentials clean; the live evidence is reproducible; the feature-index row is proposed below.

## Proposed feature-index row (for the orchestrator; file not edited)

```
production-build-selection | Production Build Selection | accepted | 2026-11-27
```

## Final report notes

- Artifacts: this log and the unchanged orchestrator-owned `status.md` (committed together); T1–T3 logs and the workflow/harness were already merged.
- Open questions: Q-2 (empty = newest successful `CI` push build on `main`; set = exact SHA, may not be latest) — implemented and proven; Q-3 (old builds fail closed on contract/schema under the immutable-migration policy) — implemented and proven by the harness; Q-4 (selection is production-only; manual development keeps `github.sha` with the Render API alignment) — implemented and proven. Q-1 (dropdown) is superseded by the owner contract change.
- Residual risks: the automatic `workflow_run` path keeps its pre-existing main-advance race (accepted, unchanged); the Render completion poll depends on the Render API's deploy status (fail-closed on timeout/terminal status/current-deploy mismatch); a future relax of the immutable-migration policy requires content hashes in the schema gate.
- Status: status.md committed unchanged under orchestrator authorization.

## T4 verify

The exact r4 `tasks.md` T4 verify block was executed on the committed tree with the documented environment-level smoke fallback (`PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose`) because the default host compose provider hits the recorded `crun`/`OomScoreAdj` regression; no repository file changes. Raw output is recorded below.

```
$ sed -n '436,556p' docs/features/production-build-selection/tasks.md > /tmp/opencode/t4-verify.sh
$ PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose bash /tmp/opencode/t4-verify.sh > /tmp/opencode/t4-verify-out.log 2>&1
T4_VERIFY_EXIT=0
```

The block executed end to end: `npm ci`; `npm run lint`; `npm run typecheck`; `npm test` (backend 52 files/2093 tests, frontend 83 files/2867 tests); `npm run coverage` (backend 97.09/92.24–92.25/99.65/97.09, frontend 97.22/96.80/98.60/97.22); `npm run build`; `npm run smoke` (`SMOKE PASS (29/29 checks)`); the 31-case harness (31/31 `PASS`, including the 14 `render-*` cases); `actionlint` (exit 0); the `vercel.json`/`render.yaml`/`deploy.yml` parses and the executed `ci.yml` parse; the two Brevo guard fixtures; the post-merge application/container diff guard plus the harness-exists assertion; the docs/stale-claim scans; the T3 live-evidence greps; the public `/healthz` fetch; the no-edit/`.env*` checks; and the credential audits (harness-only exclusion).

Raw output (tail):

```
SMOKE PASS (29/29 checks)
vercel.json: valid JSON
render.yaml: one development service, unchanged
deploy.yml: build_sha and automatic path pinned
deploy.yml: build_sha contract pinned (resolver, guard, contract, schema, Render API/completion, Vercel and 21-step order)
POST-RUN HEALTH 200 {"status":"ok"}
```

After the log-only amend that recorded this output, the same exact block was re-run on the final committed tree and exited 0 again; the only delta from the recorded run is this evidence prose.

## Deviations from spec

None. The only environment-level deviation is the documented `PODMAN_COMPOSE_PROVIDER` smoke fallback; it changes no repository file.
