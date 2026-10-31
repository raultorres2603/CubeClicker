# Build log — T4 — ECR module

Task: T4 (2026-10-31)
Files changed: infra/terraform/ecr.tf, infra/terraform/modules/ecr/variables.tf, infra/terraform/modules/ecr/main.tf, infra/terraform/modules/ecr/outputs.tf
What changed & why: Created the ECR module with two private repositories named exactly `cubeclicker-backend` and `cubeclicker-frontend`, each with scan-on-push enabled, AES256 encryption at rest, mutable image tags, and a lifecycle policy retaining the most recent 50 SHA-tagged images (older tagged images expire). Added root wiring in `ecr.tf` calling the module with `project` and `environment`. Module outputs expose both repository URLs/ARNs under the pinned names (`backend_repository_url`, `frontend_repository_url`).
Decisions: `image_tag_mutability = "MUTABLE"` per the task's "image-tag mutability enabled" wording (parallel to "scan-on-push on"); AES256 (AWS-managed) encryption rather than KMS CMK (no key provisioning in scope); single lifecycle rule keeping the 50 most recent tagged images (all tags in this pipeline are commit SHAs); no `force_delete` override (defaults to false). Lifecycle scope is `tagStatus = "tagged"` since every pushed image carries a SHA tag.
Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` → (no output) exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 init -backend=false infra/terraform` → "Too many command line arguments. Did you mean to use -chdir?" exit 1 (Terraform 1.15.9 CLI rejects a positional directory argument; equivalent `-w /repo/infra/terraform` form used, consistent with T1/T2/T3 precedent)
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0
- `grep -n "cubeclicker-backend" infra/terraform/modules/ecr/*.tf` →
  infra/terraform/modules/ecr/main.tf:8:  name                 = "cubeclicker-backend"
  infra/terraform/modules/ecr/main.tf:20:    Name        = "cubeclicker-backend"
- `grep -n "cubeclicker-frontend" infra/terraform/modules/ecr/*.tf` →
  infra/terraform/modules/ecr/main.tf:28:  name                 = "cubeclicker-frontend"
  infra/terraform/modules/ecr/main.tf:40:    Name        = "cubeclicker-frontend"
Acceptance audit: AC-6 → met (two private ECR repos named exactly `cubeclicker-backend` / `cubeclicker-frontend`; scan-on-push on; AES256 encryption; lifecycle policy retaining the most recent 50 SHA-tagged images; root wiring exposes both repository URL outputs under the pinned names).
Deviations from spec: Literal init/validate trailing-path invocation adjusted to the `-w /repo/infra/terraform` working-directory form (Terraform 1.15.9 CLI limitation); no functional change. No terraform apply run (D-12 boundary).