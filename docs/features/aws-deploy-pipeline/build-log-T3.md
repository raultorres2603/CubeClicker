# Build log — T3 — Networking + edge module (ALB, WebSocket passthrough)
Task: T3 (2026-10-31)
Files changed: infra/terraform/modules/networking/variables.tf, infra/terraform/modules/networking/main.tf, infra/terraform/modules/networking/outputs.tf, infra/terraform/modules/edge/variables.tf, infra/terraform/modules/edge/main.tf, infra/terraform/modules/edge/outputs.tf, infra/terraform/networking.tf, infra/terraform/edge.tf
What changed & why: Created the networking module (VPC, 2 public + 2 private subnets across the first two AZs, IGW, single NAT gateway with EIP, public/private route tables + associations, ALB and ECS security groups with SG-to-SG ingress) and the edge module (internet-facing ALB with idle_timeout = 90, frontend TG default route with GET / matcher 200, backend TG with GET /healthz matcher 200, HTTP listener, and priority rules routing /ws, /auth*, /healthz to the backend TG). Added root wiring files networking.tf and edge.tf calling both modules. WebSocket upgrade headers pass through by default (HTTP listener + HTTP/1.1 target groups; no request policy strips Upgrade/Connection); connection_termination left at default with reasoning documented.
Decisions: Single NAT gateway (cost) rather than per-AZ; target_type = "ip" for Fargate; backend health check asserts only path + 200 (richer signals live in image HEALTHCHECK + smoke suite). Literal init/validate trailing-path invocation adjusted to -w working directory per T1/T2 precedent (Terraform 1.15.9 CLI rejects a positional directory argument).
Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` → (no output) exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" exit 0
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0
- `grep -n "idle_timeout" infra/terraform/modules/edge/*.tf` →
  infra/terraform/modules/edge/main.tf:9:# 30s; idle_timeout = 90 is strictly greater than 2x that heartbeat).
  infra/terraform/modules/edge/main.tf:19:  idle_timeout = 90
- `grep -n "/healthz" infra/terraform/modules/edge/*.tf` →
  infra/terraform/modules/edge/main.tf:2:# two target groups (frontend default, backend for /ws + /auth* + /healthz),
  infra/terraform/modules/edge/main.tf:57:# Backend target group (/ws, /auth*, /healthz).
  infra/terraform/modules/edge/main.tf:67:    path                = "/healthz"
  infra/terraform/modules/edge/main.tf:131:# Route /healthz to the backend target group.
  infra/terraform/modules/edge/main.tf:143:      values = ["/healthz"]
- `grep -n 'matcher' infra/terraform/modules/edge/*.tf` →
  infra/terraform/modules/edge/main.tf:3:# and ALB-assertable health checks (path + matcher 200).
  infra/terraform/modules/edge/main.tf:42:    matcher             = "200"
  infra/terraform/modules/edge/main.tf:70:    matcher             = "200"
- `git ls-files '*.tfstate*' '*.tfplan*'` → (no output) exit 0
- `git ls-files | grep -E '(^|/)\.terraform/'` → (no output) exit 0
- `git ls-files '*terraform.lock.hcl'` → `infra/terraform/.terraform.lock.hcl` only
Acceptance audit: AC-4 → met (internet-facing ALB; frontend TG default route with GET / matcher 200; backend TG GET /healthz matcher 200; listener rules for /ws, /auth*, /healthz → backend TG; idle_timeout = 90 strictly > 2×30s heartbeat; WS upgrade passthrough preserved, no request policy strips Upgrade/Connection).
Deviations from spec: Literal init/validate trailing-path invocation (`init -backend=false infra/terraform`, `validate infra/terraform`) adjusted to the `-w /repo/infra/terraform` working-directory form, consistent with T1/T2 precedent; Terraform 1.15.9 CLI rejects a positional directory argument ("Too many command line arguments. Did you mean to use -chdir?"). No functional change. No terraform apply run (D-12 boundary).