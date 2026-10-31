# Build log — T9 — CI workflow (`ci.yml`, reusable gates)

Task: T9 (2026-10-31)
Files changed: `.github/workflows/ci.yml`
What changed & why: Created the reusable CI workflow with PR + main-push + workflow_call triggers, three parallel jobs (verify-app / smoke-e2e / verify-infra), Mailpit pre-start before smoke, terraform fmt/init/validate via setup-terraform, workflow-level `permissions: contents: read`, full-SHA-pinned actions, Node 24 + npm cache, per-job timeouts, and always-cleanup for smoke.
Decisions: Used docker compose (GitHub-hosted runners) per plan D-5; pinned action SHAs resolved at build time (actions/checkout v4.2.2, actions/setup-node v4.4.0, hashicorp/setup-terraform v3.1.2); terraform 1.15.9 to match the pinned local wrapper.

Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml` → exit=0 (no output)
- `grep -c "workflow_call" .github/workflows/ci.yml` → 1
- `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml` → (no output, exit=1)
- `grep -n "npm run coverage" .github/workflows/ci.yml` → 34:        run: npm run coverage
- `grep -nE 'up -d mailpit|run --rm smoke' .github/workflows/ci.yml` → 46: up -d mailpit; 48: run --rm smoke (ordered: pre-start precedes run)
- `grep -n "compose.smoke.yaml" .github/workflows/ci.yml` → lines 46, 48, 51
- `grep -n "id-token" .github/workflows/ci.yml` → (no output, exit=1)
- `sha256sum .github/workflows/ci.yml` → 9af7ee505458958b9b32049fe6c18ee088499d8b2598906b345541608f0341cd  .github/workflows/ci.yml

Pinned action SHAs (resolved at build time):
- actions/checkout v4.2.2 → 11bd71901bbe5b1630ceea73d27597364c9af683
- actions/setup-node v4.4.0 → 49933ea5288caeca8642d1e84afbd3f7d6820020
- hashicorp/setup-terraform v3.1.2 → b9cd54a3c349d3f38e8881555d616ced269862dd

Acceptance audit: AC-10 → met (triggers, 3 jobs, Mailpit pre-start, cleanup, SHA pins, Node 24 cache); AC-11 → met (workflow-level permissions contents: read, no id-token, full-SHA pins, setup-node cache npm Node 24).
Deviations from spec: none