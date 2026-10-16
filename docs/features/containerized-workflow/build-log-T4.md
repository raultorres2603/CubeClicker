# Build log — T4 — Reviewer guidance: agent rule + spec/code gate checklists

Task: T4 (2026-10-17, branch `feat/containerized-workflow`)
Batch: `[P]` batch with T2/T3 — disjoint `files_owned`; T4 touches none of T2's/T3's files.
Files changed (6 — this task's `files_owned` only):
- `.opencode/agents/reviewer.md` (edit, +1 rule)
- `.opencode/skills/spec-review/SKILL.md` (edit, +1 checklist item)
- `.opencode/skills/code-review/checklists/quality.md` (edit, +1 section)
- `.opencode/skills/code-review/checklists/security.md` (edit, +1 section)
- `.opencode/skills/code-review/checklists/testing.md` (edit, +1 section)
- `docs/features/containerized-workflow/build-log-T4.md` (this file, NEW)

What changed & why (≤5 lines):
1. `reviewer.md` § Rules gains one bullet (contract 10): for changes touching services/images/ports/
   configuration/deployability, verify the containerization contract; unverifiable = unmet. **No
   `permissions:` block or allow/deny entry touched (AC-25).**
2. `spec-review/SKILL.md` § Checklist gains one item (contract 11): **Containers (when applicable)** —
   mirror of the spec-authoring container item, for the spec gate.
3. `quality.md` § Containerized delivery (contract 12): single-command local run, one image per
   deployable/reproducible builds, env-based config, health signal + graceful stop.
4. `security.md` § Containers & images (contract 13): no secrets in images/layers/compose, deterministic
   image refs, no privileged requirement + intentional ports, provider-neutral.
5. `testing.md` § Container coverage (contract 14): containerized local env starts/serves full stack,
   WebSocket connectivity through the container path, container build/run checks enter the suite.

Decisions:
- Baselines captured at build start (D-11) via `git show HEAD:<path>` **before the first edit**; recorded
  verbatim below. HEAD was `ffadd1d` at capture (T1 committed; sibling batch commits may advance the tip —
  they touch disjoint files, so these baselines stay stable).
- Placement is additive and follows each file's existing conventions: `reviewer.md`/`spec-review` append a
  single bullet/item at the end of the existing list, after the real-time entry (logical grouping); each
  checklist appends one `## … (if applicable)` section at end-of-file using the file's existing
  `- [ ]` + `✅/❌/n/a` convention (stated in each file's preamble).
- Wording uses plan contract 10–14 prose verbatim; the three checklist code blocks are reproduced
  byte-exact. Allow-list vocabulary only (Docker, Docker Compose, container, WebSocket) — no application
  technology names (AC-28).

## Step 0 evidence

```
$ git rev-parse --abbrev-ref HEAD
feat/containerized-workflow
$ git rev-parse HEAD
ffadd1d4b6d678bf5f8e0489c208e367e880d0f5
$ git status --short
 M docs/features/README.md
 M docs/features/online-realtime-workflow/status.md
?? docs/features/containerized-workflow/plan.md
?? docs/features/containerized-workflow/reviews/
?? docs/features/containerized-workflow/spec.md
?? docs/features/containerized-workflow/status.md
?? docs/features/containerized-workflow/tasks.md
```

Branch confirmed `feat/containerized-workflow` (created at `8b34eff18c…` per T1 log; tip advanced to
`ffadd1d` by T1's commit). No branch switch performed. `main` untouched. Unrelated dirty/untracked
process files left exactly as found.

## Build-start baselines (governing, D-11)

Baseline capture command: `git show HEAD:<path>` at build start (HEAD `ffadd1d…`), before any edit.

| Path | Baseline md5 |
| --- | --- |
| `.opencode/agents/reviewer.md` | `097c58cbe227d8cb2ebd208a2a5573a0` |
| `.opencode/skills/spec-review/SKILL.md` | `a5db7d7bd02edcef9bac28402b05bcb6` |
| `.opencode/skills/code-review/checklists/quality.md` | `2bd2c115316f6765b34ec46da6a65be1` |
| `.opencode/skills/code-review/checklists/security.md` | `987b3b541cb451e277fd08fe5df2634d` |
| `.opencode/skills/code-review/checklists/testing.md` | `a9d7c9a289de994a652713cc7f8e5110` |

### `git show HEAD:.opencode/agents/reviewer.md` (md5 097c58cbe227d8cb2ebd208a2a5573a0)
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
- For features touching shared or cross-client state, apply the skills' real-time checks: connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state; unverifiable real-time behavior counts as unmet.
- Your only write scope is `docs/features/**/reviews/**`. Do not edit source, tests, specs, or logs.
- Do not expand scope beyond the spec under review; wishlist items are `INFO` at most.

## Output

Write the verdict artifact `reviews/spec-r<iteration>.md` or `reviews/code-r<iteration>.md` using your skill's template, then return the Subagent Report with `status: completed`, the verdict frontmatter echoed (verdict, blocking count), and artifact paths.
```

### `git show HEAD:.opencode/skills/spec-review/SKILL.md` (md5 a5db7d7bd02edcef9bac28402b05bcb6)
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
- **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.

## Severity & verdict

- `BLOCKER` — would cause file collisions, unverifiable acceptance, a security issue, or a guaranteed mid-build dead end.
- `MAJOR` — significant gap or ambiguity that will produce wrong work.
- `MINOR` / `INFO` — improvements, style, future-proofing.
- Verdict: any open BLOCKER or MAJOR → `changes_requested`; otherwise `approved`.

## Output

Write `docs/features/<slug>/reviews/spec-r<iteration>.md` using `templates/review.md`. Cite artifact sections per finding (e.g., `spec.md § Acceptance criteria`). Each finding states: what, why it fails the checklist, and the required action. Then return the Subagent Report with the verdict frontmatter echoed in the evidence.
```

### `git show HEAD:.opencode/skills/code-review/checklists/quality.md` (md5 2bd2c115316f6765b34ec46da6a65be1)
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

## Real-time (if the feature uses the connection)
- [ ] One owner for the connection lifecycle (connect/open/close/reconnect/teardown); UI observes connection status instead of opening its own connection
- [ ] Reconnect is idempotent: no duplicate handlers or subscriptions survive a reconnect; teardown closes the connection and removes handlers
- [ ] Reconnection is bounded (finite attempts/backoff) and resyncs state after reconnecting
- [ ] Multi-client behavior is consistent (two clients converge on the same shared state), or single-client scope is explicit in the spec
- [ ] Shared/global values are server-authoritative; client-reported values are never treated as truth
```

### `git show HEAD:.opencode/skills/code-review/checklists/security.md` (md5 987b3b541cb451e277fd08fe5df2634d)
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

## Real-time & untrusted messages (if applicable)
- [ ] Inbound WebSocket messages are treated as untrusted: shape/type-validated before use, unknown or malformed types ignored (no crash, no state change)
- [ ] Untrusted text from messages is rendered via `textContent` — never `innerHTML`/`insertAdjacentHTML`
- [ ] No API keys, tokens, or secrets in client code or in messages sent to or from the client
- [ ] Transport is secure in production (`wss://` on https pages; no mixed content)
- [ ] Shared state is never derived from unvalidated client-reported values (server-authoritative)
```

### `git show HEAD:.opencode/skills/code-review/checklists/testing.md` (md5 a9d7c9a289de994a652713cc7f8e5110)
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

## Real-time coverage (if applicable)
- [ ] Multi-client behavior has at least one test: two clients observe the same shared state
- [ ] Reconnect/close paths are tested via simulated connection events (no real network), including state resync after reconnect
- [ ] Malformed/unknown inbound messages are handled in tests (ignored, no crash, no state change)
```

## Verify commands (raw output)

### `grep -in "container" .opencode/agents/reviewer.md .opencode/skills/spec-review/SKILL.md .opencode/skills/code-review/checklists/*.md`
```
.opencode/agents/reviewer.md:60:- For changes touching services, images, ports, configuration, or deployability, verify the containerization contract (`docs/architecture/containerization.md`): single-command local run, environment-based config, no secrets in images, provider-neutral images, and the backend WebSocket endpoint exposed; unverifiable container behavior counts as unmet.
.opencode/skills/spec-review/SKILL.md:26:- **Containers (when applicable)** — features adding services, images, ports, configuration, or deployables address the containerization contract (`docs/architecture/containerization.md`: local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) or state it out of scope; stack-dependent container details are open questions.
.opencode/skills/code-review/checklists/quality.md:40:## Containerized delivery (if applicable)
.opencode/skills/code-review/checklists/quality.md:44:- [ ] Health signal present for long-running services; containers stop gracefully
.opencode/skills/code-review/checklists/security.md:41:## Containers & images (if applicable)
.opencode/skills/code-review/checklists/security.md:44:- [ ] Containers run without privileged/escalated privileges; exposed ports are intentional
.opencode/skills/code-review/checklists/testing.md:33:## Container coverage (if applicable)
.opencode/skills/code-review/checklists/testing.md:34:- [ ] The containerized local environment starts and serves the full stack (documented smoke check)
.opencode/skills/code-review/checklists/testing.md:35:- [ ] WebSocket connectivity verified through the container path (upgrades work end-to-end)
.opencode/skills/code-review/checklists/testing.md:36:- [ ] Container build/run checks are part of the verification suite once the stack provides commands
```
EXIT 0 — the token "container"/"Container" present in every edited file.

### `git diff HEAD -- <files_owned>` vs. build-start baselines
```
git diff HEAD -- .opencode/agents/reviewer.md .opencode/skills/spec-review/SKILL.md .opencode/skills/code-review/checklists/quality.md .opencode/skills/code-review/checklists/security.md .opencode/skills/code-review/checklists/testing.md
```
```diff
diff --git a/.opencode/agents/reviewer.md b/.opencode/agents/reviewer.md
index b1111ec..85fa455 100644
--- a/.opencode/agents/reviewer.md
+++ b/.opencode/agents/reviewer.md
@@ -57,6 +57,7 @@ You are the CubeClicker reviewer — a subagent and independent quality gate. Yo
 - Every finding: severity (BLOCKER/MAJOR/MINOR/INFO), location (`file:line` or artifact section), what's wrong, why it matters, required action.
 - Verdict: any open BLOCKER or MAJOR → `changes_requested`. "Unable to verify" counts as unmet.
 - For features touching shared or cross-client state, apply the skills' real-time checks: connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state; unverifiable real-time behavior counts as unmet.
+- For changes touching services, images, ports, configuration, or deployability, verify the containerization contract (`docs/architecture/containerization.md`): single-command local run, environment-based config, no secrets in images, provider-neutral images, and the backend WebSocket endpoint exposed; unverifiable container behavior counts as unmet.
 - Your only write scope is `docs/features/**/reviews/**`. Do not edit source, tests, specs, or logs.
 - Do not expand scope beyond the spec under review; wishlist items are `INFO` at most.
 
diff --git a/.opencode/skills/code-review/checklists/quality.md b/.opencode/skills/code-review/checklists/quality.md
index b0cb1fb..63c9dd1 100644
--- a/.opencode/skills/code-review/checklists/quality.md
+++ b/.opencode/skills/code-review/checklists/quality.md
@@ -36,3 +36,9 @@ Mark each ✅ / ❌ / n/a; failures become findings with severity.
 - [ ] Reconnection is bounded (finite attempts/backoff) and resyncs state after reconnecting
 - [ ] Multi-client behavior is consistent (two clients converge on the same shared state), or single-client scope is explicit in the spec
 - [ ] Shared/global values are server-authoritative; client-reported values are never treated as truth
+
+## Containerized delivery (if applicable)
+- [ ] Single-command local run preserved (`docker compose up`-style starts the full environment)
+- [ ] One image per deployable; images build reproducibly from the repository
+- [ ] Runtime config via environment variables with safe local defaults; no host-specific assumptions
+- [ ] Health signal present for long-running services; containers stop gracefully
diff --git a/.opencode/skills/code-review/checklists/security.md b/.opencode/skills/code-review/checklists/security.md
index 1f18d4f..fa98b2d 100644
--- a/.opencode/skills/code-review/checklists/security.md
+++ b/.opencode/skills/code-review/checklists/security.md
@@ -37,3 +37,9 @@ Adapted from the OWASP web-top-10 mindset for a client-side game. Mark each item
 - [ ] No API keys, tokens, or secrets in client code or in messages sent to or from the client
 - [ ] Transport is secure in production (`wss://` on https pages; no mixed content)
 - [ ] Shared state is never derived from unvalidated client-reported values (server-authoritative)
+
+## Containers & images (if applicable)
+- [ ] No secrets or credentials baked into images, layers, or compose files; `.env*` untouched
+- [ ] Image references deterministic (pinned versions where reproducibility matters)
+- [ ] Containers run without privileged/escalated privileges; exposed ports are intentional
+- [ ] Provider-neutral: no deployment-provider lock-in or credentials in images/compose
diff --git a/.opencode/skills/code-review/checklists/testing.md b/.opencode/skills/code-review/checklists/testing.md
index c540116..6b5a62b 100644
--- a/.opencode/skills/code-review/checklists/testing.md
+++ b/.opencode/skills/code-review/checklists/testing.md
@@ -29,3 +29,8 @@ Mark each ✅ / ❌ / n/a; failures become findings with severity.
 - [ ] Multi-client behavior has at least one test: two clients observe the same shared state
 - [ ] Reconnect/close paths are tested via simulated connection events (no real network), including state resync after reconnect
 - [ ] Malformed/unknown inbound messages are handled in tests (ignored, no crash, no state change)
+
+## Container coverage (if applicable)
+- [ ] The containerized local environment starts and serves the full stack (documented smoke check)
+- [ ] WebSocket connectivity verified through the container path (upgrades work end-to-end)
+- [ ] Container build/run checks are part of the verification suite once the stack provides commands
diff --git a/.opencode/skills/spec-review/SKILL.md b/.opencode/skills/spec-review/SKILL.md
index 62f5dac..5cfe1a4 100644
--- a/.opencode/skills/spec-review/SKILL.md
+++ b/.opencode/skills/spec-review/SKILL.md
@@ -23,6 +23,7 @@ Task Brief plus `spec.md`, `plan.md`, `tasks.md`, `docs/product/vision.md`, `AGE
 - **Consistency** — aligns with the vision; reuses existing architecture; contradicts nothing in `AGENTS.md`.
 - **Risks** — ambiguities that will surface mid-build as blockers.
 - **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.
+- **Containers (when applicable)** — features adding services, images, ports, configuration, or deployables address the containerization contract (`docs/architecture/containerization.md`: local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) or state it out of scope; stack-dependent container details are open questions.
 
 ## Severity & verdict
 
```

### `git diff HEAD --stat` (my five files)
```
 .opencode/agents/reviewer.md                        | 1 +
 .opencode/skills/code-review/checklists/quality.md  | 6 ++++++
 .opencode/skills/code-review/checklists/security.md | 6 ++++++
 .opencode/skills/code-review/checklists/testing.md  | 5 +++++
 .opencode/skills/spec-review/SKILL.md               | 1 +
 5 files changed, 19 insertions(+)
```

### AC-25 — no permission content in this task's diff
```
$ git diff HEAD -- <my five files> | grep -n "permissions:\|effect: allow\|effect: deny"
NO permission content in diff
$ git status --short | grep -i "\.env"
NO .env entries
```
`reviewer.md`'s `permissions:` block (frontmatter lines 7–46) is byte-identical to baseline; only the
`## Rules` section gained one bullet. No `opencode.jsonc` touched.

### AC-26 — removed-line check (additions only)
```
$ git diff HEAD -- <my five files> | grep '^-' | grep -v '^---'
NO removed lines (additions only)
```
Baseline stability re-check (`diff <baseline> <(git show HEAD:<path>)` per file): all five report
STABLE — the captured baselines equal HEAD content, so the diff above is measured against captured
content (no baseline drift).

### AC-28 — technology-name scan of added content
```
$ git diff HEAD -- <my five files> | grep '^+' | grep -v '^+++' \
  | grep -inE "react|vue|svelte|node|deno|bun|npm|yarn|pnpm|python|golang|rust|java|dotnet|typescript|javascript|nginx|kubernetes|k8s|podman|postgres|redis|mongo"
NO disallowed application technology names in added lines (allow-list: Docker, Docker Compose, container, WebSocket)
```
Added lines contain only: "container", "Containerized"/"containers", "`docker compose up`-style",
"WebSocket", "environment variables", "Provider-neutral"/"provider-neutral", "`.env*`". No provider
commitment (no "ECS Fargate" in T4 content).

### Reference resolution — pointer to `docs/architecture/containerization.md`
```
$ test -f docs/architecture/containerization.md && echo EXISTS
EXISTS: yes
$ git ls-files docs/architecture/containerization.md
docs/architecture/containerization.md
```
Both T4 pointers (`reviewer.md:60`, `spec-review/SKILL.md:26`) resolve to the T1-created file.

## Diff-vs-baseline analysis (AC-26, T4 scope)

Baseline = `HEAD` content captured verbatim above. `git diff HEAD -- <five files>` shows **19 added
lines, 0 removed lines**; every hunk is a pure append into an existing list/section.

- **`reviewer.md`** — one added line (l.60) inside `## Rules`, between the real-time bullet and the
  "only write scope" bullet. Frontmatter/`permissions:`/output sections byte-identical to baseline.
- **`spec-review/SKILL.md`** — one added line (l.26) appended to the `## Checklist` list after the
  Real-time item. Inputs/severity/output sections byte-identical.
- **`quality.md`** — one appended section (blank line + `## Containerized delivery (if applicable)` +
  4 `- [ ]` items). All pre-existing sections byte-identical.
- **`security.md`** — one appended section (blank line + `## Containers & images (if applicable)` +
  4 `- [ ]` items). All pre-existing sections byte-identical.
- **`testing.md`** — one appended section (blank line + `## Container coverage (if applicable)` +
  3 `- [ ]` items). All pre-existing sections byte-identical.
- **No drift:** no pre-existing content removed or reworded (contracts 10–14 are additive only — the
  amendment rule restricts in-place modifications to contracts 1/3/6, none of which are T4 files);
  no unrelated edits; no permission/`.env*`/asset changes.

## Acceptance audit (AC-16, AC-20, AC-21, AC-22, AC-23)

| AC | Verdict | Evidence (file:line / command) |
| --- | --- | --- |
| AC-16 | met | `.opencode/skills/spec-review/SKILL.md:26` — one checklist item `- **Containers (when applicable)** …` mirrors the spec-authoring concepts for the spec gate: features adding services/images/ports/configuration/deployables address the containerization contract (`docs/architecture/containerization.md`: local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) or state it out of scope, and stack-dependent container details are open questions. Added content contains "Containers"/"container"; diff = +1 line. |
| AC-20 | met | `.opencode/agents/reviewer.md:60` — one `## Rules` bullet: "For changes touching services, images, ports, configuration, or deployability, verify the containerization contract (`docs/architecture/containerization.md`): single-command local run, environment-based config, no secrets in images, provider-neutral images, and the backend WebSocket endpoint exposed; unverifiable container behavior counts as unmet." Added content contains "container"; diff = +1 line; `permissions:` block untouched (AC-25 check). |
| AC-21 | met | `.opencode/skills/code-review/checklists/quality.md:40–44` — new `## Containerized delivery (if applicable)` section covers: single-command local run preserved (`docker compose up`-style starts the full environment); one image per deployable + reproducible builds; runtime config via environment variables with safe local defaults (no host-specific assumptions); health signal for long-running services + graceful stop. Uses the file's `✅/❌/n/a` + `- [ ]` convention. Diff = +6 lines. |
| AC-22 | met | `.opencode/skills/code-review/checklists/security.md:41–44` — new `## Containers & images (if applicable)` section covers: no secrets in images/layers/compose + `.env*` untouched; deterministic image references; no privileged/escalated privileges + intentional exposed ports; provider-neutral (no provider lock-in/credentials). Uses the file's `✅/❌/n/a` + `- [ ]` convention. Diff = +6 lines. |
| AC-23 | met | `.opencode/skills/code-review/checklists/testing.md:33–36` — new `## Container coverage (if applicable)` section covers: containerized local env starts/serves the full stack (documented smoke check); WebSocket connectivity through the container path (upgrades end-to-end); container build/run checks part of the verification suite once the stack provides commands. Uses the file's `✅/❌/n/a` + `- [ ]` convention. Diff = +5 lines. |
| AC-25 (T4 scope) | met | `git diff` scan → no `permissions:`/`effect: allow`/`effect: deny` lines; `reviewer.md` frontmatter byte-identical to baseline; no `.env*` in `git status`; `opencode.jsonc` untouched. |
| AC-26 (T4 scope) | met | Diff-vs-baseline analysis above — additions only (0 removals); only the content pinned by contracts 10–14; no unrelated edits. |
| AC-28 (T4 scope) | met | Technology scan of added lines → only allow-list vocabulary (Docker, Docker Compose/`docker compose up`, container, WebSocket); no application tech names, no provider name; both `containerization.md` pointers resolve (`test -f` + `git ls-files`). |

## Commit record

- Message (exact): `docs: add container review checks for spec/code gates (T4)` — one commit on `feat/containerized-workflow`.
- Staged paths (explicit `git add` of exactly these six, then pathspec form `git commit -- <paths>`): `.opencode/agents/reviewer.md`, `.opencode/skills/spec-review/SKILL.md`, `.opencode/skills/code-review/checklists/quality.md`, `.opencode/skills/code-review/checklists/security.md`, `.opencode/skills/code-review/checklists/testing.md`, `docs/features/containerized-workflow/build-log-T4.md` — and no others. Never `git add .`/`-A`; never bare `git commit`; no push.
- Expected `git show --stat HEAD` shape — exactly six paths: the five edited files (1 + 6 + 6 + 5 + 1 = 19 insertions, 0 deletions) plus this new build log (`build-log-T4.md`, a new file, so its whole length counts as insertions):

```
 .opencode/agents/reviewer.md                         |  1 +
 .opencode/skills/code-review/checklists/quality.md   |  6 ++++++
 .opencode/skills/code-review/checklists/security.md  |  6 ++++++
 .opencode/skills/code-review/checklists/testing.md   |  5 +++++
 .opencode/skills/spec-review/SKILL.md                |  1 +
 docs/features/containerized-workflow/build-log-T4.md | (new file)
```
The exact `git show --stat HEAD` output (with the final counts and this log's length) is reported in the T4 Subagent Report.

- The commit hash is **not** embedded here: writing it into this log changes the log, hence the hash, so a self-reference can never be true (precedent: `build-log-T3.md` §7, `build-log-T2.md` § Commit record, and the `online-realtime-workflow` logs). The hash and the raw post-commit `git show --stat HEAD` output are reported in the T4 Subagent Report. This section describes only T4's own commit — sibling T2/T3 commits and the branch tip are deliberately not characterized (avoids stale-parent drift).

## Deviations from spec

None. Contracts 10–14 applied additively; plan code blocks (contracts 12–14) reproduced byte-exact;
placement follows each file's existing list/section + `✅/❌/n/a` conventions. No permission edits, no
`.env*`, no application technology names, no new files beyond `files_owned`.
