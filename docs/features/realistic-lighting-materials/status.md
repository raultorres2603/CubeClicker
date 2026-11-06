---
feature: realistic-lighting-materials
state: accepted
spec_review_round: 2
build_round: 2
created: 2026-11-06
updated: 2026-11-06
---
# Status — Realistic Lighting & Materials

## Summary
Frontend-only visual upgrade: move the CubeClicker scene from stylized flat materials to realistic PBR lighting/materials (better shadows, ambient occlusion, tone mapping, bloom) while keeping game rules, state, networking, and persistence untouched.

## Task board
- [x] T1 Post-processing pipeline module
- [x] T2 Renderer tone mapping, soft shadows, realistic renderer wiring
- [x] T3 Scene shadow quality upgrade [P]
- [x] T4 PBR material upgrade (cube + spaceship) [P]
- [x] T5 Verify & integrate
- [x] T6 Fix AC-3 test evidence + scene cast cleanup

## Loop log
- 2026-11-06 — created → PLANNING
- 2026-11-06 — planning → spec_review (r1)
- 2026-11-06 — spec_review → planning — review r1 changes_requested
- 2026-11-06 — planning → spec_review (r2) — revised
- 2026-11-06 — spec_review → awaiting_approval — review r2 approved
- 2026-11-06 — awaiting_approval → building — user approved
- 2026-11-06 — building → code_review (r1) — all tasks [x]
- 2026-11-06 — code_review → building — review r1 changes_requested (F1 MAJOR, F2 MINOR)
- 2026-11-06 — building → code_review (r2) — T6 fixes applied
- 2026-11-06 — code_review → accepted — review r2 approved (0 blocking); documentation pass complete (build-log-docs.md); feature index row applied

## Blockers / open questions
- none








