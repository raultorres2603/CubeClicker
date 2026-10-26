# Documentation — Best Practices

This document is the single source of truth for documentation best practices and for the acceptance-time documentation update pass. It applies to every feature: when a feature's final code review is approved, the builder runs a documentation update pass over the repository documentation before the feature is marked `accepted`, following the practices and checklist below. See `AGENTS.md` § Workflow and `.opencode/skills/orchestration-playbook/SKILL.md` for the transition rule.

## Best practices

1. **Accuracy — keep docs accurate.** Documentation must reflect shipped behavior. If a statement in the docs no longer matches what the code does, the docs are wrong and must be corrected in the same pass; never document intended or future behavior as if it were current.
2. **Minimal diffs — change only what the behavior change requires.** Touch the smallest set of documentation that reflects the change. Do not rewrite sections that are unaffected, reflow prose, or "improve" unrelated text; keep the diff reviewable.
3. **Same change as the behavior.** Update documentation in the same change as the behavior it describes (same commit/PR), so documentation and code never drift apart. A documentation update that lands later is a drift risk.
4. **Concrete specifics over vague prose.** Prefer versions, ports, commands, paths, environment variables, and exact file names over hand-waving ("configure as needed"). When a value is decided (e.g. port `8080`, command `podman compose up`), state it verbatim. See `docs/architecture/stack.md` and `docs/architecture/containerization.md` for the decided values.
5. **Link validity — keep links valid.** Every relative link in the documentation must resolve to an existing file. Verify links after editing; a broken link is a documentation defect. Automated link checking is deferred (see `docs/features/docs-on-feature-acceptance/spec.md` § Open questions, Q-3).
6. **Glossary updates.** When a term's meaning changes, update `docs/product/glossary.md` in the same change. Keep glossary terms and definitions consistent across README, architecture docs, and product docs; do not introduce a second name for an already-defined concept.
7. **Secrets and environment files.** `.env*` stays user-owned and off-limits to agents; never document secret values, tokens, or credentials. Document only the variable *names* and their purpose, never their values. See `docs/architecture/containerization.md` § Service containerization rules.

## Acceptance-time documentation checklist

Run this checklist when a feature transitions from `code_review` to `accepted`. Apply targets **as applicable to the feature** — update only the documents the feature actually touched or affected; this is not a blanket rewrite of the repository's documentation.

- [ ] **Root `README.md`** — installation/run instructions, commands, ports, and feature references still match shipped behavior.
- [ ] **`docs/architecture/**`** — `stack.md`, `containerization.md`, and this document reflect any architectural or convention change; do not alter decided stack/container statements unless the feature amended them.
- [ ] **`docs/product/**`** — `glossary.md` (terms), `vision.md`, and `realtime-backlog.md` updated when the feature changes a term, vision, or backlog item.
- [ ] **`docs/features/README.md`** — the feature index reflects the feature's state and last-updated date.

### Ownership of `docs/features/README.md`

`docs/features/README.md` is **orchestrator-owned**. The builder does **not** edit it directly. Instead, the builder either:

- appends/updates only its own feature's row in a proposed diff, or
- proposes a diff (in the build log or review) for the orchestrator to apply.

The orchestrator applies the index update on acceptance. This merge strategy keeps a single writer on the feature index and avoids conflicting edits during a feature. See `docs/features/README.md` for the current index format.

### Merge strategy (feature index)

- The builder proposes the smallest possible change to its own row (slug, title, state, last-updated date).
- The orchestrator is the sole applier of that change to `docs/features/README.md`.
- No other feature's row may be modified by a feature's documentation pass.

## Notes

- **Orchestrator** dispatches and verifies the documentation update pass before transitioning a feature to `accepted`; the feature stays in `code_review` while the pass runs and transitions only once evidence is recorded in a build log. No new state is introduced.
- Targets are applied as applicable to the feature, not as a blanket rewrite (see checklist above).
- Link to the glossary: [glossary](../product/glossary.md). Link to the vision: [vision](../product/vision.md). Link to the containerization reference: [containerization](containerization.md). Link to the stack reference: [stack](stack.md).