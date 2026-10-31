# Build log — T2 — State-bucket bootstrap root module
Task: T2 (2026-10-31)
Files changed: infra/terraform/bootstrap/main.tf, infra/terraform/bootstrap/variables.tf
What changed & why: Created the one-time bootstrap root module: a single shared S3 state bucket named cubeclicker-tfstate-<aws-account-id> (account id via variable), force_destroy=false, versioning enabled, SSE-KMS (AWS-managed default key, optional CMK override), public-access block, TLS-only bucket policy, S3-native locking consumed via use_lockfile on the consumer (no DynamoDB). Output pinned state_bucket_name. Documented the one-time apply procedure in the module header comment.
Decisions: Bucket name uses the literal "cubeclicker" prefix per the pinned convention; aws_account_id is a required validated variable (never literal). Encryption defaults to aws:kms with a null kms_master_key_id (AWS-managed aws/s3 key) and supports an optional CMK. No backend block in the bootstrap root (local state for the one-time apply). Init/validate trailing-path invocation adjusted to -w working directory (Terraform 1.15.9 CLI limitation, per T1 precedent); fmt -check -recursive accepts the path.

Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` → (no output) exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0
- `git ls-files '*.tfstate*' '*.tfplan*'` → (no output) exit 0 (no state/plan committed)
- `git ls-files | grep -E '(^|/)\.terraform/'` → (no output) exit 0 (no .terraform dirs committed)
- `git ls-files '*terraform.lock.hcl'` → `infra/terraform/.terraform.lock.hcl` only (bootstrap lockfile removed; not committed by design)

Acceptance audit: AC-2 → met (init -backend=false + validate exit 0 for root and bootstrap, no creds); AC-3 → met (no state/plan/.terraform tracked; only the T1 lockfile tracked).
Deviations from spec: Literal init/validate trailing-path invocation adjusted to -w working directory (Terraform CLI limitation, consistent with T1). No functional change. No terraform apply run (D-12 boundary).