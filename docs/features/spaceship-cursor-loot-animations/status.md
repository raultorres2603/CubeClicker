---
feature: spaceship-cursor-loot-animations
state: spec_review
spec_review_round: 1
build_round: 0
created: 2026-11-08
updated: 2026-11-08
---
# Status — Pointer ship, granular loot parts, satisfying animations

## Summary
Three-part enhancement: (1) replace the default pointer-following spaceship with a simple but realistic model; (2) make lootbox customization parts highly specific (one wing at a time, cabin, ignitions, etc.) instead of whole sets; (3) add fluent, satisfying animations inspired by the user's reference video. Request: "Now, it looks better. What about changing default spaceship that is following our pointer? Is super simple, I would like one that looks more realistic, something simple, but realistic. Also, the parts we gain by openning lootboxes must be very specific and detailed, so: gaining 1 wing instead of all wings in ones, cabine, ignitions, etc... Also, I would like to have this animations on game: /home/raultorraco/Downloads/gemini_generated_video_6c10d7c9.mp4 ... Proceed with this feature."

## Task board
- [ ] T1 — Backend granular catalog + legacy normalization `[P]`
- [ ] T2 — Migration 006 + schema mirror `[P]`
- [ ] T3 — Backend protocol v2 `[P]`
- [ ] T4 — Economy repository v2 `[seq]`
- [ ] T5 — Hub v2 open/equip `[seq]`
- [ ] T6 — Backend real-app integration `[P]`
- [ ] T7 — Frontend catalog + params `[P]`
- [ ] T8 — Motion tokens/easings `[P]`
- [ ] T9 — Ship motion math `[P]`
- [ ] T10 — Cursor ship model factory `[P]`
- [ ] T11 — Cursor spaceship integration `[seq]`
- [ ] T12 — Instant conceal + impact effects `[P]`
- [ ] T13 — Scene targeting/impact/level `[seq]`
- [ ] T14 — Frontend types/guest engine `[P]`
- [ ] T15 — Frontend protocol mirror `[P]`
- [ ] T16 — Session integration `[seq]`
- [ ] T17 — Live preview `[P]`
- [ ] T18 — Customization panel v2 `[P]`
- [ ] T19 — Styles/motion CSS `[P]`
- [ ] T20 — Coin pop/upgrade pulse/banner `[P]`
- [ ] T21 — App wiring `[seq]`
- [ ] T22 — Documentation pass `[seq]`
- [ ] T23 — Verify & integrate `[seq]`

## Loop log
- 2026-11-08 — created → PLANNING — request: pointer ship realism + granular lootbox parts + reference-video animations
- 2026-11-08 — reference video decoded (10 s, 24 fps) and analyzed; observed/extrapolated motion folded into spec r2 — video-analysis.md / reference/
- 2026-11-08 — planning → SPEC_REVIEW — package complete (51 ACs, 23 tasks); spec review round 1 — spec.md

## Blockers / open questions
- Reference video must be inspected by the planner (frame extraction); if tooling is unavailable, it will be reported.
- Lootbox part granularity changes shared/server-authoritative customization data; migration/protocol/economy questions must be surfaced.
