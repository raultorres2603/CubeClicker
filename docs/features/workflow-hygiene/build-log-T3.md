# Build log — T3 — Document the scoped credential-audit command in `docs/architecture/deployment.md`

Task: T3 (2026-11-01)
Files changed: docs/architecture/deployment.md, docs/features/workflow-hygiene/build-log-T3.md
What changed & why: Added a bullet to the "Secret posture" section of docs/architecture/deployment.md recording the canonical scoped credential-audit command `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` and explaining that the unscoped form is not used because `docs/features/**` contains benign references to the audit pattern. No other sections touched.
Decisions: Excluded all of `docs/` per plan D-2 (default Q-1). Restored the blank line before "## Trigger policy" to keep section spacing intact.
Evidence:
- `grep -F ":(exclude)docs/" docs/architecture/deployment.md` → match (line 59)
- `grep -n "docs/features/\*\*" docs/architecture/deployment.md` → match (line 59)
- `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` → no output, exit 1
Acceptance audit: AC-6 → met (grep anchors match); AC-7 → met (no matches, exit 1).
Deviations from spec: none.