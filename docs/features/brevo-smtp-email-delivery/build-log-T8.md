# Build log — T8 — Documentation pass

Task: T8 (2026-11-22)
Files changed: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/containerization.md`, `docs/features/brevo-smtp-email-delivery/build-log-T8.md`
What changed & why: the four docs now describe the shipped Brevo SMTP path (`SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, host/ports, SMTP login + SMTP key ≠ REST API key, verified sender), the branded verification email and its `src/frontend/public/email/` assets with image-blocked behavior, the user-owned test-email CLI, the deployed-origin asset recipe and the Secret hygiene guard; the guest-only/placeholder and "compose files untouched" claims are gone.

Sketch (≤5 lines):
1. README: env rows, `## Email` section (Brevo recipe, branded email + assets + image-blocked, CLI, deployed recipe, Secret hygiene), guest-only paragraph → real setup.
2. deployment.md: variables/provisioned lists, Brevo bullet, email-asset bullet, Fly-table row.
3. vercel-render-neon.md: catalog rows, Render table, runbook/troubleshooting, § SMTP and email, local-vs-cloud+Email, compose-untouched fix, cost note.
4. containerization.md: `/email/*.png` delivery row + asset bullet, two SMTP pass-throughs and the Mailpit smoke pinning, `compose.yaml` "untouched" sentence fixed.
5. Docs-only change: no code/test surface; the T8 `verify` greps are the gate (T9 runs the full lint/typecheck/test/coverage/build/smoke suite).

## Decisions

- Docs-only task, no behavior change: no unit/integration tests are added (documented exception — a documentation pass has no runtime boundary); the T8 `verify` greps plus `git diff --check` are the evidence, and T9 is the full-AC gate that re-runs the suite and the containerized proof.
- Placeholders in commands use angle brackets (`SMTP_USER=<your-smtp-login>`, `SMTP_PASS=<SMTP key>`) so they cannot match the credential guard; no real key, token or credential value appears in any edited file or in this log.
- `docs/features/README.md` is orchestrator-owned and not edited; the proposed row is at the end of this log.

## Evidence

(verify transcript appended below)

## Verify — T8 `verify` list, verbatim

Commands extracted programmatically from `tasks.md` T8 line 83 and executed in order from the repository root. Raw transcript (command text, output, exit code; no filtering):

```text
===== COMMAND 1 =====
for f in README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md; do grep -q "SMTP_SECURE" "$f" || exit 1; grep -q "SMTP_CONNECTION_TIMEOUT_MS" "$f" || exit 1; done
--- output ---
[exit=0]

===== COMMAND 2 =====
grep -q "SMTP key" docs/architecture/deployment.md
--- output ---
[exit=0]

===== COMMAND 3 =====
grep -q "SMTP key" docs/architecture/vercel-render-neon.md
--- output ---
[exit=0]

===== COMMAND 4 =====
grep -q "derived" README.md
--- output ---
[exit=0]

===== COMMAND 5 =====
grep -q "10000" README.md
--- output ---
[exit=0]

===== COMMAND 6 =====
grep -q "smtp-relay.brevo.com" README.md
--- output ---
[exit=0]

===== COMMAND 7 =====
grep -q "Settings → SMTP & API → SMTP" README.md
--- output ---
[exit=0]

===== COMMAND 8 =====
grep -q "SMTP key" README.md
--- output ---
[exit=0]

===== COMMAND 9 =====
grep -q "not the REST API key" README.md
--- output ---
[exit=0]

===== COMMAND 10 =====
grep -q "verified sender" README.md
--- output ---
[exit=0]

===== COMMAND 11 =====
grep -q "587" README.md
--- output ---
[exit=0]

===== COMMAND 12 =====
grep -q "465" README.md
--- output ---
[exit=0]

===== COMMAND 13 =====
grep -q "SMTP login" README.md
--- output ---
[exit=0]

===== COMMAND 14 =====
grep -q "email:test" README.md
--- output ---
[exit=0]

===== COMMAND 15 =====
grep -q "Test email sent to" README.md
--- output ---
[exit=0]

===== COMMAND 16 =====
grep -q "node dist/auth/email-cli.js" README.md
--- output ---
[exit=0]

===== COMMAND 17 =====
grep -q "podman compose exec backend" README.md
--- output ---
[exit=0]

===== COMMAND 18 =====
grep -q "user-owned" README.md
--- output ---
[exit=0]

===== COMMAND 19 =====
grep -q "src/frontend/public/email/" README.md
--- output ---
[exit=0]

===== COMMAND 20 =====
grep -q "src/frontend/public/email/" docs/architecture/vercel-render-neon.md
--- output ---
[exit=0]

===== COMMAND 21 =====
grep -q "work when images are blocked" README.md
--- output ---
[exit=0]

===== COMMAND 22 =====
grep -q "SMTP_FROM" README.md
--- output ---
[exit=0]

===== COMMAND 23 =====
grep -qF "CubeClicker <verified sender>" README.md
--- output ---
[exit=0]

===== COMMAND 24 =====
grep -q "APP_BASE_URL" README.md
--- output ---
[exit=0]

===== COMMAND 25 =====
grep -q "Verify your CubeClicker email" README.md
--- output ---
[exit=0]

===== COMMAND 26 =====
grep -q "Secret hygiene" README.md
--- output ---
[exit=0]

===== COMMAND 27 =====
grep -qF "xkeysib-[A-Za-z0-9]{20,}" README.md
--- output ---
[exit=0]

===== COMMAND 28 =====
grep -qF "xsmtpsib-[A-Za-z0-9]{15,}" README.md
--- output ---
[exit=0]

===== COMMAND 29 =====
grep -qF "SMTP_(USER|PASS)" README.md
--- output ---
[exit=0]

===== COMMAND 30 =====
grep -q "pins the smoke backend to Mailpit" docs/architecture/vercel-render-neon.md
--- output ---
[exit=0]

===== COMMAND 31 =====
node -e "const fs=require('node:fs');const files=['README.md','docs/architecture/vercel-render-neon.md'];const ok=files.some((f)=>{const s=fs.readFileSync(f,'utf8');return s.includes('curl -fsSI')&&s.includes('documented-not-run')&&s.includes('200')&&s.includes('image/png')});if(!ok)throw new Error('no documented deployed-origin asset recipe (curl -fsSI, 200, image/png, documented-not-run)');console.log('documented deployed-origin asset recipe present')"
--- output ---
documented deployed-origin asset recipe present
[exit=0]

===== COMMAND 32 =====
! grep -qE "guest-only|SMTP values are placeholders" README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
--- output ---
[exit=0]

===== COMMAND 33 =====
! grep -qE "compose files.*untouched|compose\.yaml.*untouched" docs/architecture/vercel-render-neon.md docs/architecture/deployment.md docs/architecture/containerization.md
--- output ---
[exit=0]

===== COMMAND 34 =====
git diff --check -- README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md docs/architecture/containerization.md
--- output ---
[exit=0]

===== COMMAND 35 =====
test -f docs/features/brevo-smtp-email-delivery/build-log-T8.md
--- output ---
[exit=0]

===== COMMAND 36 =====
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T8.md
--- output ---
[exit=0]

ALL COMMANDS: 36/36 passed
```

## Post-append re-run (log-dependent commands)

Commands 34–36 re-run against the final file state, after this log was appended:

```text
===== COMMAND 34 (re-run after appending this log) =====
git diff --check -- README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md docs/architecture/containerization.md
--- output ---
[exit=0]

===== COMMAND 35 (re-run after appending this log) =====
test -f docs/features/brevo-smtp-email-delivery/build-log-T8.md
--- output ---
[exit=0]

===== COMMAND 36 (re-run after appending this log) =====
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T8.md
--- output ---
[exit=0]
```

## Credential sanity check (docs changes)

The pinned feature guards were run against the working tree; they print nothing on success (the count-only/key-name checks are T0/T9's evidence):

```text
>>> ! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
[exit=0]
>>> ! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
[exit=0]
>>> ! git diff origin/main...HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
[exit=0]
>>> ! git diff origin/main | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
[exit=0]
```

## Documentation edits (every change)

`README.md`
1. § Configuration env table — added `SMTP_SECURE` (empty → derived, `true` on port `465`) and `SMTP_CONNECTION_TIMEOUT_MS` (default `10000`, 1000–120000); re-described `SMTP_HOST`/`SMTP_PORT` with the Brevo values, `SMTP_USER` as the SMTP login (both-or-neither), `SMTP_PASS` as the Brevo SMTP key, `SMTP_FROM` with the `CubeClicker <verified sender>` shape, and `APP_BASE_URL` as the link *and* image origin.
2. § Configuration paragraph — `.env` wording aligned with spec Q-6 (shell export canonical, gitignored `.env` accepted for compose interpolation, agents never read it).
3. New `## Email` section (between § Configuration and § Operations):
   - `### Brevo SMTP recipe` — host `smtp-relay.brevo.com`, `587` STARTTLS / `465` implicit TLS / `2525` fallback, variable table, SMTP key vs REST API key, verified sender, both-or-neither, STARTTLS/timeout behavior, HTTP `500` surfacing, shell exports with angle-bracket placeholders.
   - `### Branded verification email` — 600 px inline-CSS template, subject `Verify your CubeClicker email`, the two `src/frontend/public/email/` PNGs with dimensions, serving by the existing frontend origin (Vite/nginx/Vercel) with no new service, the `generate-email-assets.mjs --check` proof, behavior when images are blocked (CTA + visible URL), `SMTP_FROM` guidance, and the `curl -fsSI … 200 … image/png` documented-not-run recipe.
   - `### Test-email CLI (user-owned check)` — `npm run email:test`, `node dist/auth/email-cli.js`, `podman compose exec backend`, prerequisites, expected `Test email sent to` line, default-From warning, redaction, synthetic token, no automated test contacts Brevo.
   - `### Secret hygiene` — credential is runtime-only (shell/dashboard/Environment), the two literal guard patterns, the pinned `git grep`/`git grep --untracked`/`git diff` guard, angle-bracket placeholder rule, MCP credential in the global OpenCode config.
4. § User-side asset checklist — added `SMTP_SECURE`/`SMTP_CONNECTION_TIMEOUT_MS` to the variables list; replaced the "Development email is guest-only / SMTP values are placeholders" paragraph with the shipped Brevo setup (Render dashboard values, no Mailpit in the cloud).

`docs/architecture/deployment.md`
1. § Platform split — new "Verification email and its assets" bullet (SMTP side effect, `src/frontend/public/email/` served by the existing frontend origin, no new service/port/image/route, no attachments, `APP_BASE_URL`).
2. § Secrets and variables — added `SMTP_SECURE`/`SMTP_CONNECTION_TIMEOUT_MS` to the `development` variables list and a new "Brevo SMTP" bullet (host, 587/465/2525, SMTP login, SMTP key not the REST API key, verified sender, derived secure, 10000/1000–120000, no new secret name, dashboard/shell-supplied).
3. § Superseded Fly.io backend table — replaced "No equivalent on Render free; development runs guest-only" with the Brevo SMTP delivery statement.

`docs/architecture/vercel-render-neon.md`
1. § GitHub Environment `development` — `SMTP_PASS` row now documents the Brevo SMTP key (Settings path, not the REST API key); SMTP vars row adds `SMTP_SECURE`/`SMTP_CONNECTION_TIMEOUT_MS` and drops the guest-only claim.
2. § Render service environment — SMTP row lists all seven names with the Brevo purpose; `APP_BASE_URL` row now covers the email image origin.
3. § Runbook one-time prerequisites — SMTP line replaced with the Brevo recipe.
4. § Troubleshooting — "Email verification does not arrive" rewritten as a real diagnostic (variables, SMTP key vs REST key, verified sender, HTTP `500` + resend, user-owned CLI, no credential in logs).
5. § SMTP and email — rewritten: Mailpit local + smoke pinning, Brevo in development/production, the seven `sync: false` variables, STARTTLS/timeout behavior, branded template + `src/frontend/public/email/` serving, the three CLI invocations marked user-owned, and the `curl -fsSI … 200 … image/png` documented-not-run recipe.
6. § Local development vs cloud — Email row now "Brevo SMTP (`smtp-relay.brevo.com`, 587 STARTTLS); branded `/email/*.png` from the Vercel origin"; the "compose files … untouched" invariant replaced with the actual change (`compose.yaml` two SMTP pass-throughs, `compose.smoke.yaml` pins the smoke backend to Mailpit).
7. § Cost and limits — "a real SMTP provider" → the Brevo plan (free plan ~300 emails/day).

`docs/architecture/containerization.md`
1. § Frontend static delivery table — added the `GET /email/cubeclicker-hero.png` row (`image/png` not in `gzip_types`; `no-cache` via `location /`).
2. New "Verification-email assets" bullet — committed `public/email/` files, existing origins (Vite dev, nginx prod, Vercel), T9 compose-network serving proof, documented deployed recipe, backend image unchanged.
3. "Unchanged local path" bullet replaced by "Local path unchanged, SMTP pass-throughs recorded" — the two `compose.yaml` pass-throughs (`SMTP_SECURE` default `false`, `SMTP_CONNECTION_TIMEOUT_MS` default `10000`), the `compose.smoke.yaml` Mailpit pinning, no new service/image/port/volume.
4. Health/environment bullet qualified: no environment variable is added to the frontend image.

No other documentation target applied: no glossary/vision term changed, and `docs/features/README.md` is orchestrator-owned (proposed row below, not edited).

## Acceptance audit

- **AC-13 — Documentation matches shipped behavior: met.** `SMTP_SECURE`/`SMTP_CONNECTION_TIMEOUT_MS` present in README + both architecture docs (verify command 1, exit 0); README carries `smtp-relay.brevo.com`, `587`, `465`, `Settings → SMTP & API → SMTP`, `SMTP key`, `not the REST API key`, verified sender, `derived`, `10000`, `SMTP login` and the CLI commands (commands 4–17, exit 0); both catalogs describe `SMTP_PASS` as the SMTP key (commands 2–3, exit 0); no `guest-only`/`SMTP values are placeholders` claim remains in README, `deployment.md` or `vercel-render-neon.md` (command 32, exit 0); no "compose files/compose.yaml … untouched" claim remains (command 33, exit 0).
- **AC-14 — Manual live-delivery check documented and user-owned: met.** README contains `npm run email:test --workspace @cubeclicker/backend -- --to <address>`, `node dist/auth/email-cli.js --to <address>`, `podman compose exec backend …`, `Test email sent to`, the prerequisites and the `user-owned` marker, and states that no automated test or CI job contacts Brevo (commands 14–18, exit 0).
- **AC-16(d) — Documented deployed-origin recipe, marked documented-not-run: met.** README `### Branded verification email` and `vercel-render-neon.md` § SMTP and email both carry `curl -fsSI https://<frontend-host>/email/cubeclicker-hero.png` with the expected `200`/`image/png`, labelled documented-not-run (command 31 printed "documented deployed-origin asset recipe present", exit 0).
- **AC-20 — Branded-email documentation: met.** README states the branded template, `src/frontend/public/email/` hosting from the `APP_BASE_URL`/Vercel frontend origin, that the link and text still work when images are blocked, the `SMTP_FROM` `CubeClicker <verified sender>` shape and the unchanged subject `Verify your CubeClicker email`; it contains the literal `APP_BASE_URL` token (commands 19, 21–25, exit 0). Both architecture docs record that the images are served by the existing frontend origin with no new service, port or image.

## Deviations from spec

None. Docs-only task: no code, compose, `render.yaml`, workflow or `docs/features/README.md` edit; no test/coverage run here because there is no runtime behavior change (documented exception above) — T9 is the full lint/typecheck/test/coverage/build/smoke gate.

## Proposed `docs/features/README.md` row (orchestrator-owned; not edited)

Append to the index table:

```markdown
| brevo-smtp-email-delivery | Brevo SMTP Email Delivery & Branded Verification Email (Brevo SMTP for development/production with TLS/timeout config and SMTP-key vs REST-API-key guidance, branded table email with public PNG assets and image-blocked fallback, user-owned delivery CLI, Mailpit-pinned smoke) | building | 2026-11-22 |
```

## Post-commit range guards

Re-run after this task's commit, so the committed documentation is inside the audited range; every guard exits `0` and prints no match:

```text
>>> ! git grep -qE "<key patterns>"                         # tracked tree
[exit=0]
>>> ! git grep --untracked -qE "<key patterns>"             # untracked files
[exit=0]
>>> ! git diff origin/main...HEAD | grep -qE "<key patterns>"  # branch diff (includes this commit)
[exit=0]
>>> ! git log -p origin/main..HEAD | grep -qE "<key patterns>" # branch history
[exit=0]
```

(The placeholder `<key patterns>` stands for the pinned expression documented in README § Secret hygiene; the literal regex is also printed in the verify transcript above.)
