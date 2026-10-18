---
feature: stack-selection
revision: 5
---
# Plan — Application Stack Selection

> **Revision r5 — SELinux bind-mount relabel pin amendment (T6 first live sequence, 2026-10-18).** The T6 end-to-end sequence is blocked at the bind-mount layer: the verified host runs SELinux **Enforcing** with the repository under `user_home_t`, both dev containers exit `243` (`EACCES` on `/app/src/*/package.json`) and the smoke container cannot read `/smoke` (`MODULE_NOT_FOUND`), because the pinned mounts (contracts 5/6) carry no relabel option (`build-log-T6.md` § 3–§ 4). Resolved as the repo-carried pin amendment (candidate B in the T6 log): the three pinned bind mounts gain the shared relabel option — `:z` on both workspace mounts, `:ro,z` on the smoke mount — applied by remediation task T6b; manual/out-of-band relabeling (candidate A) and host-wide `label = false` / per-service `label=disable` (candidate C) are rejected (host-coupled prerequisites or disabled SELinux separation — the r4 rejection class; `build-log-T6.md` § 6). `:z` (shared label) is pinned over `:Z` (private): the sources are shared with the host user's tooling and re-mounted by freshly created container instances across `up`/`down`/`run --rm` cycles, so a per-container private label would churn and deny on re-runs. The option is a no-op where SELinux is disabled; no new flags, no host prerequisites, `tests/e2e/smoke.mjs` untouched. Every live pin below is post-r5 (contracts 5/6 mount tokens; contract 8's `HEALTHCHECK` letter aligned to the committed long form — spec-r4 F1).

> **Revision r4 — provider-compat pin amendment (T4/T5 first live builds, 2026-10-18).** Both provider divergences reported by the T4/T5 logs are resolved as pin amendments: base-image tokens are registry-qualified (`docker.io/library/node:24-alpine`; `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` — same images/tags) in every Dockerfile and the smoke image row, and every bare `podman build` command is pinned as `podman build --format docker …` so the declared `HEALTHCHECK` is carried in the built images (Podman 5's default OCI format drops it; `EXIT 0` with the healthcheck present is recorded in both logs). The compose layer is deliberately unchanged: the provider build path keeps the healthcheck (`build-log-T4.md` § 5.2), so contract 5's "no healthcheck duplication" stands and the single `podman compose up` promise adds no flags or host prerequisites. Remediation tasks T4b/T5b apply the pins; T6/T7 re-verify. Every live pin below is post-r4.

> **Revision r3 — tooling amendment: Docker → Podman (user decision, 2026-10-17).** Local container tooling is Podman + Podman Compose (`podman compose`; the verified environment delegates to the external Docker Compose v5.6.0 provider over the rootless Podman socket). Every live command pin below is post-amendment. `compose.yaml`, `compose.smoke.yaml`, `Dockerfile`, `.dockerignore`, and the compose `dockerfile:` key keep their names/keys. T2b amends the already-committed decided docs before T3 mirrors them; T2c aligns the remaining `.opencode` tooling references with reviewer oversight.

## Revision r5 — change summary (for the reviewer)

| Surface | Change |
| --- | --- |
| Bind mounts (contracts 5/6) | `compose.yaml` gains the shared SELinux relabel option on both workspace mounts: `./src/backend:/app/src/backend` → `./src/backend:/app/src/backend:z`, `./src/frontend:/app/src/frontend` → `./src/frontend:/app/src/frontend:z`; `compose.smoke.yaml`'s smoke mount `./tests/e2e:/smoke:ro` → `./tests/e2e:/smoke:ro,z`. All three bind mounts in the two compose files are covered; nothing else in either file changes (`compose.yaml` stays healthcheck-free — contract 5; the smoke `image:` token stays the r4-qualified `docker.io/library/node:24-alpine`). |
| `:z` vs `:Z` | `:z` (shared label) is pinned; `:Z` (private per-container label) is rejected: the mounted trees are host-shared by design (git, editors, host-run `npm …` and dev servers under `user_home_t`) and are re-mounted by freshly created container instances across `podman compose up`/`down` and `run --rm` cycles (every `npm run smoke` starts a new smoke container), so a private label would be tied to one container instance — relabel churn on every recreation and denial for any other consumer. Evidence precedent: the T6 diagnostics used `:z` on an isolated copy and `:ro,z` on the pinned image (`build-log-T6.md` § 4 probe C, § 5.4). |
| Decision (candidate B) | Repo-carried pin amendment — same shape as r4. Rejected: candidate A (record manual relabeling/`chcon`-style host precondition) — host-coupled, privilege-requiring, not carried by git, and contradicts AC-12's "no other host prerequisites" and the single-command promise; the prior rulings rejected it and this amendment does not disagree. Rejected: candidate C (host-wide `label = false` or per-service `label=disable`) — environment-only fix outside the repository; disables SELinux separation for containers (the r4 rejection class). Rationale: host-independent, works on a stock SELinux-Enforcing rootless host with the pinned single command, no-op where SELinux is disabled. |
| Host-visible effect | The first `podman compose up` (or `run --rm smoke`) makes Podman relabel the mounted source trees to the shared `container_file_t` label — standard Podman practice for source mounts; the next container start re-applies it after checkout refreshes; host tooling keeps full access; no manual action, no new flags, no host config. |
| Spec tokens | `spec.md` r5 amends AC-13 and AC-14 in place (pinned mount options); no AC renumbering; decided docs unchanged (`containerization.md`'s local-development contract — single command, no host prerequisites — is satisfied, not amended). |
| Contract-8 F1 alignment | Contract 8's backend `HEALTHCHECK` command letter now byte-matches the committed Dockerfile long form: `node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"` (committed at `ae3a3f2`, unchanged through `0da31cc`; spec-r4 F1 applied). No file change: this is the plan letter only. Contract 9's frontend pin stays the committed short form (each contract now byte-matches its own file; the asymmetry is intentional). |
| New task | **T6b** (owns `compose.yaml`, `compose.smoke.yaml`, its build log): applies the three mount tokens and re-runs T6's pinned end-to-end sequence with `tests/e2e/smoke.mjs` byte-unchanged (`03772b1`); closes AC-26/AC-27; T6 stays `[>]` blocked-partial until T6b is green; T7 depends on T6b. Commit message pinned in `tasks.md`. |
| Historical sections | T0–T5b task sections and all build logs stay as executed; T6's blocked log stays as executed evidence; the amended pins live in T6b and the T6–T7 notes/lists. |
| Open questions | None new — resolved from logged first-use evidence; no user-visible behavior change (no new flags in `podman compose up`, no host prerequisites). |
| Package state | r5 package: `spec.md` r5, `plan.md` r5, `tasks.md` r5. Reviewer carry-forward checks: contracts 5/6 mount tokens byte-match the T6b pins; contract 8 letter byte-matches the committed backend Dockerfile (long form) while contract 9 stays the committed short form; graph stays acyclic with T6 → T6b → T7; `compose.yaml` healthcheck-free (contract 5); `tests/e2e/smoke.mjs` byte-unchanged; no decided-doc or permission diffs. |

## Revision r4 — change summary (for the reviewer)

| Surface | Change |
| --- | --- |
| Base-image tokens | Unqualified short names → registry-qualified: `node:24-alpine` → `docker.io/library/node:24-alpine` (every Node stage, contracts 8/9; smoke service image, contract 6; contract 12's runtime mention); `nginxinc/nginx-unprivileged:1.27-alpine` → `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` (frontend prod, contract 9). Same images and tags; mirrored in § Interfaces ("Base images"/"Prod images") and § Dependency manifest. Rationale: the verified host enforces short-name resolution without a TTY — unqualified `nginxinc/nginx-unprivileged` fails (`EXIT 125`) and `node` resolves only via a host alias (`build-log-T5.md` § Divergences 1); registry-qualified tokens are host-independent and need no `registries.conf` edits. |
| Build-command form | Bare `podman build` → `podman build --format docker …` for every CLI build pin (README contract 4; T4b/T5b verify lists; T6/T7 references). Rationale: Podman 5's default OCI build format silently drops the declared `HEALTHCHECK` (`Healthcheck: null` + build warning), while `--format docker` preserves it with the pinned numbers — `EXIT 0` in both logs (`build-log-T4.md` § 5.1, `build-log-T5.md` § Divergences 2). `BUILDAH_FORMAT=docker` rejected: invisible environment coupling; the command form itself carries the pin. |
| Health signal / compose contract | **Unchanged** — the image `HEALTHCHECK` remains the single definition; `compose.yaml` keeps no healthchecks (contract 5). Evidence added: the compose-provider build path produces docker-format images carrying the healthcheck (`build-log-T4.md` § 5.2), so the composed stack's health signal is real on the verified host; T6 re-verifies `--wait` + per-container health status end-to-end and records any divergence as a spec gap (never an improvised compose healthcheck). |
| Dockerfile headers | The `#` header build-command comments in both Dockerfiles follow the amended `podman build --format docker --target …` form (contracts 8/9). |
| New tasks | **T4b** (backend Dockerfile: `FROM` qualification + amended header commands; verify = `--format docker` dev/prod builds + `podman image inspect` healthcheck-present) and **T5b** (frontend Dockerfile + smoke image + README production-image commands). Both `[P]` (disjoint `files_owned`), applied after T4/T5 respectively; T6/T7 dependencies updated. Commit messages pinned in `tasks.md`. |
| Spec tokens | `spec.md` r4 amends AC-12, AC-14, AC-15, AC-16, AC-17, AC-26 in place (build-command form, image tokens, built-image healthcheck clauses); no AC renumbering; decided docs unchanged. |
| Historical sections | T0–T5 task sections and all build logs stay as executed (the r3 `podman build …` forms that ran); the amended pins live in T4b/T5b and the notes/T6/T7 lists. |
| Open questions | None new — both divergences were resolved from logged first-use evidence; no user-visible behavior change (no new flags in `podman compose up`, no host prerequisites). |
| Package state | r4 package: `spec.md` r4, `plan.md` r4, `tasks.md` r4. Reviewer carry-forward checks: contracts 6/8/9/4 + § Interfaces tokens byte-match the T4b/T5b pins; no decided-doc or permission diffs; graph stays acyclic with T4b/T5b gating T6/T7; `compose.yaml` byte-unchanged. |

## Revision r3 — change summary (for the reviewer)

| Surface | Change |
| --- | --- |
| Compose command tokens | `docker compose` → `podman compose` everywhere a live instruction appears (spec live prose/ACs; plan interfaces + contracts 4–7/15; tasks T3–T7 verify lists and notes). 19 occurrences in `spec.md`, 14 in `plan.md`. |
| Build command tokens | `docker build` → `podman build` (spec AC-12/AC-15/AC-17 + verification notes; plan README contract; tasks T4/T5). |
| Tooling names | "Docker and Docker Compose" → "Podman and Podman Compose (`podman compose`)"; "Docker images + Docker Compose" → "Podman images + Podman Compose (`podman compose`)"; "Docker with Compose" → "Podman with a working compose provider (`podman compose`)"; "invoked by Docker" → "invoked by Podman"; "Docker Desktop" → "Podman Desktop"; "Docker-DNS" → "container-DNS". |
| Preconditions | "Docker CLI + Compose v2 + reachable daemon" → verified equivalent: Node.js ≥24 + npm; Podman with a working compose provider (`podman compose` resolves a provider and reaches the daemon — rootless user socket; Run 3 evidence: Podman 5.8.7, provider Docker Compose v5.6.0, `podman ps`/`podman compose ls` exit 0 — `build-log-T3.md`). |
| Unchanged (filenames/keys) | `compose.yaml`, `compose.smoke.yaml`, `Dockerfile` / `src/*/Dockerfile`, `.dockerignore`, the compose `dockerfile:` key, image names (`cubeclicker-backend`, `cubeclicker-frontend`), ports, env-var names, dependency ranges. |
| New task T2b | Decided docs (`docs/architecture/stack.md`, `docs/architecture/containerization.md`, `AGENTS.md`): exact replacements in contract 15; commit `docs: adopt Podman compose tooling in decided docs (T2b)`; depends on T1, runs in the `[P]` batch with T2, before T3. |
| New task T2c | `.opencode` tooling-token alignment (`builder.md` prose only, `web-implementation/SKILL.md`, `web-implementation/references/engineering-principles.md`, `code-review/checklists/quality.md`): exact replacements in contract 16; commit `docs: align remaining framework Docker references with Podman (T2c)`; reviewer oversight; permissions byte-frozen (AC-33). |
| Scan disposition | Live stale refs were found only in the three decided docs and four `.opencode` files — routed to T2b/T2c. Historical references in accepted features' artifacts (`containerized-workflow/**`, `online-realtime-workflow/**`) and this feature's Run 1–3 build logs are frozen evidence, not live guidance, and are deliberately not rewritten. Completed T0–T2 task entries stay as executed; their file effects are amended by T2b/T2c. |
| Open questions | None new. The only tooling-behavior uncertainty is the in-task provider-command verification recorded in § Risks — a provider divergence is a `blocked`/spec gap, not a license to improvise. |
| Package state | This summary reflects the finished r3 package: `spec.md` r3, `plan.md` r3, `tasks.md` r3. Reviewer carry-forward checks: (a) `spec.md` verification-notes paragraph exceeds the read-tool display limit — byte-check its technology-whitelist tail carries no stale `Docker`/`Docker Compose` token (Podman is added in the visible list); (b) completed T0–T2 task entries in `tasks.md` intentionally keep their executed `docker` tokens as historical evidence — their file effects are amended by T2b/T2c and the T3–T7 verify lists are fully `podman …`. |

## Architecture

**The decision (pinned):** TypeScript (strict) everywhere. Backend: Node.js 24 LTS + Fastify 5 + `@fastify/websocket` (WS server at `GET /ws`, health at `GET /healthz`). Frontend: React 19 + Vite SPA (static build; dev server on 5173). Tooling: npm workspaces (`src/backend`, `src/frontend`), Vitest, ESLint flat config + typescript-eslint, `tsx` as the backend dev runner. Containers: `compose.yaml` (dev mode, hot reload) + `compose.smoke.yaml` (one-off smoke service); Dockerfiles at `src/backend/Dockerfile` and `src/frontend/Dockerfile` (multi-stage `dev`/`prod`).

**Runtime topology (local):** browser ⇄ `localhost:5173` (frontend container: Vite dev server) and browser ⇄ `localhost:8080` (backend container: Fastify WS). The frontend opens the WebSocket directly to the backend URL (`VITE_WS_URL`, default `ws://localhost:8080/ws`) — no proxy anywhere, so connection upgrades are preserved by construction (proxy/LB handling stays a deployment-time decision). The smoke service runs inside the compose network (`http://backend:8080`, `ws://backend:8080/ws`, `http://frontend:5173`).

**State ownership:** none yet — the scaffold keeps no shared/cross-client state. The backend owns the per-connection lifecycle (one handler per socket, sends `hello` on connect); the frontend's `connection.ts` is the single client-side lifecycle owner (connect/retry/teardown). The first feature carrying server-authoritative shared values (core click loop) inherits these owners.

**Documentation/agent layers updated:** project truth (`stack.md`, `containerization.md`, `AGENTS.md`, new `README.md`) → framework guidance one-liners (playbook, planner, builder, web skill, spec checklist, spec review) → scaffold (root manifests, compose, Dockerfiles, workspaces, smoke). The r3 tooling amendment adds T2b (decided docs: Docker/Docker Compose → Podman/`podman compose`) and T2c (remaining `.opencode` tooling tokens) before the scaffold, so the scaffold mirrors the amended docs. The scaffold is what makes the decision *real*: every command in `AGENTS.md` § Commands is executable after T7.

**Workspace layout (decided):** unit tests colocated as `*.test.ts` beside sources; cross-service e2e in `tests/e2e/`; root holds orchestration files (`package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `compose.yaml`, `compose.smoke.yaml`, `README.md`, `.gitignore`, `.dockerignore`). `src/shared` is reserved for future shared protocol types (D-12) — not scaffolded.

## Interfaces & pinned values

| Item | Pinned value |
| --- | --- |
| Backend listen | `HOST` default `0.0.0.0`, `PORT` default `8080` (env; no other hardcoding) |
| Backend HTTP health | `GET /healthz` → `200` `{"status":"ok"}` |
| Backend WebSocket | path `/ws`; on connect server sends `{"type":"hello","serverTime":"<ISO-8601>"}`; no inbound message processing in the scaffold |
| Frontend dev server | Vite, `server.host: true`, `server.port: 5173`, `strictPort: true`, `allowedHosts: ["frontend"]` |
| Frontend WS target | `VITE_WS_URL`, default `ws://localhost:8080/ws` (injected via `vite.config.ts` `define` from `process.env.VITE_WS_URL`) |
| Host port mappings | `127.0.0.1:${BACKEND_PORT:-8080}:8080`, `127.0.0.1:${FRONTEND_PORT:-5173}:5173` (loopback binding) |
| Healthcheck (images) | `GET /healthz` / `GET /` respectively; interval 10s, timeout 3s, retries 5, start-period 15s |
| CLI build form | Every bare CLI build is `podman build --format docker …` (e.g. `podman build --format docker --target prod -f src/backend/Dockerfile .`) — Podman 5's default OCI build format drops the declared `HEALTHCHECK`; the flag carries it in the built image (r4 pin) |
| Images | `cubeclicker-backend:dev`, `cubeclicker-frontend:dev` (compose-built, `target: dev`); release tagging deferred |
| Prod images | backend: `docker.io/library/node:24-alpine` runtime, `USER node`, `NODE_ENV=production`, `node dist/server.js`; frontend: `docker.io/nginxinc/nginx-unprivileged:1.27-alpine`, static `dist/` on 8080, SPA fallback |
| Base images | `docker.io/library/node:24-alpine` (all Node stages); `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` (frontend prod) — always registry-qualified, never short names (r4: the verified host rejects unqualified short names without a TTY) |
| Compose files | `compose.yaml` (name `cubeclicker`; services `backend`, `frontend`), `compose.smoke.yaml` (service `smoke`) |
| Commands | `npm ci`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build`; `npm run dev` (= `podman compose up`); `npm run smoke` (= `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) |
| Smoke env (defaults) | `BACKEND_URL=http://backend:8080`, `WS_URL=ws://backend:8080/ws`, `FRONTEND_URL=http://frontend:5173`, `READY_TIMEOUT_MS=30000` |

**Backend source contract.** `src/backend/src/app.ts` exports `buildApp(): FastifyInstance` (registers `@fastify/websocket`, route `GET /healthz`, route `GET /ws` with the hello handler) — no side effects on import. `src/backend/src/server.ts` is the only entrypoint: reads `HOST`/`PORT` env with defaults, calls `buildApp()`, listens, logs the listen address. `serverTime` comes from the server clock at connect (a small exported helper keeps it testable).

**Frontend source contract.** `src/frontend/src/ws/connection.ts`:

```ts
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export interface ConnectionOptions {
  url: string;
  socketFactory?: (url: string) => WebSocket; // injected in tests
  maxAttempts?: number;   // default 10
  baseDelayMs?: number;   // default 500
  maxDelayMs?: number;    // default 5000
  onStatus?: (status: ConnectionStatus) => void;
}
export function createConnection(options: ConnectionOptions): { close(): void };
```

Status: `connecting` initially and during retry waits; `connected` on open (retry counter resets); `disconnected` after close/error, retrying with backoff `min(baseDelayMs * 2^(attempt-1), maxDelayMs)` while `attempt <= maxAttempts`, then stops. `close()` closes the socket and cancels any pending retry; no further retries or status changes after close. `src/frontend/src/App.tsx` calls it once (URL from injected env define with the pinned default) and renders the status text on an element with `data-status`; `src/frontend/src/main.tsx` mounts App into `#root` (`index.html`).

**Smoke contract.** `tests/e2e/smoke.mjs`, zero imports beyond Node built-ins (global `fetch`, global `WebSocket`): (1) poll backend `/healthz` → 200; (2) poll frontend `/` → 200 + `text/html`; (3) open two WebSockets concurrently, each must receive `hello` with a parseable `serverTime` within 5s; (4) print `PASS`/`FAIL` lines; exit non-zero if any check fails; bounded readiness wait (`READY_TIMEOUT_MS`). Mounted read-only; runs via the `smoke` compose service.

## Pinned content contracts

Baseline rule (all edited files): baseline = file content at that task's build start, captured in `build-log-T<id>.md`; the build-start capture governs. Diffs are checked against it; tokens below are required, wording latitude is bounded by them. **Amendment rule:** the only in-place modifications allowed anywhere are the items of § Amendment trace; every other change is a net-new file or a net-new line.

### 1. `docs/architecture/stack.md` (edit, T1)

- **1.A — status line (modification).** Becomes decided, e.g.: `**Status: DECIDED** (application stack, 2026-10-17) — the containerized delivery path remains as decided (§ Containerized delivery path).` Must contain "DECIDED" and "2026-10-17"; must not claim the application stack is NOT DECIDED.
- **1.B — prelude + rules list (modification).** The "will be selected via a dedicated stack-selection task / MUST NOT introduce" prelude and bullets are replaced by a short decided preamble (decision date; pointer to the decision section below; pointer to `docs/architecture/containerization.md` for container conventions).
- **1.C — new `## Application stack (DECIDED, 2026-10-17)` section (addition).** Names every component: Language TypeScript (strict); Runtime Node.js 24 LTS; Backend Fastify + `@fastify/websocket` (WebSocket server at `/ws`); Frontend React + Vite (SPA, static build); Package manager npm (workspaces, layout `src/backend` + `src/frontend`, unit tests colocated, e2e in `tests/e2e`); Tests Vitest; Lint ESLint (flat) + typescript-eslint; Dev runner tsx. One line states the decision rationale is recorded in this feature's spec.
- **1.D — commands (addition, inside or after 1.C).** The canonical command list must match `AGENTS.md` § Commands on the AC-4 token set.
- **1.E — WebSocket section (modification).** Heading `## Hard constraints (all candidates)` becomes `## Hard constraints`; capability bullets + rationale retained; closing sentence gains that the decided stack satisfies them (backend serves the WebSocket endpoint; frontend connects over WebSocket). The sibling-authored sentence "…the application stack remains NOT DECIDED until the stack-selection task decides it" is replaced (it is spent).
- **1.F — container path section (modification, minimal).** The bullet is replaced in full by the pin: its leading fragment "The application stack (language, framework, runtime, tooling, ports) remains NOT DECIDED;" is explicitly removed (AC-1's negative test), and its tail ("concrete container assets are authored at/after stack selection") becomes a present-tense statement that the assets exist in the repository (`compose.yaml`, Dockerfiles under `src/*`); provider-neutral wording retained verbatim; pointer to `containerization.md` retained.
- **1.G — closing "When decided…" paragraph (modification).** Fulfilled by this feature: replaced by a sentence that the decision is recorded above and operationalized by the scaffold (README, compose) — the promise list must not remain as a future tense.

### 2. `docs/architecture/containerization.md` (edit, T1)

- **2.A — preamble (modification).** Line 3's "The application stack itself … remains NOT DECIDED" becomes decided (2026-10-17; pointer to `stack.md`); the binding role and section set are retained (no new H2s; the section count stays 5).
- **2.B — § Real-time (WebSocket) requirement (modification, minimal).** Names the concrete endpoint (`GET /ws` on the backend listen port 8080); keeps upgrade-preservation and the deployment-time proxy/LB flag; keeps "no configuration content".
- **2.C — § Conventions to settle at stack selection (modification → settled record).** Retitle to settled form (e.g., "Container conventions (settled at stack selection, 2026-10-17)") and record every AC-5 item as a value, not a question: ports/env names; health signal + numbers; image naming/tagging; compose file + Dockerfile locations; dev-mode behavior; commands + README home. No item may remain open; deployment-time deferrals (proxy/LB, release tagging, prod runtime config) may be named as deferred.

### 3. `AGENTS.md` (edit, T1)

- **3.A — § Stack bullet 1 (modification).** Replaced by the decided-stack bullet: "Application stack: DECIDED (2026-10-17) — TypeScript (strict); Node.js 24 LTS + Fastify (WebSocket); React + Vite; npm workspaces; Vitest; ESLint. Canonical details in `docs/architecture/stack.md`." The `blocked`-for-undecided sentence is spent (removed).
- **3.B — § Stack containerized bullet (modification tail).** "concrete container assets are authored once the application stack is decided" becomes present tense: assets (`compose.yaml`, Dockerfiles under `src/*`) are in the repository; local run `podman compose up`; run instructions in `README.md`; keep Podman/Compose/provider-neutral/future-services/pointer content.
- **3.C — § Stack WebSocket bullet (modification tail).** Drop "No framework, library, or runtime is implied or chosen." Replace with a sentence that the decided stack satisfies the constraint (backend serves `/ws`; frontend connects over WebSocket); keep the protocol-level framing and the `stack.md § Hard constraints` pointer.
- **3.D — § Commands (rewrite; TBD bullet + local bullet).** Required commands with descriptions, tokens: `npm ci`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build`; `npm run dev` (starts the full local environment with hot reload — equivalent to `podman compose up`); `npm run smoke` (containerized e2e; equivalent to the explicit compose command). State: host tooling commands need Node.js 24 LTS + npm; the environment itself needs only Podman with a working compose provider (`podman compose`); run instructions in `README.md`. No "TBD".
- **3.E — § Conventions line 32 (modification).** Becomes: `- Language: TypeScript (strict) — decided with the application stack (2026-10-17); see docs/architecture/stack.md.`
- **3.F — § Project structure (rewrite of the list).** New list: `src/backend/` — backend workspace (Node + Fastify; Dockerfile); `src/frontend/` — frontend workspace (React + Vite; Dockerfile); `tests/e2e/` — containerized smoke/e2e tests; `docs/` — unchanged description; `.opencode/` — unchanged description. Add one line: unit tests are colocated beside sources (`*.test.ts`). The `public/` line is dropped (frontend static assets live under `src/frontend/`).

### 4. `README.md` (new, T3)

Required content (order/sectioning free): title + one-line description; **Prerequisites** — running the environment: Podman with a working compose provider (`podman compose`; "no other host prerequisites"); tooling commands: Node.js 24 LTS + npm; **Quickstart** — `podman compose up` (background: `podman compose up -d`; first run/after dependency changes: `podman compose up --build`), URLs (frontend `http://localhost:5173`, backend `http://localhost:8080`, WebSocket `ws://localhost:8080/ws`), stop with `podman compose down`; **Commands** table — `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run dev`, `npm run smoke`; **Configuration** table — `BACKEND_PORT` (8080), `FRONTEND_PORT` (5173), `VITE_WS_URL` (ws://localhost:8080/ws), note that defaults work out of the box and `.env` files are user-owned (not used by the scaffold); **Production images** — `podman build --format docker --target prod -f src/backend/Dockerfile .` / `-f src/frontend/Dockerfile .` note, with one sentence stating the `--format docker` form keeps the image `HEALTHCHECK` (Podman 5's OCI default drops it — r4); **Stack** — one-paragraph summary + links to `docs/architecture/stack.md` and `docs/architecture/containerization.md`; note that the frontend connects to the backend over WebSocket and the smoke test proves it.

### 5. `compose.yaml` (new, T3)

Pinned shape (wording of comments free; values binding):

```yaml
name: cubeclicker
services:
  backend:
    build: { context: ., dockerfile: src/backend/Dockerfile, target: dev }
    image: cubeclicker-backend:dev
    ports: ["127.0.0.1:${BACKEND_PORT:-8080}:8080"]
    environment: { NODE_ENV: development }
    volumes: ["./src/backend:/app/src/backend:z"]
  frontend:
    build: { context: ., dockerfile: src/frontend/Dockerfile, target: dev }
    image: cubeclicker-frontend:dev
    ports: ["127.0.0.1:${FRONTEND_PORT:-5173}:5173"]
    environment: { NODE_ENV: development, VITE_WS_URL: "${VITE_WS_URL:-ws://localhost:8080/ws}" }
    volumes: ["./src/frontend:/app/src/frontend:z"]
```

No `version:` key; no healthcheck duplication (health comes from the image `HEALTHCHECK`); no other services. Both workspace mounts carry the pinned `:z` shared SELinux relabel option (r5; no-op where SELinux is disabled). `podman compose config -q` exits 0.

### 6. `compose.smoke.yaml` (new, T3)

```yaml
services:
  smoke:
    image: docker.io/library/node:24-alpine
    working_dir: /smoke
    volumes: ["./tests/e2e:/smoke:ro,z"]
    command: ["node", "smoke.mjs"]
    depends_on: [backend, frontend]
```

Merged usage: `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (the `run` starts dependencies). `smoke` must never start on a plain `podman compose up` (it lives only in the override file). The mount carries the pinned `:ro,z` options — read-only + shared SELinux relabel (r5).

### 7. Root config set (new, T3)

- `package.json` — `private: true`; `workspaces: ["src/backend", "src/frontend"]`; `engines: {"node": ">=24"}`; scripts exactly: `dev` = `podman compose up`; `lint` = `eslint .`; `typecheck`/`test`/`build` = `npm run <name> --workspaces --if-present`; `smoke` = `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`. No other scripts.
- `tsconfig.json` — shared base for workspaces (`extends` target): `strict: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames`, `noEmit`-neutral (no `include`; never compiled directly).
- `eslint.config.mjs` — flat config: `@eslint/js` recommended + `typescript-eslint` recommended; ignores `dist/`, `node_modules/`, `coverage/`, `tests/e2e/**` (plain .mjs, still linted if configurable — acceptable either way); path-scoped globals: `src/backend/**` + root configs → Node globals (`globals.node`); `src/frontend/**` → browser globals (`globals.browser`) + `eslint-plugin-react-hooks` recommended-latest for `src/frontend/**`.
- `.gitignore` — at least: `node_modules/`, `dist/`, `coverage/`, `.env*`, `*.tsbuildinfo`.
- `.dockerignore` — at least: `.git`, `node_modules`, `dist`, `coverage`, `.env*`, `docs`, `tests`, `opencode.jsonc`; must NOT exclude `src/**` manifests (builds copy them). `README.md`, `.opencode` excluded (context bloat only — correctness note: Dockerfiles only copy `package*.json`, `tsconfig.json`, `src/<workspace>`).

### 8. Backend workspace (T3 manifest; T4 config/Dockerfile; T4b base-image qualification + header-command pin)

- `src/backend/package.json` (T3) — name `@cubeclicker/backend`, `private`, `type: "module"`, scripts: `dev` = `tsx watch src/server.ts`; `build` = `tsc`; `start` = `node dist/server.js`; `typecheck` = `tsc --noEmit`; `test` = `vitest run`. deps: `fastify`, `@fastify/websocket`; devDeps: `tsx`, `vitest`, `@types/node` (ranges in § Dependency manifest).
- `src/backend/tsconfig.json` (T4) — extends `../../tsconfig.json`; `module`/`moduleResolution` NodeNext, `target` ES2023+, `outDir: "dist"`, `rootDir: "src"`, `types: ["node"]`; imports use `.js` specifiers for relative imports (NodeNext requires them — pinned convention for all backend code).
- `src/backend/vitest.config.ts` (T4) — `environment: "node"`, `include: ["src/**/*.test.ts"]`.
- `src/backend/Dockerfile` (T4) — multi-stage, context repo root:
  - `dev`: `FROM docker.io/library/node:24-alpine`, `WORKDIR /app`, copy `package.json package-lock.json tsconfig.json` + both workspace `package.json`s, `npm ci`, copy the rest of `src/backend` (manifest already there), `HEALTHCHECK` (pinned timing; command: the committed long form `node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"` — aligned by r5 from spec-r4 F1; T4b leaves the line untouched), `CMD ["npm","run","dev","-w","@cubeclicker/backend"]`.
  - `prod`: builder stage `npm ci` → `npm run build -w @cubeclicker/backend`; runtime stage `docker.io/library/node:24-alpine`, `NODE_ENV=production`, copy `dist/` + prod `node_modules` (`npm ci --omit=dev`), `USER node`, same `HEALTHCHECK`, `CMD ["node","dist/server.js"]`.
  - Every `FROM` is registry-qualified (`docker.io/library/node:24-alpine` — never short names; r4) and all `COPY` paths are relative to repo root; no secrets; no `latest` tags. The `#` header build-command comments use the amended `podman build --format docker --target …` form (T4b).

### 9. Frontend workspace (T3 manifest; T5 config/Dockerfile; T5b base-image qualification + header-command pin)

- `src/frontend/package.json` (T3) — name `@cubeclicker/frontend`, `private`, `type: "module"`, scripts: `dev` = `vite`; `build` = `vite build`; `typecheck` = `tsc --noEmit`; `test` = `vitest run`. deps: `react`, `react-dom`; devDeps: `vite`, `@vitejs/plugin-react`, `vitest`, `@types/react`, `@types/react-dom`.
- `src/frontend/tsconfig.json` (T5) — extends base; `module`/`moduleResolution` bundler, `jsx: "react-jsx"`, `lib` DOM+ESNext, `types: ["vite/client"]`.
- `src/frontend/vite.config.ts` (T5) — `@vitejs/plugin-react`; `server: { host: true, port: 5173, strictPort: true, allowedHosts: ["frontend"] }` (the `allowedHosts` entry admits the smoke service's container-DNS hostname — Vite's default host check would otherwise reject `Host: frontend` with 403; published dev ports remain `127.0.0.1`-bound); `define: { 'import.meta.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL ?? 'ws://localhost:8080/ws') }`.
- `src/frontend/vitest.config.ts` (T5) — `environment: "node"`, `include: ["src/**/*.test.ts"]`.
- `src/frontend/index.html` (T5) — doctype, `<div id="root"></div>`, module script `/src/main.tsx`, title "CubeClicker".
- `src/frontend/nginx.conf` (T5) — serve `/usr/share/nginx/html`, listen 8080, `try_files $uri /index.html` SPA fallback.
- `src/frontend/Dockerfile` (T5):
  - `dev`: `docker.io/library/node:24-alpine`, `WORKDIR /app`, root manifests + both workspace manifests, `npm ci`, `HEALTHCHECK` (pinned timing; command: `node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`), `CMD ["npm","run","dev","-w","@cubeclicker/frontend"]`.
  - `prod`: build stage `docker.io/library/node:24-alpine` (`npm ci` → `npm run build -w @cubeclicker/frontend`) → `FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine`, copy `nginx.conf` + `dist/` → html root, `HEALTHCHECK` (`wget -q -O /dev/null http://127.0.0.1:8080/`), non-root by image default.
  - Every `FROM` is registry-qualified (`docker.io/…` — never short names; r4); the declared `HEALTHCHECK` is carried in the built images by the pinned `podman build --format docker` form; the `#` header build-command comments use the same amended form (T5b).

### 10. Backend sources (T4)

- `src/backend/src/app.ts` — `buildApp()`; registers `@fastify/websocket`; `GET /healthz` → `{status:'ok'}`; `GET /ws` (`{ websocket: true }`) → on `connection`, `socket.send(JSON.stringify(helloMessage()))`; exported `helloMessage(now = new Date())` returns `{type:'hello', serverTime: now.toISOString()}`.
- `src/backend/src/server.ts` — env read (`HOST` default `0.0.0.0`, `PORT` default `8080`), `buildApp()`, `listen`, log; no other logic.
- `src/backend/src/app.test.ts` — Vitest: `/healthz` 200 + body; `helloMessage()` shape (`type`, parseable ISO `serverTime`).

### 11. Frontend sources (T5)

- `src/frontend/src/ws/connection.ts` — the pinned interface (§ Interfaces); no DOM access; timer via injected default (`setTimeout`) — fake sockets/timers in tests; statuses exactly `connecting | connected | disconnected`.
- `src/frontend/src/ws/connection.test.ts` — Vitest with a `FakeSocket` class: connecting→connected on open; disconnected on close; attempt cap respected (no retry beyond `maxAttempts`); success resets counter; `close()` cancels pending retry and prevents further status changes.
- `src/frontend/src/App.tsx` — renders title + status element (`data-status` attribute; text "Connecting…"/"Connected"/"Disconnected"); creates one connection via `createConnection` in an effect with cleanup calling `close()`.
- `src/frontend/src/main.tsx` — mounts `<App/>` into `#root`.

### 12. `tests/e2e/smoke.mjs` (new, T6)

Per § Interfaces (smoke contract). Zero dependencies; runs only inside the compose network by default (env overrides allowed); mounted read-only. The file must run under `node smoke.mjs` on `docker.io/library/node:24-alpine` (the smoke image row, contract 6) with no install step.

### 13. Framework one-liners (edit, T2)

One-line edits, each a pinned replacement of stale "undecided" guidance; nothing else in these files changes:

| File | Pinned replacement |
| --- | --- |
| `.opencode/skills/orchestration-playbook/SKILL.md` §4 | shared-file example list `(package.json, lockfiles, entrypoints)` gains `, container definitions such as the compose file and Dockerfiles` (mirror of task-decomposition rule 5; folded F2) |
| `.opencode/agents/planner.md` container rule tail | "stack-dependent container details stay open questions until the application stack is decided" → "container details follow the settled conventions (`docs/architecture/stack.md`, `docs/architecture/containerization.md`); they are reopened only by a user-owned stack amendment" |
| `.opencode/agents/builder.md` container rule tail | "container assets still require the application stack — report `blocked` instead of guessing until it is decided" → "the application stack is decided (2026-10-17) — follow the pinned container conventions (`docs/architecture/containerization.md`); container assets live in the repository (`compose.yaml`, `src/*/Dockerfile`)" |
| `.opencode/skills/web-implementation/SKILL.md` architecture bullet | "No container assets before the application stack is decided." → "Container assets and conventions are pinned in the repository (`compose.yaml`, `src/*/Dockerfile`; `docs/architecture/containerization.md`)." |
| `.opencode/skills/spec-authoring/references/spec-checklist.md` container item 2 | "Stack-dependent container details flagged as open questions; no container assets specified for an undecided stack" → "Container details follow the settled conventions (`docs/architecture/containerization.md`); deviations are flagged as open questions for a user-owned amendment" |
| `.opencode/skills/spec-review/SKILL.md` container item tail | "stack-dependent container details are open questions" → "container details must match the settled conventions (`docs/architecture/containerization.md`) or be flagged as open questions" |

### 14. Permission bootstrap (edit, T0)

Append six `edit` allow entries to `.opencode/agents/builder.md`, inserted after the existing `resource: "index.html"` allow block, in this order: `README.md`, `.gitignore`, `.dockerignore`, `package-lock.json`, `compose.yaml`, `compose.smoke.yaml`. Mechanism mirrors the online-realtime-workflow T0 precedent: an anchored, idempotent `python3` heredoc via the builder's existing shell capability (no `edit`-tool access needed for the insertion point — `.opencode/agents/*.md` is already allowlisted); abort non-zero if the anchor is absent; re-run is a no-op; capture baseline; touch no deny entry. These six paths are the only files this feature authors that fall outside the current allowlist (precondition scan: `src/**`, `tests/**`, `docs/**`, `.opencode/**`, root `package.json`/`tsconfig.json`/`*.config.*`/`index.html` are already covered).

### 15. Decided docs tooling amendment: Docker → Podman (edit, T2b)

Baseline = the committed post-T1 content of the three files (build-start capture in `build-log-T2b.md`). Only the substitutions below are allowed; every other line stays byte-identical. `Dockerfile`, `Dockerfiles`, `.dockerignore`, and the compose `dockerfile:` key are filenames/keys — never renamed.

- **15.A `docs/architecture/stack.md`** (5 `docker compose` tokens): every `docker compose` token becomes `podman compose` (the command-table rows for `npm run dev`, `npm run smoke`, and the standalone `docker compose up` row; the local-development bullet; the closing paragraph). Exact tooling bullet: `- Docker images + Docker Compose are the decided containerization tooling (user decision, 2026-10-17).` → `- Podman and Podman Compose (`podman compose`) are the decided containerization tooling (user decision, 2026-10-17; tooling amendment 2026-10-17).` No other change (all `Dockerfile` occurrences stay).
- **15.B `docs/architecture/containerization.md`** (5 `docker compose` tokens): every `docker compose` token becomes `podman compose` (local-development bullet; compose-file locations bullet; dev-mode bullet; the local-run/README bullet's two commands). Exact prerequisite bullet: `- No host prerequisites beyond Docker with Compose.` → `- No host prerequisites beyond Podman with a working compose provider (`podman compose`).` No other change (Dockerfile locations/lines stay).
- **15.C `AGENTS.md`** (4 `docker compose` tokens): every `docker compose` token becomes `podman compose` (containerized-delivery bullet; `npm run dev` and `npm run smoke` entries; local-environment bullet). Exact tooling phrase: `Docker and Docker Compose are the decided tooling` → `Podman and Podman Compose (`podman compose`) are the decided tooling`. Exact prerequisite phrase: `running the environment itself needs only Docker with Compose` → `running the environment itself needs only Podman with a working compose provider (`podman compose`)`. No other change (Dockerfile mentions stay).

### 16. Framework tooling-token alignment: Docker → Podman (edit, T2c; reviewer oversight)

Baseline = the committed post-T2 content of the four files. Only these four replacements; the `permissions:` block in `builder.md` must remain byte-identical (AC-33). `builder.md` is the third sequential edit of that file (T0 permissions, T2 prose, T2c token) — never parallel with another task.

| File | Pinned replacement |
| --- | --- |
| `.opencode/agents/builder.md` line 112 (prose only) | `Docker images + Docker Compose` → `Podman images + Podman Compose (`podman compose`)` |
| `.opencode/skills/web-implementation/SKILL.md` line 27 | `` `docker compose up`-style single-command local dev `` → `` `podman compose up`-style single-command local dev `` |
| `.opencode/skills/web-implementation/references/engineering-principles.md` line 57 | `one `docker compose up`-style command; no host-specific setup beyond Docker + Compose.` → `one `podman compose up`-style command; no host-specific setup beyond Podman with a working compose provider.` |
| `.opencode/skills/code-review/checklists/quality.md` line 41 | `Single-command local run preserved (`docker compose up`-style starts the full environment)` → `Single-command local run preserved (`podman compose up`-style starts the full environment)` |

Reviewer oversight: T7's permission inspection covers T2c's commit; the reviewer verifies the four replacements exactly and confirms the `builder.md` permissions block is byte-identical to its post-T0/T2 baseline. No permission allow/deny entry may change (AC-33).

## Dependency manifest

Pinned major ranges (T3 resolves and records exact versions in the lockfile + build log; **unavailable range or peer-incompatible major = `blocked`, never substituted**).

| Where | Package | Pin | Rationale |
| --- | --- | --- | --- |
| root devDeps | `typescript` | `~5.9` | strict TS toolchain, stable 5.x line |
| root devDeps | `eslint`, `@eslint/js` | `^9` | flat-config lint |
| root devDeps | `typescript-eslint` | `^8` | TS-aware rules for ESLint 9 |
| root devDeps | `globals` | `^16` | env globals for flat config |
| root devDeps | `eslint-plugin-react-hooks` | `^5` | React hooks correctness at the lint gate |
| backend deps | `fastify` | `^5` | HTTP server + plugin model |
| backend deps | `@fastify/websocket` | `^11` | WS server on Fastify 5 (wraps `ws`) |
| backend devDeps | `tsx` | `^4` | TS dev runner/watch (no experimental flags) |
| backend devDeps | `vitest` | `^3` | unit tests |
| backend devDeps | `@types/node` | `^24` | Node 24 types |
| frontend deps | `react`, `react-dom` | `^19` | UI |
| frontend devDeps | `vite` | `^7` | build + dev server |
| frontend devDeps | `@vitejs/plugin-react` | peer-compatible major with resolved Vite (expected `^5`) | React fast refresh |
| frontend devDeps | `vitest` | `^3` | unit tests |
| frontend devDeps | `@types/react`, `@types/react-dom` | `^19` | React types |
| images | `docker.io/library/node:24-alpine` | pinned tag | Node 24 LTS line; registry-qualified (r4 — short-name-enforcing host) |
| images | `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` | pinned tag | non-root static serving; registry-qualified (r4) |

No other packages. No `ws` dependency (client uses the browser/Node global; server uses `@fastify/websocket`'s bundled `ws`). Smoke needs zero packages.

## Amendment trace

In-place modifications of pre-existing content (everything else is net-new files/lines). All items trace to this feature's mandate (stack.md "When decided…"; containerized-workflow Q-1/Q-4/Q-7; code-r1 F1/F2; the request's "make it real"), to the r3 tooling amendment (user decision 2026-10-17; contracts 15–16), to the r4 provider-compat pin amendment (T4/T5 first live builds, 2026-10-18; tasks T4b/T5b), or to the r5 SELinux host-compat amendment (T6 first live sequence, 2026-10-18; task T6b):

| File | Modified items | Trace |
| --- | --- | --- |
| `docs/architecture/stack.md` | 1.A status; 1.B prelude+rules; 1.E WebSocket section; 1.F container section tail; 1.G closing paragraph; 15.A tooling tokens | fulfills the file's own "When decided…" promise; supersedes the NOT-DECIDED pins of the two accepted predecessors by design (their Q-7/AC-5 anticipated exactly this task); 15.A = r3 amendment |
| `docs/architecture/containerization.md` | 2.A preamble; 2.B real-time tail; 2.C conventions section (settled); 15.B tooling tokens | containerized-workflow Q-1/AC-11 assigned these to stack selection; 15.B = r3 amendment |
| `AGENTS.md` | 3.A–3.F (§ Stack bullets 1–3, § Commands, § Conventions TS line, § Project structure); 15.C tooling tokens | AGENTS.md:13 "filled in after the stack-selection task"; code-r1 F1 (TS line, required fold); 15.C = r3 amendment |
| `.opencode/skills/orchestration-playbook/SKILL.md` | §4 example list | folded containerized-workflow code-r1 F2 (folding sanctioned by spec-r2 backlog note) |
| `.opencode/agents/planner.md` | container rule tail | stale "until decided" clause |
| `.opencode/agents/builder.md` | container rule tail (T2); permissions (T0); line 112 tooling tokens (T2c) | stale "report blocked until decided" clause; T0 bootstrap; T2c = r3 amendment (prose only — permissions byte-frozen, AC-33) |
| `.opencode/skills/web-implementation/SKILL.md` | container bullet sentence (T2); line 27 tooling token (T2c) | stale "no assets before decided" clause; T2c = r3 amendment |
| `.opencode/skills/web-implementation/references/engineering-principles.md` | line 57 tooling tokens (T2c) | r3 amendment — stale `docker compose up`-style reference |
| `.opencode/skills/code-review/checklists/quality.md` | line 41 tooling token (T2c) | r3 amendment — stale `docker compose up`-style reference |
| `.opencode/skills/spec-authoring/references/spec-checklist.md` | container item 2 | stale "undecided stack" clause |
| `.opencode/skills/spec-review/SKILL.md` | container item tail | stale "open questions" clause |
| `src/backend/Dockerfile` | `FROM` tokens registry-qualified; `#` header build-command comments amended (T4b) | r4 provider-compat amendment — T4/T5 first live builds (`build-log-T4.md` § 5.1/5.2) |
| `src/frontend/Dockerfile` | `FROM` tokens registry-qualified (node ×2, nginx prod); `#` header build-command comments amended (T5b) | r4 provider-compat amendment — short-name-enforcing host (`build-log-T5.md` § Divergences 1–2) |
| `compose.yaml` | both workspace bind-mount specs gain the `:z` shared relabel option (T6b) | r5 SELinux host-compat amendment — T6 first live sequence (`build-log-T6.md` § 3–§ 4, § 6) |
| `compose.smoke.yaml` | smoke `image:` token registry-qualified: `docker.io/library/node:24-alpine` (T5b); smoke bind-mount spec gains `:ro,z` (T6b) | r4 provider-compat amendment — short-name-enforcing host (`build-log-T5.md` § Divergence 1); r5 SELinux host-compat amendment — T6 first live sequence (`build-log-T6.md` § 3–§ 4, § 6) |
| `README.md` | Production-images commands pin `podman build --format docker --target prod …` + one-sentence rationale (T5b) | r4 provider-compat amendment — OCI-format `HEALTHCHECK` drop (`build-log-T4.md` § 5.1) |

No other pre-existing file may be modified; `docs/product/**`, other features' artifacts, and `opencode.jsonc` stay byte-identical, and the code-review checklists stay byte-identical except `quality.md`'s pinned tooling token (16). Historical Docker mentions in the accepted predecessor features and the Run 1–3 build logs are frozen evidence, not live guidance — they are not part of the amendment set. The r4 amendment (T4b/T5b) and the r5 amendment (T6b) modify only the rows above — files this feature itself authored (T3–T6) — under the same closed-list rule.

## File inventory

| Path | New/Edit | Purpose | Owner |
| --- | --- | --- | --- |
| `docs/architecture/stack.md` | Edit (1.A–1.G; 15.A) | decided stack; layout; commands; constraints satisfied; Podman tooling tokens | T1, T2b |
| `docs/architecture/containerization.md` | Edit (2.A–2.C; 15.B) | settled container conventions; Podman tooling tokens | T1, T2b |
| `AGENTS.md` | Edit (3.A–3.F; 15.C) | decided framing; § Commands; TS line; structure; Podman tooling tokens | T1, T2b |
| `README.md` | New; r4 pin (T5b) | run instructions home; commands/env tables; production-image build commands | T3, T5b |
| `compose.yaml` | New; r5 pin (T6b) | dev compose stack; `:z` shared relabel on both workspace bind mounts | T3, T6b |
| `compose.smoke.yaml` | New; r4 pin (T5b); r5 pin (T6b) | smoke service (opt-in); qualified image token; `:ro,z` mount | T3, T5b, T6b |
| `package.json`, `package-lock.json` | New | workspaces, scripts, lockfile | T3 |
| `tsconfig.json`, `eslint.config.mjs` | New | shared TS base; flat lint config | T3 |
| `.gitignore`, `.dockerignore` | New | hygiene; build-context hygiene | T3 |
| `src/backend/package.json`, `src/frontend/package.json` | New | workspace manifests | T3 |
| `src/backend/tsconfig.json`, `src/backend/vitest.config.ts` | New | backend TS/test config | T4 |
| `src/backend/Dockerfile` | New; r4 pin (T4b) | backend dev/prod images; registry-qualified bases; amended header commands | T4, T4b |
| `src/backend/src/app.ts`, `server.ts`, `app.test.ts` | New | Fastify app + entrypoint + tests | T4 |
| `src/frontend/tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `nginx.conf` | New | frontend config/entry | T5 |
| `src/frontend/Dockerfile` | New; r4 pin (T5b) | frontend dev/prod images; registry-qualified bases; amended header commands | T5, T5b |
| `src/frontend/src/main.tsx`, `App.tsx`, `ws/connection.ts`, `ws/connection.test.ts` | New | UI + connection module + tests | T5 |
| `tests/e2e/smoke.mjs` | New | containerized smoke | T6 |
| `.opencode/agents/builder.md` | Edit (T0 perms; T2 prose; T2c tooling token) | bootstrap + stale clause + Podman token (prose only) | T0, T2, T2c |
| `.opencode/agents/planner.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md`, `.opencode/skills/spec-review/SKILL.md`, `.opencode/skills/orchestration-playbook/SKILL.md` | Edit (one-liners; 16 for `web-implementation/SKILL.md`) | stale clause updates; F2 fold; Podman token | T2, T2c (`web-implementation/SKILL.md`) |
| `.opencode/skills/web-implementation/references/engineering-principles.md` | Edit (16) | Podman tooling tokens | T2c |
| `.opencode/skills/code-review/checklists/quality.md` | Edit (16) | Podman tooling token | T2c |
| `docs/features/stack-selection/build-log-T0.md` … `-T7.md` (incl. `-T2b`, `-T2c`, `-T4b`, `-T5b`, `-T6b`) | New | per-task evidence | T0…T7, T2b, T2c, T4b, T5b, T6b |

## Files intentionally unchanged

| Path | Why |
| --- | --- |
| `docs/product/**` (vision, backlog, glossary) | product direction untouched; backlog tensions stay flagged |
| `docs/features/**` (other features), `docs/features/README.md` | not this feature's artifacts; README row is orchestrator-owned |
| `.opencode/agents/orchestrator.md`, `.opencode/commands/feature.md` | routing/state machine unaffected by the stack decision |
| `.opencode/skills/task-decomposition/**` | rule 5 already carries container definitions (predecessor) |
| `.opencode/skills/code-review/checklists/**` (except `quality.md`'s T2c tooling token), `spec-review` body beyond its item | gate checklists already covered by predecessors; testing checklist's "once the stack provides commands" line becomes operative without edits; `quality.md` changes only its pinned T2c token |
| `opencode.jsonc`, `LICENSE` | user config untouched; license untouched |
| `docs/features/containerized-workflow/**`, `online-realtime-workflow/**`, `project-glossary/**` | accepted features' artifacts are frozen — their Docker/Docker Compose mentions are historical decision records, not live guidance; the r3 scan deliberately leaves them unchanged. This feature's own Run 1–3 build logs (including `build-log-T3.md`) are likewise frozen evidence. |

## Carried backlog items

- **Folded (required):** containerized-workflow code-r1 F1 → AGENTS.md:32 rewritten (3.E). **Folded:** code-r1 F2 → playbook §4 one-line edit (contract 13) — folding is justified *now* because this feature lands the container assets that make the asymmetry live; the spec-r2 backlog note explicitly sanctions a framework-touching feature folding it.
- **Kept recorded (not folded):** the spec-r2 sibling-parity item (import the "pinned replacement = modification" accounting sentence into the containerized-workflow amendment rule). Folding requires re-wording that accepted feature's AC-2, which is outside this feature's write scope; noted here for a future artifact-touching revision.
- **Folded (implicit obligations):** the five stale "until decided" guard clauses the predecessors deliberately left conditional (contract 13) — leaving them would misinstruct the builder after the decision.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | TypeScript everywhere (single language) | one toolchain for the AI pipeline; shared types patterns; satisfies AGENTS.md:32 intent | Go/Python/Elixir backends — rejected (split toolchain, no scale-driven need) |
| D-2 | Node.js 24 LTS | active LTS line; boring, agent-familiar; global `fetch`/`WebSocket` power the zero-dep smoke | Bun/Deno — rejected (younger ecosystem/tooling risk); Node current — rejected (churn) |
| D-3 | Fastify 5 + `@fastify/websocket` | typed, structured, plugin model for future routes/validation; first-class WS test story | Express+ws — rejected (weaker structure/TS); Hono — rejected (Node WS story newer); bare `ws` — rejected (rebuilds HTTP basics); NestJS — rejected (overkill) |
| D-4 | React 19 + Vite SPA | largest agent familiarity; small static bundles; instant load | Svelte — recorded alternative; vanilla TS — rejected (UI growth); Next.js — rejected (SSR unnecessary) |
| D-5 | npm workspaces (`src/backend`, `src/frontend`) | npm ships with Node; one lockfile; fits the two-image topology | pnpm — recorded alternative; separate packages — rejected (dual lockfiles/setup) |
| D-6 | Unit tests colocated (`*.test.ts`), e2e in `tests/e2e/` | Vitest convention; keeps tests beside code; e2e needs the full stack | all-central `tests/` — rejected for unit granularity; both-colocated — rejected (smoke is cross-service) |
| D-7 | Container conventions as pinned (ports 8080/5173; loopback maps; env names; `/healthz`; image names; compose+Dockerfile locations; hot-reload dev mode) | resolves containerization.md's checklist exactly; loopback binding keeps dev surfaces off the LAN | container-internal dynamic ports — rejected (opaque); 0.0.0.0 binding — rejected (exposure) |
| D-8 | Smoke = zero-dep Node script in a separate compose file (`compose.smoke.yaml`) with two WS clients | proves the real-time path through the container network; keeps `podman compose up` clean; `--rm run` semantics certain (no profiles uncertainty) | profile-based smoke — rejected (`run`+profiles semantics uncertain); host-run smoke — rejected (needs host Node for users; less faithful) |
| D-9 | Prod stages: node non-root backend; unprivileged nginx frontend | provider-neutral deployable artifacts; non-root by default; static serving is a solved problem | hand-rolled static server — rejected (path-traversal risk, reinvention); serving frontend from backend — rejected (violates two-deployable contract) |
| D-10 | `README.md` at repo root is the run-instructions home | fulfills containerized-workflow Q-4 expectation; single place for commands/env/ports | docs/architecture page — rejected (root README is the requested home) |
| D-11 | Fold F2 + the five stale guard clauses (one-liners) | container assets now exist; stale "undecided" guidance would misinstruct agents | leave recorded — rejected (operational defect after the decision) |
| D-12 | No `src/shared` workspace yet | YAGNI: scaffold needs no shared types; path reserved for the first feature that does | scaffold it now — rejected (premature build wiring; hello is local) |
| D-13 | No Prettier; ESLint only | minimal tooling at scaffold; add later if needed | include now — deferred, listed in non-goals |
| D-14 | Prod runtime-config injection (frontend WS URL) deferred | deployment-time design; local default is a safe local value; flagged | config.js/envsubst now — rejected (complexity beyond scaffold) |
| D-15 | T0 permission bootstrap mirrors the sibling precedent (six entries, shell heredoc, idempotent) | required paths (`compose*.yaml`, `README.md`, dotfiles, lockfile) sit outside the allowlist | manual user apply — rejected (framework autonomy directive); shell-only authoring — rejected (edit tool is the norm; explicit allows keep audits clean) |
| D-16 | Container tooling amended from Docker/Docker Compose to Podman and Podman Compose (`podman compose`), user decision 2026-10-17 | environment re-check (Run 3): no Docker CLI/daemon; rootless Podman 5.8.7 with a working compose provider (Docker Compose v5.6.0) reaches the live socket; user chose Podman at the checkpoint ("nothing more to install"); container filenames/keys (`compose.yaml`, `Dockerfile`, `dockerfile:` key) stay OCI-standard | install Docker CLI/daemon — user-rejected; keep Docker pins — leaves T3+ unbuildable on the verified host |
| D-17 | Provider-compat pins (r4, T4/T5 first live builds): registry-qualified base-image tokens (`docker.io/…`, same images/tags) + `podman build --format docker …` on every bare CLI build — compose layer, contract 5, and the single-`podman compose up` promise unchanged | the verified host enforces short-name resolution without a TTY (unqualified `nginxinc/nginx-unprivileged` fails `EXIT 125`; `node` resolves only via a host alias — `build-log-T5.md` § Divergences 1) and Podman 5's default OCI build format silently drops the declared `HEALTHCHECK` (`build-log-T4.md` § 5.1) while the compose-provider build path carries it (§ 5.2); host-independent tokens + an explicit command-form pin need no host config and reference the same images/tags | host `registries.conf` alias edits — rejected (host-coupled, not repo-carried; outside any task's write scope); `BUILDAH_FORMAT=docker` env — rejected (invisible coupling outside the pins); compose-level healthchecks — rejected (duplicates the image `HEALTHCHECK`, breaks contract 5); caveat-only documentation — rejected (leaves the r3 pins broken on the verified host) |
| D-18 | SELinux host-compat pins (r5, T6 first live sequence): the pinned bind mounts carry the shared relabel option — `:z` on both workspace mounts, `:ro,z` on the smoke mount (contracts 5/6) — applied via T6b | the verified host runs SELinux Enforcing with the repo under `user_home_t`; without the option both dev containers exit `243` (`EACCES` on `/app/src/*/package.json`) and the smoke container cannot read its read-only mount (`build-log-T6.md` § 3–§ 4). The option is host-independent, adds no flags/prerequisites, and is a no-op where SELinux is disabled; `:z` (shared) matches the sharing pattern (host tooling + recreated container instances across `up`/`down`/`run --rm`), while `:Z` (private per-container label) would tie sources to one container instance | manual/out-of-band relabeling (candidate A) — rejected (host-coupled, privilege-requiring, re-applied per checkout; contradicts AC-12's no-other-host-prerequisites); host-wide `label = false` / per-service `label=disable` (candidate C) — rejected (environment-only; disables SELinux separation; the r4 rejection class); recording a host precondition instead of a repo pin — rejected (leaves every other SELinux host/CI failing the decided single command) |

## Risks & mitigations

- **Version availability** (npm ranges / image tags / plugin peer majors): resolved at T3 build time; any mismatch → `blocked` with raw output, planner re-pins via spec revision. No silent substitution.
- **`podman compose` provider compatibility**: the verified environment delegates `podman compose` to the external `/usr/local/bin/docker-compose` provider (Docker Compose v5.6.0) over the rootless Podman socket (`/run/user/1000/podman/podman.sock`, `systemctl --user podman.socket` active — Run 3 evidence). Each pinned command form (`config -q`; `up -d --build --wait`; `down -v --rmi local`; `run --rm smoke`; `podman build --format docker --target`) must be verified by the first task that uses it, with raw output recorded in that task's build log. A provider rejection or behavioral divergence is a `blocked` report / spec gap — never an improvised substitute command.
- **Short-name base-image resolution** (T4/T5 first live builds): the verified host enforces short-name resolution without a TTY — bare `node` resolved only via a host alias, and bare `nginxinc/nginx-unprivileged` failed (`EXIT 125`; `build-log-T5.md` § Divergence 1). Mitigation: all base-image tokens are registry-qualified (`docker.io/…`; T4b/T5b); host `registries.conf` edits are explicitly not part of any task; pinned builds and T7's scan re-verify.
- **Podman 5 OCI `HEALTHCHECK` drop** (T4/T5 first live builds): bare `podman build` (default OCI format) dropped the declared `HEALTHCHECK` (`Healthcheck: null` + build warning; `build-log-T4.md` § 5.1) while the compose-provider build path carries it (§ 5.2). Mitigation: every bare CLI build pins `--format docker` (T4b/T5b verify; README commands; T6 records `podman inspect` health evidence). If the provider build path ever stops carrying the healthcheck, that is a recorded spec gap — never an improvised compose-level healthcheck (contract 5 stands).
- **SELinux bind-mount denial** (T6 first live sequence): the verified host runs SELinux **Enforcing** with the repository under `user_home_t`; without a relabel option both dev containers exit `243` (`EACCES` on `/app/src/*/package.json`) and the smoke container cannot read `/smoke` (`MODULE_NOT_FOUND` — `build-log-T6.md` § 3–§ 4). Mitigation: the pinned bind mounts carry the shared relabel option (`:z`; smoke `:ro,z` — contracts 5/6, applied by T6b), so the single-command sequence works on a stock SELinux-Enforcing rootless host: no new flags, no host prerequisites, and the option is **a no-op where SELinux is disabled** (host-independent pins). The first `podman compose up` relabels the mounted source trees (shared `container_file_t`; standard Podman practice; re-applied by the next container start after checkout refreshes) — never a manual `chcon` step (candidate A) and never `label=disable` / `label = false` (candidate C). If the provider rejects the option or the sequence still fails, that is a recorded `blocked`/spec gap — never an improvised host configuration.
- **Compose feature drift** (`--wait`; `run` semantics): T6 records exact behavior; `--wait` fallback documented in AC-26; smoke carries its own readiness wait so `run` timing is not load-bearing.
- **Bind-mount watch on Podman Desktop / VM-based container hosts**: documented polling option (Q-7); the verified Linux build host (rootless Podman) uses inotify natively.
- **Dependency-install divergence between tasks**: only T3 installs; T4/T5 are forbidden from touching manifests/lockfile (blocked if they believe a dep is missing) — keeps the `[P]` batch collision-free.
- **Permission/bootstrap drift**: T0 is isolated (permissions only), anchored, idempotent, reviewer-inspected; AC-33 freeze; no other commit may touch permission content.
- **Doc/scaffold drift** (commands or env names pinned twice): T7 full-consistency pass (AC-34); any divergence is a finding, not a patch.
- **Over-scoping**: inventory is closed; gameplay/deployment/browser-e2e explicitly out; reviewer treats added scope as a finding.
- **Dev bind-mount shadowing `node_modules`**: `./src/<workspace>` mounts shadow the workspace-local `node_modules` from the image; the toolchain is hoisted to the unmounted `/app/node_modules` (npm workspaces), so dev containers resolve their own (musl-appropriate) binaries — if a dependency ever resolves workspace-locally and fails inside the container, record `blocked` (fix via plan revision, never a silent compose edit).
- **`builder.md` multi-phase edit (`T0` perms + `T2` prose + `T2c` token)**: sequential only (never parallel), checked as three per-task diffs against per-task baselines (sibling precedent); the `permissions:` block stays byte-frozen (AC-33).

## Open questions

- The spec's Q-1…Q-8 are the active open questions for the checkpoint; the plan pins values for all of them as the recommendation (approval = acceptance of the pins; changes = spec revision). No additional plan-level questions remain.
- r3 adds no new plan-level open question: the one remaining uncertainty (`podman compose` provider command behavior) is handled as the in-task verification risk above, not as scope.
- r4 adds no new plan-level open question: both T4/T5 divergences were resolved from logged first-use evidence as pin amendments (registry-qualified base images; `podman build --format docker`), with no user-visible behavior change (no new flags in `podman compose up`, no host prerequisites); decision record in § Key decisions D-17.
- r5 adds no new plan-level open question: the SELinux bind-mount denial was resolved from logged first-use evidence as a pin amendment (candidate B — shared `:z`/`:ro,z` relabel), with no user-visible behavior change (no new flags, no host prerequisites; no-op where SELinux is disabled); decision record in § Key decisions D-18.
- Carried forward (kept recorded; no action in this feature): the spec-r2 sibling-parity item — folding it requires re-wording an accepted feature's AC-2, outside this feature's write scope (see § Carried backlog items).
