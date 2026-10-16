---
feature: project-glossary
revision: 1
---
# Plan — Project Glossary

## Architecture

No runtime architecture — this is a static documentation change, stack-agnostic, with no code, data flow, dependencies, or persisted state. The "documentary architecture" is:

- `docs/product/glossary.md` (new) — single source of truth for domain terminology: an H1 title, an intro usage note (canonical + prefer-as-defined rule), then a `## Terms` section with eight H3 entries in alphabetical order.
- `docs/product/vision.md` (edit, +1 line) — discovery link so readers of the north-star document find the glossary.
- **Consumers:** all agents and docs. The usage rule lives in the glossary, and amendment happens through feature requests (consistent with vision.md's "updates flow through feature requests").
- **Consistency policy:** terms are used as defined here; when a new term or changed meaning is needed, the glossary is amended in the same change (same feature). Synonymous wording in prose should yield to the glossary term (e.g., the canonical action is "click", the canonical resource is "points").

## Interfaces / contracts

### Entry template (pinned)

```markdown
# CubeClicker — Glossary

<intro usage note: 1–3 sentences — canonical terms; docs/agents use them as defined; amendments accompany meaning changes>

## Terms

### click

**Definition:** <1–2 sentences, ≤ 40 words>
**Example:** <exactly 1 sentence, ≤ 25 words>

### cube

**Definition:** …
**Example:** …

… (remaining terms, alphabetical: idle progress, offline progress, points, prestige, save, upgrade)
```

Rules: exactly one H1; exactly the eight H3 term entries (spelling lowercase as listed); entries separated by blank lines; each entry has exactly the two labeled fields `**Definition:**` and `**Example:**`; alphabetical order; no frontmatter.

### Counting rule (for AC-10 … AC-12)

- Words = whitespace-delimited tokens. Sentences = runs of text ending in `.`, `!`, or `?`.
- Definition/example caps count the text **after** the label (labels/headings excluded); the total-file caps count **all** content.
- Slack check: worst case ≈ 8 × (40 + 25) plus headings/labels/intro ≈ 610 words < 700; either counting convention passes. Builders should avoid abbreviations (e.g., "e.g.") inside entries to keep sentence counts unambiguous.

### Required terms — semantic anchors (wording-level; no mechanics)

| Term | What the definition must convey |
| --- | --- |
| cube | The central interactive game object; the thing the player clicks; namesake of CubeClicker. |
| click | The player's primary action on the cube that earns points; also the discrete event itself. Canonical word — prefer it over "tap"/"press". |
| points | The core resource earned by clicking and spent on upgrades. Canonical word — prefer it over informal currency synonyms. |
| upgrade | A purchasable improvement (bought with points) that increases earning rate. |
| idle progress | Progress that accrues without active clicking **while the game is open** (player present, not clicking); distinct from offline progress; the definition stays wording-level — earning mechanics are defined by the future feature that implements them. |
| offline progress | Progress credited for time the player was **away** (game not running), delivered on return; this is the mechanic behind vision.md's "idle-friendly" principle; distinct from idle progress. |
| save | The persisted game state, and the act of persisting it (one entry may cover both senses); relates to vision.md's "Persistence" principle. |
| prestige | The standard clicker-genre concept: a voluntary reset of run progress in exchange for a lasting advancement; reset/bonus mechanics remain TBD by a future feature. |

The `idle progress` and `offline progress` definitions must each name the other term (AC-9) to prevent conflation.

### Intro usage-note contract

The intro (between H1 and `## Terms`) must state: (a) these are the canonical CubeClicker terms, and (b) docs and agents should use them as defined in this glossary rather than informal synonyms. It may additionally note that new terms/changed meanings require an amendment to this file.

### Vision link contract

- Exactly **one added line** in `docs/product/vision.md`, immediately after the opening blockquote (line 3), e.g.:
  `> **Terminology:** canonical domain terms are defined in [glossary.md](glossary.md).`
- The Markdown link target is the relative sibling `glossary.md`; the visible label references the glossary/terminology.
- No other vision.md change of any kind.

**Baseline — `docs/product/vision.md` (verbatim, captured 2026-10-16).** The repository's only commit (`cba610b`, "Initial commit") contains just `.gitattributes` and `LICENSE`; all project files — including `docs/` — are untracked, so there is no committed baseline. Reviewers compare against this quote:

```markdown
# CubeClicker — Product Vision

> Living document. The user owns the vision; agents read it as the north star. Updates flow through feature requests.

## One-liner

A web-based clicker game built and maintained by an AI-native development team.

## Core loop

Click a cube → earn points → spend points on upgrades → earn faster → repeat. (Details will be refined by the first product-spec feature.)

## Principles

- **Instant fun:** playable within seconds of loading; no friction, no accounts required.
- **Idle-friendly:** progress accrues while away (offline progress), so returning players feel rewarded.
- **Persistence:** safe local saves with versioned migration; corrupted saves never crash the game.
- **Accessible & responsive:** keyboard operable, mobile-friendly, respects reduced motion.
- **Performance:** 60 fps interactions, small bundle, instant load.

## Status

Product details are intentionally high-level. The stack-selection task and the first feature (core click loop) will flesh these out through the agent workflow.
```

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `docs/product/glossary.md` | New | Canonical glossary: intro usage note + eight term entries | T1 |
| `docs/features/project-glossary/build-log-T1.md` | New | T1 per-AC inspection evidence | T1 |
| `docs/product/vision.md` | Edit (+1 line) | Discovery link to the glossary | T2 |
| `docs/features/project-glossary/build-log-T2.md` | New | T2 evidence (baseline comparison) | T2 |
| `docs/features/project-glossary/build-log-T3.md` | New | T3 full-verification evidence table | T3 |

Planner artifacts (`spec.md`, `plan.md`, `tasks.md` in this directory) and review verdicts (`reviews/**`) are written per the workflow by the planner/reviewer, not by build tasks.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | `idle progress` and `offline progress` are **two entries**, cross-referenced | The request's umbrella grouping hides two distinct concepts (in-session passive accrual vs. progress for time away); vision.md itself separates the "idle-friendly" principle from "offline progress"; future specs need distinguishable terms; cross-referencing prevents drift | One umbrella entry — rejected: conflates concepts future features must distinguish |
| D-2 | Freeze the term set at exactly the eight requested | "e.g." is ambiguous; a fixed list prevents invented scope and unverifiable coverage; additions go through follow-up amendments | Open-ended "add obvious terms" — rejected: scope invention, review noise |
| D-3 | Pinned entry template: H3 term + `**Definition:**` + `**Example:**` | Consistent, concise, and mechanically checkable; the example sentence proves real usage | Prose paragraphs or tables — rejected: inconsistent, harder to verify |
| D-4 | Lowercase canonical spellings; plural `points` | Terms read as used mid-sentence; headings declare the canonical form | Title Case headings — rejected: implies a different canonical form than prose usage |
| D-5 | Alphabetical entry order | Lookup-friendly for a reference doc; binary-verifiable | Request order — rejected: arbitrary for lookup |
| D-6 | Add one link line to `vision.md` | Discoverability from the north-star doc agents already read; minimal and additive; traceable to the request's "all agents and docs use consistent terms" | No link (weak discovery); referencing from `AGENTS.md` — deferred to Q-2 (pipeline config; ask-first) |
| D-7 | Usage/consistency rule lives in the glossary intro | Keeps the feature confined to `docs/product/`; the rule travels with the artifact | `AGENTS.md` conventions edit — rejected for this feature (shared config), noted as Q-2 |
| D-8 | Concision caps: definition ≤ 2 sentences / ≤ 40 words; example = 1 sentence / ≤ 25 words; file ≤ 100 lines / ≤ 700 words | Makes "concise" measurable and verifiable; caps carry slack so either counting convention passes | Looser caps — rejected: not verifiable; tighter — rejected: brittle |

## Risks & mitigations

- **Builder permissions exclude `docs/product/**`** (`.opencode/agents/builder.md` allows only `src/**`, `tests/**`, `public/**`, `docs/features/**/build-log*.md`, and config files) → the build cannot proceed as briefed; the orchestrator must widen the permission or re-route the two doc edits before `building`. Tracked as Q-1 (execution blocker).
- **Term drift later** (docs use synonyms) → usage rule in the intro + vision link; retrofit follow-up tracked as Q-5.
- **vision.md is user-owned** → single additive line; baseline captured above; decision D-6 flagged as Q-4 for the approval checkpoint.
- **"idle progress" semantics may not match future mechanics** → definitions kept wording-level with mechanics explicitly deferred; both entries cross-referenced so they are amended together in one file.
- **Counting brittleness** (words/sentences) → counting rule stated; caps have slack; avoid abbreviations inside entries.
- **No commands for verification** → inspection checklist per AC plus per-task build logs; reviewer re-inspects; `git diff`/`git show` available as supporting evidence only.
- **Untracked git baseline** → vision.md has no committed pre-change revision; AC-13 verification uses the verbatim baseline quote above. If the repo is committed before building, the committed content becomes the baseline.

## Open questions

- **Q-1 (execution blocker)** — Who applies the `docs/product/**` edits given current agent permissions (widen `.opencode/agents/builder.md` vs. another route)? Must be answered before `building`.
- **Q-2** — Should `AGENTS.md` / `.opencode/` prompts link the glossary for universal agent discovery? (Out of scope here.)
- **Q-3** — Confirm the frozen eight-term set (request said "e.g.").
- **Q-4** — Confirm the single additive link line in user-owned `vision.md` is acceptable.
- **Q-5** — Retrofit existing docs to glossary terms later?
- **Q-6** — None stack-dependent: this feature needs no framework, runtime, or tooling; verification stays inspection-only until the stack lands.
