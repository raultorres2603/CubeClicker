---
feature: agent-skill-migration
state: building
spec_review_round: 3
build_round: 1
created: 2026-11-12
updated: 2026-11-12
---
# Status — Agent Skill Migration & Repository-State Repair

## Summary
Repair the half-migrated agent skill pipeline: restore the six project pipeline skills in `.opencode/skills/`, track the 31 imported packs in `.agents/skills/` plus `skills-lock.json`, curate the four agents' skill allow-lists with documented exclusions, add `docs/architecture/skills.md` and update the live docs, and reconcile the feature index. Raw request: "Proceed with all of them, one by one" (first item: the repository-state repair).

## Task board
- [x] T1 — Restore the six project pipeline skills and track the 31 imported packs + lockfile (builder) `[seq]`
- [x] T2 — Curate agent allow-lists and document the skill policy (builder) `[seq]`
- [x] T3 — Reconcile the feature index rows (orchestrator edit-only) `[seq]`
- [ ] T4 — Pre-review verification and bookkeeping commit (builder) `[seq]`
- [ ] T5 — Acceptance bookkeeping commit (builder) `[seq]`

## Loop log
- 2026-11-12 — created → PLANNING — request: "Proceed with all of them, one by one" (first item: repair the half-migrated skill pipeline)
- 2026-11-12 — spec review r1 → changes_requested (4 major, 0 blockers); planner revision r2 applied; → SPEC_REVIEW round 2
- 2026-11-12 — spec review r2 → changes_requested (1 major, 0 blockers); planner revision r3 applied; → SPEC_REVIEW round 3
- 2026-11-12 — spec_review → awaiting_approval — r3 approved (0 blockers) — `reviews/spec-review-r3.md`
- 2026-11-12 — awaiting_approval → building — user instruction "Proceed with all of them, one by one" (blanket approval) — user message
- 2026-11-12 — building T1 completed — restored six pipeline skills; tracked 31 packs + lockfile; commits `633c67a` + `e2d607f` — `build-log-T1.md`
- 2026-11-12 — building T2 completed — curated agent allow-lists; added `docs/architecture/skills.md`; commits `4a63b1e` + `6faf3b4` — `build-log-T2.md`
- 2026-11-12 — building T3 completed — reconciled three feature-index rows in `docs/features/README.md` — `docs/features/README.md`

## Blockers / open questions
- Q-1 — canonical split recommended: project pipeline skills in `.opencode/skills/`, imported packs in `.agents/skills/`; see `spec.md` § Open questions.
- Q-2 — excluded/unassigned packs are tracked but not allow-listed; deletion is deferred to a separate user decision.
- Q-4 — `coin-economy` frontmatter `updated: 2026-10-28` is stale vs. its 2026-10-30 loop-log entry; the README row uses 2026-10-30 and the status file is not edited by this feature.
