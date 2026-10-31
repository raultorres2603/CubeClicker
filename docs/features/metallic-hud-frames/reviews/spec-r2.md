---
feature: metallic-hud-frames
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 3
---

# Spec Review — r2

## Summary

✅ **approved** — r2 closes both r1 blocking findings (F1 sheen geometry moved inside the padding box at `inset: 0` with `overflow: hidden` retained; F2 well declarations merged into the single existing input rule with an exact-count guard) and all ten r1 non-blocking findings (F3–F12). Acceptance criteria are now binary-testable, the dependency graph and parallel-safety plan are unchanged and sound, and no new contradictions were introduced. Only three informational hygiene items remain; none blocks building.

Reviewed: `spec.md` (r2), `plan.md` (r2), `tasks.md` (r2), `status.md`, `AGENTS.md`, `docs/architecture/stack.md`, predecessor specs (`futuristic-hud-blue`, `modern-ui-background-life`), and the current `app.css` / `app.css.test.ts` / `theme.test.ts`.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | INFO | `status.md` frontmatter | Duplicate `spec_review_round` key (`2` then `1`) — invalid YAML duplicate, last value wins depending on parser. | Remove the stale `spec_review_round: 1` line; keep `spec_review_round: 2`. | open |
| F2 | INFO | `spec.md` § AC-15 | Reduced-motion selector list names `.auth-input` (single) but not `.verification-pending input`, which shares the merged input rule. The verification-pending field has no animation/transition of its own, so behaviour is unaffected, but the list is asymmetric next to the rest of the spec. | Either add `.verification-pending input` to the AC-15 list (and write it as a separate reduced-motion selector so the AC-7 exact-count guard is not triggered), or record in the spec that the input well carries no motion and is intentionally omitted. | open |
| F3 | INFO | `spec.md` § AC-6 | The inset-accent requirement is pinned to a rule "whose selector is `.auth-button-primary`", but the plan implements it as a combined `.auth-button-primary, .verification-pending button` rule. A guard written to AC-6's literal wording (exact single-selector match) would fail against the combined rule. | Clarify whether the guard should match a rule whose selector list *contains* `.auth-button-primary`, or split the inset-accent declarations into a standalone `.auth-button-primary` rule. Either is acceptable; pick one and make the guard match. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every requested surface group (six panels, four controls, two input wells) is covered by an AC or an explicit non-goal/Q-2/Q-9 exclusion; Q-1 records the unreadable reference image. |
| Testability | ✅ | r1 F1/F2/F3/F5 closed; each AC is binary and evidence-able; r2 added AC-21/AC-22/AC-23 plus the `inset: -2px` rejection and mask-ordering guards. |
| Boundaries | ✅ | Always / Ask first / Never present; non-goals listed; no new dependencies. |
| Dependency graph | ✅ | T1 → T2, acyclic; dependencies point at earlier tasks; all ACs mapped (T1: AC-1..AC-17, AC-21..AC-23; T2: AC-18..AC-20); T2 is verification-only. |
| Parallel safety | ✅ | No `[P]` tasks; `files_owned` disjoint; T2 owns no files. |
| Security | ✅ | CSS and test-source edits only; no dependencies, user data, storage, network, external assets, or `innerHTML`. |
| Testing | ✅ | Unit + integration (SSR string rendering in the node environment) + manual visual + container smoke; `npm run coverage` with ≥ 80% per workspace; concrete assertions; edge cases named (F4/F6/F7 closed). |
| Consistency | ✅ | Aligns with vision; reuses existing selectors; no contradiction with `AGENTS.md`; predecessor supersession references corrected (F9). |
| Risks | ✅ | r1 F1 (overflow/sheen clip) now the largest documented risk with geometry pinned and manual check added; mask-degradation and state-rule erasure risks documented. |
| Real-time | ✅ | None: client-local presentation only; connection banner restyled without changing lifecycle, reconnection, multi-client behaviour, or server authority. |
| Containers | ✅ | None: no new services, images, ports, config, or compose/Dockerfile changes; AC-19 pins the diff gate; frontend image absorbs the CSS. |

## Previous round verification (iteration > 1)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) MAJOR — sheen clipped by retained `overflow: hidden` | fixed | `spec.md` § AC-9 now pins `inset: 0`, rejects `inset: -2px`, and explains the padding-edge geometry; plan § Interfaces/contracts and § D-11 updated; manual visual check includes the HUD sheen. |
| F2 (r1) MAJOR — AC-7 single-rule contradicts plan's second input rule | fixed | `spec.md` § AC-7 now requires exactly one rule with that selector list, merged; plan § Inset wells and § D-12 updated; guard-file mapping adds the exact-count guard. |
| F3 (r1) MINOR — weak `git diff` evidence gates | fixed | `spec.md` § AC-18/AC-19 and tasks T1/T2 verify now pin `BASE=$(git merge-base main HEAD)` plus `test -z "$(git status --porcelain -- <paths>)"`; build log must name `BASE`. |
| F4 (r1) MINOR — `.verification-pending button` missing from reduced motion | fixed | `spec.md` § AC-15 list now includes `.verification-pending button`; plan § State rules/risk updated. |
| F5 (r1) MINOR — missing `mask`/`-webkit-mask` layer contract | fixed | `spec.md` § AC-9 now pins both layer declarations and their composite ordering (composite after its own shorthand; standard `mask:` matched at declaration start). |
| F6 (r1) MINOR — unpinned `.auth-error` alert overrides | fixed | New `spec.md` § AC-21 pins `--frame-center`, `--frame-glow`, `color: #ffb4b4;` and forbids frame-erasing declarations. |
| F7 (r1) MINOR — unpinned disabled states | fixed | New `spec.md` § AC-23 pins opacity/cursor/colour on both disabled rules and forbids `background`; theme contrast gate added. |
| F8 (r1) INFO — input scope wording | fixed | `spec.md` Summary and Q-2 now name `.auth-input` and `.verification-pending input` consistently. |
| F9 (r1) INFO — supersession reference `AC-3/AC-5` | fixed | `spec.md` § Superseded predecessor criteria now names AC-3 (plus AC-4/AC-9). |
| F10 (r1) INFO — verification-route rationale | fixed | `spec.md` § Non-goals and Q-2 now state a scope/design decision, not a markup limitation. |
| F11 (r1) INFO — jsdom reference in testing tier | fixed | `spec.md` § Testing strategy now says "React SSR string rendering in the `node` environment" with no jsdom. |
| F12 (r1) INFO — alert/well/disabled contrast gaps | fixed | New `spec.md` § AC-22 adds computed contrast gates for the alert centre, `#ffb4b4` error text, the input well, and the `0.62`-alpha disabled text. |

## Notes / backlog (non-blocking)

- F1–F3 above are informational and do not block building; they can be folded into the build or a later revision without changing any acceptance criterion.
- The T1 scope remains large but is the only way to keep `files_owned` disjoint; the plan's escalation note (do not split `app.css` mid-task) stands.
- `app.css.test.ts` rewrite must keep the two extraction updates for grouped selectors (`main > section::before` no longer ends with `{`) and keep asserting `pointer-events: none` and "no `hud-scanline` on `::before`".
- Predecessor index rows remain historical records; no documentation edit is required beyond the orchestrator-owned `docs/features/README.md` row at acceptance.