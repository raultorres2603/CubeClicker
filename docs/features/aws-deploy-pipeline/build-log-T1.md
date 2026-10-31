# Build log — T1 — Terraform scaffold & conventions
Task: T1 (2026-10-31)
Files changed: infra/terraform/versions.tf, infra/terraform/variables.tf, infra/terraform/outputs.tf, infra/terraform/.terraform.lock.hcl, .gitignore
What changed & why: Created the root Terraform module skeleton (required_version >= 1.11, AWS provider ~> 6.0, empty S3 backend placeholder), input schema with pinned defaults (aws_region us-east-1, project cubeclicker, validated environment with no default, sizing params, use_external_database_url toggle, sensitive external_database_url), pinned output names as placeholders, generated & committed provider lockfile, and .gitignore terraform artifact additions (existing entries preserved).
Decisions: Used AWS provider ~> 6.0 (resolved 6.71.0); backend block left as empty `backend "s3" {}` placeholder for T8; outputs set to null placeholders to be backfilled by later tasks.
Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` → (no output) exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" (provider hashicorp/aws v6.71.0 installed; .terraform.lock.hcl generated) exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0
- Note: the task's literal trailing-path forms for `init`/`validate` (`... init -backend=false infra/terraform`, `... validate infra/terraform`) are not accepted by the Terraform 1.15.9 CLI (init/validate take no positional directory argument); the equivalent `-w /repo/infra/terraform` invocations above were used and are recorded. `fmt -check -recursive infra/terraform` accepts the path and exited 0.
- `git ls-files '*.tfstate*' '*.tfplan*'` → (no output) exit 0
- `git ls-files | grep -E '(^|/)\.terraform/'` → (no output) exit 0
- `git ls-files '*terraform.lock.hcl'` → `infra/terraform/.terraform.lock.hcl` (after staging; see commit)
Acceptance audit: AC-1 → met (fmt exit 0, required_version >= 1.11, aws provider only, aws_region default us-east-1); AC-2 → met (init -backend=false exit 0, validate exit 0, no creds); AC-3 → met (no state/plan/.terraform tracked; lockfile tracked by design).
Deviations from spec: Literal init/validate trailing-path invocation adjusted to -w working directory (Terraform CLI limitation); no functional change.
