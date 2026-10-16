# Build log — T3 — Builder guidance: agent rule + web skill + principles

Task: T3 (`docs/features/containerized-workflow/tasks.md` § T3), 2026-10-17, branch `feat/containerized-workflow`.
Files changed: `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md`, `docs/features/containerized-workflow/build-log-T3.md`.

What changed & why (≤5 lines):
1. `builder.md` Rules gained one additive bullet: containerized path decided (Docker images + Docker Compose, single-command local run, provider-neutral), follow the contract when authoring container assets, `blocked` until the application stack is decided (plan contract 7 / AC-17).
2. `web-implementation/SKILL.md` Architecture rules gained one additive bullet: container-contract summary + depth pointer to `references/engineering-principles.md` § Containerization principles — the established summary/depth idiom (plan contract 8 / AC-18).
3. `engineering-principles.md` gained the appended `## Containerization principles` section with seven bullets (plan contract 9 / AC-19).
4. All three edits are additive only — no line removed, no in-place modification (plan § Pinned content contracts § Amendment rule).
5. No `permissions:` block, allow entry, or deny entry touched anywhere (AC-25).

Decisions:
- Baseline = `git show HEAD:<path>` captured before the first edit (D-11); HEAD at build start was `ffadd1d4b6d678bf5f8e0489c208e367e880d0f5` (sibling batch commits may advance the branch; the build-start capture governs).
- Placement is additive and pattern-consistent: `builder.md` bullet directly after the existing stack rule (same "stack boundary" topic); `SKILL.md` bullet directly after the Real-time bullet (the other depth-pointer bullet); principles section appended after § Real-time principles.
- No new files beyond `files_owned`; no container assets; no application tech names beyond the allow-list (Docker, Docker Compose, container vocabulary, WebSocket; AWS ECS Fargate example-only).

## Build-start baselines

Captured with `git show HEAD:<path>` before editing (copy kept for diffing at `/tmp/opencode/t3-baselines/`, outside the repo).

| Path | Baseline md5 (`git show HEAD:<path> \| md5sum`) | Baseline lines | Post-edit md5 | Post-edit lines |
| --- | --- | --- | --- | --- |
| `.opencode/agents/builder.md` | `c9a4aa19becfe7f4338ed88ee255fce3` | 102 | `0bcc20f4b7e54c6e8ca2d1f895ef0acb` | 103 |
| `.opencode/skills/web-implementation/SKILL.md` | `23ff097b2262ffb8a7bc3a20ad72674c` | 58 | `0a92a18a8c63e2737e35ce3efa3d6194` | 59 |
| `.opencode/skills/web-implementation/references/engineering-principles.md` | `69a8a32e71be2cb746004d61a41fe158` | 52 | `0406ed733615807bab8b93d8dc49b0d0` | 62 |

Working tree matched HEAD for all three paths at build start (empty `git diff HEAD -- <paths>` output), so the baselines are also the pre-edit working-tree content.

Baseline excerpts around each edit anchor:

`git show HEAD:.opencode/agents/builder.md` (lines 91–95):
```
- Load the `web-implementation` skill before acting; its rules and Definition of Done are binding.
- Real-time: shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules.
- The stack is whatever `AGENTS.md` and `docs/architecture/stack.md` say. If the stack is NOT DECIDED, report `blocked` — never introduce tooling, frameworks, or dependencies on your own.
- Read before you write: spec, plan, your task section, and the files you will touch.
- Stay inside your task's `files_owned`. Out-of-scope edits are a reportable failure.
```
(¶ `builder.md` baseline includes the T0-widened `permissions:` block, lines 7–82 — byte-identical after the edit; see AC-25 evidence.)

`git show HEAD:.opencode/skills/web-implementation/SKILL.md` (lines 23–27):
```
- Game logic is pure and framework-free: functions over explicit state in `src/core/` (or the stack's equivalent). No DOM or timers inside pure logic — time and randomness come in as parameters.
- Rendering/UI subscribes to state; it does not own it. Single source of truth for game state.
- One place owns `requestAnimationFrame`/interval usage; clean up on teardown. No leaks.
- Real-time (WebSocket): one owner for the connection lifecycle (connect → open → close → reconnect); reconnection is bounded and resyncs state; shared/cross-client state is server-authoritative (the client never trusts reported values); teardown closes connections and removes handlers. Depth in `references/engineering-principles.md` § Real-time principles.
- Persistence: versioned save schema plus a migration function; validate on load; a corrupt save must never crash the game.
```

`git show HEAD:.opencode/skills/web-implementation/references/engineering-principles.md` (lines 45–52, file tail):
```
## Real-time (WebSocket) principles

- **Single connection owner.** One module owns the socket and its lifecycle; the rest of the UI observes connection status and never opens its own socket.
- **Lifecycle & reconnection.** Reconnection is bounded (retry limit/backoff) and resyncs state on success; handlers are idempotent, so reconnecting never registers duplicates or double-applies server state.
- **Server authority.** Shared/global values (counters, presence, leaderboards) come from the server; optimistic UI must reconcile with the server's answer, and client-reported values are never treated as truth.
- **Untrusted inbound data.** Treat every inbound message as untrusted: validate its shape and type, ignore unknown messages and fields, and render untrusted text via `textContent`, never `innerHTML`.
- **Graceful degradation.** Connection loss is visible (a clear status) and non-fatal: local play and saves keep working and resync when the connection returns.
- **Testability.** Connection logic takes its socket/transport as an injected, fakeable dependency; reconnects, closes, and inbound messages are simulated, so tests need no real network.
```

## Evidence — § T3 verify commands

### 1. `grep -in "container" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md`

```
.opencode/agents/builder.md:94:- Containerized delivery path (decided): Docker images + Docker Compose, single-command local run, provider-neutral deployment — see `docs/architecture/containerization.md`. When a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); container assets still require the application stack — report `blocked` instead of guessing until it is decided.
.opencode/skills/web-implementation/SKILL.md:27:- Containerized delivery (`docs/architecture/containerization.md`): one image per deployable; `docker compose up`-style single-command local dev; runtime config via environment variables (never secrets in images); a health signal per service; backend WebSocket endpoint exposed; provider-neutral images. No container assets before the application stack is decided. Depth in `references/engineering-principles.md` § Containerization principles.
.opencode/skills/web-implementation/references/engineering-principles.md:54:## Containerization principles
.opencode/skills/web-implementation/references/engineering-principles.md:56:- **One image per deployable.** Frontend, backend, and future services each build from this repository into their own container image; the image is the deployable artifact (`docs/architecture/containerization.md`).
.opencode/skills/web-implementation/references/engineering-principles.md:61:- **WebSocket end-to-end.** The backend container exposes the WebSocket endpoint and the compose setup preserves connection upgrades — consistent with § Real-time (WebSocket) principles.
.opencode/skills/web-implementation/references/engineering-principles.md:62:- **Deploy neutrality.** No provider-specific assumptions; the images run on any container platform (AWS ECS Fargate is an example only, not a commitment).
```
Result: match found in all three files; exit status 0.

### 2. `git diff HEAD -- .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md` vs. build-start baselines

Diffstat:
```
 .opencode/agents/builder.md                                    |  1 +
 .opencode/skills/web-implementation/SKILL.md                   |  1 +
 .../web-implementation/references/engineering-principles.md    | 10 ++++++++++
 3 files changed, 12 insertions(+)
```

Full diff:
```diff
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index 29921e3..d32f962 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -91,6 +91,7 @@ You are the CubeClicker builder — a subagent and web technologies specialist.
 - Load the `web-implementation` skill before acting; its rules and Definition of Done are binding.
 - Real-time: shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules.
 - The stack is whatever `AGENTS.md` and `docs/architecture/stack.md` say. If the stack is NOT DECIDED, report `blocked` — never introduce tooling, frameworks, or dependencies on your own.
+- Containerized delivery path (decided): Docker images + Docker Compose, single-command local run, provider-neutral deployment — see `docs/architecture/containerization.md`. When a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); container assets still require the application stack — report `blocked` instead of guessing until it is decided.
 - Read before you write: spec, plan, your task section, and the files you will touch.
 - Stay inside your task's `files_owned`. Out-of-scope edits are a reportable failure.
 - Verify: run the task's `verify` commands and record raw evidence in `build-log-<taskid>.md`. Never claim success without command output.
diff --git a/.opencode/skills/web-implementation/SKILL.md b/.opencode/skills/web-implementation/SKILL.md
index 20b0415..4fe1c6c 100644
--- a/.opencode/skills/web-implementation/SKILL.md
+++ b/.opencode/skills/web-implementation/SKILL.md
@@ -24,6 +24,7 @@ You implement exactly one task (or a small parallel-safe batch) per invocation,
 - Rendering/UI subscribes to state; it does not own it. Single source of truth for game state.
 - One place owns `requestAnimationFrame`/interval usage; clean up on teardown. No leaks.
 - Real-time (WebSocket): one owner for the connection lifecycle (connect → open → close → reconnect); reconnection is bounded and resyncs state; shared/cross-client state is server-authoritative (the client never trusts reported values); teardown closes connections and removes handlers. Depth in `references/engineering-principles.md` § Real-time principles.
+- Containerized delivery (`docs/architecture/containerization.md`): one image per deployable; `docker compose up`-style single-command local dev; runtime config via environment variables (never secrets in images); a health signal per service; backend WebSocket endpoint exposed; provider-neutral images. No container assets before the application stack is decided. Depth in `references/engineering-principles.md` § Containerization principles.
 - Persistence: versioned save schema plus a migration function; validate on load; a corrupt save must never crash the game.
 - DRY without premature abstraction: extract on the third repetition, not the first. KISS: prefer the boring solution. YAGNI: build what the task asks, nothing speculative.
 - `textContent`, never `innerHTML`, for user-controlled strings. No `eval`, no remote code.
diff --git a/.opencode/skills/web-implementation/references/engineering-principles.md b/.opencode/skills/web-implementation/references/engineering-principles.md
index ac28405..d223add 100644
--- a/.opencode/skills/web-implementation/references/engineering-principles.md
+++ b/.opencode/skills/web-implementation/references/engineering-principles.md
@@ -50,3 +50,13 @@ Extract on the third repetition, not the first. Two similar lines are cheaper th
 - **Untrusted inbound data.** Treat every inbound message as untrusted: validate its shape and type, ignore unknown messages and fields, and render untrusted text via `textContent`, never `innerHTML`.
 - **Graceful degradation.** Connection loss is visible (a clear status) and non-fatal: local play and saves keep working and resync when the connection returns.
 - **Testability.** Connection logic takes its socket/transport as an injected, fakeable dependency; reconnects, closes, and inbound messages are simulated, so tests need no real network.
+
+## Containerization principles
+
+- **One image per deployable.** Frontend, backend, and future services each build from this repository into their own container image; the image is the deployable artifact (`docs/architecture/containerization.md`).
+- **Single-command local run.** The full environment starts from a clean checkout with one `docker compose up`-style command; no host-specific setup beyond Docker + Compose.
+- **Config via environment.** Ports, endpoints, and flags come from environment variables with safe local defaults; configuration is never baked into the image.
+- **No secrets in images.** Secrets are injected at run time; nothing secret is committed, layered, or logged, and `.env*` stays user-owned.
+- **Health & graceful lifecycle.** Every long-running service exposes a health signal and stops cleanly without data corruption.
+- **WebSocket end-to-end.** The backend container exposes the WebSocket endpoint and the compose setup preserves connection upgrades — consistent with § Real-time (WebSocket) principles.
+- **Deploy neutrality.** No provider-specific assumptions; the images run on any container platform (AWS ECS Fargate is an example only, not a commitment).
```

### 3. Additive-only check (amendment rule, plan § Pinned content contracts)

```
$ git diff HEAD -- .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md | grep -E '^-[^-]'
(no output; exit 1 — no removed/modified content lines)
```

Diff-vs-baseline (per-file `diff` against the captured copies) confirms pure additions at these anchors:
```
--- .opencode/agents/builder.md
93a94            (one added line after baseline line 93)
--- .opencode/skills/web-implementation/SKILL.md
26a27            (one added line after baseline line 26)
--- .opencode/skills/web-implementation/references/engineering-principles.md
52a53,62         (blank line + 10-line section appended after baseline line 52)
```
No `<` (baseline-only) lines in any of the three diffs → no baseline content removed or modified.

### 4. AC-25 permission freeze check

```
$ git diff HEAD -- .opencode/agents/builder.md | grep -ci "permissions\|effect:"
0
```
The `permissions:` block (baseline lines 7–82, including the T0-widened edit allowlist) is untouched: the only diff hunk in `builder.md` is `@@ -91,6 +91,7 @@` inside § Rules. `opencode.jsonc` is not in `files_owned` and was not edited.

### 5. AC-28 technology scan on the added lines

```
$ git diff HEAD -- <three paths> | grep -E '^\+' | grep -v '^+++' | grep -ioE 'docker compose up|docker compose|docker|podman|kubernetes|k8s|node|typescript|react|vue|svelte|vite|express|fastify|npm|yarn|pnpm|deno|bun|python|java|golang|rust|nginx|aws|azure|gcp' | sort | uniq -c
      1 AWS
      2 Docker
      1 Docker Compose
      2 docker compose up
```
Only allow-listed vocabulary appears: Docker, Docker Compose, `docker compose up`, container vocabulary, WebSocket, and the example-only "AWS ECS Fargate" (framed "an example only, not a commitment"). No application technology or provider commitment introduced.

### 6. `git status --short` (scope check)

```
 M .opencode/agents/builder.md
 M .opencode/agents/planner.md
 M .opencode/agents/reviewer.md
 M .opencode/skills/code-review/checklists/quality.md
 M .opencode/skills/code-review/checklists/security.md
 M .opencode/skills/code-review/checklists/testing.md
 M .opencode/skills/spec-authoring/references/spec-checklist.md
 M .opencode/skills/spec-review/SKILL.md
 M .opencode/skills/task-decomposition/SKILL.md
 M .opencode/skills/web-implementation/SKILL.md
 M .opencode/skills/web-implementation/references/engineering-principles.md
 M docs/features/README.md
 M docs/features/online-realtime-workflow/status.md
?? docs/features/containerized-workflow/plan.md
?? docs/features/containerized-workflow/reviews/
?? docs/features/containerized-workflow/spec.md
?? docs/features/containerized-workflow/status.md
?? docs/features/containerized-workflow/tasks.md
```
Sibling T2/T4 files are dirty in the shared working tree — not staged or committed by T3 (commit used explicit `git add` of the three edited paths plus this log, and the pathspec form `git commit -- <paths>`; see the commit stat below). The unrelated `docs/features/README.md` and `docs/features/online-realtime-workflow/status.md` modifications, and the untracked process files, are left exactly as found.

### 7. Commit stat

Commit subject: `docs: add container engineering guidance for builder and web skill (T3)` — one commit on `feat/containerized-workflow`, staging only this task's `files_owned` (explicit `git add` of the four paths, then `git commit -- <paths>`).

```
$ git show --stat HEAD      # 4 files changed, 238 insertions(+)
 .opencode/agents/builder.md                                              |  1 +
 .opencode/skills/web-implementation/SKILL.md                             |  1 +
 .opencode/skills/web-implementation/references/engineering-principles.md | 10 ++++++++++
 docs/features/containerized-workflow/build-log-T3.md                     | 226 +…
```

The commit hash is not embedded here: writing it into this log changes the log, hence the hash, so a self-reference can never be true. The hash of this task's commit is reported in the T3 Subagent Report. This section describes only T3's own commit — sibling T2/T4 commits and the branch tip are deliberately not characterized.

## Acceptance audit

| AC | Status | Evidence |
| --- | --- | --- |
| **AC-17** — `builder.md` gains one container rule: containerized path decided per the containerization doc; tasks authoring container assets follow the contract (env config, no secrets in images, health signal, backend WebSocket endpoint, provider-neutral); container assets still require the application stack → report `blocked` until decided; added content contains "container". | met | `builder.md` line 94 (single added rule bullet, evidence §1 line 1): states the decided path with the `docs/architecture/containerization.md` pointer, lists env-based config / no secrets in images / health signal / backend WebSocket endpoint / provider-neutral, and ends "container assets still require the application stack — report `blocked` instead of guessing until it is decided." Diff is a single `+` line (§2, §3). |
| **AC-18** — `web-implementation/SKILL.md` gains one architecture-rule bullet summarizing the container contract (one image per deployable; `docker compose up`-style single-command local dev; config via environment variables; no secrets in images; health signal; WebSocket endpoint exposed; provider-neutral; no assets before stack decision) with a pointer to `references/engineering-principles.md` § Containerization principles; added content contains "container". | met | `SKILL.md` line 27 (evidence §1 line 2) contains every listed element verbatim in summary form and closes with "Depth in `references/engineering-principles.md` § Containerization principles." — the existing summary/depth idiom (matches the Real-time bullet pattern). Single `+` line (§2, §3). |
| **AC-19** — `engineering-principles.md` gains a `## Containerization principles` section covering at least: one image per deployable; single-command local run; config via environment variables with local defaults; no secrets in images; health signal + graceful lifecycle; WebSocket end-to-end exposure; deploy neutrality. | met | `engineering-principles.md` lines 54–62 (evidence §1 lines 3–6, full section in §2): `## Containerization principles` with seven bullets — **One image per deployable**; **Single-command local run**; **Config via environment** ("with safe local defaults"); **No secrets in images**; **Health & graceful lifecycle**; **WebSocket end-to-end**; **Deploy neutrality**. Appended after § Real-time principles; only additions (§3). |

Boundary constraints re-checked:
- **AC-25** — met for T3: zero `permissions:` / `effect:` lines in the diff (§4); `builder.md`'s T0-widened allowlist untouched; `opencode.jsonc` not edited; no `.env*` created/edited/committed.
- **AC-28** — met for T3: added vocabulary limited to Docker, Docker Compose, `docker compose up`, container vocabulary, WebSocket, plus example-only AWS ECS Fargate (§5); no application technology or provider commitment.
- **AC-26 (T3 portion)** — met: diff vs. build-start baseline is additive-only, three single-anchor additions, no pre-existing content removed or modified (§2, §3).
- **AC-27** — met: no `Dockerfile*`, compose file, CI/config, dependency, or `src/`/`tests/`/`public/` change; only `.md` files under `.opencode/**` and this feature's build log.

## Deviations from spec

None. All three edits are additive; no in-place modification of pre-existing content (contracts 7–9 pin additions only), so the amendment trace is unaffected.

Baseline note: `HEAD` at T3 build start was `ffadd1d4b6d678bf5f8e0489c208e367e880d0f5`; the branch tip may advance via sibling T2/T4 commits — the build-start baselines above govern this task's diff.
