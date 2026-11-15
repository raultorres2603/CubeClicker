---
feature: project-only-skills
state: accepted
spec_review_round: 2
build_round: 2
created: 2026-11-14
updated: 2026-11-14
---
# Status — Project-Only Skills

## Summary

Delete every imported third-party skill pack under `.agents/skills/` (33 directories, including `neon-postgres` and `deploy-to-vercel`) and `skills-lock.json`, and remove all imported skill allow-list entries from the four agents. Context7 MCP now covers library/platform documentation (Three.js, React, Vercel, Neon, etc.); the only skills we need are the six project pipeline skills under `.opencode/skills/`: `orchestration-playbook`, `spec-authoring`, `spec-review`, `task-decomposition`, `web-implementation`, `code-review`. Update `AGENTS.md`, `README.md`, `docs/architecture/skills.md`, and `docs/architecture/documentation.md` accordingly. Raw request: "Knowing that we have now MCP of Context7, do we need the skills we have for Three.js and others we have, for example? If not, delete them. We just need skills about the project, not techs related information, that will be covered by Context7 MCP."

## Task board

- [x] T1 — Delete imported packs and lockfile `[seq]`
- [x] T2 — Remove imported allow-list entries and rewrite skill policy docs `[seq]`
- [x] T3 — Verify no stale references; full gates; commit `[seq]`

## Loop log

- 2026-11-14 — created → PLANNING — user explicitly approved deletion of tech/generic imported skills; keep six project pipeline skills; Context7 covers library docs.
- 2026-11-14 — planning → spec_review — planner artifacts r1 written (11 ACs, 3 sequential tasks); review round 1 pending — `spec.md` r1
- 2026-11-15 — spec review r1 → changes_requested (1 blocker: clean-tree staging; 1 major: non-skill permission parity); planner revision r2 pending — `reviews/spec-review-r1.md`
- 2026-11-15 — planner revision r2 applied — scoped clean-tree + reviews staging, non-skill permission parity, total-count parser; → SPEC_REVIEW round 2 — `spec.md` r2
- 2026-11-15 — spec_review → building — r2 approved (0 blockers); user explicitly authorized deletion; T1 started — `reviews/spec-review-r2.md`
- 2026-11-15 — building T1 completed — deleted 33 packs + lockfile; commit `18d5010`; 6 project skills preserved; backend 1110/frontend 1873 tests; coverage 95.25/88.68/99.53/95.25 and 96.48/96.14/97.56/96.48 — `build-log-T1.md`
- 2026-11-15 — building T2 completed — removed imported allow rules + advisory bullets; project-only `skills.md`; commit `7491db3`; parser/permission parity green — `build-log-T2.md`
- 2026-11-15 — building T3 completed — stale sweep + full gates; commit `95d93f8`; backend 1110/frontend 1873 tests; coverage 95.25/88.68/99.53/95.25 and 96.48/96.14/97.56/96.48; build green — `build-log-T3.md`
- 2026-11-15 — building → code_review — all T1-T3 verified; acceptance bookkeeping pending — `build-log-T3.md`
- 2026-11-15 — code_review → accepted — code review r1 approved (0 blockers); AC-1..AC-10 met, AC-11 with post-commit addendum; 33 packs removed, six project skills kept — `reviews/code-review-r1.md`

## Blockers / open questions

- None blocking. Deletion is explicitly authorized by the user; preserve `.opencode/skills/` and the project pipeline.
- Baseline: pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` from the blocked Vercel feature is excluded from the scoped clean-tree check and must not be staged or edited.
- Do not touch the blocked `vercel-fly-neon-deployment` or paused `runtime-observability` feature artifacts.
