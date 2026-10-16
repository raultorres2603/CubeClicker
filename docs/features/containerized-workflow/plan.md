---
feature: containerized-workflow
revision: 2
---
# Plan — Containerized Workflow Alignment

## Architecture (documentation "system")

No runtime architecture: static text changes only — no code, containers, data flow, or persisted state. The "documentary architecture" has three layers, all read by future agent sessions:

1. **Project-level truth** — `docs/architecture/stack.md` (canonical: split status + decided delivery path summary + amended hard constraints) and `AGENTS.md` (read every session: split stacking framing + local-run contract; § Commands mirrors the future compose command). A new **`docs/architecture/containerization.md`** carries the durable, binding container requirements (local-run contract, service rules, deploy neutrality, WebSocket requirement, conventions to settle) so `stack.md` stays status-lean and the stack-selection task gets a checklist without fabrication.
2. **Product/planning guidance** — `.opencode/agents/planner.md` + `spec-authoring/references/spec-checklist.md` (specs cover container impact by default) + `task-decomposition/SKILL.md` (container definitions are shared files → `[P]` safety).
3. **Build & review guidance** — `.opencode/agents/builder.md` + `web-implementation/SKILL.md` + `references/engineering-principles.md` (how container assets must be built once the stack lands); `.opencode/agents/reviewer.md` + `spec-review/SKILL.md` + `code-review/checklists/{quality,security,testing}.md` (gate-time container checks).

**Data flow (future sessions):** agent reads `AGENTS.md` → sees the split status (application stack NOT DECIDED; containerized path DECIDED) → planner reads `docs/architecture/containerization.md` before speccing any service/port/config/deployable change → builder follows the container rules when a task authors assets → reviewer applies the container checks at both gates. **Vocabulary pin (consistency):** "container", "containerized delivery path", "Docker", "Docker Compose", "`docker compose up`-style", "WebSocket", "provider-neutral"; no application technology names anywhere (permitted: the pre-existing `AGENTS.md` TypeScript line and the example-only "AWS ECS Fargate" mention).

## Pinned content contracts (per file)

Baseline rule (all files): baseline = file content at that task's build start, captured in `build-log-T<id>.md` (`git show HEAD:<path>` excerpt or verbatim copy); this build-start capture **governs**. Verification: `git diff` vs. that baseline plus the greps named in the ACs. Wording may vary slightly if the required tokens/concepts hold; substance is pinned. **Amendment rule:** the only in-place modifications allowed anywhere are the pinned replacements in contracts 1, 3, and 6; all other changes are additive.

### 1. `docs/architecture/stack.md` (edit, T1)

- **1.A — status line (modification).** `**Status: NOT DECIDED**` becomes: `**Status: NOT DECIDED** (application stack) — **DECIDED:** the containerized delivery path (§ Containerized delivery path; user decision, 2026-10-17).`
- **1.B — rules bullet 1 (modification).** `- Agents MUST NOT introduce, assume, or install any framework, language runtime, build tool, or dependency.` becomes: `- Agents MUST NOT introduce, assume, or install any framework, language runtime, build tool, or dependency beyond the decided containerization tooling (Docker images + Docker Compose; § Containerized delivery path).` Bullets 2–3 unchanged.
- **1.C — new section (addition).** `## Containerized delivery path (DECIDED)` placed between the "Until this file is filled in" bullet list and `## Hard constraints (all candidates)`. Required content (bullets):
  - backend and frontend each run as containers; the full local environment starts from a clean checkout with a single `docker compose up`-style command;
  - Docker images + Docker Compose are the decided containerization tooling (user decision, 2026-10-17);
  - deployable artifacts are container images runnable on any container platform — provider-neutral; AWS ECS Fargate is an example only and no provider is chosen;
  - future services (databases, queues, etc.) are added via the same containerized path;
  - the application stack (language, framework, runtime, tooling, ports) remains NOT DECIDED; concrete container assets (Dockerfiles, compose file) are authored at/after stack selection;
  - the backend container must expose the WebSocket endpoint required by § Hard constraints;
  - binding requirements live in `docs/architecture/containerization.md`.
- **1.D — WebSocket section closing sentence (modification).** `...it names no technology and the stack remains NOT DECIDED until the stack-selection task decides it.` → `...it names no technology, and the application stack remains NOT DECIDED until the stack-selection task decides it.` The two capability bullets and the rationale sentence are retained verbatim.
- **1.E — closing paragraph (addition).** Append one sentence to the "When decided, this file will define: …" paragraph: the stack-selection task must also produce the container assets realizing the decided delivery path (Dockerfiles, compose file) and document the single-command local run (see § Containerized delivery path).

### 2. `docs/architecture/containerization.md` (NEW, T1)

Closed section set: H1 `# Containerized Delivery Path`; a 2–3 line preamble (decided 2026-10-17 per user direction; binding for stack selection and future container work; the application stack remains NOT DECIDED, pointing to `stack.md`); exactly the H2 sections below; no other sections.

- `## Local development contract` — full environment (backend + frontend, and future services) starts from a clean checkout with a single `docker compose up`-style command; no host prerequisites beyond Docker with Compose; when container assets land, run instructions must be documented at the repo root and mirrored in `AGENTS.md` § Commands.
- `## Service containerization rules` — every deployable component builds from this repository into its own container image (image = deployable artifact); future supporting services (databases, queues, etc.) are added through the same path; runtime configuration (ports, endpoints, flags) comes from environment variables with safe local defaults; secrets are injected at run time — never committed or baked into images; `.env*` remains user-owned and off-limits to agents.
- `## Deployment neutrality` — images must run on any container platform with no provider-specific lock-in; AWS ECS Fargate (named by the user) is an example only, with an explicit no-commitment statement; provider selection is a separate future decision not made by this document.
- `## Real-time (WebSocket) requirement` — the backend container exposes the WebSocket endpoint required by `stack.md` § Hard constraints; local and deployed container environments must preserve WebSocket connections end-to-end (no proxy/load balancer that strips connection upgrades); proxy/LB handling is flagged as a deployment-time decision — not designed here (no configuration content).
- `## Conventions to settle at stack selection` — list of items resolved and documented by the stack-selection task: listen ports + environment-variable names (backend HTTP/WebSocket, frontend, future services); health signal per long-running service (compose healthcheck + platform health checks); image naming/tagging convention; compose file location/name and Dockerfile locations; dev-mode behavior (serving mode, rebuild/hot-reload expectations); the exact local-run command(s) documented in the README and mirrored in `AGENTS.md` § Commands.

### 3. `AGENTS.md` (edit, T1)

- **3.A — § Stack bullet 1 (modification).** Current: "- **NOT DECIDED.** The canonical stack lives in ...; the builder reports `blocked` instead of guessing." Becomes: "- **Application stack: NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency beyond the decided containerized delivery path (next bullet); the builder reports `blocked` for stack-dependent implementation instead of guessing."
- **3.B — § Stack new bullet (addition, after 3.A).** "- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `docker compose up`-style command; deployable artifacts are container images runnable on any container platform (AWS ECS Fargate is an example only — no provider is chosen); future services (databases, queues, etc.) join the same path. Docker and Docker Compose are the decided tooling; concrete container assets are authored once the application stack is decided (see `docs/architecture/containerization.md`)."
- **3.C — § Commands new bullet (addition, after the TBD bullet).** "- **Local environment (containerized).** The full local environment will start with a single `docker compose up`-style command (backend + frontend containers) once the container assets land; run instructions will be documented at the repo root and mirrored here."
- The existing WebSocket constraint bullet and the TBD bullet are unchanged. Diff shape: § Stack = 1 modified + 1 added bullet; § Commands = 1 added bullet; no other section changes.

### 4. `.opencode/agents/planner.md` (edit, T2)

Add one bullet to **Rules** (token "container"): specs for features that add services, images, ports, configuration, or deployables must cover their containerization impact per `docs/architecture/containerization.md` (compose service, image, environment-based config, health signal, WebSocket endpoint exposure) — or state it explicitly out of scope — and stack-dependent container details stay open questions until the application stack is decided.

### 5. `.opencode/skills/spec-authoring/references/spec-checklist.md` (edit, T2)

Add section (after the Real-time section):

```markdown
## Containers (when the feature adds services, images, ports, configuration, or deployables)
- [ ] Containerization impact addressed per `docs/architecture/containerization.md` (local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) — or explicitly out of scope
- [ ] Stack-dependent container details flagged as open questions; no container assets specified for an undecided stack
```

### 6. `.opencode/skills/task-decomposition/SKILL.md` (edit, T2)

Rule 5's shared-file examples (modification only): the parenthetical "(package.json, lockfiles, entrypoints, global styles, routers)" gains ", container definitions such as the compose file and Dockerfiles" before the closing paren; `package.json` and the rest of the list stay as-is. No other rule text changes; the template is untouched.

### 7. `.opencode/agents/builder.md` (edit, T3)

Add one bullet to **Rules** (token "container"): the containerized delivery path is decided (`docs/architecture/containerization.md`) — Docker images + Docker Compose, single-command local run, provider-neutral deployment; when a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); container assets still require the application stack — report `blocked` instead of guessing until it is decided.

### 8. `.opencode/skills/web-implementation/SKILL.md` (edit, T3)

Add one bullet to **Architecture rules** (summary + depth pointer, consistent with the existing pattern; token "container"): the delivery path is containerized (`docs/architecture/containerization.md`) — one image per deployable; `docker compose up`-style single-command local dev; runtime config via environment variables (never secrets in images); a health signal per service; backend WebSocket endpoint exposed; provider-neutral images. No container assets before the application stack is decided. Depth in `references/engineering-principles.md` § Containerization principles.

### 9. `.opencode/skills/web-implementation/references/engineering-principles.md` (edit, T3)

Add section `## Containerization principles` with bullets covering at least: **one image per deployable** (frontend, backend, and future services each build from this repo; the image is the deployable artifact); **single-command local run** (full environment from a clean checkout with one `docker compose up`-style command; no host-specific setup beyond Docker + Compose); **config via environment** (ports, endpoints, flags from environment variables with safe local defaults; never bake configuration into images); **no secrets in images** (injected at run time; nothing secret committed, layered, or logged); **health & graceful lifecycle** (health signal per long-running service; clean shutdown without data corruption); **WebSocket end-to-end** (backend container exposes the endpoint; the compose setup keeps upgrades intact, consistent with § Real-time principles); **deploy neutrality** (no provider-specific assumptions; any container platform, e.g. AWS ECS Fargate, can run the images).

### 10. `.opencode/agents/reviewer.md` (edit, T4)

Add one bullet to **Rules** (token "container"): for changes touching services, images, ports, configuration, or deployability, verify the containerization contract (`docs/architecture/containerization.md`) — single-command local run, environment-based config, no secrets in images, provider-neutral images, backend WebSocket endpoint exposed; unverifiable container behavior counts as unmet.

### 11. `.opencode/skills/spec-review/SKILL.md` (edit, T4)

Append to the **Checklist** list one item: **Containers (when applicable)** — features adding services, images, ports, configuration, or deployables address the containerization contract (`docs/architecture/containerization.md`: local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) or state it out of scope; stack-dependent container details are open questions.

### 12. `.opencode/skills/code-review/checklists/quality.md` (edit, T4)

Add section (same ✅/❌/n/a convention):

```markdown
## Containerized delivery (if applicable)
- [ ] Single-command local run preserved (`docker compose up`-style starts the full environment)
- [ ] One image per deployable; images build reproducibly from the repository
- [ ] Runtime config via environment variables with safe local defaults; no host-specific assumptions
- [ ] Health signal present for long-running services; containers stop gracefully
```

### 13. `.opencode/skills/code-review/checklists/security.md` (edit, T4)

Add section:

```markdown
## Containers & images (if applicable)
- [ ] No secrets or credentials baked into images, layers, or compose files; `.env*` untouched
- [ ] Image references deterministic (pinned versions where reproducibility matters)
- [ ] Containers run without privileged/escalated privileges; exposed ports are intentional
- [ ] Provider-neutral: no deployment-provider lock-in or credentials in images/compose
```

### 14. `.opencode/skills/code-review/checklists/testing.md` (edit, T4)

Add section:

```markdown
## Container coverage (if applicable)
- [ ] The containerized local environment starts and serves the full stack (documented smoke check)
- [ ] WebSocket connectivity verified through the container path (upgrades work end-to-end)
- [ ] Container build/run checks are part of the verification suite once the stack provides commands
```

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `docs/architecture/stack.md` | Edit (status line + bullet 1 + WebSocket closing sentence + closing paragraph; +1 section) | Split status; decided delivery path; container deliverable in stack selection | T1 |
| `docs/architecture/containerization.md` | New | Binding durable container requirements (local-run, services, deploy neutrality, WebSocket, conventions) | T1 |
| `AGENTS.md` | Edit (1 modified + 2 added bullets) | § Stack split framing + container bullet; § Commands local-run contract | T1 |
| `.opencode/agents/planner.md` | Edit (+1 rule) | Spec-time containerization obligations | T2 |
| `.opencode/skills/spec-authoring/references/spec-checklist.md` | Edit (+1 section) | Spec-gate container item | T2 |
| `.opencode/skills/task-decomposition/SKILL.md` | Edit (rule 5 example list) | Container definitions = shared files (`[P]` safety) | T2 |
| `.opencode/agents/builder.md` | Edit (+1 rule) | Container engineering obligations + blocked boundary | T3 |
| `.opencode/skills/web-implementation/SKILL.md` | Edit (+1 rule) | Container contract summary + depth pointer | T3 |
| `.opencode/skills/web-implementation/references/engineering-principles.md` | Edit (+1 section) | Container engineering depth | T3 |
| `.opencode/agents/reviewer.md` | Edit (+1 rule) | Container verification obligation | T4 |
| `.opencode/skills/spec-review/SKILL.md` | Edit (+1 item) | Spec-gate container check | T4 |
| `.opencode/skills/code-review/checklists/quality.md` | Edit (+1 section) | Code-gate container quality checks | T4 |
| `.opencode/skills/code-review/checklists/security.md` | Edit (+1 section) | Code-gate container security checks | T4 |
| `.opencode/skills/code-review/checklists/testing.md` | Edit (+1 section) | Code-gate container coverage checks | T4 |
| `docs/features/containerized-workflow/build-log-T1.md` … `-T5.md` | New | Per-task evidence (baselines, diffs, greps, AC audit) | T1…T5 |

Planner artifacts (`spec.md`, `plan.md`, `tasks.md`) and review verdicts (`reviews/**`) are written by the planner/reviewer per the workflow, not by build tasks. All 14 content targets are already inside the builder's current edit allowlist (`AGENTS.md`, `docs/architecture/**`, `.opencode/agents/*.md`, `.opencode/skills/**`, `docs/features/**/build-log*.md`) — **no permission bootstrap task exists in this feature** (contrast: online-realtime-workflow T0).

## Files intentionally unchanged

| Path | Why no change |
| --- | --- |
| `.opencode/agents/orchestrator.md` | Routing/state-machine mechanics are unaffected; container obligations are role-local (planner/builder/reviewer) and the checkpoint already surfaces spec open questions; adding a fourth orchestrator rule would duplicate without changing behavior (D-9). |
| `.opencode/commands/feature.md` | Pure routing into the orchestrator; no container content belongs here. |
| `.opencode/skills/orchestration-playbook/**` | Scheduling mechanics unchanged; §4's shared-file example list is illustrative — the authoritative `[P]`/shared-file rule is task-decomposition rule 5, which contract 6 updates. |
| `.opencode/skills/spec-authoring/SKILL.md`, `templates/spec.md`, `templates/plan.md` | Workflow/template shape unchanged; the container gate lives in the checklist (contract 5) — avoids mandatory "n/a noise" sections. |
| `.opencode/skills/spec-review/templates/review.md`, `.opencode/skills/code-review/SKILL.md`, `templates/review.md`, `.opencode/skills/task-decomposition/templates/tasks.md` | Findings/verdict formats and checklist-running workflow are generic; container checks surface as ordinary findings via the updated checklists. |
| `docs/product/vision.md`, `docs/product/realtime-backlog.md` | Product direction is not changed by a tech-path decision; both were just updated by online-realtime-workflow and are user-owned. |
| `docs/features/README.md`, `docs/features/**/status.md` | Orchestrator-owned process bookkeeping. |
| `src/**`, `tests/**`, `public/**`, config files, `opencode.jsonc` | No application code/tooling/permissions in this feature (application stack NOT DECIDED; AC-25, AC-27). |
| `Dockerfile*`, compose files, CI config | Deliberately not created — assets wait for stack selection (non-goal; AC-27). |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Split the stack status instead of flipping to decided: application stack NOT DECIDED; containerized delivery path DECIDED | The user decided the delivery path (Docker/Compose, local compose run, provider-neutral images) but named no language/framework/runtime — over-deciding would violate scope; the split keeps one canonical truth in `stack.md` | All-in stack.md rewrite — rejected (over-decides); leave stack.md untouched — rejected (canonical file would contradict AGENTS.md and confuse stack selection) |
| D-2 | New `docs/architecture/containerization.md` carries the durable requirements; `stack.md` keeps a summary + pointer | Keeps the canonical status file lean; gives the stack-selection task a binding checklist (ports/health/conventions) without fabricating values; mirrors the docs layering (summary vs. depth) | Everything inline in `stack.md` — rejected (bloat + mixing status with a requirements checklist); requirements as open questions only — rejected (loses the binding contract) |
| D-3 | Docker + Docker Compose recorded as decided containerization tooling (user named them; brief authorizes recording as decided) | The request explicitly names Docker and `docker compose` and asks for "the containerized way" as the project path; recording it stops the pipeline from treating containers as undecided | Keeping tooling undecided — rejected (ignores the user's explicit words); naming extra tooling (registries, orchestrators) — rejected (not asked; over-decides) |
| D-4 | Deployment neutrality recorded with AWS ECS Fargate as an example only | User: "or any other provider, we don't care"; images = portable artifact; no provider commitment is made | Picking a provider — rejected (not asked, explicitly discounted by the user) |
| D-5 | Role distribution: planner/builder/reviewer get one rule each; gates get checklist items; orchestrator unchanged | Matches the established summary/depth pattern from online-realtime-workflow; each role checks what it can see; routing needs no new behavior (D-9) | Blanket-updating every agent/skill file — rejected (bloat, no behavioral need) |
| D-6 | No container asset paths pinned in `AGENTS.md` § Project structure now | Assets don't exist; paths (Dockerfile locations, compose file name) are stack-selection conventions (contract 2 § Conventions) — pre-assigning them now would fabricate layout | Pinning `/Dockerfile`, `/docker-compose.yml` now — rejected (speculative; may fight the eventual stack) |
| D-7 | Container assets explicitly deferred (no Dockerfiles/compose authored) | The application stack is NOT DECIDED: base images, ports, runtimes unknown; the request is about the path, and the brief forbids fabricating implementation | Stack-agnostic placeholder Dockerfiles — rejected (misleading, easily wrong, zero value) |
| D-8 | WebSocket constraint extended to containers (backend container exposes WS endpoint; upgrade preservation flagged) | Online/real-time is the app's core constraint; container/deploy guidance must not silently break it; concrete proxy/LB design stays out (scope discipline) | Leaving WS out of container docs — rejected (gap); designing LB config now — rejected (premature infra design) |
| D-9 | Orchestrator agent file unchanged | Routing, checkpoints, and state-machine transitions don't change; container awareness reaches checkpoints via the planner's spec content/open questions; a second awareness rule duplicates the real-time pattern without new behavior | Adding a container awareness bullet — rejected as no-op bloat; revisit if container work creates a new orchestration obligation |
| D-10 | `task-decomposition` rule 5 example list gains container definitions (compose file, Dockerfiles) | When container assets land, they are touchpoints for many tasks; the `[P]` safety rule must name them or parallel collisions return (the #1 multi-agent failure) | Leaving the list — rejected (the authoritative rule would silently miss the new shared files); updating the playbook instead — rejected (duplicate authority; see § Files intentionally unchanged) |
| D-11 | Baselines captured at build start per task (carried forward from online-realtime-workflow D-10) | Repo state may move; plan-time quotes would go stale | Plan-time-only baselines — rejected as brittle |

## Risks & mitigations

- **Amending pre-existing content** (`AGENTS.md` § Stack bullet 1, `stack.md` status line / rules bullet 1 / WebSocket closing sentence / closing paragraph, task-decomposition rule 5's example list) could read as drift → the amendment set's two provenance classes (pinned by `online-realtime-workflow` vs. previously unpinned) are named in spec § Verification notes (r2) and the set stays bound by plan contract amendment rule; everything else must be additive; reviewer diffs vs. build-start baselines (AC-26).
- **Over-deciding the stack** (Docker becoming a wedge for more choices) → vocabulary pin + AC-28; only Docker/Docker Compose/container vocabulary permitted; assets deferred (D-7).
- **New doc duplicates stack.md** → summary-vs-requirements layering (D-2); cross-links; containerization.md holds only the durable checklist, stack.md the status + summary bullets.
- **Checklist bloat / future "n/a noise"** → all new checklist/skill items are conditional ("if applicable", "when the feature…"); additions capped (~2–7 bullets each).
- **Wording drift vs. pinned contracts** → tokens + concepts per AC; reviewer inspects diffs against contracts; greps recorded in build logs.
- **Baseline staleness across parallel batch T2–T4** → disjoint files_owned; each task captures its own build-start baselines; no shared files touched.
- **Link/pointer resolution** (`containerization.md` referenced before existing) → T1 creates it before T2–T4 reference it; T5 re-checks all references resolve (AC-28).
- **Accidental permission edits** (self-referential `.opencode/**` targets) → AC-25 freezes permissions; reviewer inspects every diff for `permissions:` content; no bootstrap needed (all targets already allowlisted).
- **Reviewer flags the orchestrator/task-decomposition scope choices** → D-9/D-10 rationale here + § Files intentionally unchanged table; reviewer can rebut or escalate at the spec gate.

## Open questions

- **Q-1** — Concrete container conventions (listen ports + env-var names, health signal, image naming, compose location/name, Dockerfile locations, dev-mode behavior, exact command) — deliberately unsettled; recorded as a binding checklist (contract 2 § Conventions) for the stack-selection task to resolve and document.
- **Q-2** — Deployment provider: explicitly open ("ECS Fargate or any other provider, we don't care"); no commitment; future decision.
- **Q-3** — `AGENTS.md` § Project structure not extended with container asset paths now (D-6); confirm acceptable at the checkpoint.
- **Q-4** — Run instructions will live in a repo-root `README.md` created when container assets land (not by this feature); confirm the README home.
- **Q-5** — Docker + Docker Compose recorded as decided tooling (D-3); a future user-owned amendment would be needed to swap container tooling.
- **Q-6** — Frontend deployment shape (container image vs. static hosting) beyond local dev remains open; deploy neutrality unaffected.
- **Q-7** — Stack-selection task scope is not yet written; this spec records container assets + documented conventions as its deliverables (AC-5); confirm the expectation.
