# Tasks — Application Stack Selection

Dependency overview: `T0 → T1 → {T2, T2b} → T2c → T3 → {T4, T5} → {T4b, T5b} → T6 → T6b → T7`. `{T2, T2b}`, `{T4, T5}`, and `{T4b, T5b}` are `[P]` batches (pairwise disjoint `files_owned`, no shared files; T4b applies after T4, T5b after T5). `T2c`, `T3`, `T6`, `T6b`, and `T7` are `[seq]`. T6 depends on T4, T5, T4b, T5b; T6b depends on T3, T4b, T5b, T6 (its T6 dependency is satisfied by T6's landed deliverable commit `03772b1`); T7 depends on T6b and is the final verification gate before code review.

**Task board:** T0 [x] · T1 [x] · T2 [x] · T2b [x] · T2c [x] · T3 [x] · T4 [x] · T5 [x] · T4b [x] · T5b [x] · T6 [x] · T6b [x] · T7 [x]. T6/T6b closed on green runs (2026-10-18; `build-log-T6b.md` § 3).

**Revision r5 — SELinux bind-mount relabel pin amendment (T6 first live sequence, 2026-10-18).** The T6 containerized sequence is blocked at the bind-mount layer: the verified host runs SELinux Enforcing (`user_home_t` sources), both dev containers exit `243` (`EACCES` on `/app/src/*/package.json`) and the smoke container cannot read `/smoke` (`MODULE_NOT_FOUND`; `build-log-T6.md` § 3–§ 4). Resolved as the repo-carried pin amendment (candidate B in the log): the three pinned bind mounts gain the shared relabel option — `:z` on both workspace mounts, `:ro,z` on the smoke mount (`plan.md` contracts 5/6) — applied by the new **T6b**, which re-runs T6's pinned end-to-end sequence with `tests/e2e/smoke.mjs` unchanged (`03772b1`) and closes AC-26/AC-27; T6 stays `[>]` (blocked-partial) until T6b is green. Manual `chcon`-style host preconditions (candidate A) and host-wide `label = false` (candidate C) are rejected. T0–T5b sections and all build logs stay as executed; T6's blocked log stays as executed evidence.

**Revision r4 — provider-compat pin amendment (T4/T5 first live builds, 2026-10-18).** Two provider divergences logged by T4/T5 are resolved as pin amendments: (1) every base-image token is registry-qualified (`docker.io/library/node:24-alpine`; `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` — same images/tags) in both Dockerfiles and the smoke image row (the verified host enforces short-name resolution without a TTY — `build-log-T5.md` § Divergences 1); (2) every bare CLI build is `podman build --format docker --target …` because Podman 5's default OCI build format drops the declared `HEALTHCHECK` (`build-log-T4.md` § 5.1) while the compose-provider build path keeps it (§ 5.2) — so `compose.yaml`, contract 5 (no healthcheck duplication), and the single-`podman compose up` promise stay unchanged. The completed T0–T5 sections below stay as executed (historical evidence); the amended pins live in the new T4b/T5b sections and the updated T6/T7 dependency/verify lists.

**Revision r3 — tooling amendment: Docker → Podman (user decision, 2026-10-17).** Live command pins are `podman compose …` / `podman build …`; `compose.yaml`, `compose.smoke.yaml`, `Dockerfile`, `.dockerignore`, and the compose `dockerfile:` key keep their names/keys. T2b amends the decided docs before T3 mirrors them; T2c aligns the remaining `.opencode` tooling references with reviewer oversight. The completed T0–T2 sections below stay as executed (historical evidence); their file effects are amended by T2b/T2c — only T2b/T2c, the notes above, and the T3–T7 verify lists use the amended `podman …` pins.

**Branch:** `feat/stack-selection`, created from the then-current `main` at build time (not before). T0's commit — like all task commits — lands on `feat/stack-selection`; the permission widen reaches `main` only via the explicit post-acceptance merge (never by default).

**Building precondition (ordering, not user action):** nothing is built before the spec is approved at the checkpoint (the stack choice and the dependency set are user-owned). Permissions are bootstrapped by the pipeline itself in **T0** (same mechanical mechanism as online-realtime-workflow T0): the builder adds six `edit` allow entries to `.opencode/agents/builder.md` via its existing shell capability (a shell write — the `edit` tool cannot open the new root paths until T0 lands). Do not dispatch any post-T0 task (T1, T2, T2b, T2c, T3–T7) until T0's commit has landed; before dispatching T1 the orchestrator checks T0's recorded verify evidence in `build-log-T0.md` against the pinned six entries (read-only check). T0 is the only sanctioned permission change anywhere (AC-33); reviewer inspects its diff; git-revertible; never pushed. T2c also touches `.opencode/agents/builder.md`, but prose only (line 112): its `permissions:` block must remain byte-identical, and the reviewer inspects T2c's diff for permission drift.

**Environment preconditions (flag; do not work around):** Node.js ≥24 + npm on the build host (T3–T7 npm commands); Podman with a working compose provider — `podman compose` resolves a provider and reaches the daemon (rootless user socket; verified 2026-10-17, Run 3 of `build-log-T3.md`: Podman 5.8.7, provider Docker Compose v5.6.0, `podman ps`/`podman compose ls` exit 0) — for T3 compose config and T4–T7 builds/up/smoke; network access to the npm registry and container image registries (T3 installs; T4–T6 pulls/builds); host loopback ports 8080/5173 free (T6/T7). SELinux-Enforcing hosts need no action: the pinned mounts carry the shared relabel option (r5 — no-op where SELinux is disabled; never a manual relabel step). Missing capability → `blocked` report with the exact error.

**Verification note:** docs/framework ACs are verified by inspection (`grep`, `git diff`/`git show`, `git status` as aids); scaffold ACs by the commands defined in this feature (`npm …`, `podman compose …`, `podman build …`). Never use `curl`/`wget` (denied) — use `node -e "fetch(...)"`. Record raw output in the task's build log; self-audit each `acceptance` AC.

**Baseline note:** each task captures build-start baselines of every file it edits in its build log; all diffs are checked against them. Amendment set is the closed list in `plan.md` § Amendment trace — anything else is drift.

**Commit staging note:** every task commit stages only that task's `files_owned` paths (explicit `git add`) — never `git add .`/`-A`; never push. Commit messages pinned per task.

## T0 — Permission bootstrap: builder `edit` allow entries `[seq]`
depends_on: —
files_owned: `.opencode/agents/builder.md`, `docs/features/stack-selection/build-log-T0.md`
verify: run the bootstrap heredoc twice (second run byte-identical — idempotency evidence); `grep -n 'resource: "README.md"\|resource: "\.gitignore"\|resource: "\.dockerignore"\|resource: "package-lock.json"\|resource: "compose.yaml"\|resource: "compose.smoke.yaml"' .opencode/agents/builder.md` (six anchors present); structural assertion: `python3` + `yaml.safe_load` (frontmatter parses; every `permissions:` item has `action`, `resource`, `effect`); `git show HEAD -- .opencode/agents/builder.md` (diff adds only the six allow entries); record all output in `build-log-T0.md`
acceptance: AC-33 (sanctioned permission change; no content AC — chore task)
status: [x]

Chore (bootstrap). Apply exactly six `edit` allow entries to `.opencode/agents/builder.md` — `README.md`, `.gitignore`, `.dockerignore`, `package-lock.json`, `compose.yaml`, `compose.smoke.yaml` — via an anchored, idempotent `python3` heredoc (shell write): locate the existing `resource: "index.html"` allow block and insert the six entries after it in the order listed; abort non-zero if the anchor is absent; re-run is a no-op. Capture the file baseline at build start; touch no deny entry (`.env*`, push, sudo, `rm -rf`, curl/wget unchanged); commit `chore: widen builder edit permissions for stack-selection (T0)`.

## T1 — Project truth: stack decision + settled container conventions + AGENTS.md `[seq]`
depends_on: T0
files_owned: `docs/architecture/stack.md`, `docs/architecture/containerization.md`, `AGENTS.md`, `docs/features/stack-selection/build-log-T1.md`
verify: `grep -n "DECIDED\|NOT DECIDED\|2026-10-17" docs/architecture/stack.md AGENTS.md docs/architecture/containerization.md`; `grep -in "typescript\|node\.js 24\|fastify\|react\|vite\|vitest\|eslint\|npm" docs/architecture/stack.md AGENTS.md`; `grep -n "npm ci\|npm run lint\|npm run typecheck\|npm test\|npm run build\|npm run dev\|npm run smoke\|docker compose up" docs/architecture/stack.md AGENTS.md`; `grep -n "healthz\|8080\|5173\|VITE_WS_URL\|HEALTHCHECK\|cubeclicker-backend\|cubeclicker-frontend" docs/architecture/containerization.md`; `git diff HEAD -- <files_owned>` vs. build-start baselines (record in `build-log-T1.md`)
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
status: [x]

Apply `plan.md` § Pinned content contracts 1–3 exactly (stack.md 1.A–1.G; containerization.md 2.A–2.C; AGENTS.md 3.A–3.F). Capture build-start baselines. In-place modifications limited to the § Amendment trace items; everything else additive. Commit `docs: decide application stack and settle container conventions (T1)`.

## T2 — Framework alignment: stale guard clauses + playbook §4 `[P]`
depends_on: T1
files_owned: `.opencode/skills/orchestration-playbook/SKILL.md`, `.opencode/agents/planner.md`, `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md`, `.opencode/skills/spec-review/SKILL.md`, `docs/features/stack-selection/build-log-T2.md`
verify: `grep -n "container definitions such as the compose file" .opencode/skills/orchestration-playbook/SKILL.md`; `grep -rn "until it is decided\|until the application stack is decided\|undecided stack\|No container assets before the application stack is decided" .opencode/` (no hits); `git diff HEAD -- <files_owned>` vs. build-start baselines — exactly the six pinned one-liners (record in `build-log-T2.md`)
acceptance: AC-30, AC-31
status: [x]

Apply `plan.md` contract 13: six one-line replacements (each file exactly one line; no other rule text changes; no permission content — AC-33). `builder.md` is the second of its sequential edits (T0 = permissions, T2 = prose; T2c later applies the line-112 token fix): baseline captured post-T0. Commit `docs: align framework guidance with the decided stack (T2)`.

## T2b — Tooling amendment: decided docs Docker → Podman `[P]`
depends_on: T1
files_owned: `docs/architecture/stack.md`, `docs/architecture/containerization.md`, `AGENTS.md`, `docs/features/stack-selection/build-log-T2b.md`
verify: `grep -n "podman compose" docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md` (command tokens present); `grep -in "docker compose\|Docker with Compose\|Docker and Docker Compose\|Docker images + Docker Compose" docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md` (no hits; `Dockerfile`/`.dockerignore` filename mentions are outside these patterns); `git diff HEAD -- <files_owned>` vs. build-start baselines — exactly the replacements pinned in `plan.md` contract 15 (record in `build-log-T2b.md`); `git status --short` (no `.env*`, no stray files)
acceptance: AC-2, AC-4, AC-5, AC-6, AC-8, AC-9, AC-34 (tooling-consistency portion)
status: [x]

Apply `plan.md` contract 15: `docs/architecture/stack.md`, `docs/architecture/containerization.md`, `AGENTS.md` — every `docker compose` token → `podman compose`; `Docker images + Docker Compose` / `Docker and Docker Compose` → `Podman and Podman Compose (`podman compose`)`; `Docker with Compose` → `Podman with a working compose provider (`podman compose`)`. `Dockerfile`/`.dockerignore` filenames unchanged; no other lines change. This task precedes T3 so the scaffold mirrors the amended docs. Capture build-start baselines. Commit `docs: adopt Podman compose tooling in decided docs (T2b)`.

## T2c — `.opencode` tooling-token alignment (reviewer oversight) `[seq]`
depends_on: T2, T2b
files_owned: `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md`, `.opencode/skills/code-review/checklists/quality.md`, `docs/features/stack-selection/build-log-T2c.md`
verify: `grep -n "podman compose" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md .opencode/skills/code-review/checklists/quality.md`; `grep -rn "docker compose up\|Docker images + Docker Compose\|Docker + Compose" .opencode/` (no hits); permission freeze: `git diff HEAD -- .opencode/agents/builder.md` shows only the line-112 prose token replacement — the `permissions:` block byte-identical to its post-T2 baseline (compare against `build-log-T2.md` capture / `git show HEAD:.opencode/agents/builder.md`); `git diff HEAD -- <files_owned>` exactly the four replacements of `plan.md` contract 16; record in `build-log-T2c.md`
acceptance: chore (framework wording; no content AC) + AC-33 freeze re-verified
status: [x]

Chore (reviewer oversight). Apply `plan.md` contract 16: four pinned stale Docker tooling references replaced in `.opencode/**` — `builder.md` line 112 (prose only; `permissions:` block byte-frozen), `web-implementation/SKILL.md` line 27, `web-implementation/references/engineering-principles.md` line 57, `code-review/checklists/quality.md` line 41. This is the third sequential edit of `builder.md` (T0 permissions, T2 prose, T2c token) — never parallel with another task; baseline captured post-T2. Leave `Dockerfile`/`.dockerignore` filename mentions untouched. Commit `docs: align remaining framework Docker references with Podman (T2c)`.

## T3 — Scaffold foundations: manifests, configs, compose, README `[seq]`
depends_on: T0, T1, T2b, T2c
files_owned: `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`, `.dockerignore`, `compose.yaml`, `compose.smoke.yaml`, `README.md`, `src/backend/package.json`, `src/frontend/package.json`, `docs/features/stack-selection/build-log-T3.md`
verify: `npm install` (resolves the pinned ranges — record full output; any unavailable range/peer conflict → `blocked`, no substitution) then `npm ci` (lockfile in sync); `podman compose config -q`; `podman compose -f compose.yaml -f compose.smoke.yaml config -q`; `node -e` sanity check that `podman compose config` merged JSON contains services `backend`, `frontend`, `smoke` and the pinned ports; `grep -n "BACKEND_PORT\|FRONTEND_PORT\|VITE_WS_URL\|5173\|8080" compose.yaml README.md`; `git status --short` (no `.env*`, no stray files) — record in `build-log-T3.md`
acceptance: AC-12, AC-13, AC-14, AC-18, AC-29
status: [x]

Apply `plan.md` contracts 5–7 + workspace manifests (contracts 8/9 manifest rows) + README (contract 4), mirroring the post-T2b docs (`podman compose up`, `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`). `npm install` resolves and records exact versions in `package-lock.json`. This task is the only place dependencies are installed/resolved — T4/T5 must not touch manifests or the lockfile (missing dep → `blocked`). Commit `chore: scaffold workspace, compose stack, and commands (T3)`.

## T4 — Backend skeleton: Fastify app, health, WebSocket hello `[P]`
depends_on: T0, T3
files_owned: `src/backend/tsconfig.json`, `src/backend/vitest.config.ts`, `src/backend/Dockerfile`, `src/backend/src/app.ts`, `src/backend/src/server.ts`, `src/backend/src/app.test.ts`, `docs/features/stack-selection/build-log-T4.md`
verify: `npm run typecheck -w @cubeclicker/backend`; `npm test -w @cubeclicker/backend`; `npm run lint`; `podman build --target dev -f src/backend/Dockerfile -t cubeclicker-backend:dev-check .`; `podman build --target prod -f src/backend/Dockerfile -t cubeclicker-backend:prod-check .` — all exit 0 (record in `build-log-T4.md`)
acceptance: AC-15, AC-16, AC-19, AC-20, AC-21
status: [x]

Apply `plan.md` contracts 8 (config/Dockerfile rows) and 10: `buildApp()` factory (`GET /healthz`; `/ws` hello `{"type":"hello","serverTime":ISO}`), entrypoint with `HOST`/`PORT` defaults 0.0.0.0/8080, unit tests (`inject` + hello shape). Dockerfile multi-stage `dev`/`prod` per contract (NodeNext `.js` import specifiers). No manifest/lockfile edits (T3-owned). Commit `feat: backend skeleton with health and WebSocket hello (T4)`.

## T5 — Frontend skeleton: React app + connection module `[P]`
depends_on: T0, T3
files_owned: `src/frontend/tsconfig.json`, `src/frontend/vite.config.ts`, `src/frontend/vitest.config.ts`, `src/frontend/index.html`, `src/frontend/nginx.conf`, `src/frontend/Dockerfile`, `src/frontend/src/main.tsx`, `src/frontend/src/App.tsx`, `src/frontend/src/ws/connection.ts`, `src/frontend/src/ws/connection.test.ts`, `docs/features/stack-selection/build-log-T5.md`
verify: `npm run typecheck -w @cubeclicker/frontend`; `npm test -w @cubeclicker/frontend`; `npm run lint`; `npm run build -w @cubeclicker/frontend`; `podman build --target dev -f src/frontend/Dockerfile -t cubeclicker-frontend:dev-check .`; `podman build --target prod -f src/frontend/Dockerfile -t cubeclicker-frontend:prod-check .` — all exit 0 (record in `build-log-T5.md`)
acceptance: AC-17, AC-22, AC-23, AC-24
status: [x]

Apply `plan.md` contracts 9 and 11: connection module per the pinned interface (injectable socket, bounded retry, teardown) + fake-socket tests; App status element; Vite/nginx configs; multi-stage Dockerfile (unprivileged nginx prod). No manifest/lockfile edits. Commit `feat: frontend skeleton with connection module (T5)`.

## T4b — Backend image provider-compat pins (r4) `[P]`
depends_on: T4
files_owned: `src/backend/Dockerfile`, `docs/features/stack-selection/build-log-T4b.md`
verify: `grep -n "FROM" src/backend/Dockerfile` (all four `FROM` lines `docker.io/library/node:24-alpine`; no unqualified token remains); `podman build --format docker --target dev -f src/backend/Dockerfile -t cubeclicker-backend:dev-check .` and `podman build --format docker --target prod -f src/backend/Dockerfile -t cubeclicker-backend:prod-check .` — both exit 0 and neither prints the `HEALTHCHECK is not supported for OCI image format` warning; `podman image inspect cubeclicker-backend:dev-check cubeclicker-backend:prod-check --format '{{.Config.Healthcheck}}'` → non-null `Healthcheck` with the pinned values (Interval 10s / Timeout 3s / Retries 5 / StartPeriod 15s); `git diff HEAD -- src/backend/Dockerfile` vs. the task's own build-start baseline (= the committed pre-amendment state at HEAD) shows only the four `FROM` tokens plus the `#` header build-command comments gaining `--format docker` (record all output in `build-log-T4b.md`)
acceptance: AC-15, AC-16, AC-32
status: [x]

Apply the r4 pins to the backend image (`plan.md` contracts 8 header + Dockerfile rows): registry-qualify every `FROM` token to `docker.io/library/node:24-alpine` and amend the `#` header build-command comments to the `podman build --format docker --target …` form. Nothing else in the file changes (T4 content otherwise frozen; no manifest/lockfile edits). Capture the build-start baseline. Commit `fix: qualify backend base image and pin docker-format builds (T4b)`.

## T5b — Frontend + smoke image provider-compat pins (r4) `[P]`
depends_on: T3, T5
files_owned: `src/frontend/Dockerfile`, `compose.smoke.yaml`, `README.md`, `docs/features/stack-selection/build-log-T5b.md`
verify: `grep -n "FROM" src/frontend/Dockerfile` (`docker.io/library/node:24-alpine` ×2 — `dev` and `build` (prod's builder) stages; `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` — prod; no unqualified token remains); `grep -n "image:" compose.smoke.yaml` (`docker.io/library/node:24-alpine`); `grep -n "podman build --format docker --target prod" README.md` (both production-image commands); `podman build --format docker --target dev -f src/frontend/Dockerfile -t cubeclicker-frontend:dev-check .` and `podman build --format docker --target prod -f src/frontend/Dockerfile -t cubeclicker-frontend:prod-check .` — both exit 0 and neither prints the OCI-format `HEALTHCHECK` warning; `podman image inspect cubeclicker-frontend:dev-check cubeclicker-frontend:prod-check --format '{{.Config.Healthcheck}}'` → non-null `Healthcheck` with the pinned values; merged-model check: `podman compose -f compose.yaml -f compose.smoke.yaml config --format json | node -e "…"` → `smoke` image `docker.io/library/node:24-alpine` and services `backend`/`frontend`/`smoke` present; `git diff HEAD -- <files_owned>` vs. the task's own build-start baseline (= the committed pre-amendment state at HEAD) shows only the pinned r4 tokens/lines (record all output in `build-log-T5b.md`)
acceptance: AC-12, AC-14, AC-17, AC-32
status: [x]

Apply the r4 pins to the frontend image, smoke image row, and README (`plan.md` contracts 9, 6, 4): registry-qualify every `FROM` in `src/frontend/Dockerfile` (node ×2; nginx prod) and amend its `#` header build-command comments; qualify the `compose.smoke.yaml` smoke `image:` token; pin the README production-image commands as `podman build --format docker --target prod …` plus the one-sentence `HEALTHCHECK` rationale. Nothing else changes (no manifest/lockfile edits). Capture build-start baselines. Commit `fix: qualify frontend and smoke base images and pin docker-format builds (T5b)`.

## T6 — Containerized smoke test + single-command run `[seq]`
depends_on: T4, T5, T4b, T5b
files_owned: `tests/e2e/smoke.mjs`, `docs/features/stack-selection/build-log-T6.md`
verify: `podman compose down -v --rmi local` (clean state) → `podman compose up -d --build --wait` (exit 0; if `--wait` unsupported by the provider, record the divergence and poll `podman compose ps` — AC-26 contingency) → health capture: `podman compose ps` (both services healthy) plus `podman inspect <backend|frontend container> --format '{{.Config.Healthcheck}} {{.State.Health.Status}}'` (image `HEALTHCHECK` present + `healthy` — carried by the compose-provider build path, `build-log-T4.md` § 5.2; a provider regression is a recorded spec gap, never a compose-level healthcheck, contract 5) → `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (exit 0; first run pulls the qualified smoke image `docker.io/library/node:24-alpine` — T5b) → host-path checks via `node -e "fetch('http://localhost:8080/healthz')…"`, `node -e "fetch('http://localhost:5173/')…"`, and a `node -e` WebSocket client receiving hello → `podman compose down` — record every command's raw output in `build-log-T6.md` (first live use of these `podman compose` forms: verify each against the provider, per `plan.md` § Risks — divergence → `blocked`/spec gap, no improvised substitute)
acceptance: AC-25, AC-26, AC-27
status: [x]

Write `tests/e2e/smoke.mjs` per `plan.md` contract 12 (zero deps; two concurrent WS clients; bounded readiness wait; PASS/FAIL output; non-zero exit on failure). Run the full compose sequence above; `--wait` must see both services `healthy` — the health signal is the image `HEALTHCHECK` carried by the compose-provider build path (`build-log-T4.md` § 5.2) and `compose.yaml` stays healthcheck-free (contract 5). Commit `test: containerized smoke test over the composed stack (T6)`.

**r5 status (closed, 2026-10-18):** the sequence failed only at the bind-mount layer (`build-log-T6.md` § 3–§ 4 — SELinux Enforcing + `user_home_t` sources); T6b applied the r5 mount pins (`plan.md` contracts 5/6) and its re-run of the full sequence above is green (`build-log-T6b.md` § 3: `up -d --build --wait` exit 0, both services `Healthy`, `SMOKE PASS (4/4 checks)`, host + WS checks, clean `down`), so T6 is `[x]` — `tests/e2e/smoke.mjs` stays byte-unchanged (`03772b1`).

## T6b — Compose bind-mount SELinux relabel (r5) `[seq]`
depends_on: T3, T4b, T5b, T6
files_owned: `compose.yaml`, `compose.smoke.yaml`, `docs/features/stack-selection/build-log-T6b.md`
verify: `podman compose config -q`; `podman compose -f compose.yaml -f compose.smoke.yaml config -q`; then re-run T6's pinned end-to-end sequence with the amended mounts: `podman compose down -v --rmi local` → `podman compose up -d --build --wait` (exit 0; both services `healthy`; `--wait` unavailable ⇒ AC-26 contingency recorded in the log) → health capture `podman compose ps` + `podman inspect <backend|frontend container> --format '{{.Config.Healthcheck}} {{.State.Health.Status}}'` (healthcheck present + `healthy`) → `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (exit 0; script prints `SMOKE PASS (4/4 checks)` — `tests/e2e/smoke.mjs` unchanged, `03772b1`) → host-path checks via `node -e "fetch('http://localhost:8080/healthz')…"`, `node -e "fetch('http://localhost:5173/')…"`, and a `node -e` WebSocket client receiving hello → `podman compose down`; diff check: `git diff HEAD -- compose.yaml compose.smoke.yaml` vs. the task's build-start baseline captures — only the three pinned mount tokens (`:z`, `:z`, `:ro,z`), nothing else in either file; record every command's raw output in `build-log-T6b.md` (first live use of the compose `z` option through the provider — a provider rejection or a still-failing sequence is a `blocked`/spec gap, no improvised substitute)
acceptance: AC-13, AC-14, AC-26, AC-27, AC-32
status: [x]

Apply the r5 pins (`plan.md` contracts 5/6): add the shared SELinux relabel option to all three bind mounts — `compose.yaml` → `./src/backend:/app/src/backend:z` and `./src/frontend:/app/src/frontend:z`; `compose.smoke.yaml` → `./tests/e2e:/smoke:ro,z`. Nothing else changes (`compose.yaml` stays healthcheck-free — contract 5; the smoke `image:` token is already r4-pinned). Capture build-start baselines of both files. Re-run the T6 sequence above and record raw output; `tests/e2e/smoke.mjs` is not edited. Commit `fix: relabel compose bind mounts for SELinux hosts (T6b)`.

## T7 — Verify & integrate `[seq]`
depends_on: T0, T1, T2, T2b, T2c, T3, T4, T4b, T5, T5b, T6, T6b
files_owned: `docs/features/stack-selection/build-log-T7.md`
verify: full pass: `npm ci`; `npm run lint && npm run typecheck && npm test && npm run build`; `npm run smoke` (with stack up per AC-26; AC-26/AC-27 end-to-end evidence sustained in `build-log-T6b.md`); build-form evidence for AC-15/AC-16/AC-17 from the T4b/T5b logs (amended `podman build --format docker …` forms + `podman image inspect` healthcheck-present); stale-token scan: `grep -rn "docker compose" AGENTS.md docs/architecture .opencode README.md compose.yaml compose.smoke.yaml src tests package.json` → no hits (`Dockerfile`/`.dockerignore` names and frozen historical records under `docs/features/**` are out of scope); per-AC inspection table for AC-1…AC-34 (grep anchors for every token named in the ACs; per-task diffs vs. recorded baselines for AC-32; permission inspection across every commit's diff — T0 adds exactly six entries, T2c's `builder.md` diff is line-112 prose only, nothing else touches permission content — plus `git status --short`/`git log` checks for AC-33; cross-file consistency greps for AC-34; "no template/gameplay/provider/CI assets" scan) — record the full evidence table in `build-log-T7.md`
acceptance: AC-1 … AC-34 (verification gate; AC-28, AC-32, AC-33, AC-34 final checks)
status: [x]

Independent re-check of the complete deliverable before code review; report any AC not met with exact location. Flag any drift from the pinned contracts instead of papering over it. Commit `docs: record T7 verification pass for stack-selection (T7)`.
