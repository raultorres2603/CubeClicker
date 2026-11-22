# Build log — T6 — Runbook and architecture documentation

Task: T6 (2026-11-22)
Files changed: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/features/deploy-brevo-env-placeholders/build-log-T6.md`
What changed & why: Documented the shipped GitHub Environment → Render behavior: a complete executable runbook in `README.md` (commands, names-only verification, migration, preserve/merge ordering, user-owned deployed proof, rollback), and corrected the two architecture references to the nine validated / seven synced catalog, the strict placeholder guard, the deploy order, the production placeholder state, and the GitHub-as-source-of-truth rule.
Decisions: GitHub is the documented source of truth for the nine names; the seven SMTP names are synced by the workflow and dashboard edits are documented as reverted on the next deploy. The 18 exact `gh` commands are documented for both environments; the `development` block carries an explicit warning not to re-run it over the preserved values (AC-11(a) requires the command forms, while T5's preserve decision keeps the live values). The `docs/features/README.md` row is proposed only and not edited.

## Doc edit inventory

| File | Section | Change |
| --- | --- | --- |
| `README.md` | § Email | The nine deployment values live in the GitHub Environment; the deploy workflow syncs the seven SMTP names; the dashboard is not the source |
| `README.md` | § Secret hygiene | GitHub Environment is the source; the extended guard adds `RENDER_API_KEY=` and `rnd_` shapes; branch-history command added |
| `README.md` | § What the pipelines run | `verify-workflows` lists `Guard rejects placeholder values` and `Guard accepts a complete value set`; deploy bullet orders check → Neon migration → sync → Render deploy hook |
| `README.md` | § Deploy flow | Steps 3–4 add the preflight guard and the sync between the migration and the hook |
| `README.md` | § User-side asset checklist | Secrets list gains `SMTP_USER` and `RENDER_API_KEY`; variables list drops `SMTP_USER` and gains `RENDER_SERVICE_ID`; production is `placeholder-only` with no provisioned asset; sync/source wording replaces the dashboard wording |
| `README.md` | § Deployment Brevo runbook (new) | UI path; 18 exact `gh` commands; names-only listings and both environment-listing forms; stdin/never-argv rule; `SMTP_USER` migration; preserve note; merge ordering; source of truth; user-owned deployed proof; rollback/rotation |
| `docs/architecture/deployment.md` | § Platform split and state ownership | Deploy order check → Neon migration → sync → Render deploy hook; GitHub Environment source of truth |
| `docs/architecture/deployment.md` | § Environments and triggers | Production holds the nine placeholder names (`placeholder-only`), no asset provisioned |
| `docs/architecture/deployment.md` | § Secrets and variables | Secrets/variables catalogs updated; nine validated, seven synced; wiring names never written to Render; remaining `sync: false` names dashboard-owned/never synced |
| `docs/architecture/deployment.md` | § Deploy pipeline | CI `verify-workflows` guard steps; deploy order with check/sync; "the sync runs after the Neon migration and before the Render deploy hook" replaces "Failed gates …" |
| `docs/architecture/deployment.md` | § Security and credential posture | Production placeholder statement; `RENDER_API_KEY=` added to the token audit |
| `docs/architecture/vercel-render-neon.md` | § Architecture | Deploy order with check/sync; source-of-truth bullet; nine validated, seven synced |
| `docs/architecture/vercel-render-neon.md` | § Environment catalog | Development table has `SMTP_USER`/`RENDER_API_KEY` as `secret` and `RENDER_SERVICE_ID` as `var`; production placeholder-only; Render env table marks the seven SMTP names workflow-synced; remaining `sync: false` names dashboard-owned/never synced |
| `docs/architecture/vercel-render-neon.md` | § Runbook | Prerequisites, routine deploy order, production promotion, email troubleshooting points at the GitHub source, `Placeholder guard` entry |
| `docs/architecture/vercel-render-neon.md` | § SMTP and email / § Operating rules / § Local development vs cloud | Sync and guard described; secrets source row is `GitHub Environment (synced to Render for the seven SMTP names)` |

## Verify evidence

The T6 verify block was extracted from `tasks.md` and run verbatim (the same extraction T7 uses):

```text
$ bash -c "$(sed -n '/^## T6 /,/^## T7 /p' docs/features/deploy-brevo-env-placeholders/tasks.md | sed -n '/^```bash/,/^```/p' | sed '1d;$d')"
README verify-workflows guard steps OK
README What the pipelines run deploy order OK
README Deploy flow order OK
deployment.md verify-workflows guard steps OK
deployment.md deploy pipeline order OK
deployment.md platform split deploy order OK
vercel-render-neon architecture deploy order OK
vercel-render-neon routine deploy order OK
exit=0
```

The first run (before this file existed) printed the same eight section-order lines and then failed only at `test -f docs/features/deploy-brevo-env-placeholders/build-log-T6.md`; after creating this file the identical block exits `0`.

Additional checks:

```text
$ git diff --check
exit=0

$ git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
exit=1 (no match)

$ git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
exit=1 (no match)
```

No value was read, printed or recorded in this task; every command in the docs carries a pinned literal, an angle-bracket placeholder, or a names-only listing.

## Acceptance audit

- AC-11 — met.
  - (a) README runbook has the 18 exact `gh variable set`/`gh secret set` lines for both environments (verify loop over the five variables plus the two service-ID lines and the three-secret loop).
  - (b) `Settings → Environments → <environment>` with **Environment variables** and **Environment secrets**, used only for entering values, `never as verification evidence`.
  - (c) Four names-only list commands, `gh api … --jq '.environments[].name'`, and both single-environment fallback forms are present; the `'.[].name'` form is absent.
  - (d) The runbook states values are entered through the UI or stdin, `never as a command argument` or in a file; only the placeholder `--body` commands carry values.
  - (e) `#### Deployed proof (user-owned)` lists seven `SYNCED <KEY>` lines, the `Render deploy list` check, `Render dashboard lists the seven keys`, `curl -fsS "$VITE_API_URL/healthz"`, a `registration from the deployed frontend`, and the `local \`npm run email:test\` equivalent` with the Render-free no-shell caveat.
  - (f) Rollback covers the GitHub correction plus re-run, **Deploys → Rollback**, and `rotate it in Render`.
  - (g) Merge ordering contains `before this feature merges to main` and `preserved development values are already in place`, with `RENDER_API_KEY` as the only remaining pre-merge development value.
  - (h) The `SMTP_USER` migration documents `gh variable get SMTP_USER --env development` → stdin → `gh secret set SMTP_USER --env development` → conditional `gh variable delete SMTP_USER --env development`, the conditional production delete, and the `variables and secrets are separate` rationale.
  - (i) The preserve note contains `preserves the existing development values`, the four created names, the stdin move, and the owner re-check.
  - (j) The source-of-truth note states the deploy workflow syncs the seven SMTP names from the GitHub Environment, `GitHub Environment is the source`, `nine validated, seven synced`, `never written to the Render service`, and that dashboard edits are reverted.
- AC-12 — met.
  - (a) `deployment.md` has `SMTP_USER`/`RENDER_API_KEY` in Secrets and `RENDER_SERVICE_ID` in Variables (no `SMTP_USER` variable); `nine validated, seven synced`, `never written to the Render service`, `synced from the GitHub Environment`, `placeholder-only`, and `no Render service, Vercel project or Neon branch is provisioned` are present; the old phrases (`No new secret name is introduced`, `every value is dashboard- or shell-supplied`, `runtime-parity`, the `SMTP_*` dashboard list, `the same names, none provisioned`, the old environment sentence) are gone.
  - (b) `vercel-render-neon.md` catalogs the nine names with the required table types, states `nine validated, seven synced`, documents the sync and guard, adds the `Placeholder guard` troubleshooting entry, uses `GitHub Environment (synced to Render for the seven SMTP names)`, and removes the listed stale sentences.
  - (c) Both architecture docs state `render.yaml` keeps `sync: false` with no value, and that the remaining `sync: false` names `stay dashboard-owned` and are `never synced`.
  - (d) README § Email no longer says `or set them on the Render service`; the checklist Secrets list contains `SMTP_USER` and `RENDER_API_KEY`, the Variables list contains `RENDER_SERVICE_ID` and no `SMTP_USER`; the closing paragraph uses the sync/source wording and the extended guard includes `RENDER_API_KEY=` and `rnd_[A-Za-z0-9_-]{20,}` plus `git log -p origin/main..HEAD`.
  - (e) README's `verify-workflows` list names both guard steps; the deploy bullet and § Deploy flow order check → Neon migration → sync → Render deploy hook; the old direct migration → hook sequence is gone.
  - (f) `deployment.md` § Platform split and § Deploy pipeline both order check → Neon migration → sync → Render deploy hook; the CI list names both guard steps; `the sync runs after the Neon migration and before the Render deploy hook` is present and `Failed gates block the deploy before any provider is touched` is gone; `Production holds the nine placeholder names` is present and the old production sentence is gone.
  - (g) `vercel-render-neon.md` § Architecture and § Routine development deploy order check → Neon migration → sync → hook; `Nothing is provisioned today` and `fails on the first missing production secret` are gone and the replacements are present; troubleshooting says `check the GitHub`; the operating rule says `the seven SMTP names are synced from the GitHub Environment`.
  - (h) All three docs contain `no Render service, Vercel project or Neon branch is provisioned`.
- Evidence: the T6 verify block above (exit `0`), plus `git diff --check` and the extended credential guard (exit `1` = no match). The deployed proof remains user-owned and is documented, not claimed.

## Proposed `docs/features/README.md` row (not applied — orchestrator-owned)

Current last row:

```diff
 | brevo-smtp-email-delivery | Brevo SMTP Email Delivery & Branded Verification Email (...) | accepted | 2026-11-22 |
+| deploy-brevo-env-placeholders | Deployment Brevo Environment Placeholders (GitHub Environment source of truth, nine validated/seven synced, strict placeholder guard) | building | 2026-11-22 |
```

## Testing note

This is a documentation-only task: it changes no source, workflow, compose, `render.yaml` or runtime behavior, so no unit/integration test can regress from it and the testing bar's two tiers do not apply. The T6 verify block (exact `grep`/`node -e` documentation assertions, section-order checks and the extended credential guard over this log) is the task's gate; T7 runs the full lint/typecheck/test/coverage/build/smoke suite.

## Deviations from spec

None. The development command block is explicitly marked as the reference form with a do-not-overwrite warning, because AC-11(a) requires the exact command lines while T5 preserved the live development values.
