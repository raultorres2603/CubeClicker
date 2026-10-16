---
feature: project-glossary
revision: 1
status: draft
created: 2026-10-16
updated: 2026-10-16
---
# Spec — Project Glossary

## Summary

Create the canonical glossary of CubeClicker domain terminology at `docs/product/glossary.md` so that all agents and docs use consistent terms. The glossary defines exactly eight terms — `cube`, `click`, `points`, `upgrade`, `idle progress`, `offline progress`, `save`, `prestige` — each with a short definition (at most 2 sentences / 40 words) and one example sentence (at most 25 words), and the whole file stays under the total size caps in AC-12. The file opens with a usage note making the terms canonical for docs and agents. `docs/product/vision.md` gains exactly one line linking to the glossary (decision D-6; baseline captured in `plan.md`). This is a documentation-only feature: no source code, tests, build config, or dependencies; no stack-dependent decisions were identified (stack is NOT DECIDED, and nothing here needs it).

## Scope

### In scope

- **Target file (explicit):** `docs/product/glossary.md` (new file, authored during `building`).
- **Exactly eight term entries** as listed in AC-5. The request's umbrella item "idle/offline progress" is resolved into **two separate entries** — `idle progress` and `offline progress` — each cross-referencing the other (decision D-1 in `plan.md`): the two describe different concepts (in-session passive accrual vs. progress credited for time away), and they must be disambiguated rather than merged.
- **Entry shape:** term as heading, then a definition and one example sentence (template pinned in `plan.md` § Interfaces / contracts).
- **Concision:** per-entry and total caps (AC-10 … AC-12); counting rule stated in Testing strategy.
- **Discovery link:** one additive line in `docs/product/vision.md` pointing to the glossary (AC-13).
- **Consistency rule:** the glossary itself carries the usage note that docs/agents should use these terms as defined (AC-3, AC-4), and editors update the glossary in the same change that introduces a new term or meaning.

### Explicitly out of scope (term coverage)

- Any term **not** in the list of eight — including technology/stack terms (e.g., "stack", "bundle"), workflow terms (e.g., "spec gate", "task brief"), UI terms (e.g., "responsive"), and future game-mechanic specifics (formulas, costs, balance numbers).
- Per-feature glossaries and localized (i18n) glossaries.
- Automated terminology linting or CI checks.
- Retrofitting existing docs (beyond the single vision.md link line) to glossary terms.
- New terms or changed meanings beyond this initial set — those require a follow-up feature request that amends this glossary (single central file).

## User stories

- As a spec or doc author (human or agent), I want one canonical list of domain terms so that every document uses the same vocabulary.
- As an agent writing docs or code identifiers, I want concise definitions with an example sentence per term so that I can apply each term correctly without guessing.
- As the product owner, I want ambiguous pairs such as idle vs. offline progress disambiguated in one place so that future feature specs do not drift in wording.

## Acceptance criteria

Verification notes: all criteria are verified **by inspection** (no project commands exist — see Testing strategy). A "term entry" is the block under an H3 heading in the Terms section. "Word" = whitespace-delimited token; "sentence" = run of text ending in `.`, `!`, or `?` (counting rule and slack explained in `plan.md`).

- **AC-1** — `docs/product/glossary.md` exists at that exact path.
- **AC-2** — The file contains exactly one H1 heading (the document title).
- **AC-3** — Between the H1 and the first term entry, the file contains a usage note stating that the listed terms are the canonical CubeClicker terminology.
- **AC-4** — The usage note states that docs and agents should use the terms as defined in this glossary.
- **AC-5** — The file contains exactly the following eight term entries, each as an H3 heading using the listed spelling, and no other term entries: `cube`, `click`, `points`, `upgrade`, `idle progress`, `offline progress`, `save`, `prestige`.
- **AC-6** — The term entries appear in alphabetical order.
- **AC-7** — Every term entry contains both required fields, `Definition:` and `Example:`, and both are populated.
- **AC-8** — Every example sentence uses the term it illustrates (case-insensitive; inflected forms such as "clicking" or "clicks" count as using the term).
- **AC-9** — The `idle progress` and `offline progress` definitions each name the other term so the two concepts are distinguishable.
- **AC-10** — Each definition is at most 2 sentences and at most 40 words.
- **AC-11** — Each example is exactly one sentence and at most 25 words.
- **AC-12** — The glossary file is at most 100 lines and at most 700 words in total.
- **AC-13** — `docs/product/vision.md` contains exactly one added line: a Markdown link whose target is `glossary.md` (relative sibling) and whose visible label references the glossary/terminology; all pre-existing vision.md content is unchanged relative to the baseline captured in `plan.md` § Interfaces / contracts.

## Non-goals

- No source code, tests, build config, dependency, or tooling changes of any kind (documentation-only; stack NOT DECIDED).
- No edits to `AGENTS.md`, `.opencode/**`, `docs/architecture/**`, or docs other than `docs/product/glossary.md` and `docs/product/vision.md`.
- No edits to `docs/product/vision.md` beyond the single additive link line (vision.md is user-owned).
- No glossary entries beyond the eight listed; no per-feature glossaries.
- No game-mechanic specification: definitions are wording-level only (e.g., prestige reset/bonus mechanics remain TBD by a future feature).
- No retrofitting of existing docs to glossary terms (follow-up candidate, open question Q-5).
- No automated glossary linting/CI checks.

## Boundaries

- ✅ Always: keep the glossary to the pinned entry template and caps (`plan.md` § Interfaces / contracts); keep edits additive and non-destructive; record per-AC inspection evidence in the task build logs under `docs/features/project-glossary/`.
- ⚠️ Ask first: adding or removing a term; changing the entry template, the size caps, or the vision link placement; touching any file outside `docs/product/glossary.md`, `docs/product/vision.md`, and the feature's build logs.
- 🚫 Never: edit `src/`, `tests/`, `public/`, `.opencode/`, `AGENTS.md`, `docs/architecture/`; introduce dependencies or tooling; rewrite existing doc content (beyond the single vision.md link line); edit `.env*`; commit secrets.

## Security considerations

- Documentation-only: no user-controlled data, no runtime, no persistence, no client bundle — this feature introduces no security surface.
- No secrets: no credentials, tokens, or keys in definitions or examples.
- No dependency additions; supply-chain surface unchanged.
- The vision.md edit is additive and single-line; the baseline is captured in `plan.md` so reviewers can confirm it is non-destructive.

## Testing strategy

- No automated commands exist (`AGENTS.md` § Commands: TBD; stack NOT DECIDED) → every acceptance criterion is verified by inspection, as required by the Task Brief.
- Evidence: the builder records a per-criterion inspection table (quote/count per AC) in `build-log-T<id>.md`; the reviewer re-verifies independently by inspection. Plain text utilities (e.g., `wc`, `ls`) and `git diff`/`git show` may be cited as aids, but they are not project commands.
- Counting rule (also pinned in `plan.md`): definition/example word caps count the text after the `Definition:`/`Example:` label (labels and headings excluded); the total-file caps count all content. Caps carry slack so minor counting differences cannot flip a verdict.
- Edge cases addressed by construction: word/sentence counting ambiguity (rule + slack), multiword term ordering (`idle progress` between `cube` and `offline progress` alphabetically), relative link resolution (`glossary.md` as sibling of `vision.md`), untracked-git baseline (baseline quote embedded in `plan.md`).

## Open questions

- **Q-1 (execution blocker for `building`)** — Builder edit permissions (`.opencode/agents/builder.md`) allow `src/**`, `tests/**`, `public/**`, `docs/features/**/build-log*.md`, and config files but **not `docs/product/**`**; the orchestrator's permissions are narrower still. Who applies the two product-doc edits (widen the builder permission vs. another route)? Must be resolved before the `building` phase or T1/T2 will be permission-blocked.
- **Q-2** — Should `AGENTS.md` (or `.opencode/` prompts) also link the glossary so every future agent session discovers it? Out of scope here; recommended follow-up.
- **Q-3** — The request said "e.g."; this spec freezes the term set at the eight listed for scope control. Confirm no additional terms are required now.
- **Q-4** — Confirm that one additive link line in the user-owned `vision.md` is acceptable (alternative: leave vision.md untouched).
- **Q-5** — Should existing docs (vision.md body, `docs/features/README.md`) be retrofitted to glossary terms in a later feature?
- **Q-6** — Stack-dependent decisions: none identified for this feature (docs-only). No commands are available for verification until the stack lands, so all ACs use inspection.

## Assumptions

- The eight terms (with the idle/offline split per D-1) are the complete v1 set; the request's "e.g." list is treated as authoritative for this feature.
- The glossary is a single central Markdown file; amendments flow through feature requests, consistent with vision.md's "updates flow through feature requests".
- `prestige` is defined at the standard clicker-genre concept level (a voluntary reset of run progress in exchange for a lasting advancement); no mechanics are pinned because no feature spec defines them yet.
- Word = whitespace-delimited token; sentence = text ending in `.`, `!`, or `?`; caps hold under either counting convention (slack documented in `plan.md`).
- The vision.md edit is acceptable and non-destructive (single added line, baseline captured).
- No frontmatter in `glossary.md` (matches `docs/product/vision.md`, which has none).

## Revision history

- r1 — 2026-10-16 — initial draft
