---
feature: futuristic-hud-blue
phase: spec
iteration: 1
verdict: changes_requested
blocking: 4
nonblocking: 5
---

# Spec Review — r1

## Summary

❌ **changes requested** — The spec, plan and tasks are complete in scope (futuristic blue HUD, minimize fix, scanline, reduced motion, responsive, coverage), frontend-only, with an acyclic dependency graph (T1 → T2) and disjoint file ownership. However, four acceptance criteria leave implementation-critical CSS details unspecified in ways that will produce wrong or unverifiable work at the code gate: AC-6 permits `::before` for the scanline even though `::before` is already occupied by the border-light animation (AC-8); AC-2/3/4/5/11 refer to "the `main > section` rule" / a single media block while the stylesheet has multiple such blocks, so a grep guard cannot bind deterministically; AC-2's `overflow: hidden` conflicts with the retained border-light `::before` (inset `-1px`) with no reconciliation stated; and AC-7 does not name the scanline pseudo-element under reduced motion. Required actions under F1–F4.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | spec.md § Acceptance criteria (AC-6); plan.md § CSS contract | AC-6 allows the scanline on `main > section::after` **or** `main > section::before`. But `::before` is already the border-light carrier (AC-8: `border-light-travel` applied to `main > section`, implemented via `main > section::before` with its own `animation`). Putting `hud-scanline` on the same pseudo-element would overwrite the border-light animation and silently break AC-8; the two cannot coexist on one pseudo without a combined shorthand that AC-6 does not describe. | Amend AC-6 to pin the scanline to `main > section::after` only (drop the `::before` alternative), and add `main > section::after` to the reduced-motion selector list in AC-7 (see F4). State that `::before` remains the border-light carrier. | open |
| F2 | MAJOR | spec.md § Acceptance criteria (AC-2, AC-3, AC-4, AC-5, AC-11); plan.md § Border light & HUD blink CSS | The ACs speak of "the `main > section` rule" / "a `@media (max-width: 480px)` block" in the singular, but `app.css` already contains two `main > section` rule blocks (base layout, lines 67–82, and overlay motion, lines 531–533) plus a minimized-state block (line 544), and two `@media (max-width: 480px)`-adjacent contexts (the auth block at line 507). A non-greedy guard such as `/main > section[^{]*\{[\s\S]*?…/` binds to the first block and will miss tokens added to a later block (or vice versa); AC-5's "on the section rule" is additionally confusable with the adjacent `main > section[data-minimized="true"] p` collapse rule. Left as-is this is a guaranteed mismatch point at the code gate (cf. predecessor F3). | Pin the canonical, greppable form: (a) AC-2 tokens must all live in the existing base `main > section` rule (lines 67–82) as one consolidated rule, not a new block; (b) AC-3/AC-4 tokens live in the existing `main > section button` rule (line 535) and a new `main > section button:focus-visible` rule respectively; (c) AC-5's dim (`opacity:` or `filter: brightness(`) lives in a rule whose selector is exactly `main > section[data-minimized="true"]` (no trailing ` p`/pseudo), anchored with `\{` immediately after optional whitespace; (d) AC-11's `main > section` adjustment is added inside the existing `@media (max-width: 480px)` block (line 507), not a second 480px block, and guards scan all 480px blocks. | open |
| F3 | MAJOR | spec.md § Acceptance criteria (AC-2, AC-8); plan.md § Risks & mitigations | AC-2 requires `overflow: hidden` on `main > section`, but the retained border light (AC-8) is drawn by `main > section::before` with `inset: -1px` (a 1px ring outside the panel). `overflow: hidden` on the parent clips that outer ring, so the border light can disappear while both AC-2 and AC-8 grep guards still pass — a silent visual regression of a stated retention requirement. The spec never states how the two ACs coexist. | Amend AC-2/AC-8 to state the reconciliation: either keep `overflow: hidden` and adjust the border-light `::before` to `inset: 0` (ring inside the padding box), or move the border light to a non-clipped layer; pin which pseudo-element owns which effect (F1) and add a guard that the border-light `animation:` is still present on `::before`. | open |
| F4 | MAJOR | spec.md § Acceptance criteria (AC-7); plan.md § Key decisions D-4 | AC-7 says animations/transitions are disabled "for `main > section` and its pseudo-elements" under reduced motion, but the evidence bar only requires the media block to contain `main > section` and `animation: none`. The current block (app.css lines 611–626) lists `main > section::before` but, per F1, the scanline will live on `::after`, which is **not** in the list — so the scanline keeps animating under `prefers-reduced-motion: reduce`, violating the user story (AC-7's reduced-motion promise) and the accessibility intent. | Amend AC-7 to require the reduced-motion selector list to include `main > section`, `main > section::before`, and `main > section::after` (plus `main > section button`, the minimized `p`, and the blink selector), each with `animation: none` and `transition: none`; update the evidence note to require `main > section::after` and `animation: none` in the media block. | open |
| F5 | MINOR | spec.md § Summary | The summary promises a "panel layering" fix ("fixes the currently broken/undersized minimize button and panel layering"), but no acceptance criterion verifies stacking/z-index, so the claim is unverifiable at the code gate and cannot be checked by a hidden guard. | Either add a testable AC (e.g. `main > section { z-index: … }` above the canvas, or pseudo-elements pinned with `pointer-events: none` + `z-index`), or reword the summary to describe layering as an implementation detail covered by AC-2/AC-6. | open |
| F6 | MINOR | spec.md § Acceptance criteria (AC-3) | AC-3 accepts either `1.5rem` or `24px` for the minimize button size ("at least `1.5rem` (or `24px`)"). A hidden guard must convert units to compare "at least"; if it does not, a builder choosing `1.5rem` (or `24px`) can fail depending on the guard's parser, and there is no single canonical value to assert against. | Pin one canonical unit in AC-3 (recommend `min-width: 1.5rem; min-height: 1.5rem;` and state the guard converts `rem` at a 16px base, or accept `24px` only), and state the comparison rule explicitly. | open |
| F7 | MINOR | spec.md § Acceptance criteria (AC-2, AC-6); plan.md § Risks & mitigations | The plan mentions mitigating pseudo-element layering with `pointer-events: none` and `z-index` ordering, but neither AC-2 nor AC-6 pins `pointer-events: none` on the pseudo-elements or a `z-index` ordering, so the scanline/border-light layers can sit above HUD text and obscure it with no failing test. | Add a clause to AC-2/AC-6 requiring `pointer-events: none` on `main > section::before`/`::after` (and a `z-index` below the text) so detailing cannot capture pointer input or obscure stats. | open |
| F8 | INFO | tasks.md; status.md | T1 owns a 626-line stylesheet plus its guard test in one session and T2 is verification-only; status.md's task board is still "(none yet)" despite tasks.md defining T1/T2. No artifact change required, but the board should be populated before building and T1 may be split if the builder reports overload. | Populate the status task board from tasks.md before T1 starts; optionally split T1 into "CSS restyle" and "guard tests" if the session runs long. | open |
| F9 | INFO | spec.md § Open questions (Q-5) | The request bundles a visual redesign with a minimize-control fix; the spec already acknowledges the split option and gates it on user approval. No artifact change required — recorded for the approval checkpoint. | Confirm scope (one feature vs. split into `hud-visual-redesign` + `hud-minimize-fix`) at `awaiting_approval`. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ❌ | All asks are covered by AC-1…AC-13 or non-goals except the summary's "panel layering" claim, which has no AC (F5). Q-1 (reference layout) is acknowledged as an open question. |
| Testability | ❌ | F1, F2, F4: AC-6's pseudo-element alternative, AC-2/3/4/5/11's singular rule/block references, and AC-7's reduced-motion pseudo list are not pinned enough for a deterministic guard. |
| Boundaries | ✅ | Three tiers present and specific; non-goals listed (game rules, markup, deps, backend/container, theme constants). |
| Dependency graph | ✅ | Acyclic: T1 → T2. Every AC mapped (AC-2..9, AC-11 → T1; AC-1, AC-10, AC-12, AC-13 → T2). Tasks sized to one builder session. |
| Parallel safety | ✅ | No `[P]` tasks; both sequential. `files_owned` disjoint by construction (T2 owns none). |
| Security | ✅ | No new dependencies, no user data/storage/network, CSS-only detailing, no `innerHTML`/assets. |
| Testing | ✅ | Unit + integration tiers defined; commands from `AGENTS.md` named; `npm run coverage` with ≥ 80% all four metrics per workspace named; concrete-assertion and no-useless-tests bars referenced; edge cases (reduced motion, responsive) named. |
| Consistency | ❌ | AC-2 (`overflow: hidden`) conflicts with the retained border light (AC-8, `::before` inset `-1px`) with no stated reconciliation (F3); otherwise aligns with predecessor specs and `AGENTS.md`. |
| Real-time | ✅ | No shared/cross-client state created or read; no protocol message added; connection lifecycle, reconnection, multi-client and server authority unaffected. Local-only reduced-motion handling. |
| Containers | ✅ | Frontend source/CSS only; no services/images/ports/config; AC-12 pins the container-file diff gate. |

## Previous round verification

N/A — iteration 1.

## Notes / backlog (non-blocking)

- F1's `::after` choice also requires the scanline pseudo to be added to the reduced-motion selector list (F4) so it cannot animate under `prefers-reduced-motion: reduce`.
- F3's reconciliation should be verified visually at the code gate; the grep guards alone will not catch a clipped border light.
- The documentation pass on acceptance should confirm `README.md` and `docs/features/README.md` need no change beyond the orchestrator-owned row update (plan.md § Documentation impact already states none expected for CSS-only).
- F2's guard-anchoring guidance (F2 item c) should be reflected in the builder's `app.css.test.ts` additions so the new guards bind to the intended rule blocks.