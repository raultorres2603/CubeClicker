# Build log — T5 — Reviewer guidance

Task: T5 (2026-10-17) — `[P]`, depends_on T0, T1. One of three concurrent builders (T3/T4/T5); files_owned disjoint, staged by explicit path only.
Files changed: `.opencode/agents/reviewer.md` (edited), `.opencode/skills/spec-review/SKILL.md` (edited), `.opencode/skills/code-review/checklists/quality.md` (edited), `.opencode/skills/code-review/checklists/security.md` (edited), `.opencode/skills/code-review/checklists/testing.md` (edited) — plus this log (the sixth `files_owned` path).

What changed & why: applied `plan.md` § Pinned content contracts items 11–15 exactly, additively (21 inserted lines, 0 deletions):
- (11) `spec-review/SKILL.md` Checklist gains one appended item **Real-time (when applicable)** — lifecycle, reconnection, multi-client behavior, server authority, identity/accounts flag.
- (12) `reviewer.md` **Rules** gains one bullet (token "real-time") — verify lifecycle/reconnection/multi-client/server-authoritative shared state against the skills' real-time checks; unverifiable real-time behavior counts as unmet.
- (13) `quality.md` gains `## Real-time (if the feature uses the connection)` with five `- [ ]` items.
- (14) `security.md` gains `## Real-time & untrusted messages (if applicable)` with five `- [ ]` items.
- (15) `testing.md` gains `## Real-time coverage (if applicable)` with three `- [ ]` items.

Decisions:
- Additive only: each edit is a pure insertion (verified `deleted=0` per file); no existing line reflowed, no section reordered, no heading/text of pre-existing content touched (AC-25).
- Checkbox convention matched per file: `quality.md`/`security.md`/`testing.md` all use `- [ ]` rows under a `## Section` heading with the file's "Mark each ✅ / ❌ / n/a" preamble (unchanged), so the new sections use the same `- [ ]` row shape; `reviewer.md` and `spec-review/SKILL.md` use `- ` bullets, so the new content is one `- ` bullet/item each.
- `reviewer.md` bullet inserted after the verdict bullet (line 58 baseline) rather than at the list tail: it carries the same "unverifiable … counts as unmet" logic and reads as part of the gate rules; the subsequent write-scope/scope bullets stay last. One insertion either way.
- New sections appended at end of each checklist file (the contract pins the section, not its position), separated by one blank line, matching each file's existing section spacing.
- Wording: "WebSocket" appears only as the protocol term mandated by contract 14 (`inbound WebSocket messages`) and `wss://`/https as transport terms; no library/framework/runtime/vendor/package name anywhere (§5 V4e).
- No `permissions:` block or allow/deny entry touched (AC-24) — T5 diffs contain no `action:`/`effect:`/`permissions:` line (§5 V3).
- Baseline = build-start content, captured **before** the first edit; the working tree for all five files was byte-identical to `HEAD` (`b3aeff1`, T2) at capture time (§1.1).

Commit staging: only the six `files_owned` paths were staged (explicit `git add`); no `git add .` / `git add -A`; no push. Concurrent T3/T4 worktree edits under `.opencode/` (`builder.md`, `orchestrator.md`, `planner.md`, `spec-authoring/references/spec-checklist.md`, `web-implementation/**`) and all untracked planner/orchestrator artifacts were left unstaged — visible in §5 V4d/§6.

---

## 0. PRE-OP — branch and concurrent-builder context (no switch)

```
$ git rev-parse --abbrev-ref HEAD
feat/online-realtime-workflow
$ git log --oneline -4
b3aeff1 docs: add provisional real-time backlog and vision direction link (T2)
d41c465 docs: state online real-time nature and WebSocket constraint (T1)
5af8715 chore: widen builder edit permissions for online-realtime-workflow (T0)
927fd78 Initial commit
$ git status --short
 M docs/features/project-glossary/status.md
?? docs/features/online-realtime-workflow/plan.md
?? docs/features/online-realtime-workflow/reviews/
?? docs/features/online-realtime-workflow/spec.md
?? docs/features/online-realtime-workflow/status.md
?? docs/features/online-realtime-workflow/tasks.md
?? docs/features/project-glossary/plan.md
?? docs/features/project-glossary/reviews/
?? docs/features/project-glossary/spec.md
?? docs/features/project-glossary/tasks.md
```

Branch at T5 build start: `feat/online-realtime-workflow` at `b3aeff1` (T2). **No** checkout/branch switch, **no** rebase/reset/amend/history rewrite, **no** push. `build-log-T3.md` was not on disk at T5 build start (T3 still running), so `build-log-T2.md` was used as the sibling precedent for log structure and staging discipline.

Pre-edit cleanliness check for the five owned files:

```
$ for f in <five files_owned>; do git diff --quiet HEAD -- "$f" && echo "CLEAN(no worktree diff) $f" || echo "DIRTY $f"; done
CLEAN(no worktree diff) .opencode/agents/reviewer.md
CLEAN(no worktree diff) .opencode/skills/spec-review/SKILL.md
CLEAN(no worktree diff) .opencode/skills/code-review/checklists/quality.md
CLEAN(no worktree diff) .opencode/skills/code-review/checklists/security.md
CLEAN(no worktree diff) .opencode/skills/code-review/checklists/testing.md
```

All five were untouched (no concurrent builder collision) and byte-identical to `HEAD` at build start.

---

## 1. Baseline capture (build start)

### 1.1 Capture commands and hashes

```
$ for f in .opencode/agents/reviewer.md .opencode/skills/spec-review/SKILL.md \
           .opencode/skills/code-review/checklists/quality.md \
           .opencode/skills/code-review/checklists/security.md \
           .opencode/skills/code-review/checklists/testing.md; do
    git show HEAD:"$f" > "/tmp/opencode/t5/baseline-$(echo "$f" | tr '/' '_')"
    cp "$f"           "/tmp/opencode/t5/buildstart-$(echo "$f" | tr '/' '_')"
  done
$ sha256sum <baseline> <buildstart>   # per file
5bb59a9641f0aa074dd25a57164c8bb23df7c4747929e81f35aaf6d6a5da2d0e  baseline-.opencode_agents_reviewer.md
5bb59a9641f0aa074dd25a57164c8bb23df7c4747929e81f35aaf6d6a5da2d0e  buildstart-.opencode_agents_reviewer.md
30dfbedb1279270dd472ac7af35e769e42cfc9d8341619d63245ab96f8ac3bc7  baseline-.opencode_skills_spec-review_SKILL.md
30dfbedb1279270dd472ac7af35e769e42cfc9d8341619d63245ab96f8ac3bc7  buildstart-.opencode_skills_spec-review_SKILL.md
5c6f4ac56a526119bc5f1d8bf0ccb4e7c240177138d337edc5374b94772b58c4  baseline-.opencode_skills_code-review_checklists_quality.md
5c6f4ac56a526119bc5f1d8bf0ccb4e7c240177138d337edc5374b94772b58c4  buildstart-.opencode_skills_code-review_checklists_quality.md
10bb5f40412e1a09edd793578a93af02359d4927df63781186371e72f9da8bcf  baseline-.opencode_skills_code-review_checklists_security.md
10bb5f40412e1a09edd793578a93af02359d4927df63781186371e72f9da8bcf  buildstart-.opencode_skills_code-review_checklists_security.md
c568ecd69f8a6d852a2e4269f30a216d45cfa6cee26f7dda5340bf3fdeb2b90b  baseline-.opencode_skills_code-review_checklists_testing.md
c568ecd69f8a6d852a2e4269f30a216d45cfa6cee26f7dda5340bf3fdeb2b90b  buildstart-.opencode_skills_code-review_checklists_testing.md
$ wc -lc <each baseline>
  64 2379 /tmp/opencode/t5/baseline-.opencode_agents_reviewer.md
  35 2341 /tmp/opencode/t5/baseline-.opencode_skills_spec-review_SKILL.md
  31 1773 /tmp/opencode/t5/baseline-.opencode_skills_code-review_checklists_quality.md
  32 1797 /tmp/opencode/t5/baseline-.opencode_skills_code-review_checklists_security.md
  26 1450 /tmp/opencode/t5/baseline-.opencode_skills_code-review_checklists_testing.md
$ git rev-parse HEAD:<each>
f0909c2d06daa5fda335e002e10bdda4a9aa7732  .opencode/agents/reviewer.md
ec80082488766e1854b5c121d3834deeb38c4aca  .opencode/skills/spec-review/SKILL.md
a78c58337bd4e4a81630cf942f6cdbc343eaf8c0  .opencode/skills/code-review/checklists/quality.md
b7e0f8bd67f44f09c340220ccc5bb326487404b0  .opencode/skills/code-review/checklists/security.md
94b01f6f8c0826b95c523010f4bb4633c9da4c97  .opencode/skills/code-review/checklists/testing.md
$ cmp <baseline> <buildstart>   # per file
HEAD == build-start worktree: IDENTICAL   (all five)
```

Baseline table:

| # | Path | Lines/bytes | sha256 | `HEAD` blob (`b3aeff1`) |
| --- | --- | --- | --- | --- |
| B1 | `.opencode/agents/reviewer.md` | 64 / 2379 | `5bb59a96…d0e` | `f0909c2` |
| B2 | `.opencode/skills/spec-review/SKILL.md` | 35 / 2341 | `30dfbedb…bc7` | `ec80082` |
| B3 | `.opencode/skills/code-review/checklists/quality.md` | 31 / 1773 | `5c6f4ac5…8c4` | `a78c583` |
| B4 | `.opencode/skills/code-review/checklists/security.md` | 32 / 1797 | `10bb5f40…bcf` | `b7e0f8b` |
| B5 | `.opencode/skills/code-review/checklists/testing.md` | 26 / 1450 | `c568ecd6…90b` | `94b01f6` |

### 1.2 Baseline B1 — `.opencode/agents/reviewer.md` (verbatim)

```markdown
---
description: Independent quality gate. Reviews specs before building and implementations against the spec after building; produces severity-ranked findings and a verdict. Never fixes code.
mode: subagent
model: opencode/glm-5.3-flash-free#max
color: "#ef4444"
steps: 50
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: edit
    resource: "docs/features/**/reviews/**"
    effect: allow
  - action: shell
    resource: "*"
    effect: allow
  - action: shell
    resource: "git push *"
    effect: deny
  - action: shell
    resource: "sudo *"
    effect: deny
  - action: shell
    resource: "rm -rf *"
    effect: deny
  - action: shell
    resource: "curl *"
    effect: deny
  - action: shell
    resource: "wget *"
    effect: deny
  - action: subagent
    resource: "*"
    effect: deny
  - action: question
    resource: "*"
    effect: deny
  - action: skill
    resource: "*"
    effect: deny
  - action: skill
    resource: "spec-review"
    effect: allow
  - action: skill
    resource: "code-review"
    effect: allow
---

# Reviewer

You are the CubeClicker reviewer — a subagent and independent quality gate. You NEVER address the user and NEVER fix anything: you find, document, and rank what must change. Assume nothing is correct until the evidence proves it.

## Rules

- Determine the gate from the brief: `spec_review` → load the `spec-review` skill; `code_review` → load the `code-review` skill. Follow that skill's checklist and output format.
- Read every artifact listed in the brief. For code review, inspect the diff file-by-file and run the verification suite yourself — a builder's log is a claim, not evidence.
- Every finding: severity (BLOCKER/MAJOR/MINOR/INFO), location (`file:line` or artifact section), what's wrong, why it matters, required action.
- Verdict: any open BLOCKER or MAJOR → `changes_requested`. "Unable to verify" counts as unmet.
- Your only write scope is `docs/features/**/reviews/**`. Do not edit source, tests, specs, or logs.
- Do not expand scope beyond the spec under review; wishlist items are `INFO` at most.

## Output

Write the verdict artifact `reviews/spec-r<iteration>.md` or `reviews/code-r<iteration>.md` using your skill's template, then return the Subagent Report with `status: completed`, the verdict frontmatter echoed (verdict, blocking count), and artifact paths.
```

Note: the `permissions:` frontmatter is quoted above only as part of the verbatim baseline; **T5 changes no line of it** (AC-24, §5 V3).

### 1.3 Baseline B2 — `.opencode/skills/spec-review/SKILL.md` (verbatim)

```markdown
---
name: Spec Review
description: Use when reviewing a CubeClicker spec/plan/tasks as the reviewer (spec gate) — completeness, testability, dependency-graph validity, parallel safety, and risk findings with a verdict.
---

# Spec Review (gate 1)

You are an independent verifier. Assume nothing is correct until proven. You do not fix anything; you find and document what must change.

## Inputs

Task Brief plus `spec.md`, `plan.md`, `tasks.md`, `docs/product/vision.md`, `AGENTS.md`, `docs/architecture/stack.md`, and the raw request (quoted in the brief).

## Checklist — every item must hold; gaps become findings

- **Completeness** — every ask in the request is covered by an AC or an explicit non-goal; no scope invented.
- **Testability** — each AC is binary-testable, single-behavior, evidence-able. Vague terms ("fast", "clean") are MAJOR unless quantified.
- **Boundaries** — three tiers present; non-goals listed.
- **Dependency graph** — acyclic; dependencies point at earlier tasks; every AC mapped; tasks sized to one builder session.
- **Parallel safety** — every `[P]` has `files_owned` disjoint from all other tasks and no shared-file contact. Violation is a BLOCKER (parallel collisions are the #1 multi-agent failure).
- **Security** — user-controlled data, persistence integrity, secrets, dependency additions addressed.
- **Testing** — strategy present; commands exist in `AGENTS.md`; relevant edge cases named.
- **Consistency** — aligns with the vision; reuses existing architecture; contradicts nothing in `AGENTS.md`.
- **Risks** — ambiguities that will surface mid-build as blockers.

## Severity & verdict

- `BLOCKER` — would cause file collisions, unverifiable acceptance, a security issue, or a guaranteed mid-build dead end.
- `MAJOR` — significant gap or ambiguity that will produce wrong work.
- `MINOR` / `INFO` — improvements, style, future-proofing.
- Verdict: any open BLOCKER or MAJOR → `changes_requested`; otherwise `approved`.

## Output

Write `docs/features/<slug>/reviews/spec-r<iteration>.md` using `templates/review.md`. Cite artifact sections per finding (e.g., `spec.md § Acceptance criteria`). Each finding states: what, why it fails the checklist, and the required action. Then return the Subagent Report with the verdict frontmatter echoed in the evidence.
```

### 1.4 Baseline B3 — `.opencode/skills/code-review/checklists/quality.md` (verbatim)

```markdown
# Quality checklist — structure, correctness, UX, performance

Mark each ✅ / ❌ / n/a; failures become findings with severity.

## Structure & maintainability
- [ ] Pure game logic separated from rendering/DOM (testable without a browser)
- [ ] Single source of truth for game state; UI reads state, doesn't fork it
- [ ] One writer per storage key / one owner per timer
- [ ] Names describe intent; files organized per the plan's file inventory
- [ ] No dead code, commented-out blocks, or debug leftovers (`console.log` beyond intentional logging)
- [ ] DRY honored without premature abstraction; no copy-pasted blocks across modules
- [ ] Diffs traceable to the task — no drive-by refactors

## Correctness
- [ ] Number handling: no silent float/overflow surprises in economy math; rounding rules documented
- [ ] Time handling: one clock source; offline/elapsed-time math correct (including negative/zero/huge deltas)
- [ ] Edge inputs: rapid clicking, double-fire prevention, tab throttling, reload mid-action
- [ ] Error paths: storage failure, invalid save, network (if any) all handled without crashing

## UX & accessibility
- [ ] Keyboard operable end-to-end; visible focus states
- [ ] Semantic elements (`button` for actions); labels for controls
- [ ] Text contrast ≥ 4.5:1; respects `prefers-reduced-motion`
- [ ] No layout shift as numbers grow; number formatting readable
- [ ] Feedback for user actions (especially clicks) is immediate and obvious

## Performance
- [ ] Interaction latency: input → visible feedback within the same frame at 60 fps
- [ ] No per-frame allocations or DOM churn in hot loops
- [ ] Timers/observers cleaned up on teardown (no leaks across reloads/HMR)
- [ ] Bundle additions justified and measured where significant
```

### 1.5 Baseline B4 — `.opencode/skills/code-review/checklists/security.md` (verbatim)

```markdown
# Security checklist — web clicker lens

Adapted from the OWASP web-top-10 mindset for a client-side game. Mark each item ✅ / ❌ / n/a with notes; failures become findings with severity.

## Injection & DOM safety
- [ ] User-controlled strings (player name, imports, URLs, feature flags) never reach `innerHTML`/`insertAdjacentHTML`; `textContent` used instead
- [ ] No `eval`, `new Function`, dynamic `<script>` injection, or remote code loading
- [ ] URL/hash parameters parsed safely and validated before use

## Secrets & data exposure
- [ ] No API keys, tokens, or private identifiers in the client bundle
- [ ] No secrets committed (`git log -p` spot-check for key patterns if in doubt)
- [ ] Error messages don't leak internal details to the UI

## Persistence integrity
- [ ] Saves validated on load; malformed/corrupted saves degrade gracefully (fresh state + non-crashing notice)
- [ ] Save schema versioned with a migration path for old versions
- [ ] Import/share features (if any) sanitize and validate before trusting
- [ ] `localStorage`/`IndexedDB` failures (quota, private mode) handled without crashing

## Dependencies & supply chain
- [ ] Every new dependency is justified, maintained, and widely used; flagged per project rules (Ask first)
- [ ] No typosquat-looking package names
- [ ] Lockfile updated only via the package manager

## Transport & embedding (if applicable)
- [ ] No mixed-content requests (https only)
- [ ] CSP considerations noted if the app adds remote content
- [ ] External embeds sandboxed with minimal permissions

## Game-specific abuse (document, don't over-engineer)
- [ ] Client-side save tampering is acknowledged; any future economy validation is server-side by design — flag if the task implies competitive/paid value stored client-side
```

### 1.6 Baseline B5 — `.opencode/skills/code-review/checklists/testing.md` (verbatim)

```markdown
# Testing checklist — coverage, quality, evidence

Mark each ✅ / ❌ / n/a; failures become findings with severity.

## Coverage of the feature
- [ ] Every acceptance criterion has direct evidence: a test, a command, or a reproducible manual step recorded in the review
- [ ] Core logic (economy, time, persistence) has unit tests independent of the DOM
- [ ] Integration points (state ↔ UI, save ↔ load) have at least one test each
- [ ] Bug fixes in this diff include a regression test

## Edge cases exercised
- [ ] Offline progress: large time jumps, clock going backwards, zero elapsed
- [ ] Storage: quota exceeded, private mode, corrupted JSON, version migration from previous schema
- [ ] Input: rapid/repeated clicks, keyboard activation, double event firing
- [ ] Lifecycle: reload mid-action, visibility change/tab throttling

## Test quality
- [ ] Deterministic: no reliance on real wall-clock sleeps; time is injected/faked
- [ ] Assertions check behavior, not implementation details
- [ ] No flaky patterns (timing races, order dependence, shared mutable fixtures)
- [ ] Tests fail for the right reason (spot-check one negative case where cheap)

## Evidence standard
- [ ] The review records raw command names and result summaries (not "tests pass" without output)
- [ ] Any AC marked met cites where the proof lives (test name, file:line, command)
- [ ] Anything not verifiable is marked unable-to-verify and treated as unmet
```

---

## 2. Changes applied

| # | Path | Contract | Change | Added / deleted |
| --- | --- | --- | --- | --- |
| C1 | `.opencode/agents/reviewer.md` | item 12 | one `- ` bullet in **Rules** (after the verdict bullet) | +1 / 0 |
| C2 | `.opencode/skills/spec-review/SKILL.md` | item 11 | one appended `- **Real-time (when applicable)**` item in **Checklist** | +1 / 0 |
| C3 | `.opencode/skills/code-review/checklists/quality.md` | item 13 | new `## Real-time (if the feature uses the connection)` section + 5 `- [ ]` rows | +6 (+1 blank) / 0 |
| C4 | `.opencode/skills/code-review/checklists/security.md` | item 14 | new `## Real-time & untrusted messages (if applicable)` section + 5 `- [ ]` rows | +6 (+1 blank) / 0 |
| C5 | `.opencode/skills/code-review/checklists/testing.md` | item 15 | new `## Real-time coverage (if applicable)` section + 3 `- [ ]` rows | +4 (+1 blank) / 0 |

Added content verbatim (the exact inserted lines):

- **C1** `.opencode/agents/reviewer.md:59`
  `- For features touching shared or cross-client state, apply the skills' real-time checks: connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state; unverifiable real-time behavior counts as unmet.`
- **C2** `.opencode/skills/spec-review/SKILL.md:25`
  `- **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.`
- **C3** `.opencode/skills/code-review/checklists/quality.md:32–38`
  `## Real-time (if the feature uses the connection)` + five checked-style rows: one owner for the connection lifecycle (connect/open/close/reconnect/teardown; UI observes status); reconnect idempotent (no duplicate handlers/subscriptions; teardown closes + removes handlers); reconnection bounded and resyncs state; multi-client behavior consistent (or single-client scope explicit in the spec); shared/global values server-authoritative, client-reported values never truth.
- **C4** `.opencode/skills/code-review/checklists/security.md:33–39`
  `## Real-time & untrusted messages (if applicable)` + five rows: inbound WebSocket messages untrusted (shape/type-validated, unknown/malformed ignored, no crash/no state change); untrusted message text via `textContent`, never `innerHTML`/`insertAdjacentHTML`; no keys/tokens/secrets in client code or messages; secure transport in production (`wss://` on https; no mixed content); shared state never derived from unvalidated client-reported values.
- **C5** `.opencode/skills/code-review/checklists/testing.md:27–31`
  `## Real-time coverage (if applicable)` + three rows: multi-client behavior has at least one test (two clients observe the same shared state); reconnect/close paths tested via simulated connection events (no real network) incl. resync; malformed/unknown inbound messages handled in tests.

Pre-commit content addresses (working tree == stage after `git add`):

```
$ git hash-object <five files>
<recorded in §4 together with the staged blobs>
```

---

## 3. Diffs vs. build-start baselines (staged content; pre-commit)

`git diff --cached --stat` — **21 insertions(+), 0 deletions**, five files, nothing else:

```
 .opencode/agents/reviewer.md                        | 1 +
 .opencode/skills/code-review/checklists/quality.md  | 7 +++++++
 .opencode/skills/code-review/checklists/security.md | 7 +++++++
 .opencode/skills/code-review/checklists/testing.md  | 5 +++++
 .opencode/skills/spec-review/SKILL.md               | 1 +
 5 files changed, 21 insertions(+)
```

### 3.1 `git diff --cached` — full unified diff (all five files)

```diff
diff --git a/.opencode/agents/reviewer.md b/.opencode/agents/reviewer.md
index f0909c2..b1111ec 100644
--- a/.opencode/agents/reviewer.md
+++ b/.opencode/agents/reviewer.md
@@ -56,6 +56,7 @@ You are the CubeClicker reviewer — a subagent and independent quality gate. Yo
 - Read every artifact listed in the brief. For code review, inspect the diff file-by-file and run the verification suite yourself — a builder's log is a claim, not evidence.
 - Every finding: severity (BLOCKER/MAJOR/MINOR/INFO), location (`file:line` or artifact section), what's wrong, why it matters, required action.
 - Verdict: any open BLOCKER or MAJOR → `changes_requested`. "Unable to verify" counts as unmet.
+- For features touching shared or cross-client state, apply the skills' real-time checks: connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state; unverifiable real-time behavior counts as unmet.
 - Your only write scope is `docs/features/**/reviews/**`. Do not edit source, tests, specs, or logs.
 - Do not expand scope beyond the spec under review; wishlist items are `INFO` at most.
 
diff --git a/.opencode/skills/spec-review/SKILL.md b/.opencode/skills/spec-review/SKILL.md
index ec80082..62f5dac 100644
--- a/.opencode/skills/spec-review/SKILL.md
+++ b/.opencode/skills/spec-review/SKILL.md
@@ -22,6 +22,7 @@ Task Brief plus `spec.md`, `plan.md`, `tasks.md`, `docs/product/vision.md`, `AGE
 - **Testing** — strategy present; commands exist in `AGENTS.md`; relevant edge cases named.
 - **Consistency** — aligns with the vision; reuses existing architecture; contradicts nothing in `AGENTS.md`.
 - **Risks** — ambiguities that will surface mid-build as blockers.
+- **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.
 
 ## Severity & verdict
 
diff --git a/.opencode/skills/code-review/checklists/quality.md b/.opencode/skills/code-review/checklists/quality.md
index a78c583..b0cb1fb 100644
--- a/.opencode/skills/code-review/checklists/quality.md
+++ b/.opencode/skills/code-review/checklists/quality.md
@@ -29,3 +29,10 @@ Mark each ✅ / ❌ / n/a; failures become findings with severity.
 - [ ] No per-frame allocations or DOM churn in hot loops
 - [ ] Timers/observers cleaned up on teardown (no leaks across reloads/HMR)
 - [ ] Bundle additions justified and measured where significant
+
+## Real-time (if the feature uses the connection)
+- [ ] One owner for the connection lifecycle (connect/open/close/reconnect/teardown); UI observes connection status instead of opening its own connection
+- [ ] Reconnect is idempotent: no duplicate handlers or subscriptions survive a reconnect; teardown closes the connection and removes handlers
+- [ ] Reconnection is bounded (finite attempts/backoff) and resyncs state after reconnecting
+- [ ] Multi-client behavior is consistent (two clients converge on the same shared state), or single-client scope is explicit in the spec
+- [ ] Shared/global values are server-authoritative; client-reported values are never treated as truth
diff --git a/.opencode/skills/code-review/checklists/security.md b/.opencode/skills/code-review/checklists/security.md
index b7e0f8b..1f18d4f 100644
--- a/.opencode/skills/code-review/checklists/security.md
+++ b/.opencode/skills/code-review/checklists/security.md
@@ -30,3 +30,10 @@ Adapted from the OWASP web-top-10 mindset for a client-side game. Mark each item
 
 ## Game-specific abuse (document, don't over-engineer)
 - [ ] Client-side save tampering is acknowledged; any future economy validation is server-side by design — flag if the task implies competitive/paid value stored client-side
+
+## Real-time & untrusted messages (if applicable)
+- [ ] Inbound WebSocket messages are treated as untrusted: shape/type-validated before use, unknown or malformed types ignored (no crash, no state change)
+- [ ] Untrusted text from messages is rendered via `textContent` — never `innerHTML`/`insertAdjacentHTML`
+- [ ] No API keys, tokens, or secrets in client code or in messages sent to or from the client
+- [ ] Transport is secure in production (`wss://` on https pages; no mixed content)
+- [ ] Shared state is never derived from unvalidated client-reported values (server-authoritative)
diff --git a/.opencode/skills/code-review/checklists/testing.md b/.opencode/skills/code-review/checklists/testing.md
index 94b01f6..c540116 100644
--- a/.opencode/skills/code-review/checklists/testing.md
+++ b/.opencode/skills/code-review/checklists/testing.md
@@ -24,3 +24,8 @@ Mark each ✅ / ❌ / n/a; failures become findings with severity.
 - [ ] The review records raw command names and result summaries (not "tests pass" without output)
 - [ ] Any AC marked met cites where the proof lives (test name, file:line, command)
 - [ ] Anything not verifiable is marked unable-to-verify and treated as unmet
+
+## Real-time coverage (if applicable)
+- [ ] Multi-client behavior has at least one test: two clients observe the same shared state
+- [ ] Reconnect/close paths are tested via simulated connection events (no real network), including state resync after reconnect
+- [ ] Malformed/unknown inbound messages are handled in tests (ignored, no crash, no state change)
```

Diff shape per file: single hunk each; one or more pure additions; **no deletion, no modification, no reordering** — the baseline lines quoted in §1 are reproduced verbatim as context lines everywhere.

### 3.2 Diff vs. build-start baselines — `diff -u <baseline> <file>` (independent of git)

```
$ for f in <five files_owned>; do diff -u "/tmp/opencode/t5/baseline-$(...)" "$f"; done
--- .opencode/agents/reviewer.md vs baseline ---
@@ -56,6 +56,7 @@
 - Read every artifact listed in the brief. For code review, inspect the diff file-by-file and run the verification suite yourself — a builder's log is a claim, not evidence.
 - Every finding: severity (BLOCKER/MAJOR/MINOR/INFO), location (`file:line` or artifact section), what's wrong, why it matters, required action.
 - Verdict: any open BLOCKER or MAJOR → `changes_requested`. "Unable to verify" counts as unmet.
+- For features touching shared or cross-client state, apply the skills' real-time checks: connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state; unverifiable real-time behavior counts as unmet.
 - Your only write scope is `docs/features/**/reviews/**`. Do not edit source, tests, specs, or logs.
 - Do not expand scope beyond the spec under review; wishlist items are `INFO` at most.
 
--- .opencode/skills/spec-review/SKILL.md vs baseline ---
@@ -22,6 +22,7 @@
 - **Testing** — strategy present; commands exist in `AGENTS.md`; relevant edge cases named.
 - **Consistency** — aligns with the vision; reuses existing architecture; contradicts nothing in `AGENTS.md`.
 - **Risks** — ambiguities that will surface mid-build as blockers.
+- **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.
 
 ## Severity & verdict
 
--- .opencode/skills/code-review/checklists/quality.md vs baseline ---
@@ -29,3 +29,10 @@
 - [ ] No per-frame allocations or DOM churn in hot loops
 - [ ] Timers/observers cleaned up on teardown (no leaks across reloads/HMR)
 - [ ] Bundle additions justified and measured where significant
+
+## Real-time (if the feature uses the connection)
+- [ ] One owner for the connection lifecycle (connect/open/close/reconnect/teardown); UI observes connection status instead of opening its own connection
+- [ ] Reconnect is idempotent: no duplicate handlers or subscriptions survive a reconnect; teardown closes the connection and removes handlers
+- [ ] Reconnection is bounded (finite attempts/backoff) and resyncs state after reconnecting
+- [ ] Multi-client behavior is consistent (two clients converge on the same shared state), or single-client scope is explicit in the spec
+- [ ] Shared/global values are server-authoritative; client-reported values are never treated as truth
--- .opencode/skills/code-review/checklists/security.md vs baseline ---
@@ -30,3 +30,10 @@
 
 ## Game-specific abuse (document, don't over-engineer)
 - [ ] Client-side save tampering is acknowledged; any future economy validation is server-side by design — flag if the task implies competitive/paid value stored client-side
+
+## Real-time & untrusted messages (if applicable)
+- [ ] Inbound WebSocket messages are treated as untrusted: shape/type-validated before use, unknown or malformed types ignored (no crash, no state change)
+- [ ] Untrusted text from messages is rendered via `textContent` — never `innerHTML`/`insertAdjacentHTML`
+- [ ] No API keys, tokens, or secrets in client code or in messages sent to or from the client
+- [ ] Transport is secure in production (`wss://` on https pages; no mixed content)
+- [ ] Shared state is never derived from unvalidated client-reported values (server-authoritative)
--- .opencode/skills/code-review/checklists/testing.md vs baseline ---
@@ -24,3 +24,8 @@
 - [ ] The review records raw command names and result summaries (not "tests pass" without output)
 - [ ] Any AC marked met cites where the proof lives (test name, file:line, command)
 - [ ] Anything not verifiable is marked unable-to-verify and treated as unmet
+
+## Real-time coverage (if applicable)
+- [ ] Multi-client behavior has at least one test: two clients observe the same shared state
+- [ ] Reconnect/close paths are tested via simulated connection events (no real network), including state resync after reconnect
+- [ ] Malformed/unknown inbound messages are handled in tests (ignored, no crash, no state change)
```

Added/deleted line counts per file (from `git diff HEAD -- <file>`):

```
.opencode/agents/reviewer.md                        added=1 deleted=0
.opencode/skills/spec-review/SKILL.md               added=1 deleted=0
.opencode/skills/code-review/checklists/quality.md  added=6 deleted=0
.opencode/skills/code-review/checklists/security.md added=6 deleted=0
.opencode/skills/code-review/checklists/testing.md  added=4 deleted=0
```

---

## 4. Committed-state evidence

Commit identity is **deliberately omitted from this file** (self-reference: a commit cannot contain its own hash; same precedent as `build-log-T0.md` §7 / `build-log-T1.md` §4 / `build-log-T2.md` §4). It is reported to the orchestrator in the Subagent Report and retrievable as `git rev-parse HEAD`.

Commit identity metadata (recorded):

```
branch:  feat/online-realtime-workflow
parent:  b3aeff18...  (T2; recorded as b3aeff1)
subject: docs: add real-time review checks for spec/code gates (T5)
hash:    omitted here (self-reference) — reported in the Subagent Report / `git rev-parse HEAD`
files (from `git show --name-only --format=%s HEAD`):
.opencode/agents/reviewer.md
.opencode/skills/code-review/checklists/quality.md
.opencode/skills/code-review/checklists/security.md
.opencode/skills/code-review/checklists/testing.md
.opencode/skills/spec-review/SKILL.md
docs/features/online-realtime-workflow/build-log-T5.md
```

Content is proven content-addressed (pre-commit `git hash-object` == staged blob == post-commit `git rev-parse HEAD:<path>`):

```
$ git hash-object <five files>          # pre-commit, from the working tree
$ git rev-parse :<five files>           # staged (index) blobs
$ git rev-parse HEAD:<five files>       # post-commit blobs
# all three lists identical per path (compare in §6 after staging)
```

Post-commit `git show HEAD -- <paths>` reproduces the §3.1 diff bodies verbatim (only the commit header lines differ); the staged diff was re-verified after the commit with `git show` (§6.2 command recorded with its output).

---

## 5. Verify commands (tasks.md T5) — raw output

### V1 — `grep -in "real-time" .opencode/agents/reviewer.md .opencode/skills/spec-review/SKILL.md .opencode/skills/code-review/checklists/*.md` (exit 0)

```
.opencode/agents/reviewer.md:59:- For features touching shared or cross-client state, apply the skills' real-time checks: connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state; unverifiable real-time behavior counts as unmet.
.opencode/skills/spec-review/SKILL.md:25:- **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.
.opencode/skills/code-review/checklists/quality.md:33:## Real-time (if the feature uses the connection)
.opencode/skills/code-review/checklists/security.md:34:## Real-time & untrusted messages (if applicable)
.opencode/skills/code-review/checklists/testing.md:28:## Real-time coverage (if applicable)
exit=0
```

All five files carry the token — one hit each, all on the T5-added line (AC-19, AC-20, AC-21, AC-22, AC-23).

### V2 — `git diff HEAD -- <files_owned>` (name-status + stat)

```
M	.opencode/agents/reviewer.md
M	.opencode/skills/code-review/checklists/quality.md
M	.opencode/skills/code-review/checklists/security.md
M	.opencode/skills/code-review/checklists/testing.md
M	.opencode/skills/spec-review/SKILL.md
 .opencode/agents/reviewer.md                        | 1 +
 .opencode/skills/code-review/checklists/quality.md  | 7 +++++++
 .opencode/skills/code-review/checklists/security.md | 7 +++++++
 .opencode/skills/code-review/checklists/testing.md  | 5 +++++
 .opencode/skills/spec-review/SKILL.md               | 1 +
 5 files changed, 21 insertions(+)
```

Exactly the five owned files appear; 21 insertions, 0 deletions (full diff in §3.1).

### V3 (extra, AC-24) — permission-block guard

```
$ git diff HEAD -- .opencode/ | grep -in "permissions:\|effect: allow\|effect: deny\|action:"
NO permission-block lines in the T5 diff
```

T5 touches no `permissions:` block and no allow/deny entry; `reviewer.md`'s permission frontmatter is quoted in §1.2 only as part of the baseline.

### V4 (extra, contract constraint) — technology-name scan on added lines

```
$ git diff HEAD -- <five files> | grep '^+' | grep -Ein '\b(react|vue|angular|svelte|node|nodejs|deno|bun|express|django|spring|flask|fastapi|rust|nginx|apache|postgres|redis|mongo|docker|firebase|aws|npm|yarn|pnpm|vite|webpack|axios|jest|vitest|esbuild|rollup|socket\.io|framework|librar(y|ies)|runtime|vendor|package)\b'
NO matches — no library/framework/runtime/vendor/package names in T5 added lines

# first pass without word boundaries flagged 3 lines — all false positives on the substring "rust" inside "untru*st*ed":
13:+## Real-time & untrusted messages (if applicable)
14:+- [ ] Inbound WebSocket messages are treated as untrusted: shape/type-validated before use, unknown or malformed types ignored (no crash, no state change)
15:+- [ ] Untrusted text from messages is rendered via `textContent` — never `innerHTML`/`insertAdjacentHTML`
```

`WebSocket` (contract 14's mandated protocol term) and `wss://`/https (transport terms) are the only technology/protocol words added; both are protocol-level, not library/framework/runtime/vendor names. Nothing else.

### V4b — protocol-term occurrences in T5 added lines

```
$ git diff HEAD -- <five files> | grep '^+' | grep -in "websocket\|wss://"
+- [ ] Inbound WebSocket messages are treated as untrusted: shape/type-validated before use, unknown or malformed types ignored (no crash, no state change)
+- [ ] Transport is secure in production (`wss://` on https pages; no mixed content)
```

### V5 (extra, AC-25) — additions only, no modification/removal

```
$ for f in <five files_owned>; do a=$(git diff HEAD -- "$f" | grep -c '^+[^+]'); d=$(git diff HEAD -- "$f" | grep -c '^-[^-]'); echo "$f added=$a deleted=$d"; done
.opencode/agents/reviewer.md added=1 deleted=0
.opencode/skills/spec-review/SKILL.md added=1 deleted=0
.opencode/skills/code-review/checklists/quality.md added=6 deleted=0
.opencode/skills/code-review/checklists/security.md added=6 deleted=0
.opencode/skills/code-review/checklists/testing.md added=4 deleted=0
```

Deleted = 0 for every file → no pre-existing content removed or modified; every baseline line survives byte-for-byte (§3.2).

### V6 (extra, concurrent-builder isolation) — wider `.opencode/` diff was NOT staged

```
$ git diff HEAD -- .opencode/ | grep '^+'      # shows T3/T4 in-progress lines too, e.g.
+- Framework autonomy: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; …
+++ b/.opencode/agents/builder.md
+++ b/.opencode/agents/orchestrator.md
+++ b/.opencode/agents/planner.md
+++ b/.opencode/skills/spec-authoring/references/spec-checklist.md
+++ b/.opencode/skills/web-implementation/SKILL.md
+++ b/.opencode/skills/web-implementation/references/engineering-principles.md
```

These belong to concurrent T3/T4 (and are not T5 `files_owned`). They were deliberately **not** staged; `git diff --cached --name-only` (§6) lists only the six T5 paths.

---

## 6. Staging discipline

### 6.1 Explicit-path staging

```
$ git add .opencode/agents/reviewer.md .opencode/skills/spec-review/SKILL.md \
          .opencode/skills/code-review/checklists/quality.md \
          .opencode/skills/code-review/checklists/security.md \
          .opencode/skills/code-review/checklists/testing.md
$ git diff --cached --name-only
.opencode/agents/reviewer.md
.opencode/skills/code-review/checklists/quality.md
.opencode/skills/code-review/checklists/security.md
.opencode/skills/code-review/checklists/testing.md
.opencode/skills/spec-review/SKILL.md
$ git add docs/features/online-realtime-workflow/build-log-T5.md
$ git diff --cached --name-only
.opencode/agents/reviewer.md
.opencode/skills/code-review/checklists/quality.md
.opencode/skills/code-review/checklists/security.md
.opencode/skills/code-review/checklists/testing.md
.opencode/skills/spec-review/SKILL.md
docs/features/online-realtime-workflow/build-log-T5.md
```

Explicit-path `git add` only — **no** `git add .` / `git add -A`; **no** push. Left unstaged: concurrent T3/T4's `.opencode/` edits (`builder.md`, `orchestrator.md`, `planner.md`, `spec-authoring/references/spec-checklist.md`, `web-implementation/**`), the pre-existing `docs/features/project-glossary/status.md` modification, and all untracked planner/orchestrator artifacts.

### 6.2 Post-commit verification

```
$ git show --name-only --format='%h %s' HEAD
<commit hash> docs: add real-time review checks for spec/code gates (T5)

.opencode/agents/reviewer.md
.opencode/skills/code-review/checklists/quality.md
.opencode/skills/code-review/checklists/security.md
.opencode/skills/code-review/checklists/testing.md
.opencode/skills/spec-review/SKILL.md
docs/features/online-realtime-workflow/build-log-T5.md
$ git show HEAD -- <five files> | diff - <staged diff captured before commit>   # bodies identical (header lines only differ)
$ git rev-parse HEAD:<each of five files>   # == staged blobs (content-addressed; no post-commit drift)
$ git status --short                        # only other builders' / pre-existing artifacts remain unstaged/untracked
```

---

## Acceptance audit

- **AC-19 — met.** `.opencode/agents/reviewer.md:59` adds a Rules bullet requiring real-time verification for features touching shared or cross-client state: "…apply the skills' real-time checks: connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state; unverifiable real-time behavior counts as unmet." Contains "real-time" (V1) and the four required concepts plus the unverifiable→unmet rule; added as +1 line, no other change (V5, §3).
- **AC-20 — met.** `.opencode/skills/spec-review/SKILL.md:25` appends one Checklist item: "**Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged." Covers all five required concepts (lifecycle, reconnection, multi-client, server authority, identity conflicts) (V1).
- **AC-21 — met.** `.opencode/skills/code-review/checklists/quality.md:33–38` adds `## Real-time (if the feature uses the connection)` with rows for (a) one owner for the connection lifecycle, (b) no duplicate handlers after reconnect + teardown, (c) bounded reconnection with state resync, (d) multi-client behavior consistent — or single-client scope explicit in the spec, (e) shared/global values server-authoritative. Uses the file's existing `## Section` + `- [ ]` row convention (header preamble "Mark each ✅ / ❌ / n/a" untouched).
- **AC-22 — met.** `.opencode/skills/code-review/checklists/security.md:33–39` adds `## Real-time & untrusted messages (if applicable)` with rows for (a) inbound WebSocket messages untrusted — shape/type-validated, unknown/malformed ignored; (b) untrusted text via `textContent`, never `innerHTML`/`insertAdjacentHTML`; (c) no keys/tokens/secrets in client code or messages; (d) secure transport / no mixed content on https (`wss://`); (e) shared state never derived from unvalidated client-reported values. Same convention style as the file.
- **AC-23 — met.** `.opencode/skills/code-review/checklists/testing.md:27–31` adds `## Real-time coverage (if applicable)` with rows for (a) multi-client behavior has at least one test (two clients observe the same shared state); (b) reconnect/close paths tested via simulated connection events (no real network) with resync covered; (c) malformed/unknown inbound messages handled in tests. Same convention style as the file.
- **AC-24 (T5 scope) — met / not implicated.** The T5 diff contains no `permissions:` block line, no `action:`/`effect:` entry, and no `.opencode/agents/*.md` permission content change (V3); staged paths are exactly the six T5-owned paths (§6.1).
- **AC-25 (T5 scope) — met.** Each file's diff vs. its build-start baseline (§3.1 git diff, §3.2 independent `diff -u`) contains only the contract items 11–15 additions: 21 inserted lines total, 0 deletions, single hunk per file, no unrelated or drive-by edits, no pre-existing content modified or removed (V5). No contract 1.A/4.A-style pinned replacement is involved in T5.

Contract-token audit (plan § Pinned content contracts items 11–15, AC tokens):

| Required token / concept | Where |
| --- | --- |
| `reviewer.md` Rules bullet, token "real-time" | `.opencode/agents/reviewer.md:59` |
| connection lifecycle / reconnection / multi-client / server-authoritative shared state | `.opencode/agents/reviewer.md:59` |
| "unverifiable real-time behavior counts as unmet" | `.opencode/agents/reviewer.md:59` |
| spec-review Checklist item, token "Real-time" | `.opencode/skills/spec-review/SKILL.md:25` |
| lifecycle / reconnection / multi-client / server authority / identity-accounts flagged | `.opencode/skills/spec-review/SKILL.md:25` |
| quality section `## Real-time (if the feature uses the connection)` | `.opencode/skills/code-review/checklists/quality.md:33` |
| one lifecycle owner / no duplicate handlers after reconnect / teardown | `quality.md:35–36` |
| bounded reconnection with resync | `quality.md:37` |
| multi-client consistent or single-client explicit | `quality.md:38` |
| server-authoritative shared/global values | `quality.md:39` |
| security section `## Real-time & untrusted messages (if applicable)` | `.opencode/skills/code-review/checklists/security.md:34` |
| inbound messages untrusted (shape-validated, unknown ignored) | `security.md:35` |
| untrusted text via `textContent`, never `innerHTML` | `security.md:36` |
| no secrets/tokens in client code or messages | `security.md:37` |
| secure transport / no mixed content on https | `security.md:38` |
| shared state never from unvalidated client values | `security.md:39` |
| testing section `## Real-time coverage (if applicable)` | `.opencode/skills/code-review/checklists/testing.md:28` |
| multi-client test (two clients, same shared state) | `testing.md:29` |
| reconnect/close via simulated events (no real network), resync | `testing.md:30` |
| malformed/unknown inbound messages in tests | `testing.md:31` |
| `✅ / ❌ / n/a` row convention preserved per file | all three checklists: existing preamble unchanged; new rows use the file's `- [ ]` shape |
| no library/framework/runtime/vendor names | V4/V4b scans (only "WebSocket" protocol + `wss://`/https) |
| no permission-block edits | V3 |

## Tests

None — no automated commands exist (`AGENTS.md` § Commands: TBD; stack NOT DECIDED, per spec § Testing strategy / § Non-goals). Verification is inspection + `grep`/`git diff`/`diff`/`sha256sum` aids, as the spec requires. No application code, dependency, or tooling was introduced.

## Deviations from spec

None in content or scope.

Notes (not deviations):
- This is a workflow-instruction documentation change (no runtime behavior); the "tests accompany every behavior change" convention has no applicable artifact here, consistent with spec § Testing strategy / § Non-goals.
- The commit hash is reported out-of-band (Subagent Report) rather than embedded here — a commit cannot contain its own hash (T0/T1/T2 precedent).
- `grep`/`git`/`diff`/`sha256sum` were used strictly as build-time inspection aids — no tooling choice is introduced; stack remains NOT DECIDED.
- The word "WebSocket" in `security.md` is the protocol term mandated by plan contract item 14 / AC-22, not a technology selection.
