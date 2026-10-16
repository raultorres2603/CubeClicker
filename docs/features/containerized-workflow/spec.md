---
feature: containerized-workflow
revision: 2
status: draft
created: 2026-10-17
updated: 2026-10-17
---
# Spec — Containerized Workflow Alignment

## Summary

Record containerization as the project's decided delivery and local-development path, and update the AI framework so every future workstream follows it. The user has decided (2026-10-17) that backend and frontend run as **containers**, started locally with a single `docker compose up`-style command; that deployable artifacts are **container images runnable on any platform** (AWS ECS Fargate named only as an example — no provider commitment); and that future services (databases, queues, etc.) join via the same containerized path. Docker and Docker Compose are the decided containerization tooling. This feature does **not** decide the application stack: `docs/architecture/stack.md` moves from a single `NOT DECIDED` status to a **split status** — application stack still NOT DECIDED, containerized delivery path DECIDED — and the WebSocket hard constraint (online/real-time, from the accepted online-realtime-workflow feature) is retained and extended to the container path: the backend container must expose the WebSocket endpoint and container/proxy setups must preserve connection upgrades (flagged, not designed). Durable container requirements that depend on stack decisions (ports, health signal, image naming, compose layout, dev-mode) are captured as a binding checklist for the future stack-selection task in a new `docs/architecture/containerization.md`, not fabricated now. Framework updates: `AGENTS.md` (§ Stack split framing + § Commands local-run contract), one container rule each in planner/builder/reviewer agent files, container items in the spec-authoring checklist and spec-review checklist, container rules in the web-implementation skill + engineering principles, container sections in the three code-review checklists, and one shared-file-list amendment in the task-decomposition skill (compose files/Dockerfiles are shared files — parallel-collision prevention). No application code, Dockerfiles, or compose files are authored (stack NOT DECIDED). No permission changes are needed: every target is already within the builder's current edit allowlist (widened by online-realtime-workflow T0). Fourteen target files (13 edits + 1 new doc), per-file pinned content contracts in `plan.md`; all ACs verified by inspection (no project commands exist).

## Scope

### In scope

Fourteen target files, each with a pinned content contract in `plan.md` § Pinned content contracts:

- **Project-level truth (3):** `docs/architecture/stack.md` (split status; rules exception; WebSocket closing sentence scoped to application stack; new `## Containerized delivery path (DECIDED)` section; closing paragraph); `docs/architecture/containerization.md` (NEW: durable container requirements — local-run contract, service rules, deploy neutrality, WebSocket requirement, conventions to settle at stack selection); `AGENTS.md` (§ Stack split framing + container bullet; § Commands local-run contract bullet).
- **Planning guidance (3):** `.opencode/agents/planner.md` (one container rule); `.opencode/skills/spec-authoring/references/spec-checklist.md` (container section); `.opencode/skills/task-decomposition/SKILL.md` (rule 5 shared-file examples gain container definitions).
- **Builder guidance (3):** `.opencode/agents/builder.md` (one container rule); `.opencode/skills/web-implementation/SKILL.md` (one architecture-rule bullet); `.opencode/skills/web-implementation/references/engineering-principles.md` (new `## Containerization principles` section).
- **Reviewer guidance (5):** `.opencode/agents/reviewer.md` (one container rule); `.opencode/skills/spec-review/SKILL.md` (one checklist item); `.opencode/skills/code-review/checklists/quality.md`, `security.md`, `testing.md` (one conditional container section each).
- **Evidence (in feature dir only):** per-task build logs `build-log-T1.md…-T5.md`.

### Explicitly out of scope

- Any Dockerfile, compose file, container asset, CI pipeline, or deployment configuration (the application stack is NOT DECIDED — assets are authored at/after stack selection).
- Any application-stack choice: language, framework, runtime, package manager, build/test tooling, project layout, ports, health mechanisms (recorded as requirements/open questions).
- Any deployment design: provider selection, ECS/Fargate task definitions, load balancers, environments, secret managers (provider neutrality recorded; design deferred).
- Product/docs outside the target list: `docs/product/**` (vision, backlog), `docs/features/**` other than this directory, `docs/features/README.md`.
- Any permission change: no `permissions:` block or allow/deny entry in `.opencode/agents/*.md` or `opencode.jsonc` is touched.
- Orchestrator agent file: unchanged — routing/state-machine mechanics are unaffected; container obligations are role-local (see plan D-9).
- Retrofitting old feature directories or resolving existing open questions of other features.

## User stories

- As a developer, I want the full local environment (backend + frontend) to start with a single `docker compose up`-style command so setup is trivial for anyone with Docker.
- As the project owner, I want the containerized path recorded as the decided tech direction so stack selection, future services, and deployment all follow it.
- As the planner, I want containerization obligations in my rules and checklist so specs cover container impact by default.
- As the builder, I want container engineering rules and the known boundaries (assets wait for stack selection) so implementation never guesses.
- As the reviewer, I want container checks at both gates so the contract is verified once assets exist.
- As a future operator, I want provider-neutral images so the same artifacts run on AWS ECS Fargate or any other container platform with no rework.

## Acceptance criteria

Verification notes: every AC is verified **by inspection** — `AGENTS.md` § Commands is TBD and the application stack is NOT DECIDED, so no project commands exist. `grep`, `git diff`/`git show`, `ls`, `test`, and `git status` may be cited as build-time aids, not project commands. "Build-start baseline" = file content at the task's build start, recorded in `build-log-T<id>.md`; all diffs are checked against that baseline. **Amendment trace:** this feature intentionally changes pre-existing content in exactly three files, as six pinned items; all six trace to this request and any other deviation is drift. **(i) Pinned by the accepted `online-realtime-workflow` feature:** `AGENTS.md` § Stack bullet 1 (pinned as unchanged, sibling AC-3); `docs/architecture/stack.md` status line and rules bullet 1 (pinned as retained, sibling AC-4); the WebSocket-section closing sentence (sibling-authored, pinned by sibling AC-5). **(ii) Pre-existing, previously unpinned content this feature amends:** the `stack.md` closing "When decided…" paragraph and `.opencode/skills/task-decomposition/SKILL.md` rule 5's example list (neither was touched nor pinned by that feature). "Application technology names" below = framework/library/runtime/package/dependency/vendor names; the permitted names are Docker, Docker Compose, container vocabulary, and the WebSocket protocol (plus `AGENTS.md`'s pre-existing TypeScript line, untouched).

- **AC-1** — `docs/architecture/stack.md` status line records the split: the application stack is still NOT DECIDED (contains "NOT DECIDED" qualified as applying to the application stack, e.g. "application stack") and the containerized delivery path is DECIDED (contains "containerized delivery path"; the tooling tokens "Docker"/"Docker Compose" are verified by AC-4(c) and AC-12, not by this status-line test).
- **AC-2** — `docs/architecture/stack.md` rules list: the not-introduce rule now excepts only the decided containerization tooling (added content contains "container"), the `blocked` rule for stack-dependent implementation is retained, and the planner open-questions rule is retained.
- **AC-3** — `docs/architecture/stack.md` retains the WebSocket hard-constraint section (previous capability statements and rationale survive), its closing qualifier is amended so the NOT DECIDED claim is scoped to the application stack, and the section still names no application technology.
- **AC-4** — `docs/architecture/stack.md` gains a section whose heading contains "Containerized delivery path" stating: (a) backend and frontend run as containers locally; (b) a single `docker compose up`-style command starts the full local environment; (c) Docker + Docker Compose are the decided tooling; (d) images are runnable on any container platform — provider-neutral, AWS ECS Fargate as an example only, no provider commitment; (e) future services (databases, queues, etc.) join the same path; (f) concrete container assets are authored at/after stack selection (application stack NOT DECIDED); (g) points to `docs/architecture/containerization.md` as the binding requirements.
- **AC-5** — `docs/architecture/stack.md` closing "When decided…" paragraph lists container assets among the stack-selection task's deliverables (added content mentions "container" and the single-command local run).
- **AC-6** — `docs/architecture/containerization.md` exists with a closed section set: H1, a short decided/status preamble (including the application-stack NOT DECIDED pointer), and exactly the H2 sections `Local development contract`, `Service containerization rules`, `Deployment neutrality`, `Real-time (WebSocket) requirement`, `Conventions to settle at stack selection` — no other H2 sections.
- **AC-7** — Containerization doc local-run contract: the full environment (backend + frontend containers) starts from a clean checkout with a single `docker compose up`-style command; no host prerequisites beyond Docker with Compose; when container assets land, run instructions must be documented at the repository root and mirrored in `AGENTS.md` § Commands (no README is created by this feature).
- **AC-8** — Containerization doc service rules: every deployable component builds from this repository into its own container image (image = deployable artifact); future supporting services (databases, queues, etc.) are added via the same path; runtime config comes from environment variables with safe local defaults; secrets are never committed or baked into images; `.env*` stays user-owned/agent-forbidden.
- **AC-9** — Containerization doc deployment neutrality: images run on any container platform; no provider lock-in; AWS ECS Fargate appears only as an example with an explicit no-commitment statement; provider selection stays a separate future decision.
- **AC-10** — Containerization doc real-time requirement: the backend container exposes the WebSocket endpoint; local and deployed container environments must preserve WebSocket upgrades end-to-end; proxy/load-balancer handling is flagged as a deployment-time decision, not designed (the section contains no proxy/LB configuration).
- **AC-11** — Containerization doc conventions section lists the items to settle at stack selection: listen ports + their environment-variable names; health signal per long-running service; image naming/tagging; compose file location/name and Dockerfile locations; dev-mode behavior; the exact local-run command(s).
- **AC-12** — `AGENTS.md` § Stack records the split: bullet 1 retains NOT DECIDED (scoped to the application stack) and the `blocked` rule; a newly added bullet records the decided containerized delivery path with at least the tokens "Docker", "Docker Compose", "docker compose up", a provider-neutral statement ("any container platform"), "AWS ECS Fargate" marked as example-only, future services, and a pointer to `docs/architecture/containerization.md`; the pre-existing WebSocket constraint bullet is untouched.
- **AC-13** — `AGENTS.md` § Commands retains the TBD/unavailable bullet and gains one bullet stating the local-run contract: the full local environment will start with a single `docker compose up`-style command (backend + frontend containers) once container assets land, with run instructions documented at the repo root and mirrored in § Commands.
- **AC-14** — `.opencode/agents/planner.md` gains one container rule: specs for features that add services, images, ports, configuration, or deployables must cover containerization impact per `docs/architecture/containerization.md` (or state it explicitly out of scope), and stack-dependent container details stay open questions (added content contains "container").
- **AC-15** — `.opencode/skills/spec-authoring/references/spec-checklist.md` gains a conditional container section requiring containerization impact addressed (or out of scope) per the containerization doc and stack-dependent container details as open questions (added content contains "Container" or "container").
- **AC-16** — `.opencode/skills/spec-review/SKILL.md` gains one checklist item mirroring AC-15's concepts for the spec gate (added content contains "Container" or "container").
- **AC-17** — `.opencode/agents/builder.md` gains one container rule: the containerized path is decided per the containerization doc; tasks authoring container assets must follow the contract (env config, no secrets in images, health signal, backend WebSocket endpoint, provider-neutral); container assets still require the application stack — report `blocked` until decided (added content contains "container").
- **AC-18** — `.opencode/skills/web-implementation/SKILL.md` gains one architecture-rule bullet summarizing the container contract (one image per deployable; `docker compose up`-style single-command local dev; config via environment variables; no secrets in images; health signal; WebSocket endpoint exposed; provider-neutral; no assets before stack decision) with a pointer to `references/engineering-principles.md` § Containerization principles (added content contains "container").
- **AC-19** — `.opencode/skills/web-implementation/references/engineering-principles.md` gains a `## Containerization principles` section covering at least: one image per deployable; single-command local run; config via environment variables with local defaults; no secrets in images; health signal + graceful lifecycle; WebSocket end-to-end exposure; deploy neutrality.
- **AC-20** — `.opencode/agents/reviewer.md` gains one container rule: for changes touching services, images, ports, configuration, or deployability, verify the containerization contract; unverifiable container behavior counts as unmet (added content contains "container").
- **AC-21** — `.opencode/skills/code-review/checklists/quality.md` gains a conditional container section covering at least: single-command local run preserved; one image per deployable / reproducible builds; env-based config; health signal + graceful stop.
- **AC-22** — `.opencode/skills/code-review/checklists/security.md` gains a conditional container section covering at least: no secrets in images/layers/compose; deterministic image references; no privileged requirement + intentional exposed ports; provider-neutral images.
- **AC-23** — `.opencode/skills/code-review/checklists/testing.md` gains a conditional container section covering at least: containerized local environment starts/serves the full stack; WebSocket connectivity through the container path; container build/run checks enter the verification suite once stack commands exist.
- **AC-24** — `.opencode/skills/task-decomposition/SKILL.md` rule 5's shared-file examples now include container definitions (compose file / Dockerfiles); the rest of the rule (and the skill) is unchanged.
- **AC-25** — No task commit modifies any `permissions:` block or allow/deny entry in `.opencode/agents/*.md` or `opencode.jsonc` (this feature makes zero permission changes); no `.env*` file is created, edited, or committed.
- **AC-26** — For each of the 14 target files, the diff vs. its task's build-start baseline contains only the additions/amendments pinned in `plan.md` § Pinned content contracts, with in-place modifications limited to the amendment trace named in the Verification notes (three files); no pre-existing content is removed beyond those pinned replacements; no unrelated edits.
- **AC-27** — The aggregate diff adds no implementation assets: no `Dockerfile*`, no compose file, no CI/config, no dependencies, no `src/`, `tests/`, or `public/` changes (application stack NOT DECIDED).
- **AC-28** — Cross-file consistency: every edited file's stack-status statements agree with `docs/architecture/stack.md` (application stack NOT DECIDED; containerized path DECIDED); `docs/architecture/containerization.md` exists wherever referenced; the only technology names introduced anywhere in the new content are Docker, Docker Compose, container vocabulary, and WebSocket; "AWS ECS Fargate" appears only with example-only/no-commitment framing; no application technology or provider commitment is introduced.

## Non-goals

- No application code, Dockerfiles, compose files, tests, dependencies, or tooling (documentation/config-content only; application stack NOT DECIDED).
- No application-stack decisions (language, framework, runtime, build/test tooling, package manager, layout, ports, health mechanism).
- No deployment design or provider selection (no ECS task definitions, LBs, environments, secret managers, CI).
- No product-doc changes (`docs/product/**` untouched); no changes to other features' artifacts or `docs/features/README.md`.
- No permission changes anywhere; no `.env*`; no secrets; no push.
- No orchestrator-rule change (routing unaffected — plan D-9); no retrofitting of unrelated docs.

## Boundaries

- ✅ Always: follow the pinned per-file contracts exactly; capture build-start baselines and per-AC inspection evidence in `build-log-T<id>.md`; keep edits additive/minimal; respect that `AGENTS.md`, `docs/architecture/**`, and `.opencode/**` are shared user-owned config.
- ⚠️ Ask first: any addition beyond the pinned contracts; altering the decided-tooling framing (Docker/Compose) or deployment-neutrality statement; touching any file outside the 14-target inventory; changing a permissions block (should be never — AC-25).
- 🚫 Never: introduce application technologies, container assets, or dependencies; change permissions or `opencode.jsonc`; edit `.env*`; commit secrets; rewrite pre-existing content beyond the pinned amendments; resolve the open questions in § Open questions unilaterally.

## Security considerations

- **No permission change:** unlike online-realtime-workflow, this feature touches no permissions — all 14 targets are already inside the builder's allowlist (`AGENTS.md`, `docs/architecture/**`, `.opencode/agents/*.md`, `.opencode/skills/**`, `docs/features/**/build-log*.md`). AC-25 freezes this; the reviewer inspects every diff for permission content.
- **Instruction-content safety:** the new rules instruct future container work (no secrets in images, env-injected config, `.env*` off-limits) — this feature itself writes no secrets and runs no containers; supply chain unchanged (no dependencies).
- **User-controlled data/persistence:** not applicable (docs-only); no runtime surface added.
- **Self-referential edits:** the feature updates agent/skill files that govern the pipeline; all edits are content-only, pinned, baseline-diffed (AC-26), and git-revertible with no push.
- **Future-execution note:** container commands will be executed by future tasks under the existing shell allowlist; no new shell permissions are added now.

## Testing strategy

- No automated commands exist (`AGENTS.md` § Commands: TBD; application stack NOT DECIDED) → every AC is verified by inspection, per the Task Brief.
- Evidence per task: build log with (a) build-start baseline capture per edited file (`git show HEAD:<path>` excerpt or verbatim copy), (b) `git diff` output vs. baseline, (c) per-AC inspection table, (d) `grep` anchor outputs for tokens named in ACs.
- Reviewer re-verifies independently: reads each target file's added content, reruns greps, inspects diffs for AC-25/AC-26, checks cross-file consistency (AC-28), treats anything unverifiable as unmet.
- Edge cases addressed by construction: baseline drift (build-start capture governs), wording drift (tokens + concepts), reference resolution (`containerization.md` must exist before dependent checks — T1 sequence), accidental permission edits (AC-25), fabricated assets (AC-27), over-decided tech names (AC-28).

## Real-time considerations

- This feature changes no runtime behavior and touches no shared/cross-client state → connection lifecycle, reconnection, multi-client behavior, and server authority for shared values are **out of scope here** (owned by application features per the accepted online-realtime-workflow rules).
- The container path is required to stay consistent with the WebSocket hard constraint: the containerization doc must require the backend container to expose the WebSocket endpoint and must flag upgrade preservation through proxy/LB as a deployment-time decision (AC-3, AC-10); no proxy/LB design is done (scope control).
- Identity vs. "no accounts": not implicated — no identity surface is touched; Q-6 of online-realtime-workflow remains open there, unaffected.

## Open questions

- **Q-1** — Concrete container conventions (listen ports and env-var names, health signal, image naming/tagging, compose file location/name, dev-mode behavior) are deliberately unsettled; they are recorded as a binding checklist (AC-11) for the stack-selection task, which must resolve and document them.
- **Q-2** — Deployment provider: explicitly open (user: "ECS Fargate or any other provider, we don't care"); no commitment recorded; a future deployment decision resolves it.
- **Q-3** — `AGENTS.md` § Project structure is deliberately not extended with container asset paths now; locations land with stack selection (see plan § Files intentionally unchanged / D-6). Confirm acceptable.
- **Q-4** — Run instructions home: `README.md` at the repo root does not exist yet; it is expected to be created when container assets land (not by this feature). Confirm README is the desired home.
- **Q-5** — Docker + Docker Compose are recorded as the decided container tooling per the request's explicit naming; if the user prefers alternative container tooling (e.g., Podman), that is a user-owned amendment in a future feature.
- **Q-6** — Frontend deployment shape: container for local dev is decided; production frontend as container image vs. static hosting both remain possible (deploy neutrality unaffected). This spec follows the user's "containers on both" direction; a future deployment decision may refine it.
- **Q-7** — The stack-selection task's scope is not yet written; this spec records container assets (Dockerfiles, compose, documented conventions) as its deliverables (AC-5). Confirm that expectation at the checkpoint.

## Assumptions

- Docker + Docker Compose may be recorded as decided tooling (user named them explicitly; brief authorizes recording as decided); the request's "for example" latitude preserves room for a future user-owned tooling swap (Q-5).
- `docker compose up`-style denotes the single-command local-run contract; the exact command shape is refined at stack selection (Q-1) without weakening the contract.
- All 14 targets are writable by the builder under the current allowlist (post online-realtime-workflow T0) — no permission bootstrap exists in this feature's tasks.
- Wording latitude is bounded by the tokens/concepts pinned in `plan.md`; baselines are captured at build start per task.
- The three-file amendment set (AGENTS.md, stack.md, task-decomposition SKILL.md) fully reconciles the new direction with the previously pinned "NOT DECIDED / names no technology" wording where such pinning exists (plus the two previously unpinned passages named in the amendment trace); everything else in those files stays byte-identical.
- The framework-update file set (14 targets) reflects "update, if needed": orchestrator, commands/feature.md, product docs, templates, and code-review/spec-review workflow files are intentionally unchanged (plan § Files intentionally unchanged lists reasons).
- No application-stack decision is implied by any wording introduced here.

## Revision history

- r1 — 2026-10-17 — initial draft.
- r2 — 2026-10-17 — spec-r1 review fixes (`reviews/spec-r1.md`). **F1** fixed via reviewer direction (b) — least churn that preserves intent: AC-1's status-line test now asserts only the split; `"Docker"; "Docker Compose"` dropped from AC-1 (the tokens remain pinned by AC-4(c) and AC-12; the rules bullet's tooling reference stays bound by AC-2/AC-26); plan contract 1.A kept as reviewed — T1 build target frozen; T1 `verify:` grep re-checked — file-wide token coverage unaffected, no edit needed. **F2** fixed: ⚠️ boundary count "16-target" → "14-target". **F3** fixed: Amendment trace now distinguishes two provenance classes — (i) content pinned by the accepted `online-realtime-workflow` feature (`AGENTS.md` § Stack bullet 1 — pinned as unchanged, sibling AC-3; `stack.md` status line and rules bullet 1 — pinned as retained, sibling AC-4; WebSocket closing sentence — sibling-authored, pinned by sibling AC-5) and (ii) pre-existing, previously unpinned content this feature amends (`stack.md` closing paragraph; task-decomposition rule 5 example list); six-item set unchanged; § Assumptions reworded ("where such pinning exists"); plan § Risks bullet mirrored. **F4** fixed: build-time aids whitelist gains `test` and `git status` (spec Verification notes + tasks.md verification note). **F5** no change (reviewer: none required for this spec) — the playbook §4 asymmetry stays recorded (plan D-10 / § Files intentionally unchanged); a future framework-touching feature may fold the one-word playbook edit. Optional parity item (review l.48 note) not folded: importing the sibling's "pinned replacement = modification, never added/deleted" accounting sentence would make AC-2's "added content contains 'container'" pin stop evidencing the amended rules bullet (contract 1.B's replacement text would be net-new-excluded under that definition) — the r1-F1 conflict class; AC-26's "beyond those pinned replacements" exception already covers the ground (per that note itself). No scope, contract, or AC semantics changed beyond the F1 alignment; plan.md revision → 2; tasks.md otherwise stable.
