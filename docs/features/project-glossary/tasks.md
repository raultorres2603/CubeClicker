# Tasks — Project Glossary

Dependency overview: T1 → T2 → T3 (strictly sequential; no `[P]` batch — the feature is two small files plus a final gate, so parallel scheduling adds no value).

Building precondition: spec Q-1 is resolved — `.opencode/agents/builder.md` now allows `docs/product/**` (widened by online-realtime-workflow T0; permissions byte-stable since). The builder still verifies the allowlist at build time, then proceeds.

## T1 — Author `docs/product/glossary.md` `[seq]`

depends_on: —
files_owned: `docs/product/glossary.md`, `docs/features/project-glossary/build-log-T1.md`
verify: inspection checklist (no project commands — `AGENTS.md` § Commands TBD): path + single H1 (AC-1, AC-2); usage note (AC-3, AC-4); exactly the eight required H3 entries, no others (AC-5); alphabetical (AC-6); `Definition:` + `Example:` populated (AC-7); examples use their term (AC-8); idle/offline mutual naming (AC-9); per-entry caps (AC-10, AC-11); total caps (AC-12). Record a per-AC evidence table in `build-log-T1.md` (`wc`/`ls` may be cited as aids).
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12
status: [x]

Write the new glossary exactly per the pinned template, term anchors, and caps in `plan.md` § Interfaces / contracts. Do not touch `docs/product/vision.md` or anything outside `files_owned`.

## T2 — Link the glossary from `docs/product/vision.md` `[seq]`

depends_on: T1
files_owned: `docs/product/vision.md`, `docs/features/project-glossary/build-log-T2.md`
verify: inspection — compare against the verbatim baseline in `plan.md` § Interfaces / contracts: exactly one added line containing a Markdown link to `glossary.md`, all pre-existing content unchanged (AC-13); `git diff` may be cited as an aid. Record evidence in `build-log-T2.md`.
acceptance: AC-13
status: [x]

Add the single contract line (e.g., `> **Terminology:** canonical domain terms are defined in [glossary.md](glossary.md).`); no other edits.

## T3 — Verify & integrate `[seq]`

depends_on: T1, T2
files_owned: `docs/features/project-glossary/build-log-T3.md`
verify: full inspection pass over both files against AC-1 … AC-13; confirm the vision.md link resolves to the existing glossary; per-AC evidence table in `build-log-T3.md`.
acceptance: AC-1 … AC-13 (verification gate)
status: [x]

Independent re-check of the complete deliverable before code review; report any AC not met with exact location.
