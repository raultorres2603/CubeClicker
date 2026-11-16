---
feature: game-feel-overhaul
phase: spec_review
round: 2
iteration: 2a
verdict: approved
reviewed: 2026-11-16
blocking: 0
nonblocking: 1
---
# Spec Review — r2a (targeted verification)

## Summary

✅ **Approved — 0 blocking, 1 non-blocking.** The two r2 MAJORs are correctly fixed in the r3 text: AC-21's 720 px reveal override now preserves all three safe-area offsets and pins `z-index: 20` (AC-27/AC-30, plan, T7 and the boundary matrix agree), and the App-level AC-2/AC-11/AC-13 assertions are owned by T8 (`App.test.tsx`) with T4/T5 explicitly scoped to session/panel tests. All eight r2 MINORs are applied. No drift: revisions are r3, the r2a response/revision history is present, AC-1…AC-38 are unchanged, the DAG/`[P]` batches/`files_owned` are intact, and no stale scrim/`drop-shadow`/`role=status`/`data-reveal-active`-on-`<main>`/16.7 ms-interval claim remains. The spec is ready for the user checkpoint with the Q-1…Q-18 defaults.

## Verification table

| Item | Severity | Status | Evidence |
| --- | --- | --- | --- |
| MAJOR 1 — mobile reveal override | MAJOR | ✅ Fixed | `spec.md` AC-21 (line 171) pins `left/right: calc(1rem + env(safe-area-inset-left/right, 0px))`, `bottom: calc(5rem + env(safe-area-inset-bottom, 0px))`, `z-index: 20`; AC-27 (line 177) says reveal 20 on both desktop and mobile; AC-30 (line 180) repeats the safe-area offsets and z-index; `plan.md:76,87`, `tasks.md` T7 (line 79) and the 720/721 boundary matrix (`plan.md:340`) agree. No accepted safe-area offset is discarded; the desktop rule keeps `right/bottom: auto`, 34 rem max-width and `z-index: 20`. |
| MAJOR 2 — App-test ownership | MAJOR | ✅ Fixed | `tasks.md` T8 (line 85) acceptance now lists AC-2/AC-11/AC-13, and T8 notes (line 87) own grant/no-grant, mid-reveal status and toggle-click close on `App.test.tsx`; T4 notes (line 55) are session-level and T5 notes (line 63) panel-level; only T8's `files_owned` contains `App.test.tsx`; DAG and `[P]` batches unchanged. |
| r2 F3 — `reference-image-game-view` AC-2 | MINOR | ✅ Fixed | `spec.md:278` adds AC-2: corner placements and 720 px band values retained; the "unchanged `app.css` / only 720 position declarations" file-state clause superseded by the restyle and the 721/720 reveal rule. |
| r2 F4 — deferred customization live region | MINOR | ✅ Fixed | `spec.md` AC-31 (line 181) scopes the exactly-one polite region to the **settled** shell and explicitly exempts the deferred customization panel's `Loading customization…` `role="status"`/error `role="alert"`; `plan.md:99` and T8 notes (line 87) match. |
| r2 F5 — 24 px HUD minimize | MINOR | ✅ Fixed | `spec.md:14,153,169,181` and `tasks.md` T6/T8 notes state the existing `1.5rem` (24 px) minimize is retained and is not a new 44 px control; the per-surface "44 px" claim is removed. |
| r2 F6 — one context wording | MINOR | ✅ Fixed | `spec.md` AC-15 (line 93) says exactly one **reveal/panel** context in addition to the main scene; `spec.md:218` (security bounds) and `plan.md:53,273,294` use the same wording. |
| r2 F7 — T11 protected-frontend status | MINOR | ✅ Fixed | `tasks.md` T11 verify (line 108) adds `test -z "$(git status --porcelain -- <protected render/engine/multiplayer/main/auth paths>)"`, matching the backend/package status gate. |
| r2 F8 — AC-29 ownership | MINOR | ✅ Fixed | `spec.md` AC-29 (line 179) states T6's `app.css` owns the whole typography block and `game-view.css` does not duplicate it; T6 notes (line 71) record it; T9/T10 acceptance (lines 93/101) include AC-29 for the component title classes. |
| r2 F9 — fallback `data-slot` | MINOR | ✅ Fixed | `spec.md` AC-10 (line 88) pins the fallback `data-slot` to the catalog-derived slot for a valid part; an invalid part renders the AC-7 card with `data-slot=""` and no fallback; T3 notes (line 47) cover it. |
| r2 F10 — pre-welcome labels | MINOR | ✅ Fixed | `spec.md` AC-19 (line 169) pins `Clicks:`, `Faces destroyed:` and `Cube` with their `data-stat` hooks; T8 notes (line 87) have `App.test.tsx` assert the labels. |
| Residual — shared AC acceptance overlap | MINOR | ⚠ Non-blocking | T4's acceptance still lists AC-2/AC-11 and T5's still lists AC-13, even though the App-level evidence is T8. The notes explicitly scope T4/T5 to session/panel evidence, so this is not an ownership conflict; for clarity, annotate the T4/T5 acceptance entries as "session evidence" / "panel evidence" (or leave the shared AC list and rely on the T8 ownership note). |

## Drift check

- `spec.md` and `plan.md` are revision 3; `spec.md` has the r2a response table and r3 revision-history entry; `status.md` records the r2 review, escalation, user authorization and r2a planning step.
- AC numbering is stable: AC-1…AC-38 are present once each (with cross-references and predecessor AC-41/AC-48 references); no AC was removed, added or renumbered.
- `tasks.md` DAG is unchanged (T1 → T2/T4 → T3/T5 → T6 → T7 → T8/T9/T10 → T11); the only `[P]` batches are T2∥T4 and T9∥T10; `files_owned` are exclusive; T8 alone owns `App.test.tsx`.
- No stale contradictory claims found: no scrim/`data-reveal-active` on `<main>`, no `role="status"` reveal, no `filter`/outer shadow on the clipped panel, no 16.7 ms rAF-interval metric, no "only 720 position declarations" claim, no HUD 44 px minimize claim. T11's verify command is shell-valid (quoted `git diff`/`git status`/`grep`/`test -z` with `$BASE` recorded).
- Bundle/coverage/container contracts are unchanged: 150,000 / 165,000 / 300,000 B gzip, ≥80% per workspace, no compose/Dockerfile/`/ws` change.

## Verdict

**`approved`** — the two r2 MAJORs and all eight r2 MINORs are correctly fixed; the single residual is a non-blocking acceptance-annotation clarification. The spec is ready for the user checkpoint with the Q-1…Q-18 defaults.
