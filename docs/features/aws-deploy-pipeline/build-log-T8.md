# Build log — T8 — Environment composition + state backend wiring + infra README

Task: T8 (2026-10-31)
Files changed: infra/terraform/backend.tf (new), infra/terraform/envs/production.tfvars (new), infra/README.md (new), infra/terraform/versions.tf (edit: remove the T1 placeholder `backend "s3" {}` block now that backend.tf owns it)

What changed & why: Added the S3 backend block (use_lockfile = true, key pinned literal env/production/terraform.tfstate, no bucket/region literals — those arrive via -backend-config flags), the production env layer (environment = "production" + per-env sizing), and the infra README (C-1 wrapper reference, one-time bootstrap run, per-env init/plan, repo-variables checklist, verification boundary). Removed the versions.tf placeholder backend block to avoid a duplicate backend configuration.

Decisions: versions.tf's T1 placeholder `backend "s3" {}` was removed because Terraform permits only one backend block; backend.tf now owns it. Sizing values use the pinned defaults now (real numbers post-acceptance). README documents staging only as an additive recipe (F5). Generated .terraform/ directories and bootstrap lockfile were removed after validation so they are not committed (gitignored/regenerable).

Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` -> exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false` -> "Terraform has been successfully initialized!" exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` -> "Success! The configuration is valid." exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 init -backend=false` -> exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 validate` -> "Success! The configuration is valid." exit 0
- `grep -n "use_lockfile" infra/terraform/backend.tf` -> line 10: `use_lockfile = true`
- `grep -rni "dynamodb" infra/terraform/` -> (no output) exit 1
- `grep -n "env/production/terraform.tfstate" infra/terraform/backend.tf` -> line 9: `key = "env/production/terraform.tfstate"`
- `grep -Rni "staging" infra/terraform/` -> (no output) exit 1

Acceptance audit: AC-3 -> met (no state/plan/.terraform committed; dynamodb absent); AC-9 -> met (envs/production.tfvars exists, environment = "production", key pinned literal, single production documented; staging only as additive recipe).

Deviations from spec: Literal trailing-path invocation for init/validate adjusted to -w working-directory form (Terraform 1.15.9 CLI does not accept a positional directory; same adjustment recorded in T1-T7). versions.tf placeholder backend block removed (necessary wiring, not a scope change — backend.tf now owns the backend).
