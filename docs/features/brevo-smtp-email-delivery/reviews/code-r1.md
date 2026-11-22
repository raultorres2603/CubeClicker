---
feature: brevo-smtp-email-delivery
phase: code
verdict: approved
blocking: 0
iteration: 1
---
# Code Review — r1

## Summary

✅ **approved** — The feature meets all 21 acceptance criteria at `HEAD a4a3b6c`. The completed review reproduced the full gate (lint, typecheck, 4,617 tests, coverage, build, Mailpit smoke 29/29, asset serving 4/4, credential/OpenCode/Render/actionlint checks), and this session's focused spot-checks reproduced the critical code, test, asset, credential-guard and documentation claims. Four MINOR operator-wording/documentation drifts (F1–F4) and two INFO notes (F5–F6) remain non-blocking; there is no open BLOCKER or MAJOR.

## Acceptance verification

| AC | Met? | Evidence | Reviewer spot-check |
| --- | --- | --- | --- |
| AC-1 | ✅ | `config.ts:228-229` derives `smtpSecure` from port 465 when `SMTP_SECURE` is empty; `config.test.ts` asserts 1025→false, 465→true and all `true/1/false/0` overrides. | ✅ code read + focused `config.test.ts` (43 tests) pass |
| AC-2 | ✅ | `config.ts:238-244` (`1000..120000`, default `DEFAULT_SMTP_CONNECTION_TIMEOUT_MS=10000`); `config.test.ts` pins both boundaries and the default. | ✅ code read + focused test pass |
| AC-3 | ✅ | `config.ts:151-160,175-185`; exact errors from `buildApp` in `app.test.ts:283-293`; `server.ts` calls `loadAuthConfig` before listening. | ✅ `app.test.ts` (42 tests) pass |
| AC-4 | ✅ | `config.ts:230-236` both-or-neither rule and exact message; `config.test.ts` covers both set, both unset/empty and all one-sided pairs. | ✅ code read + focused test pass |
| AC-5 | ✅ | `email.ts:111-127` exact transport object (Brevo 587 `secure:false/requireTLS:true`, 465 `secure:true/requireTLS:false`, Mailpit no `auth`/no STARTTLS, all three timeouts); `email.ts:172-188` single composition path; `app.test.ts:295-317` factory called once with the exact object. | ✅ `email.test.ts` (16) + `app.test.ts` (42) pass |
| AC-6 | ✅ | Empty-environment defaults in `config.ts:226-244`; `email.test.ts` strict Mailpit object with no `auth` property and no STARTTLS. | ✅ config/email focused tests pass |
| AC-7 | ✅ | `email-template.ts:99-111` unchanged subject/plain text; `email.ts:158-165` sends exactly `{from,to,subject,text,html}`; `email.test.ts:243+` and `app.test.ts:356+` assert the strict envelope, including verbatim `SMTP_FROM` and no `attachments`/`replyTo`. | ✅ `email-template.test.ts` (30) and the two focused files pass |
| AC-8 | ✅ | `email-cli.ts:156-168` prints the pinned `Test email sent to … (secure=false, starttls=required, auth=yes, from="…")` line and the default-sender warning; `email-cli.test.ts:135-226` asserts one send and exact lines. | ✅ `email-cli.test.ts` (21) pass |
| AC-9 | ✅ | `email-cli.ts:68-89` `redactSecrets` (user/pass values + both key patterns); `email-cli.ts:104-154` argument/config/transport exits; `email-cli.test.ts` covers every pinned failure line, exact redacted line, exit 1 and no-service construction. | ✅ `email-cli.test.ts` (21) pass |
| AC-10 | ✅ | `auth-routes.test.ts:592-637` transport rejection → 500 `internal_error`, no session cookie, account persisted unverified, resend 202 with a fresh token; `auth-service.test.ts` service-layer recovery. | ✅ `auth-routes.test.ts` (29) + `auth-service.test.ts` (55) pass |
| AC-11 | ✅ | `compose.smoke.yaml:20-26` pins all six Mailpit values; T7 hermetic/hostile config checks and T9 clean-stack hostile smoke `SMOKE PASS (29/29)` are recorded in the build logs. | ✅ compose pins read; smoke result attributed to completed review |
| AC-12 | ✅ | This session reran the pinned guards: HEAD counts `0/0`; tracked tree, untracked files, branch diff and branch history silent; no `.env*` in branch; repo `opencode.jsonc` entries `["vercel","Neon","brevo"]`, brevo keys `["type","url"]`, no headers/key; global config entries `["context7","github","render","brevo"]`, one brevo with `headers.Authorization` matching the key pattern (value not printed); `render.yaml` 7 SMTP entries all `sync:false` with no `value`. | ✅ independently rerun |
| AC-13 | ✅ | README env table `README.md:77-83` and Brevo recipe `README.md:101-116`; deployment catalog `deployment.md:47-50`; `vercel-render-neon.md:172-186`; `containerization.md:61`; T8 36/36 greps rerun in T9. No stale guest-only or "compose files untouched" claim remains. | ✅ docs read + stale-claim greps |
| AC-14 | ✅ | `README.md:156-177` contains `podman compose exec backend`, `npm run email:test -w @cubeclicker/backend -- --to`, `node dist/auth/email-cli.js`, the success line, prerequisites and the `user-owned` marker; no `.github` change in the branch. | ✅ docs read + diff check |
| AC-15 | ✅ | `email-template.ts:119-198` four `role="presentation"` tables, inline CSS only, nine palette literals and no others, preheader/headline/one CTA/visible URL/expiry/footer, no `<style>/<link>/<script>/<svg>`/web font/CSS `url(`. | ✅ code read + 30 template tests pass |
| AC-16 | ✅ | `email-template.ts:74-87` origin/fallback derivation, two images with explicit dimensions/alt at `:139/:179`; `email-template.test.ts` absolute + relative + malformed cases; T9 fetches all four compose-network URLs with `200 image/png` and PNG signature at 4,357/582 bytes; README recipe at `:149-154`. | ✅ code/tests + recipe read; serving attributed |
| AC-17 | ✅ | `generate-email-assets.mjs --check` reruns `2/2 PASS` with the committed SHA-256 values; PNG check confirms 600×200/4,357 B and 72×72/582 B; template tests pin HTML `4,322 B`, combined `9,448 B` and five contrast ratios ≥ 4.5. | ✅ asset/signature/dimension checks + template tests |
| AC-18 | ✅ | `email-template.test.ts:32-56` byte-for-byte plain text and `/token=([A-Za-z0-9]+)/` extraction; T9 smoke passes register → Mailpit → verify → login (29/29). | ✅ template tests; smoke attributed |
| AC-19 | ✅ | `email-template.test.ts:58-82` renders `24 hours`/`1 hour`/`7 days`; `auth-service.ts:314-317,466-469` passes `verificationTokenTtlMs` on both paths; `auth-service.test.ts` records the value on both messages. | ✅ template + service tests pass |
| AC-20 | ✅ | `README.md:134-147` branded template, `src/frontend/public/email/`, `APP_BASE_URL`, image-blocked CTA/URL behavior, `CubeClicker <verified sender>`, unchanged subject; architecture docs state the existing frontend origin serves the assets with no new service/port/image. | ✅ docs read |
| AC-21 | ✅ | `src/frontend/scripts/generate-email-assets.mjs` uses only `node:buffer/crypto/fs/process/zlib`, pins seed/geometry/font/palette/zlib; `--check` reproduces both SHA-256 values; no build/script wiring (`grep` in T9 and package.json). | ✅ generator read + `--check` rerun |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `compose.yaml:60` | `SMTP_SECURE: "${SMTP_SECURE:-false}"` passes an explicit `false` even when `SMTP_PORT=465`, so the compose path masks the `loadAuthConfig` port-465 derivation. A user setting only `SMTP_PORT=465` gets `secure=false` with `requireTLS=true`, which does not match the documented derivation. | Use `${SMTP_SECURE:-}` (empty → derive) or document that compose users on 465 must set `SMTP_SECURE=true` explicitly. | open |
| F2 | MINOR | `src/backend/src/auth/email-cli.ts:157` | The success line prints `starttls=off` when there is no auth and `secure=false`, while `nodemailer` still negotiates opportunistic STARTTLS; the plan's vocabulary is `required\|opportunistic`. | Align the wording (print `opportunistic` for the no-auth plaintext case, or change the documented vocabulary) and update the Mailpit CLI test. | open |
| F3 | MINOR | `README.md:149`, `docs/architecture/vercel-render-neon.md:180` (same rationale in `spec.md:96`) | The deployed-origin recipe says the development frontend deploy is "user-triggered", but `deployment.md:24/40` and `.github/workflows/deploy.yml` state that a push to `main` triggers development deployment automatically via `workflow_run` after CI. | Correct the rationale (for example: the deployed check is user-run because no automated job fetches the deployed origin, or because production is unprovisioned) without claiming a manual deploy trigger. | open |
| F4 | MINOR | `README.md:183-189` | The Secret hygiene text says the guard covers "the branch history", but the command block lacks `! git log -p origin/main..HEAD \| grep -qE …` (the spec's pinned guard and T9 do run it). | Add the branch-history command to the README block so the documented guard matches the claim. | open |
| F5 | INFO | `fbadccf` | The T9 integration commit stages the orchestrator-owned feature artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/spec-r1.md`, `reviews/spec-r2.md`) together with `build-log-T9.md`, as documented in the build log. | No action; intentional integration commit. | accepted |
| F6 | INFO | `src/backend/src/auth/auth-routes.test.ts:592` | The AC-10 recovery test calls the `/auth/resend` alias; AC-10 names `/auth/resend-verification`. Both routes share the same handler (`auth-routes.ts:270-271`) and the alias has its own 202 test at `auth-routes.test.ts:371`. | Optional: use `/auth/resend-verification` in the AC-10 recovery test for exact AC vocabulary. | accepted |

## Verification performed

### Reproduced by the completed review (attributed — not re-run in this session)

- `npm run lint` → exit 0; `npm run typecheck` → exit 0 in both workspaces.
- `npm test` → backend 40 files / 1,773 tests, frontend 83 files / 2,844 tests, all passing.
- `npm run coverage` → backend `96.59 / 90.54 / 99.60 / 96.59`, frontend `97.15 / 96.75 / 98.36 / 97.15` (statements/branches/functions/lines), all ≥ 80; `config.ts`, `email.ts`, `email-cli.ts` and `email-template.ts` are included in the report.
- `npm run build` → exit 0; bundle budget check passes.
- `node src/frontend/scripts/generate-email-assets.mjs --check` → `2/2 PASS`: 4,357 B hero (600×200) and 582 B cube (72×72), SHA-256 identical.
- Hermetic compose config → `mailpit:1025`; hostile merged config → Mailpit pins (host/port/empty user+pass/from/`secure=false`).
- Clean-stack hostile-env smoke → `SMOKE PASS (29/29)`, including register → Mailpit delivery → verify → login.
- Compose-network asset fetches on Vite 5173 and nginx 8080 → 4/4 `200 image/png` with PNG signature, 4,357/582 bytes.
- Credential guards → HEAD counts `0/0`; tracked tree, untracked, branch diff, branch history and `.env` all clean; guard self-test PASS.
- OpenCode repo check → entries `["vercel","Neon","brevo"]`, exactly one brevo, keys `["type","url"]`, no headers/key; global check → `~/.config/opencode/opencode.json`, entries `["context7","github","render","brevo"]`, brevo `headers.Authorization` matches the key pattern (value not printed).
- `render.yaml` → 7 SMTP entries, all `sync:false`, no `value`; `vercel.json` valid JSON; `actionlint` passes with `--security-opt label=disable` (SELinux MCS label limitation otherwise).
- T8 doc greps pass; no stale guest-only / "SMTP values are placeholders" / "compose files untouched" claims remain; `docs/features/README.md` untouched with a proposed row in `build-log-T8.md:294`.
- Git state → 11 commits ahead of `origin/main` (T0–T9 plus the amended-hash note), conventional messages, no push.
- Visual sign-off → hero approved: emerald isometric cube, cyan rim, legible `CUBECLICKER` wordmark + tagline, starfield; cube mark clear; HTML table-based, inline CSS only, no `<style>/<svg>/<script>`/web font/CSS `url(`, `role="presentation"`, image dimensions/alt, visible fallback URL; budgets met.

### Spot-checks run in this session

- `node src/frontend/scripts/generate-email-assets.mjs --check` → `PASS` both files; `4,357 B` and `582 B`, matching the committed hashes.
- PNG signature/dimension/byte check → hero `600x200 4357 bytes`, cube `72x72 582 bytes`, both `89504e470d0a1a0a`.
- `npm test --workspace @cubeclicker/backend -- src/auth/email-template.test.ts src/auth/email-cli.test.ts src/auth/config.test.ts` → 3 files / 94 tests passing.
- `npm test --workspace @cubeclicker/backend -- src/app.test.ts src/auth/email.test.ts src/auth/auth-service.test.ts src/auth/auth-routes.test.ts` → 4 files / 142 tests passing.
- Pinned credential guards → HEAD `0/0`; tracked, untracked, diff, history and `.env` checks all clean.
- OpenCode repo/global checks → entry names and shape only; global `headers.Authorization` matches the pattern (no value printed).
- `render.yaml` read → 7 SMTP entries with `sync:false` and no `value`.
- Documentation greps → `SMTP_SECURE`/`SMTP_CONNECTION_TIMEOUT_MS` present in README, `deployment.md` and `vercel-render-neon.md`; Brevo/SMTP-key/CLI/asset wording present; no stale guest-only or "compose files untouched" claims; `docs/features/README.md` unchanged.
- Direct visual inspection of both PNGs via the image reader (hero and cube marks legible, no text corruption).
- Git history/status → 11 feature commits ahead, no push; working tree only orchestrator `status.md`/`tasks.md` bookkeeping and pre-existing untracked `.agents/`/`skills-lock.json`.

## Visual approval (spec-r1 F16)

**Approved.** I inspected the committed PNGs directly. The hero (600×200) shows an emerald isometric cube with a cyan rim, a legible cyan `CUBECLICKER` wordmark and the tagline `AN ONLINE CUBE-CLICKING GAME` over a starfield; the 72×72 cube mark is clear and undistorted. No clipped glyphs or corruption. The HTML shell is table-based with inline CSS only (four `role="presentation"` tables), no `<style>`/`<svg>`/`<script>`/web font/CSS `url(`, explicit image dimensions and alt text, one `Verify email` CTA and a visible fallback URL; the 4,357/582-byte assets and 4,322-byte HTML meet the budgets. Builder self-check is in `build-log-T2.md`; this is the reviewer approval location required by spec-r1 F16.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No credential in the tracked tree or branch history; `opencode.jsonc` is reference-only and the key lives in the user-owned global config; CLI failure/config lines redact user/pass and both key shapes; `requireTLS` is enforced whenever auth is configured and implicit TLS is off; all three timeouts are bounded; no new dependency, no secret baked into an image/compose file, no client-side SMTP settings; no live Brevo call made. |
| Quality | ✅ | Pure `config.ts`/`email-template.ts`, one transport-options source, single `createSmtpEmailService` composition path, no dead code or debug leftovers, docs updated for every changed behavior, `docs/features/README.md` ownership respected. F1–F4 are wording/operator-usability cleanups only. |
| Testing | ✅ | Coverage ≥ 80 on all four metrics in both workspaces; focused reruns of the new feature tests pass; no banned matchers (`expect.any`/`anything`/`objectContaining`/`arrayContaining`/`stringContaining`/`stringMatching`/snapshot-only/`toMatchObject`/argument-unchecked `toHaveBeenCalled()`) in the changed test files; tests are deterministic (injected/fake time, no real sleeps) and assert exact values; exclusions remain the justified `server.ts` composition root plus test files. |

## Previous round verification (spec r1/r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1–F6 (spec r1) | fixed | The owner-directive T0 is implemented (tracked reference-only `opencode.jsonc`, global credential, guards); CLI redaction is tested; the credential audit covers build logs/history/untracked; the deterministic generator and both local serving proofs exist; the docs pass covers the stale claims. Spec-r2 confirmed F1–F16 fixed. |
| F17 (spec r2) | fixed | The T0/T9 checks now resolve `cfg.mcp?.servers ?? cfg.mcp ?? cfg.mcpServers`, iterate the actual entry map, assert exactly one brevo entry and its reference shape, and print names only. This session's independent check: repo `["vercel","Neon","brevo"]` with brevo `["type","url"]`; global `["context7","github","render","brevo"]` with one `headers.Authorization` key match. |
| F18–F25 (spec r2) | fixed | T0's `local_action` scope, T8 per-file statement greps, branch-history/untracked audit, 3/6-digit hex whitelist (`email-template.test.ts:120-126`), task/evidence mapping, backend-cwd asset resolution (`new URL('../../../frontend/public/email/…', import.meta.url)`), placeholder/guard self-test and numstat/global-path conditions are all present in the r4 spec/tasks and the T0/T9 logs. |
| F26–F32 (spec r2) | accepted / INFO | Optional cleanups; the shipped README/architecture docs are correct. Residual: `spec.md:273` still says the asset generator is "not copied into any runtime image", while the frontend **dev** image copies `src/frontend` (including `scripts/`). No runtime impact; correct the spec wording in a future docs touch. |

## Notes / backlog (non-blocking)

- Fix F1–F4 in the next change that touches these files: compose empty-default derivation, CLI STARTTLS vocabulary, deploy-trigger rationale, and the README branch-history guard line.
- Optional F6: align the AC-10 test with `/auth/resend-verification` (the alias already has its own 202 test).
- Spec-only wording residual from spec-r2 F26 (`spec.md:273`, dev-image generator copy) — documentation cleanup, no gate action.
- User-owned preconditions remain outside this gate: Q-1/Q-2/Q-3 (SMTP key placement, verified sender/domain, live-delivery verification) and Q-7 (production remains unprovisioned). No live Brevo email was sent and no Brevo setting was changed.
- The working tree contains orchestrator bookkeeping edits to `status.md`/`tasks.md` and pre-existing untracked `.agents/` and `skills-lock.json`; neither is part of the feature diff, and the credential guards treat the untracked paths as clean.
