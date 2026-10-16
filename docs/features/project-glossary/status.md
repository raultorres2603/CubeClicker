---
feature: project-glossary
state: awaiting_approval
spec_review_round: 1
build_round: 0
created: 2026-10-16
updated: 2026-10-16
---
# Status — Project Glossary

## Summary
Create `docs/product/glossary.md` defining the canonical CubeClicker domain terminology (cube, click, points, upgrade, idle/offline progress, save, prestige) with one example sentence per term, so agents and docs use consistent terms.

## Task board
- [ ] T1 — Author `docs/product/glossary.md` (AC-1…AC-12)
- [ ] T2 — Link the glossary from `docs/product/vision.md` (AC-13)
- [ ] T3 — Verify & integrate (AC-1…AC-13 gate)

## Loop log
- 2026-10-16 — created → planning — request: "Create a project glossary at docs/product/glossary.md defining the canonical domain terminology for CubeClicker ... so that all agents and docs use consistent terms."
- 2026-10-16 — planning → spec_review — planner reported completed; spec.md, plan.md, tasks.md written — docs/features/project-glossary/tasks.md
- 2026-10-16 — spec_review → awaiting_approval — spec-r1 verdict: approved (blocking: 0) — docs/features/project-glossary/reviews/spec-r1.md

## Blockers / open questions
- Q-1 (must resolve before `building`): `.opencode/agents/builder.md` permissions exclude `docs/product/**`; no pipeline agent can write `docs/product/glossary.md` or the `vision.md` link line under current config. Needs user decision (widen builder allowlist to `docs/product/**`, or approve an alternative edit route).
- Q-3: confirm the frozen eight-term set (request said "e.g.").
- Q-4: confirm the single additive link line in the user-owned `docs/product/vision.md` (AC-13).
- Q-2/Q-5/Q-7 (deferred/backlog): universal agent discovery via AGENTS.md/.opencode, retrofitting existing docs to glossary terms, permission-config follow-up.
