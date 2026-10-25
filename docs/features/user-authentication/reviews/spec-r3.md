---
feature: user-authentication
phase: spec
iteration: 3
verdict: approved
blocking: 0
nonblocking: 1
---

# Spec Review — r3

## Summary

✅ approved — This is an authorized third round (user override of the 2-round budget) to close r2's two MAJORs. F22 (reconnect under deferred join) and F23 (multi-tab account resume selection) are now fully specified via AC-34 and AC-35, with matching protocol types, transport retention rules, and hub validation; F24/F25/F27 are closed as notes/sizing/clarification. The dependency graph is acyclic with every AC (now AC-1…AC-35) mapped to a task, the four `[P]` tasks have disjoint `files_owned`, and coverage verify commands (≥ 80% per workspace) are present on every code task. No open BLOCKER or MAJOR remains; only the standing approval gates (Q-1/Q-2/Q-3/Q-6, T17/T18) and one stale plan-inventory row remain.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | plan.md § File inventory (`src/backend/src/game/config.test.ts`) | The inventory still lists `src/backend/src/game/config.test.ts` as an Edit, but T1 no longer touches game config after F27 (AuthConfig is separate and `GameConfig` is unchanged in shape). Left as-is, this could send the builder editing a file that should stay untouched. | Remove the `game/config.test.ts` row from the file inventory (or annotate it as "unchanged / not touched by this feature"). | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All requested capabilities covered by AC-1…AC-35; non-goals listed; AC-34/AC-35 close the reconnect/resume gaps. |
| Testability | ✅ | Every AC is binary-testable with named evidence (transport.test.ts, hub.test.ts, protocol parity tests); AC-25/AC-34/AC-35 are now unambiguous. |
| Boundaries | ✅ | Three tiers present; non-goals listed. |
| Dependency graph | ✅ | Acyclic; every AC mapped to at least one task (AC-34 → T16, AC-35 → T11); T17/T19/T20 sequencing intact; T_final after all. |
| Parallel safety | ✅ | `[P]` tasks T2, T7, T8, T18 have disjoint `files_owned` and no shared-file contact; T18 gated on user approval. |
| Security | ✅ | Cookie dep, enumeration trade-off, logging policy, sliding expiry, single-session, SQL injection, rate limiting, CSRF, secure cookie, secrets-via-env all specified. |
| Testing | ✅ | Unit + integration tiers named; `npm run coverage` with ≥ 80% thresholds per workspace on every code task; assertion bar referenced; no exclusions. |
| Consistency | ✅ | Aligns with vision supersession ledger; reuses existing architecture; no contradictions with AGENTS.md beyond the approval gates. |
| Risks | ✅ | F22/F23 (the r2 mid-build dead ends) are now specified; remaining risks are the standing approval gates (Q-1/Q-2/Q-3/Q-6, T17/T18) and F1 (stale inventory). |
| Real-time | ✅ | Connection lifecycle, deferred join, reconnect-resume (AC-34), multi-client/multi-tab resume selection (AC-35), and server authority (cookie-resolved session, forged payloads rejected) are defined. |
| Containers | ✅ | `db` (Postgres 16) + `mailpit` services, named volume, healthcheck, env config, secrets via env, WS endpoint exposed, approval gates for compose edits — all specified and gated. |

## Previous round verification (r2 → r3)

| Finding | Status | Evidence |
| --- | --- | --- |
| F22 (r2) MAJOR | fixed | spec.md AC-34 (first connection sends nothing on `hello` until `transport.join(mode)`; reconnect sends `rejoin { token }` when a token exists else `join { mode: lastMode }`); plan.md § Frontend data flow + Real-time impact; tasks.md T16 notes + acceptance (AC-34); `resume_failed` forgets the token and re-sends `join { mode: lastMode }`. |
| F23 (r2) MAJOR | fixed | spec.md AC-35 (token-based `rejoin { token }` for accounts; hub validates token maps to an account member whose `accountId` equals the cookie's `userId` and that the session is verified, else `resume_failed`; `join { mode: 'account' }` always creates a new member); plan.md § Architecture (account member lifecycle / `rejoin` branch); tasks.md T11 acceptance (AC-35). |
| F24 (r2) MINOR | fixed (note) | tasks.md T11 and T14 notes explicitly allow splitting and recording the decision in the build log (F24). |
| F25 (r2) MINOR | fixed | plan.md § Interfaces now contains the TypeScript type definitions (`ClientMessage` with `join`/`rejoin`, `Identity`, `Placement.identity`, `ErrorCode` incl. `account_unverified`/`not_authenticated`, and the `Transport.join` interface) with parity tests. |
| F26 (r2) INFO | open (approval) | Blocking dependency/service decisions Q-1/Q-2/Q-3/Q-6 and approval gates T17/T18 remain pending user approval; correctly gated before T1/T3/T7/T17 and recorded in build log. Not a spec gap. |
| F27 (r2) MINOR | fixed | tasks.md T1 `files_owned` no longer includes `src/backend/src/game/config.ts` / its test; notes state GameConfig is untouched and AuthConfig is separate (F27). |

## Notes / backlog (non-blocking)

- INFO — Q-4 (validation library), Q-5 (session store), Q-7 (username policy), Q-8 (auto-login after verify), Q-9 (password reset), Q-10 (CSRF depth), Q-11 (Mailpit), Q-12 (intro UX) are lower-risk open questions; resolve at build time with proposed defaults.
- INFO — Blocking approval gates remain for Q-1/Q-2/Q-3/Q-6 and for T17/T18 (F26); record approvals in build logs before those tasks execute.
- INFO — Wishlist items (OAuth, MFA, passkeys, password reset, roles, display names, leaderboards, account deletion) correctly listed as non-goals.
- MINOR — Stale plan inventory row for `src/backend/src/game/config.test.ts` (F1 above).