---
feature: upgrades-panel-bottom-right
phase: spec
iteration: 1
verdict: approved
blocking: 0
nonblocking: 2
---

# Spec Review — r1

## Summary

✅ approved — spec/plan/tasks are consistent, testable, and scoped correctly: single-rule CSS guard (no duplicate-rule ambiguity), production scope correctly excludes test files, and all five ACs are mapped across T1–T4. Two non-blocking clarifications on the UpgradesPanel.test.tsx assertion form and narrow-viewport width.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | spec.md § Testing strategy (Integration tier) and AC-2 | `UpgradesPanel.test.tsx` currently has no section-markup assertion, so "update expected markup … to include `class="upgrades-panel"`" requires the builder to *add* one rather than edit an existing golden string. The spec fixes the attribute order but not the concrete expected string, leaving room for a weak/incomplete check at build time (e.g., a bare `toContain('class="upgrades-panel"')` that wouldn't lock the section). | Pin the concrete expected section string in the testing strategy (e.g., `expect(html).toContain('<section aria-label="Upgrades" class="upgrades-panel" data-mode="account">')`, with the mode variant for the guest case) so the added assertion is concrete and matches the `customization-panel` attribute order. | open |
| F2 | INFO | spec.md § Non-goals / Open questions (Q-3) | The repositioned panel has no `max-width`/clamp constraint, so on very narrow viewports a wide upgrade list could overflow or collide with the phase announcement; the spec flags overlap as a known limitation (Q-3) but not width. The sibling `customization-panel` rule already uses `max-width: min(22rem, calc(100vw - 2rem))` as a precedent. | Either note in Q-3 that a `max-width` may be added without spec revision (mirroring `customization-panel`), or leave as-is per the non-goal (no responsive-breakpoint rework). No code change required. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | User ask ("put it on Right side bottom corner") covered by AC-1–AC-3; non-goals explicit (no content/costs/behavior changes). |
| Testability | ✅ | AC-1 pins exact CSS values; AC-2 pins class + location; AC-3 pins insets; AC-4 names commands; AC-5 pins file scope. Minor ambiguity on the UpgradesPanel.test.tsx assertion form (F1). |
| Boundaries | ✅ | Three tiers present; non-goals listed. |
| Dependency graph | ✅ | T1→T2→T3→T4 acyclic; every AC mapped (AC-1..AC-5); tasks single-session sized. |
| Parallel safety | ✅ | No `[P]` tasks; `files_owned` disjoint across T1–T3. |
| Security | ✅ | CSS/markup only; no user-controlled data, persistence, secrets, or dependencies. |
| Testing | ✅ | Unit (CSS guard) + integration (SSR) tiers; `npm run coverage` thresholds ≥ 80% named; assertion bar stated; no exclusions added. |
| Consistency | ✅ | Aligns with metallic-hud-frame conventions and the spaceship-customization-layout-fix safe-area inset pattern; no `AGENTS.md` contradiction. |
| Real-time | ✅ | Explicitly out of scope (no shared/cross-client state, connection lifecycle, reconnection, or server authority touched). |
| Containers | ✅ | Explicitly out of scope (no services, images, ports, env vars, compose/Dockerfile/server.ts changes). |

## Previous round verification (if iteration > 1)

n/a — first round.

## Notes / backlog (non-blocking)

- Verified there is no pre-existing `.upgrades-panel` rule in `app.css` (grep clean), so the plan's "single rule, first-match selects deterministically" claim holds; the previous feature's duplicate-rule dead end (spec-r1 F2) is avoided.
- Specificity claim (class 0,1,0 beats `main > section` 0,0,2) is correct, and `main > section` already declares `position: absolute`, so the override only needs to reset `top`/`left` to `auto` and set `bottom`/`right`. `main` has `position: relative` (app.css:64-65), so absolute offsets resolve against `<main>`.
- The `.upgrades-panel` rule inherits `pointer-events: none` from `main > section` and re-enables clicks on its buttons via the existing `main > section button { pointer-events: auto }` rule, consistent with the customization panel.
- Q-1/Q-2/Q-3 remain documented tunables; acceptable at spec gate. The builder should preserve the single trailing newline when appending the rule (stylesheet-hygiene test).