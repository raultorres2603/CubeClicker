# Build log — T7 — CI/CD IAM (GitHub OIDC + least-privilege roles)

Task: T7 (2026-10-31)
Files changed: infra/terraform/cicd-iam.tf, infra/terraform/modules/cicd-iam/variables.tf, infra/terraform/modules/cicd-iam/main.tf, infra/terraform/modules/cicd-iam/outputs.tf, infra/terraform/outputs.tf
What changed & why: Added the GitHub OIDC identity provider and the two least-privilege roles (GitHubActionsCubeCI read-only, GitHubActionsCubeDeploy apply-scoped) with trust conditions on sub/aud, plus root wiring and role-ARN outputs. No static access keys.
Decisions: Repo owner/name and state bucket name arrive as variables (never literals). Task-role prefix and ECR ARNs derived in-module. Lockfile ops scoped to *.tflock objects.

Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` → exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0
- grep `token.actions.githubusercontent.com` → present (OIDC issuer + condition keys) — see output above
- grep `GitHubActionsCubeCI` → present (role name + outputs)
- grep `GitHubActionsCubeDeploy` → present (role name + outputs)
- grep `environment:production` → present (deploy trust sub condition)
- `grep -rn "aws_iam_access_key" infra/terraform/modules/cicd-iam/*` → (no output) exit 1

Acceptance audit: AC-8 → met (OIDC IdP + two roles with constrained trust; no access keys).

Deviations from spec: none.