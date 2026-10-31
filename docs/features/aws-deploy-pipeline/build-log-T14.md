# Build log — T14 — Documentation pass

Task: T14 (2026-10-31)
Files changed: `README.md`, `docs/architecture/deployment.md` (new), `docs/architecture/containerization.md`, `docs/architecture/stack.md`
What changed & why: Added the Deployment section to README (gates, deploy flow, user-side asset checklist, plan-role note), created `docs/architecture/deployment.md` with the pinned deployment conventions, resolved the three containerization deferrals and amended the neutrality sentence, and amended the provider-choice sentence in stack.md. Local-run instructions untouched.
Decisions: Appended the Deployment section at the end of README to keep the `podman compose up` lines out of the diff (unchanged-text check). Proposed (did not apply) the `docs/features/README.md` row per orchestrator ownership.

Evidence:
- `grep -n "Deployment" README.md` →
```
86:Both images are provider-neutral and are the deployable artifacts. Release tagging = commit SHA in the deploy pipeline (see the Deployment section above).
95:## Deployment
```
- `grep -n "use_lockfile" docs/architecture/deployment.md` →
```
12:- S3-native locking: `use_lockfile = true` in the backend block. No DynamoDB anywhere.
```
- `grep -n "commit SHA" docs/architecture/deployment.md` →
```
41:- Release images are tagged with the commit SHA (`github.sha`) and pushed to ECR (`cubeclicker-backend`, `cubeclicker-frontend`). No mutable `:latest` tag is referenced by any task definition.
```
- `grep -n "provider-neutral" docs/architecture/containerization.md` →
```
21:- Images must run on any container platform with no provider-specific lock-in; the container images remain provider-neutral deployables.
```
- `grep -c "no provider is chosen" docs/architecture/stack.md docs/architecture/containerization.md` →
```
docs/architecture/stack.md:0
docs/architecture/containerization.md:0
```
- `grep -n "idle_timeout" docs/architecture/deployment.md` →
```
35:- `idle_timeout = 90` — strictly greater than 2× the backend's 30 s heartbeat (`src/backend/src/game/hub.test.ts`, line 556).
```
- `grep -nE 'deliberate|by design' docs/architecture/deployment.md` →
```
29:- Staging is deliberately not shipped. ...
60:## Double gate on `main` (by design)
62:- ... This is deliberate (F16): ...
```
- link-validity: `ls docs/architecture/deployment.md` → `docs/architecture/deployment.md`
- unchanged-text check: `git diff README.md | grep -c "podman compose up"` → `0`

Proposed `docs/features/README.md` row diff (NOT applied — orchestrator-owned index):

```diff
@@ ... (end of table, before "States:" line) @@
+| aws-deploy-pipeline | AWS Deploy Pipeline (Terraform infrastructure + GitHub Actions CI/CD + framework proof-of-working) | building | 2026-10-31 |
```

Acceptance audit: AC-21 (a)–(f) → met (README Deployment section + asset checklist incl. plan-role note; deployment.md created with all pinned conventions; containerization.md deferrals resolved + neutrality amended; stack.md sentence amended; AGENTS.md fragment owned by T13 already amended; feature-index row proposed above).

Deviations from spec: none.