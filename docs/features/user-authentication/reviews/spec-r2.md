---
feature: user-authentication
phase: spec
iteration: 2
verdict: changes_requested
blocking: 2
nonblocking: 4
---

# Spec Review — r2

## Summary

❌ changes requested — r2 addresses all 21 r1 blocking findings in substance (account member lifecycle, deferred join, frontend protocol mirror ownership, `@fastify/cookie`, sliding `touch`, resume semantics, single-session AC-33, blocking dependency decisions, composition/AuthConfig, verification consumption UI, AC-17 mapping, approval gates, join-mode resolution, rate-limiter keying, intro-skip/menu clarification, `not_authenticated` semantics, uniqueness reconciliation, registration-enumeration trade-off, container sequencing, logging policy). Dependency graph is acyclic, `[P]` tasks have disjoint `files_owned`, coverage verify commands are present on every task, and container/real-time/security coverage is solid. Two new MAJOR gaps remain: (1) deferred join removes the auto-join-on-hello path but the reconnect-resume path (guest token rejoin / account resume within grace) is not specified, so reconnects would never resume; (2) account resume within grace cannot identify the correct member when several members share one `accountId` (multi-tab), because no client-held token or selection rule is defined.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F22 | MAJOR | plan.md § Frontend data flow; tasks.md T16; transport.ts (existing auto-join on hello) | Deferred join is specified only for the first connection: the transport "no longer auto-joins on `hello`" and the session calls `transport.join(mode)` after a menu choice. But every reconnect (new socket) produces a new `hello`; with auto-join removed, neither a guest token `rejoin` nor an account resume within grace can be sent, so reconnects never resume and the member is dropped after grace. The spec's AC-25 (reconnect preserves identity/cube state within grace) becomes unachievable. | Specify reconnect handling under deferred join: the transport retains the last chosen mode and the last `welcome` token and, on a subsequent `hello`, sends `rejoin { token }` when a token exists (guest/account reconnect) and otherwise `join { mode }`; or the session subscribes to `hello` frames and re-invokes `transport.join(mode)`. Add tests in `transport.test.ts`. | open |
| F23 | MAJOR | plan.md § Architecture (Account member lifecycle); spec.md AC-21, AC-25; hub.ts (existing) | Within-grace resume for accounts is specified as "an existing member with the same `accountId` in grace", but multi-tab play creates multiple distinct members sharing one `accountId` (plan § Architecture). A reconnecting tab cannot be matched to its own grace member by `accountId` alone, so resume would either pick the wrong member or fail. No client-held token or selection rule (e.g. most-recently-disconnected) is defined. | Define account resume selection: either (a) reuse the `welcome`-issued member token via `rejoin { token }` for accounts too (hub validates the token maps to an account member whose `accountId` matches the cookie), or (b) specify a deterministic selection rule (e.g. the single grace member, or the most recently disconnected one) and its failure mode. Update protocol/hub and `hub.test.ts`. | open |
| F24 | MINOR | tasks.md T11, T14 | T11 (8 files across backend + frontend protocol) and T14 (8 UI files) are large for a single builder session and bundle backend hub/protocol changes with frontend mirror changes. | Consider splitting T11 into backend (app/hub/protocol) and frontend-mirror sub-tasks, and T14 into component groups; or record the sizing decision in the build log. | open |
| F25 | MINOR | plan.md § WS protocol changes; protocol.ts (backend + frontend mirror) | The new `identity` field on `welcome`/`worldEntered`, the `mode` field on `join`, and the `account_unverified`/`not_authenticated` error codes are described in prose but not reflected in the TypeScript protocol types (`ClientMessage`, `ServerMessage`, `ErrorCode`, `Placement`). | Add the updated type definitions (and decoders/builders) to the plan's Interfaces section or to T11's notes so the backend/frontend mirrors stay in sync; cover with parity tests. | open |
| F26 | INFO | spec.md § Open questions (Q-1, Q-2, Q-3, Q-6); tasks.md T1, T3, T7, T17 | The four blocking dependency/service decisions (PostgreSQL 16, pluggable SMTP + Mailpit, `@node-rs/argon2`, in-repo SQL runner) remain open pending user approval. They are now correctly gated as blocking before T1/T3/T7/T17, but must be recorded as approved in the build log before those tasks execute. | User approves proposed defaults (or alternatives) and records approval; no spec change required beyond the existing gates. | open |
| F27 | MINOR | tasks.md T1 | T1's `files_owned` includes `src/backend/src/game/config.ts` and its test, but the plan states `GameConfig` is unchanged in shape and auth config lives in a separate `AuthConfig`. | Clarify in T1 notes whether `game/config.ts` is touched (and why) or remove it from `files_owned` to keep the hub's game config untouched. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All requested capabilities (accounts, registration + email activation, password hashing, guest play, intro menu, dockerized DB + email, WS auth) covered by ACs; non-goals listed. AC-33 added; AC-4/AC-19/AC-24/AC-25 rewritten for testability. |
| Testability | ⚠️ | Most ACs binary-testable. AC-25 (resume) now unambiguous for the within/outside-grace split, but F22/F23 leave the reconnect mechanism and multi-tab resume selection unspecified. |
| Boundaries | ✅ | Three tiers present; non-goals listed. |
| Dependency graph | ✅ | Acyclic; every AC mapped to at least one task; T17/T19/T20 sequencing correct; T_final after all. (Mermaid omits T_final edges for readability only.) |
| Parallel safety | ✅ | `[P]` tasks T2, T7, T8, T18 have disjoint `files_owned` and no shared-file contact; T18 gated on user approval. |
| Security | ✅ | Cookie dependency, enumeration trade-off, logging policy, sliding expiry, single-session, SQL injection, rate limiting, CSRF, secure cookie all specified; secrets via env. |
| Testing | ✅ | Strategy present with unit + integration tiers; `npm run coverage` with ≥ 80% thresholds named per workspace; assertion bar referenced; verify commands on every task. |
| Consistency | ✅ | Aligns with vision supersession ledger; reuses existing architecture; no contradictions with AGENTS.md beyond the approval gates. |
| Risks | ⚠️ | F22 (reconnect under deferred join) and F23 (multi-tab account resume) are ambiguities that will surface mid-build; F24/F25/F27 are sizing/clarity risks. |
| Real-time | ⚠️ | Connection lifecycle, reconnection, multi-client and server authority are defined, but reconnect-resume mechanism under deferred join (F22) and multi-tab account resume selection (F23) are unspecified. |
| Containers | ✅ | db + mailpit services, named volume, healthcheck, env config, secrets via env, WS endpoint exposed, approval gates for compose edits — all specified and gated. |

## Previous round verification (r1 → r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) BLOCKER | fixed | plan.md § Architecture "Account member lifecycle in the hub" (`Connection.accountSession`, `Member.accountId`, account resume, multi-tab, post-grace re-join); AC-21/AC-25. |
| F2 (r1) BLOCKER | fixed | Transport no longer auto-joins on `hello`; `transport.join(mode)` exposed and called after an explicit menu choice (T16); plan § Frontend data flow. (Reconnect interaction remains open — see F22.) |
| F3 (r1) BLOCKER | fixed | `src/frontend/src/multiplayer/protocol.ts` added to T11 `files_owned` with parity tests. |
| F4 (r1) MAJOR | fixed | `@fastify/cookie` added to dependency list and T1 (approval-gated); spec Boundaries lists it. |
| F5 (r1) MAJOR | fixed | `SessionRepository.touch(id, ttlMs)` added to interface/impls and T5; sliding expiry in routes (T10). |
| F6 (r1) MAJOR | fixed | AC-25 rewritten: within-grace full resume vs. post-grace new member with same account identity. |
| F7 (r1) MAJOR | fixed | Single-session made explicit and intentional with AC-33; assumption updated (spec § Assumptions line 144). |
| F8 (r1) MAJOR | fixed | Q-1, Q-2, Q-3, Q-6 marked BLOCKING; proposed defaults gated for user approval before T1/T3/T7/T17 (T1/T17 notes). Approval still pending — see F26. |
| F9 (r1) MAJOR | fixed | Composition order specified; separate `AuthConfig` (`auth/config.ts`); T1/T11 updated. |
| F10 (r1) MAJOR | fixed | `VerifyEmail` component + route handling added (T14/T15); AC-5 evidence updated. |
| F11 (r1) MAJOR | fixed | AC-17 added to T_final acceptance and final-gate grep. |
| F12 (r1) MAJOR | fixed | T17 marked approval-gated before execution. |
| F13 (r1) MAJOR | fixed | T18 marked approval-gated before editing `vision.md`. |
| F14 (r1) MAJOR | fixed | Mode resolution specified via deferred `transport.join(mode)` and server-side validation. (Reconnect interaction remains open — see F22.) |
| F15 (r1) MAJOR | fixed | Rate limiter `allow(key, limit, windowMs)` keying specified; tests per-key. |
| F16 (r1) MAJOR | fixed | Q-12/AC-19 clarify skip advances cinematic only and does not select a mode or dismiss the menu. |
| F17 (r1) MAJOR | fixed | `not_authenticated` (no session) vs. `account_unverified` (unverified session) semantics defined; AC-4/AC-24 and tests. |
| F18 (r1) MAJOR | fixed | Schema reconciled: functional unique indexes only; raw `UNIQUE` removed. |
| F19 (r1) MAJOR | fixed (accepted trade-off) | Registration enumeration via `409` documented as accepted in Security considerations. |
| F20 (r1) MAJOR | fixed | T17 sequenced before T19/T20; T19 depends on T17. |
| F21 (r1) MAJOR | fixed | Logging hygiene specified in Security considerations and AC-12; final-gate grep. |

## Notes / backlog (non-blocking)

- MINOR — T11/T14 are large; consider splitting (F24).
- MINOR — Protocol types need updating for `mode`/`identity`/new error codes (F25).
- MINOR — T1 `files_owned` includes `game/config.ts` though GameConfig is unchanged (F27).
- INFO — Q-4 (validation library), Q-5 (session store), Q-7 (username policy), Q-8 (auto-login after verify), Q-9 (password reset), Q-10 (CSRF depth), Q-11 (Mailpit), Q-12 (intro UX) are lower-risk open questions; resolve at build time with proposed defaults.
- INFO — Blocking approval gates remain for Q-1/Q-2/Q-3/Q-6 and for T17/T18 (F26); record approvals in build logs.
- INFO — Wishlist items (OAuth, MFA, passkeys, password reset, roles, display names, leaderboards, account deletion) correctly listed as non-goals.