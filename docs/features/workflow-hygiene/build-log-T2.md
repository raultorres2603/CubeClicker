# Build log — T2 — Append trailing newline to `.github/workflows/deploy.yml`

Task: T2 (2026-11-01)
Files changed: `.github/workflows/deploy.yml`, `docs/features/workflow-hygiene/build-log-T2.md`
What changed & why: Appended a single trailing `\n` to `.github/workflows/deploy.yml` (it previously ended with `"` and no newline) so it conforms to the repository's text-file hygiene and diffs cleanly. No content changes.
Decisions: Used `printf '\n' >>` to add exactly one byte; verified tail bytes.

Evidence:
- `tail -c 1 .github/workflows/deploy.yml | od -An -tuC` → `  10`
- `tail -c 2 .github/workflows/deploy.yml | od -An -tuC` → `  34  10` (not `10  10`)
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml` → exit 0 (no output)
- `grep -E 'uses: .*@v[0-9]+' .github/workflows/deploy.yml` → exit 1 (no match)

Acceptance audit: AC-2 → met (final byte 0x0A, not 0x0A 0x0A); AC-3 → met (actionlint exit 0); AC-8 → met (no SHA-pinned `@vN` actions).
Deviations from spec: none