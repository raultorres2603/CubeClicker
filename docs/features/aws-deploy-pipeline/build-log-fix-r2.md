# Build log — fix-r2 — F1/F2/F3 review fixes
Task: fix-r2 (2026-10-31)
Files changed: .github/workflows/ci.yml, .github/workflows/deploy.yml, docs/architecture/deployment.md
What changed & why:
- F1: Terraform 1.15.9 accepts no positional directory argument for init/validate/plan (only -chdir= or working-directory). Switched all terraform steps in ci.yml and deploy.yml to `working-directory: infra/terraform` and dropped positional args (fmt/init/validate/plan/apply).
- F2: Removed the render-task-definition + deploy-service steps that referenced nonexistent infra/ecs/*-task-definition.json; ECS task defs/services are updated by terraform apply via image URI vars. Documented in deployment.md.
- F3: Removed untracked infra/terraform/bootstrap/.terraform/ and .terraform.lock.hcl.
Decisions: Used working-directory approach (the only functional form on terraform 1.15.9) instead of the review's positional-first suggestion, which empirically fails ("Too many command line arguments"). Positional form for fmt still works but unified to working-directory for consistency.
Evidence:
- actionlint: `podman run --rm -v $PWD:/repo -w /repo rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml` → exit 0
- SHA-pin audit: `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml` → exit 1 (no matches)
- terraform fmt: `podman run ... terraform:1.15.9 fmt -check -recursive infra/terraform` → exit 0
- terraform init (working form): `podman run ... terraform:1.15.9 -chdir=infra/terraform init -backend=false` → exit 0
- terraform validate (working form): `podman run ... terraform:1.15.9 -chdir=infra/terraform validate` → exit 0
- literal positional init (as pinned in task verify) → fails: "Too many command line arguments. Did you mean to use -chdir?" (empirical confirmation that positional form is unsupported on terraform 1.15.9)
- literal positional validate (as pinned) → fails: "Module not installed" (no positional target resolution)
- git status (bootstrap): `git status --short -- infra/terraform/bootstrap/` → exit 0, no .terraform/.terraform.lock.hcl
Acceptance audit: F1 → met (workflows use working-directory, functional); F2 → met (render/deploy steps removed, documented); F3 → met (artifacts removed, git status clean of them).
Deviations from spec: Workflow steps use `working-directory` instead of positional-first ordering, because positional ordering is rejected by terraform 1.15.9 (empirically verified). Functionally equivalent and is the alternative explicitly permitted by the task scope.