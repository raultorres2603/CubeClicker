# Build log — T10 — Activity feed and leaderboard markup

Task: T10 (2026-11-16), feature `game-feel-overhaul`, branch `feat/game-feel-overhaul` at `07dd9fb`.
Files changed: `src/frontend/src/ui/ActivityFeed.tsx`, `src/frontend/src/ui/ActivityFeed.test.tsx`,
`src/frontend/src/ui/Leaderboard.tsx`, `src/frontend/src/ui/Leaderboard.test.tsx`,
`docs/features/game-feel-overhaul/build-log-T10.md`.

## Plan (sketch, written before implementing)

1. `ActivityFeed`: one `aria-hidden` `<span class="gf-live-dot" data-live-dot="true" />` as the first child of the `h2`; nothing else changes.
2. `Leaderboard`: the same dot in the `h2`, plus one `aria-hidden` medal span (first row child) and one `aria-hidden` bar span (last row child) carrying `data-medal`/`data-bar` = rank.
3. Tests: update the pinned SSR markup and add dedicated AC-22/AC-23/AC-29/AC-31 assertions (one dot; one medal and one bar per row; exact rank values; heading/label retention).

## What changed & why

- `ActivityFeed.tsx`: the title gained exactly one decorative live dot, the only DOM change.
  The landmark, `aria-live="off"`, the five-event slice, the newest-first order, `data-event-type`,
  the text, `data-reduced-motion` and the 160 ms CSS hook are unchanged.
- `Leaderboard.tsx`: the title gained the same dot; each row gained one medal span (before the
  rank text) and one bar span (after the score, so the flex-wrapped bar owns the second line).
  `data-rank`/`data-player-id`, the `#N` rank text, the pluralized score, the totals, the
  top-five slice, the server wire order and `aria-live="off"`/`data-reduced-motion` are unchanged.
- Both decorative spans are `aria-hidden="true"` and carry `data-live-dot="true"`,
  `data-medal="<rank>"`, `data-bar="<rank>"` — the exact hooks T7's `game-view.css` keys on.
- No new pure logic, no re-sort, no timestamp, no control: the unit tier is unchanged (the
  existing `activityText`/`formatActivitySeconds`/`pluralize`/`leaderboardEntryText`/
  `leaderboardTotalsText` tests still cover the pure helpers); the SSR component render is the
  integration tier and is extended below.

## Exact DOM/data evidence (React SSR output)

Activity feed title (from `ActivityFeed.test.tsx`, exact string):

```html
<h2 class="activity-feed-title"><span class="gf-live-dot" data-live-dot="true" aria-hidden="true"></span>Server activity</h2>
```

Leaderboard title and first row (from `Leaderboard.test.tsx`, exact strings):

```html
<h2 class="leaderboard-title"><span class="gf-live-dot" data-live-dot="true" aria-hidden="true"></span>Leaderboard</h2>
<li data-rank="1" data-player-id="p2"><span class="leaderboard-medal" data-medal="1" aria-hidden="true"></span><span class="leaderboard-rank">#1</span><span class="leaderboard-name">Player 2</span><span class="leaderboard-score">2 cubes · 40 clicks</span><span class="leaderboard-bar" data-bar="1" aria-hidden="true"></span></li>
```

- `ActivityFeed.test.tsx` pins: exactly one `gf-live-dot`, one `data-live-dot="true"`, the
  unchanged `<h2 class="activity-feed-title">`, the unchanged `aria-label="Server activity"`,
  and (pre-existing tests, still green) the five-newest cap, newest-first order, exact sentences,
  empty render (`''`) and `aria-live="off"` with no `role="status"`/`alert`/`log`, no
  `<button>`/`<a>`/`tabindex`.
- `Leaderboard.test.tsx` pins: `data-medal`/`data-bar` exactly `1…5` on a five-row snapshot,
  exactly five medals and five bars, the live dot count of one, the h2 class, the landmark label,
  and the row child order (medal → rank → name → score → bar). Pre-existing tests still pin the
  three-row exact markup, `#N`/name/score text, the six-entry → five-row cap (`data-rank` 1…5,
  no sixth player), the wire order preserved, guests/accounts rendering identically, and the
  absence of `<time>`, the `at` value, coins, live regions and focusable controls.
- Reduced motion: both roots still render `data-reduced-motion="true|false"` exactly as before.

## Decisions

- **D-1 — Dot inside the `h2`, medal first and bar last.** T7's `.gf-live-dot` is an
  `inline-block` child with a right margin, and `.leaderboard li` is `display: flex;
  flex-wrap: wrap` with the bar at a fixed percentage width, so the dot belongs inside the
  title and the bar must be the last flex child (it wraps under the row). The medal leads
  the row as the rank marker. No CSS change is needed or made.
- **D-2 — Verification isolation.** The T9 builder is editing its own files in the shared
  working tree concurrently, so all T10 gates were run in a detached worktree at `07dd9fb`
  containing only T10's files (`/tmp/opencode/t10-verify`, throwaway). This keeps T9's
  in-flight red test files out of T10's evidence.
- **D-3 — T8-owned stale App assertions.** `src/App.test.tsx` contains two pre-existing
  exact-markup integration assertions for the feed/leaderboard markup and is owned by T8
  (`tasks.md` T8 `files_owned`; spec-review r2a confirms "T8 alone owns `App.test.tsx`").
  T10's required markup change invalidates those two strings. T10 does not edit the file;
  see § Out-of-scope residual below.

## Evidence

`npm run lint` (worktree `/tmp/opencode/t10-verify`, only T10 files changed):

```
> lint
> eslint .
```
exit 0.

`npm run typecheck` (same worktree):

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```
exit 0.

`npm test --workspace @cubeclicker/frontend` (same worktree, T10 files only):

```
 FAIL  src/App.test.tsx > App — server activity ticker (AC-19…AC-21) > renders the ticker in the welcomed shell and keeps one live region (AC-19, AC-20)
 FAIL  src/App.test.tsx > App — server leaderboard (AC-20, AC-21) > renders the populated panel beside the ticker in the welcomed shell and keeps one live region (AC-20, AC-21)
 Test Files  1 failed | 76 passed (77)
      Tests  2 failed | 2363 passed (2365)
```

The two failures are exactly the T8-owned stale strings in `App.test.tsx`
(`<h2 class="activity-feed-title">Server activity</h2>` at line 872 and the pre-dot medal-free
`<aside class="leaderboard" …>` block at lines 955-972); no T10-owned test fails.

Post-commit T10-scoped run (main tree, feature branch):

```
 ✓ src/ui/ActivityFeed.test.tsx (8 tests) 10ms
 ✓ src/ui/Leaderboard.test.tsx (10 tests) 13ms

 Test Files  2 passed (2)
      Tests  18 passed (18)
```

**Verification-only reconciliation proof** (throwaway worktree only; the two stale strings were
replaced with the new exact markup, nothing else — not part of the commit, main tree untouched):

```
 ✓ src/App.test.tsx (50 tests) 1881ms
 Test Files  77 passed (77)
      Tests  2365 passed (2365)
```

`npm run coverage --workspace @cubeclicker/frontend` (same worktree with the verification-only
reconciliation, so the coverage gate is observable):

```
All files          |   96.74 |    96.44 |    97.86 |   96.74 |
 src/ui            |   97.16 |    95.11 |    95.78 |   97.16 |
  ActivityFeed.tsx |     100 |      100 |     100 |     100 |
  Leaderboard.tsx  |     100 |      100 |     100 |     100 |
 Test Files  77 passed (77)
      Tests  2365 passed (2365)
```

All four aggregates are above the pinned ≥ 80 threshold; both T10 modules are 100 % on
statements, branches, functions and lines. No coverage exclusion or threshold change.

`git diff --check` (feature branch, T10 paths):

```
(no output)
```
exit 0.

## Out-of-scope residual (T8-owned, reported, not edited)

`src/App.test.tsx` is outside T10's `files_owned` and still asserts the pre-T10 feed and
leaderboard strings. With T10's committed change and no other edits, the frontend suite is
`1 failed | 76 passed (77)` / `2 failed | 2363 passed (2365)`; the only failures are the two
App-level exact-markup assertions listed above. The file is owned by T8, which runs next and
rewrites its shell/feed/leaderboard integration assertions; T10 leaves it untouched rather
than editing a file the reviewed plan assigns exclusively to T8. Coverage with the
verification-only reconciliation is recorded above.

## Acceptance audit

- **AC-22 — Activity feed chrome → met.** One `aria-hidden` `<span class="gf-live-dot"
  data-live-dot="true" />` inside the title (exact SSR string above; one dot per render); the
  exact text (`Server activity` + the six sentences), the five-entry cap, newest-first order,
  `aria-live="off"`, no live role and `data-reduced-motion` are unchanged (pre-existing tests
  still green). The per-event glyph/colour CSS is T7's `game-view.css` (`data-event-type` hooks
  unchanged); `game-view.css.test.ts` is green.
- **AC-23 — Leaderboard chrome → met.** Each row carries one `aria-hidden`
  `leaderboard-medal` (`data-medal` = rank) and one `aria-hidden` `leaderboard-bar`
  (`data-bar` = rank); the title carries the same dot; the `#N`, name and exact score text,
  the top-five cap, the server order, the totals text and `data-reduced-motion` are unchanged
  (exact-markup, cap and no-re-sort tests still green). The gold/silver/bronze/cyan channels
  and 100/80/64/50/40 % bar widths are T7 CSS keyed on `data-rank`.
- **AC-29 — Typography and headings → met (component evidence).** Both titles remain real
  `<h2>` elements with the pinned classes (`activity-feed-title`, `leaderboard-title`), their
  exact text and the landmarks' `aria-label`s; the T6 `app.css` block owns the declarations and
  is unchanged. New assertions pin the h2 class/text/label evidence.
- **AC-31 — Accessibility → met (T10 scope).** All three new spans are `aria-hidden="true"`;
  no control, focus target or live region is added (the feed/leaderboard tests still assert
  no `role="status"`/`alert`/`log`, no `<button>`/`<a>`/`tabindex`, and `aria-live="off"`),
  so `.phase-announcement` remains the shell's only polite region. No colour-only information:
  rank text `#N` and score text remain readable.

## Deviations from spec

- None in the shipped markup/behaviour. The only residual is the T8-owned stale
  `App.test.tsx` assertions described above; T10 did not edit them (plan ownership).
