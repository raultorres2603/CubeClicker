---
feature: metallic-hud-frames-polish
revision: 1
status: draft
created: 2026-10-28
updated: 2026-10-28
---

# Spec — Metallic HUD Frames Polish

## Summary

A frontend-only polish that closes the two non-blocking findings recorded in `docs/features/metallic-hud-frames/reviews/code-r1.md` (F1 MINOR, F2 MINOR) without changing any behaviour, markup, styling beyond a single trailing byte, or container/backend asset: (1) add the missing trailing newline to `src/frontend/src/ui/app.css` (code-r1 F1), and (2) anchor the standard `mask:` / `mask-composite:` lookups in the frame-sheen ordering guard of `src/frontend/src/ui/app.css.test.ts` to declaration starts so the guard validates the standard declarations independently of the `-webkit-mask` / `-webkit-mask-composite` declarations (code-r1 F2). The manual visual verification note from the same review remains a manual, non-automated check and requires no code change. Game rules, server authority, persistence, cross-client state, and all other surfaces are untouched.

## Origin

- Source feature: `metallic-hud-frames` (accepted).
- Source review: `docs/features/metallic-hud-frames/reviews/code-r1.md` — verdict approved, 0 blocking, 2 non-blocking.
- F1 (MINOR) `src/frontend/src/ui/app.css` (EOF): stylesheet ends without a trailing newline.
- F2 (MINOR) `src/frontend/src/ui/app.css.test.ts` (frame sheen "mask-composite declarations follow their shorthands"): `maskIdx` is computed via `body.indexOf('mask: linear-gradient(#000 0 0)')`, which first matches inside the `-webkit-mask:` declaration, so the guard does not strictly verify the standard `mask:`/`mask-composite:` ordering.
- Manual visual check note (same review): remains manual; no code change.

## User stories

- As a maintainer, the stylesheet ends with a single trailing newline consistent with the rest of the repository, so diffs and tooling stay clean.
- As a maintainer, the frame-sheen mask-composite ordering guard anchors the standard `mask:` / `mask-composite:` lookups to declaration starts, so a regression in the standard composite ordering cannot pass by resolving to the `-webkit-*` declarations.
- As a maintainer, no other file, behaviour, or visual output changes, so the accepted metallic-hud-frames contract is preserved.

## Acceptance criteria

Verification notes: **the stylesheet** means `src/frontend/src/ui/app.css`; **the guard** means the "mask-composite declarations follow their shorthands" test in `src/frontend/src/ui/app.css.test.ts`. Evidence per AC is a named test file, a command, or a `git diff` output. All tests use concrete expected values (no wildcard matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), `npm test`, `npm run coverage` (final gate), `npm run build`.

- **AC-1 — Trailing newline.** `src/frontend/src/ui/app.css` ends with exactly one `\n`: the final byte is `0x0A` and the penultimate byte is not `0x0A`. The stylesheet's content is otherwise byte-identical to its predecessor (only the EOF newline is added). Evidence: a guard in `app.css.test.ts` asserting `css.endsWith('\n')` and `!css.endsWith('\n\n')`, plus `git diff` showing only the EOF newline.

- **AC-2 — Mask guard anchored to declaration starts.** In `app.css.test.ts`, the "mask-composite declarations follow their shorthands" test no longer derives `maskIdx` from `body.indexOf('mask: linear-gradient(#000 0 0)')`. Instead, both standard lookups use declaration-start anchors (e.g. `body.search(/^\s*mask:/m)` and `body.search(/^\s*mask-composite:/m)`, or an equivalent line-anchored lookup) so neither can resolve to the `-webkit-mask` / `-webkit-mask-composite` declarations. The `-webkit-*` lookups are likewise anchored to their own declaration starts. The test still passes against the unchanged stylesheet, and the existing ordering assertions (`webkitCompIdx > webkitMaskIdx` and `compIdx > maskIdx`) remain. Evidence: `app.css.test.ts`.

- **AC-3 — No other files changed.** With `BASE` recorded as `$(git merge-base main HEAD)` (or the fork point recorded before the first feature commit), only `src/frontend/src/ui/app.css` and `src/frontend/src/ui/app.css.test.ts` differ: `git diff --exit-code "$BASE"...HEAD -- <protected paths>` exits 0 and `test -z "$(git status --porcelain -- <protected paths>)"` succeeds, where `<protected paths>` = `src/frontend/src/App.tsx`, `src/frontend/src/ui/Hud.tsx`, `src/frontend/src/ui/UserPanel.tsx`, `src/frontend/src/ui/AuthMenu.tsx`, `src/frontend/src/ui/AuthForms.tsx`, `src/frontend/src/ui/ConnectionBanner.tsx`, `src/frontend/src/ui/VerificationPending.tsx`, `src/frontend/src/ui/VerifyEmail.tsx`, `src/frontend/src/ui/theme.ts`, `src/frontend/src/ui/theme.test.ts`, `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, `src/frontend/Dockerfile`, and `**/Dockerfile`. Evidence: final build log naming `BASE` and pasting both command outputs.

- **AC-4 — Full verification suite passes.** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, and `npm run build` all exit 0, with `npm run coverage` reporting ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend`). Evidence: final build log.

## Non-goals

- No change to game rules, stats, intents, phase sequencing, level progression, server protocol, or persistence.
- No React markup or component change: no class/attribute additions, no new wrappers, no JSX edits.
- No change to `theme.ts` constants or the contrast gate; `theme.test.ts` is unchanged.
- No new dependencies, textures, image assets, shaders, fonts, or audio.
- No browser automation, pixel/perceptual snapshot tests, or visual regression tooling.
- No layout, responsive, or motion change; the reduced-motion, responsive, scanline, blink, and minimize rules are untouched.
- No change to the backend, containers, compose files, Dockerfiles, or configuration.
- No framing, restyling, or re-styling of any surface beyond the EOF newline and the test anchor.
- No edit to any predecessor spec, plan, or task file.
- The manual visual verification (beveled metal frame, cyan glow, sheen not clipped by `overflow: hidden`, legible centers, hover/focus/disabled, reduced-motion) remains a manual, non-automated check performed at code review; no code change addresses it.

## Boundaries

- ✅ Always: keep the change inside `src/frontend/src/ui/app.css` and `src/frontend/src/ui/app.css.test.ts`; preserve every existing guard and assertion; keep the pinned theme colours and contrast gate; run lint, typecheck, tests, and the coverage command before reporting done; stage only `files_owned` per task.
- ⚠️ Ask first: any change to a file outside the two owned files; any change to `theme.ts` or `theme.test.ts`; any JSX/class/markup change; any reformatting of `app.css` beyond the EOF newline; any coverage exclusion or threshold change; any new dependency.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, or configs; use `!important`; rewrite a predecessor spec; push.

## Security considerations

- **No new dependencies.** CSS and test-source edits only; lockfile untouched.
- **No user data, storage, or network.** No change to behaviour; visuals remain client-local.
- **Test integrity.** The anchored guard tightens (not weakens) the existing contract; the coverage bar and concrete-assertion rule protect unchanged logic.

## Real-time impact

**None.** This is a client-local presentation/test change: no shared value is created or read, no protocol message is added, and connection lifecycle, reconnection, multi-client behaviour, and server authority are unaffected. The connection banner is not restyled. No identity/account behaviour is touched.

## Containerization impact

**None.** No new services, images, ports, environment variables, health signals, or compose/Dockerfile changes. The frontend image absorbs no diff beyond the trailing byte through the existing Vite build; the containerized smoke test (`npm run smoke`) is unchanged and remains the regression check at the final gate where the environment allows it. AC-3 pins the container-file diff gate. Container conventions in `docs/architecture/containerization.md` are untouched.

## Testing strategy

- **Unit (Vitest, `node` environment):** `app.css.test.ts` keeps all existing guards unchanged except the anchored mask-composite ordering test (AC-2) and gains a small trailing-newline guard (AC-1). `theme.test.ts` is unchanged.
- **Integration (React SSR string rendering in the `node` environment):** `Hud.test.tsx`, `UserPanel.test.tsx`, `AuthMenu.test.tsx`, `AuthForms.test.tsx`, `ConnectionBanner.test.tsx`, `VerificationPending.test.tsx`, and `App.test.tsx` must keep passing unmodified.
- **Diff gates (AC-3):** the build log records `BASE` (the `main` merge-base or the pre-first-commit fork point) and pastes the output of both protected-path checks.
- **Manual visual verification (not automated):** unchanged from the predecessor — performed at code review with `podman compose up`. Pixel/perceptual tests are a non-goal.
- **E2E / container:** no change; `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged.

## Open questions

- **Q-1 — Anchor form.** The anchor may be expressed as `body.search(/^\s*mask:/m)` or an equivalent declaration-start match (e.g. a regex with a leading newline or word boundary). Either satisfies AC-2; the reviewer checks that the standard lookup cannot resolve to `-webkit-mask:`.
- **Q-2 — Trailing-newline guard placement.** The guard may live in any `describe` block in `app.css.test.ts`; a dedicated small `describe('stylesheet hygiene', ...)` block is the default. Either satisfies AC-1.

## Assumptions

- The only intended change to `app.css` is the single trailing `\n`; no reformatting, reordering, or whitespace change elsewhere (AC-1).
- The predecessor stylesheet already ends without a trailing newline (code-r1 F1); appending one byte is the entire edit.
- The anchored guard must keep passing against the unchanged stylesheet; if it fails, the anchor is wrong, not the CSS.
- Stack unchanged: TypeScript strict, Vitest, ESLint; the project testing bar governs.
- Predecessor specs/plans/tasks stay authoritative; this spec never edits them.

## Revision history

- r1 — 2026-10-28 — initial draft (planning phase).