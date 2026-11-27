# Build log — T3 — Vercel production project

Task: T3 (2026-11-27)
Files changed: `docs/features/production-provisioning/build-log-T3.md` (only; no application code, workflow, `render.yaml`, `src/frontend/vercel.json`, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: Reused-or-created the production Vercel project `cubeclicker` (none existed, so it was created), applied the project settings (root `src/frontend`, framework `vite`, Node.js `24.x`, the `src/frontend/vercel.json` build/output and the `npm ci` install, Git auto-deploy off, Vercel Authentication/SSO deployment protection off), and read back the project ID, org ID and production domain. No Vercel deployment was created.
Decisions: The base name `cubeclicker` was available, so the `cubeclicker-game` fallback was not used and no provider refusal applies. The project was created without a `gitRepository` argument, so it has no Git connection and Actions remains the single deployment path; `update_project` also re-applied the same settings idempotently.
Testing note: T3 is an infrastructure task per `tasks.md` (provider state plus a build log; no application code). The feature-appropriate integration tier is the provider read-back recorded below; no repository unit/integration test boundary exists for Vercel account state, and the full repository suite remains T8's gate.

## Vercel project read-back

Read live with `tools.vercel.list_teams`, `tools.vercel.list_projects`, `tools.vercel.get_project`, `tools.vercel.list_project_domains` and `tools.vercel.list_deployments` (read-only) on 2026-11-27:

```
name: cubeclicker
project id: prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH
org id: team_7cz2iixGr020Vqvjhj7Y1DNp
https://cubeclicker.vercel.app
production frontend: https://cubeclicker.vercel.app
framework: vite
nodeVersion: 24.x
rootDirectory: src/frontend
gitAutoDeploy: disabled
deploymentProtection: disabled
distinct from prj_9GfusgivGpVJDXeJPi2TnMUCb2RV
No Vercel deployment was created
```

- Team/org: `raultorres2603's projects` (`raultorres2603s-projects`), id `team_7cz2iixGr020Vqvjhj7Y1DNp`; Hobby plan (mirrors development).
- Project: `cubeclicker`, id `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, created `2026-11-27T11:26:14Z`, last updated `2026-11-27T11:26:54Z`, `live: false` (no production deployment yet), `latestDeployment: null`.
- Domain: `cubeclicker.vercel.app`, verified (`verified: true`), project id `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`.
- The project is distinct from the development project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV` (`cubeclicker-development`); `list_projects` with `search: "cubeclicker"` returned exactly those two projects and no duplicate or environment-suffixed production project.

## Provider calls and creation record

Capabilities used are the T1-recorded Vercel tools (`create_project`, `update_project`, `get_project`, `list_project_domains`, `list_deployments`, `list_projects`, `list_teams`); no unlisted tool was guessed or called.

1. Pre-check `tools.vercel.list_projects({ teamId, search: "cubeclicker", limit: "20" })` → only `cubeclicker-development` (`prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`). The name `cubeclicker` was available; the `cubeclicker-game` fallback was not needed and there is no provider refusal to record.
2. `tools.vercel.create_project({ teamId, requestBody: { name: "cubeclicker", framework: "vite", rootDirectory: "src/frontend" } })` → `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, `framework: "vite"`, default `nodeVersion: "26.x"`, `ssoProtection: {"enabled":true,"deploymentType":"all_except_custom_domains"}` (Vercel's new-project default), `latestDeployment: null`, `domains: []`. No `gitRepository` was supplied, so no Git connection was created.
3. `tools.vercel.update_project({ idOrName: "cubeclicker", requestBody: { rootDirectory: "src/frontend", framework: "vite", nodeVersion: "24.x", buildCommand: "npm run build", outputDirectory: "dist", ssoProtection: null } })` → accepted; response `nodeVersion: "24.x"`, `ssoProtection: {"enabled":false,"deploymentType":null}`.
4. `tools.vercel.update_project` idempotent re-apply with the same settings plus `installCommand: "npm ci"` → accepted; response `nodeVersion: "24.x"`, `ssoProtection: {"enabled":false,"deploymentType":null}`, `latestDeployment: null`.
5. `tools.vercel.get_project({ idOrName: "cubeclicker" })` → `id: prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, `name: cubeclicker`, `framework: vite`, `nodeVersion: 24.x`, `accountId: team_7cz2iixGr020Vqvjhj7Y1DNp`, `latestDeployment: null`, `ssoProtection: {"enabled":false,"deploymentType":null}`, `passwordProtection: {"enabled":false,"deploymentType":null}`.
6. `tools.vercel.list_project_domains({ idOrName: "cubeclicker" })` → `cubeclicker.vercel.app`, `verified: true`.
7. `tools.vercel.list_deployments({ projectId: "prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH" })` → `count: 0`, `deployments: []`.
8. Development read-back `tools.vercel.get_project({ idOrName: "cubeclicker-development" })` → unchanged id `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`, `nodeVersion: 24.x`, `ssoProtection.enabled: false`; its `updatedAt` remains `1795770130687` (last change predates T3). No T3 call targeted a development setting.

## Settings and the `src/frontend/vercel.json` contract

`src/frontend/vercel.json` is unchanged (no repository edit) and is the committed build/output/rewrites/headers contract; because it sits at the project root (`src/frontend`), the T6 build reads it directly:

| Setting | Value |
| --- | --- |
| framework | `vite` |
| buildCommand | `npm run build` |
| outputDirectory | `dist` |
| rewrites | `/((?!assets/).*)` → `/index.html` (SPA fallback; `/assets/*` excluded) |
| headers | `/assets/(.*)` → `Cache-Control: public, max-age=31536000, immutable`; `/` and `/index.html` → `Cache-Control: no-cache` |

Project-level settings were aligned to that file (`buildCommand: npm run build`, `outputDirectory: dist`) and the development project's lockfile install (`installCommand: npm ci`). `update_project` accepted every value on both apply calls.

### Limitation / fallback notes

- The Vercel MCP `get_project`/`list_projects` projection omits `rootDirectory` (and also `installCommand`, `buildCommand`, `outputDirectory`) for this project, exactly as recorded for the development project (`docs/features/vercel-fly-neon-deployment/build-log-T7-provision.md`, `docs/features/render-backend-migration/build-log-T2-vercel.md`). `rootDirectory: src/frontend` is therefore a **request record**: the value was supplied at create and re-applied on both updates and accepted. T6's successful Vercel build from the `src/frontend` root is the effective-root proof; no deployment was created here to prove it.
- The projection also exposes no Git-link field. `gitAutoDeploy: disabled` is evidenced by the project being created with no `gitRepository` (no Git connection), by `latestDeployment: null`, and by `list_deployments` returning zero deployments; the only deployment path is the T5/T6 Actions workflow (`vercel pull/build/deploy --prod`).
- The MCP create/update path succeeded, so the documented authenticated `vercel` CLI/REST fallback and the owner dashboard hand-off were not needed.

## No deployment and no secret

- `No Vercel deployment was created`: the create and both update responses report `latestDeployment: null`, and `list_deployments` for `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` returns `count: 0`. No `create_deployment`, alias, domain-add or build call was made.
- No token, credential, environment value or `.env*` content was read, printed or written. The recorded IDs are non-secret provider identifiers. `.env*` was not touched.

## Verify

Command: the exact T3 verify block from `tasks.md` (lines 90–105), extracted to `/tmp/opencode/t3/t3-verify.sh` and run as `bash /tmp/opencode/t3/t3-verify.sh`; `set -euo pipefail` is inside the block. Raw output:

```
$ bash /tmp/opencode/t3/t3-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=0
```

The block is silent on success (every check is a `test` or a `grep -q`/negated `grep`); exit `0` means every assertion passed:

| Verify area | Result |
| --- | --- |
| Build log present; `name: cubeclicker`; the domain and the single anchored `production frontend: https://cubeclicker.vercel.app` line | PASS |
| `rootDirectory: src/frontend`, `framework: vite`, `nodeVersion: 24.x` | PASS |
| `gitAutoDeploy: disabled`, `deploymentProtection: disabled` | PASS |
| `distinct from prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`, `No Vercel deployment was created` | PASS |
| No `cubeclicker-production` name/host and no credential-shaped value in this file | PASS |

## Acceptance audit

- **AC-1(b) — production Vercel resource name and domain carry no environment token.** Met: `name: cubeclicker`; `https://cubeclicker.vercel.app`; `production frontend: https://cubeclicker.vercel.app`. Neither the recorded name nor the domain contains `production`, `prod`, `dev`, `staging` or `stage`.
- **AC-3(a) — project mirrors the development build with the production protection decision.** Met: project `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` exists with root `src/frontend` (request record), `framework: vite`, `nodeVersion: 24.x`, the unchanged `src/frontend/vercel.json` build/output/rewrites/headers contract (aligned project settings), no Git connection (`gitAutoDeploy: disabled`), and `ssoProtection.enabled: false` / `passwordProtection.enabled: false` (`deploymentProtection: disabled`).
- **AC-3(d) — T3 creates no Vercel deployment.** Met: `latestDeployment: null` and `list_deployments` `count: 0`; no deployment ID exists in this record.
- **AC-3 evidence / scope.** Met: the T3 read-back is recorded above; the only changed file is this build log; no development resource was modified; no GitHub/Render/Neon write; no push.

## Deviations from spec

None. The base name `cubeclicker` was available, so the `cubeclicker-game` fallback and the provider-refusal record were not needed. The `rootDirectory` projection limitation is recorded (with the requested value and the T6 effective-root proof) rather than guessed or silently omitted.
