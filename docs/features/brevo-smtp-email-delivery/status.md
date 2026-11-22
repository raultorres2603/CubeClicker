---
feature: brevo-smtp-email-delivery
state: building
spec_review_round: 2
build_round: 0
created: 2026-11-20
updated: 2026-11-21
---
# Status — Brevo SMTP Email Delivery

## Summary
Wire Brevo SMTP as the email delivery provider for development and production so account-verification emails are actually delivered, and upgrade the verification email to a game-branded HTML template; expose and document all required SMTP settings (host, port, credentials, sender, TLS mode) without committing secrets.

## Task board
- [x] T0 — Move Brevo MCP credential to global config + sanitize opencode.jsonc `[seq]`
- [x] T1 — SMTP TLS mode, timeout, credential-pair validation `[seq]`
- [x] T2 — Author and commit the two email brand PNGs `[P]`
- [x] T3 — Branded verification HTML template `[seq]`
- [x] T4 — Transport options, factory, template wiring `[seq]`
- [x] T5 — Verification TTL + failure surfacing `[seq]`
- [x] T6 — Test-email CLI and scripts `[seq]`
- [x] T7 — Mailpit smoke pinning + Render/compose entries `[seq]`
- [x] T8 — Documentation pass `[seq]`
- [ ] T9 — Verify & integrate `[seq]`

## Loop log
- 2026-11-20 — created → planning — request: "We are going to use Brevo SMTP to send the emails on development and production environments for verification accounts when registering the accounts. We have an API Key. Proceed with implementation to be able to set the API KEY, SMTP host, etc."
- 2026-11-20 — planning → spec_review — planner delivered spec/plan/tasks r2 (SMTP + branded email); review round 1 — docs/features/brevo-smtp-email-delivery/spec.md
- 2026-11-20 — scope addendum during planning — "update our verification email with some pretty assets based on our game using our skills we have"
- 2026-11-21 — spec_review (r1) → planning — verdict `changes_requested`, 6 blocking (F1–F6) — docs/features/brevo-smtp-email-delivery/reviews/spec-r1.md
- 2026-11-21 — planning (r3) → spec_review — spec r1 findings F1–F16 closed; owner directive encoded: Brevo MCP credential moves to the user-owned global OpenCode config and the tracked `opencode.jsonc` stays reference-only (new T0) — docs/features/brevo-smtp-email-delivery/spec.md
- 2026-11-21 — spec_review round 2 started — docs/features/brevo-smtp-email-delivery/spec.md (r3)
- 2026-11-21 — spec_review (r2) → planning — verdict `changes_requested`, 1 blocking (F17, config traversal) — reviews/spec-r2.md
- 2026-11-21 — planning (r4) → awaiting_approval — owner approved a scoped F17 fix skipping round 3; r4 verified against F17 (traverse `mcp.servers`/`mcp`/`mcpServers`, exactly one `brevo`, reference shape vs global `headers.Authorization`, names only); Q-1 confirmed SMTP key — spec.md (r4)
- 2026-11-22 — awaiting_approval → building — user approved spec r4 — spec.md (r4)
- 2026-11-22 — building — T0 complete — credential moved to global config, `opencode.jsonc` reference-only, 14/14 guards green, commit 97cab2f — build-log-T0.md
- 2026-11-22 — building — T1 complete — SMTP_SECURE/TIMEOUT + pairing rule; 1708 tests, coverage 96.48/90.52/99.59/96.48, commit 17107c2 — build-log-T1.md
- 2026-11-22 — building — T2 complete — deterministic generator + hero 600×200/4,357 B and cube 72×72/582 B, SHA-256 reproducible, commit 602ef2f — build-log-T2.md
- 2026-11-22 — building — T3 complete — branded template 4,322 B HTML, 30 tests, backend coverage 96.52/90.58/99.6/96.52, commit 9c906ef — build-log-T3.md
- 2026-11-22 — building — T4 complete — factory seam + Brevo transport options + template wiring, 1746 tests, coverage 96.53/90.64/99.6/96.53, commit 0c96658 — build-log-T4.md
- 2026-11-22 — building — T5 complete — TTL into register/resend, failure 500 + resend recovery, 1752 tests, commit 2214e97 — build-log-T5.md
- 2026-11-22 — building — T6 complete — `email:test`/`email:test:dist` CLI with `redactSecrets`, 1773 tests, commit 941862d — build-log-T6.md
- 2026-11-22 — building — T7 complete — SMTP_SECURE/TIMEOUT in compose+render, smoke pinned to Mailpit, 7/7 config checks, commit 6eb14b5 — build-log-T7.md
- 2026-11-22 — building — T8 complete — README Brevo recipe/CLI/asset docs, deployment/vercel-render/containerization updated, 36/36 greps, commit 36d6aa8 — build-log-T8.md

## Blockers / open questions
- Spec r1 F1–F16 addressed in revision 3; awaiting round-2 review.
- T0 (builder, pre-build): move the Brevo MCP auth header to `~/.config/opencode/opencode.json`, sanitize the tracked `opencode.jsonc` to a reference-only entry, run the key-pattern guard. Owner states the key was never pushed; rotation is a contingency only. A running OpenCode session may need a restart before the Brevo MCP reconnects — expected, not a build failure.
- Q-1 (user, blocks live delivery only): confirm the Brevo SMTP key (not the REST API key) and place it in SMTP_PASS.
- Q-2 (user): sender identity / domain verification for the From address.
- Q-3 (user, post-build): live-delivery verification owner and redacted evidence.
- Q-5 (user): 300 emails/day plan capacity.
- Q-7 (user): production remains unprovisioned (documented recipe only).
- Q-9: resolved — assets come from the committed deterministic generator; reviewer visual approval in the code-review artifact.
- Q-4/Q-6/Q-8/Q-10: agent-decided defaults recorded in the spec; no user action.
