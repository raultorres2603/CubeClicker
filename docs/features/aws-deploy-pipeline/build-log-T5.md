# Build log — T5 — Database module

Task: T5 (2026-10-31)
Files changed: infra/terraform/data.tf, infra/terraform/modules/data/variables.tf, infra/terraform/modules/data/main.tf, infra/terraform/modules/data/outputs.tf, infra/terraform/outputs.tf
What changed & why: Created the data module implementing the `use_external_database_url` toggle (Q-5 mode). Default branch provisions RDS PostgreSQL with `engine_version = "16"`, `storage_encrypted = true`, `publicly_accessible = false`, private subnets, a security group allowing 5432 only from the ECS SG, and `manage_master_user_password = true` (AWS-managed secret; no password literal). Toggle branch consumes an out-of-band external database URL via an SSM SecureString parameter created by the root from the sensitive `external_database_url` variable. Root wiring exposes `db_host` and `db_secret_arn` (sensitive) outputs. Added `vpc_id`/`private_subnet_ids`/`ecs_security_group_id` module inputs sourced from the networking module.
Decisions: RDS instance class `db.t3.micro`, 20 GiB gp3, 7-day backups, `skip_final_snapshot = true` (module default; production hardening deferred to T8/env sizing). VPC id is passed explicitly from the networking module rather than looked up via a data source. SSM parameter is created by the root (count-gated) and its ARN passed into the module. No `password` attribute anywhere.
Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` → (no output) exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0
- `grep -n "16" infra/terraform/modules/data/*.tf` →
  infra/terraform/modules/data/main.tf:1: # Data module: PostgreSQL 16 on RDS ...
  infra/terraform/modules/data/main.tf:5: #   - RDS PostgreSQL, engine_version = "16" ...
  infra/terraform/modules/data/main.tf:69:   engine_version    = "16"
- `grep -n "publicly_accessible" infra/terraform/modules/data/*.tf` →
  infra/terraform/modules/data/main.tf:6: #   - storage_encrypted = true, publicly_accessible = false
  infra/terraform/modules/data/main.tf:82:   publicly_accessible    = false
- `grep -n "use_external_database_url" infra/terraform/modules/data/*.tf` → (multiple matches in main.tf/outputs.tf/variables.tf; see file)
- `grep -rn "manage_master_user_password" infra/terraform/modules/data/*.tf` →
  infra/terraform/modules/data/main.tf:80:   manage_master_user_password = true
- `grep -rni "password" infra/terraform/data.tf infra/terraform/modules/data/` → only comment occurrences (no password literal)
Acceptance audit: AC-7 → met (PostgreSQL 16 engine_version = "16"; publicly_accessible = false; SG allows 5432 only from ECS SG; manage_master_user_password = true with no password literal; use_external_database_url toggle consumes SSM SecureString created by the root from the sensitive variable; root exposes db_host + db_secret_arn outputs).
Deviations from spec: Literal init/validate trailing-path invocation adjusted to the `-w /repo/infra/terraform` working-directory form (Terraform 1.15.9 CLI limitation, consistent with T1–T4 precedent); no functional change. No terraform apply run (D-12 boundary).