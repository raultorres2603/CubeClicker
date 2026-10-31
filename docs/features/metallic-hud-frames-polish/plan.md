---
feature: metallic-hud-frames-polish
revision: 1
---

# Plan — Metallic HUD Frames Polish

## Architecture

Two-file, byte-minimal change. No modules, data flow, or state ownership is involved: `src/frontend/src/ui/app.css` gains a single trailing newline, and `src/frontend/src/ui/app.css.test.ts` has its frame-sheen mask-composite ordering guard re-anchored plus a small trailing-newline guard. No React markup, theme, backend, or container asset is touched. The accepted metallic-hud-frames contract (selectors, tokens, geometry, motion) is preserved verbatim.

## Interfaces / contracts

- **Trailing newline (AC-1):** append one `\n` to the end of `app.css` if (and only if) it is missing; the file's final bytes become `}\n`. No other byte changes.
- **Mask guard anchor (AC-2):** in `app.css.test.ts`, the "mask-composite declarations follow their shorthands" test computes indices with declaration-start anchors:
  - `webkitMaskIdx = body.search(/^\s*-webkit-mask:/m)` (or equivalent)
  - `webkitCompIdx = body.search(/^\s*-webkit-mask-composite:/m)` (or equivalent)
  - `maskIdx = body.search(/^\s*mask:/m)` (or equivalent)
  - `compIdx = body.search(/^\s*mask-composite:/m)` (or equivalent)
  
  The anchors ensure `mask:` / `mask-composite:` cannot resolve to the `-webkit-mask` / `-webkit-mask-composite` declarations (which contain the substrings `mask:` and `mask-composite:`). The ordering assertions `webkitCompIdx > webkitMaskIdx` and `compIdx > maskIdx` remain, so the guard now truly validates that each composite declaration follows its own shorthand.
- **Trailing-newline guard (AC-1):** add to `app.css.test.ts`:
  ```
  expect(css.endsWith('\n')).toBe(true);
  expect(css.endsWith('\n\n')).toBe(false);
  ```
  Placement is flexible (Q-2); default a dedicated `describe('stylesheet hygiene', ...)` block.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/ui/app.css` | Edit | Append single trailing newline (AC-1). |
| `src/frontend/src/ui/app.css.test.ts` | Edit | Anchor mask/composite lookups (AC-2); add trailing-newline guard (AC-1). |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Append the newline with an edit that adds only `\n` at EOF (no reformat). | AC-1 requires byte-identical content except the newline; any reformat risks spurious diff and guard breakage. | Rewrite the file — rejected: invites accidental changes. |
| 2 | Use `RegExp.prototype.search` with `/m` anchors (`/^\s*mask:/m`) rather than `indexOf`. | Anchoring to declaration starts is exactly what code-r1 F2 asks for; `indexOf` substring matches inside `-webkit-mask:`. | Keep `indexOf` but search for `'\n  mask:'` — rejected: fragile to indentation changes. |
| 3 | Add a trailing-newline guard test. | Makes AC-1 self-verifying and prevents regression; cheap, concrete assertion. | Rely on `git diff` only — rejected: not an automated gate. |
| 4 | Anchor the `-webkit-*` lookups too, even though F2 only names the standard ones. | Consistency and a stronger guard; trivial cost. | Leave `-webkit-*` on `indexOf` — acceptable but weaker; rejected for uniformity. |

## Risks & mitigations

- **Risk:** the EOF edit accidentally reformats or reorders `app.css`. **Mitigation:** the edit is append-only (`\n`); verify with `git diff` that only the "No newline at end of file" marker disappears and no other line changes (AC-1, AC-3).
- **Risk:** the anchored regex fails to match because of unexpected indentation, breaking the guard. **Mitigation:** run the frontend test suite immediately; the guard must still pass against the unchanged stylesheet (assumption). If it fails, fix the anchor, not the CSS.
- **Risk:** accidental edit to a protected file. **Mitigation:** `files_owned` is limited to the two files; T2 verifies both BASE-pinned diff gates (AC-3).
- **Risk:** coverage drops below 80% due to test edits. **Mitigation:** changes are tiny and additive; run `npm run coverage --workspace @cubeclicker/frontend` as the pre-gate.

## Open questions

- **Q-1 — Anchor form:** `body.search(/^\s*mask:/m)` or an equivalent declaration-start match (AC-2). Either is acceptable; the reviewer checks that the standard lookup cannot resolve to `-webkit-mask:`.
- **Q-2 — Guard placement:** the trailing-newline guard may live in any `describe` block; default a dedicated `describe('stylesheet hygiene', ...)` block (AC-1).

## Documentation impact

- No `README.md`, `docs/architecture/**`, or `docs/product/**` change is required: no command, port, image, configuration, term, or architecture change.
- `docs/features/README.md` is orchestrator-owned: the builder proposes the smallest row update for `metallic-hud-frames-polish` (title, state, last-updated) on acceptance but does not edit the index (see `docs/architecture/documentation.md` § Ownership).
- No predecessor spec/plan/task file is edited.