# Build log — T1 — Append trailing newline to `.github/workflows/ci.yml`

Task: T1 (2026-11-01)
Files changed: `.github/workflows/ci.yml`, `docs/features/workflow-hygiene/build-log-T1.md`
What changed & why: Appended a single trailing `\n` to `.github/workflows/ci.yml` (it previously ended with `e` and no newline) so it conforms to the repository's text-file hygiene and diffs cleanly. No content changes.
Decisions: Used `printf '\n' >>` to add exactly one byte; verified tail bytes and actionlint.

Evidence:
- `tail -c 1 .github/workflows/ci.yml | od -An -tuC` → `  10`
- `tail -c 2 .github/workflows/ci.yml | od -An -tuC` → ` 101  10` (not `10  10`)
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml` → exit 0 (no output)

Acceptance audit: AC-1 → met (final byte 0x0A, not 0x0A 0x0A); AC-3 → met (actionlint exit 0).
Deviations from spec: none
