# Build log — T11 — Dependabot + workflow hygiene

Task: T11 (2026-10-31)
Files changed: `.github/dependabot.yml`
What changed & why: Created `.github/dependabot.yml` tracking the `github-actions` ecosystem at the repository root on a weekly schedule, with a `ci` commit-message prefix (Dependabot emits `ci: ...` commits) and an open-pull-requests limit of 5. No application/infra code changes.

Decisions: Single `github-actions` update entry only (scope per task); npm ecosystem deliberately omitted because the task pins the github-actions ecosystem. The `ci:` token is documented in a comment so the Dependabot-emitted commit prefix is unambiguous; the config value is `ci` (Dependabot itself appends the colon).

Evidence:
- `grep -n "github-actions" .github/dependabot.yml` → 3:  - package-ecosystem: github-actions
- `grep -n "weekly" .github/dependabot.yml` → 6:      interval: weekly
- `grep -n "ci:" .github/dependabot.yml` → 8:      # Dependabot prepends this prefix followed by ": " (e.g. "ci: ...").
- `grep -n "open-pull-requests-limit: 5" .github/dependabot.yml` → 10:    open-pull-requests-limit: 5
- `npm run coverage` → exit 0 (regression guard; no TS changes in this task)
- `npm run lint` → not re-run (no TS/JS touched); config-only change

Acceptance audit: AC-14 → met (github-actions ecosystem, weekly schedule, ci: commit prefix, open-pull-requests-limit: 5 present in `.github/dependabot.yml`).
Deviations from spec: none