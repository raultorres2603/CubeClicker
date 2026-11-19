---
feature: remote-spaceship-customization
phase: code
iteration: 2
verdict: approved
blocking: 0
reviewed: 2026-11-19
---
# Code Review — r2 (docs remediation)

## Verdict rationale

Approved. The two r1-fix commits (`1f95cd6`, `ec38660`) are docs-only and close all three
remediation findings. F1 is fixed: `docs/architecture/realtime.md:492-497` now scopes the privacy
claim to **leaderboard or activity** frames and the leaderboard placement field, names the
appearance-projection exception, and the same document states that appearance travels via
`MemberState.appearance` on server rosters (`realtime.md:516-517,524-528`), the `memberAppearance`
server frame and the guest `setAppearance` report (`realtime.md:545-551`). F2 is fixed: the docs now
separate wire fidelity (`parseMemberState`/`copyMemberState` preserve an absent field,
`realtime.md:536-539`) from the storage/render read gate (`memberAppearanceOf`, `copyMember`, the
reducer paths and the scene roster copy fill `{}`, `realtime.md:530-534,539-543`), and I confirmed
each claim against the shipped code. F3 is fixed: `frontend-rendering.md:133` says
`partDefinitionV3(partId).slot` and no stale `partDefinition(` remains in that file. The commits
touch only the two owned architecture docs plus the fix build log; the T17 docs greps, `lint`,
`typecheck`, the frontend suite and the coverage gate are green. No new contradiction remains in the
changed docs. One non-blocking INFO wording note is recorded below.

## Acceptance verification (docs scope)

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-34 (documentation) | ✅ | Re-ran the T17 recipe: all four README phrases, `## Public appearance projection`, `## Remote ships`, the two observability `setAppearance` allow-list mentions and the empty stale-text grep pass. The r1 fix adds the two missing precise statements: scoped leaderboard privacy (`realtime.md:492-497`) and transport-vs-storage normalization (`realtime.md:530-543`); `frontend-rendering.md:133` uses `partDefinitionV3`. |
| AC-32 / AC-33 (gate re-check) | ✅ | Reviewer-run `npm run coverage` → backend **96.46 / 90.49 / 99.59 / 96.46**, frontend **97.15 / 96.75 / 98.36 / 97.15** (statements/branches/functions/lines), exit 0; `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test --workspace @cubeclicker/frontend` → 83 files / 2,844 tests passed, exit 0. |
| AC-1–AC-31, AC-35, AC-36 | unchanged | No source, test, container, package or schema change in either fix commit; r1 verified these ACs on the same tree (`git diff --stat 1f95cd6^..ec38660 -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json` is empty). |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F9 | INFO | `docs/architecture/realtime.md:494-496` | “Appearance is carried only by the public appearance projection: the `MemberState.appearance` field …, the `memberAppearance` server frame and the guest `setAppearance` report” reads as an exhaustive statement. The pre-existing owner-scoped `welcome.customization` (`src/backend/src/game/hub.ts:824-826`) and `customizationUpdate` (`src/backend/src/game/protocol.ts:343`) also carry the owner's own appearance to that account's connections. In context the paragraph is about the leaderboard and the public/cross-member surface, and the projection section defines public carriage, so this is not a contradiction with the leaderboard privacy claim or the feature contract. | Optional wording only (e.g. “Publicly, appearance is carried only by …” or an owner-scoped note). No action required for approval. | open (INFO) |

No BLOCKER, MAJOR or MINOR findings remain open from r1.

## Verification performed

- `git show --name-status --format='' 1f95cd6` → `M docs/architecture/frontend-rendering.md`, `M docs/architecture/realtime.md`, `A docs/features/remote-spaceship-customization/build-log-code-r1-fixes.md`; `git show --name-status --format='' ec38660` → only the same build log. `git diff --name-only 1f95cd6^..ec38660` lists exactly those three files; `git diff --stat 1f95cd6^..ec38660 -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json docs/features/remote-spaceship-customization docs/features/README.md` shows only the expected build log (no spec/plan/tasks/status/reviews/index change).
- `git status --porcelain` → only ` M docs/features/README.md` (the pre-existing orchestrator-owned row) plus the untracked feature artifacts. `git diff --check` → exit 0. `git rev-parse --abbrev-ref HEAD` → `feat/remote-spaceship-customization`; HEAD = `ec38660`.
- T17 docs greps re-run: `remote player spaceships`, `1,351 spaceship parts`, `form and finish picker` and `shot styles` found in `README.md`; `## Public appearance projection` found in `realtime.md`; `## Remote ships` found in `frontend-rendering.md`; `grep -cF setAppearance docs/architecture/observability.md` → `2`; `! grep -E "five part-group tabs|ten part slots|n/4" README.md` → exit 0 (no matches).
- Fix-specific greps: `! grep -F "No frame or placement object" docs/architecture/realtime.md` → exit 0; `No **leaderboard or activity** frame` present at `realtime.md:492`; `! grep -F "Every frontend decode/copy path"` → exit 0; `Every frontend storage/copy path` present at `realtime.md:530`; `Wire fidelity is separate from that read gate` present at `realtime.md:536`; `partDefinitionV3(partId).slot` present at `frontend-rendering.md:133`; `! grep -F "partDefinition(" docs/architecture/frontend-rendering.md` → exit 0.
- F2 code cross-check (read-only): frontend `parseMemberState` keeps `undefined` for an absent field and normalizes a present record (`src/frontend/src/multiplayer/protocol.ts:985-1000`); `memberAppearanceOf` returns `parseAppearance(...) ?? {}` (`protocol.ts:551-553`); reducer `copyMember` always assigns `appearance: memberAppearanceOf(member)` (`src/frontend/src/multiplayer/server-state.ts:115-123`), and `welcome`/`worldEntered`/`memberJoined` reach it through `othersFrom`/`map(copyMember)`/`withMember` (`server-state.ts:225-236,486-525,581-582`); the scene roster copy does the same (`src/frontend/src/render/world.ts:146-160`). Backend `copyMemberState` preserves absence and normalizes a present record (`src/backend/src/game/protocol.ts:1270-1285`); backend `memberAppearanceOf` → `parseAppearance(...) ?? {}` (`protocol.ts:444-446`). `withAppearance` stores only a parsed record (`server-state.ts:295-320`); `withAdvanced` spreads the current member, preserving appearance (`server-state.ts:356-395`).
- F1 neighbouring-claims cross-check: `src/backend/src/game/leaderboard.ts:36-105` reads only `playerId`/`name` and the three integer counters; `LeaderboardMember` has no economy/customization/appearance field, so “the leaderboard snapshot never reads or carries it” (`realtime.md:496-497`) and the `member.appearance` never-read list at `realtime.md:394-396` are accurate.
- `npm run lint` → exit 0; `npm run typecheck` → exit 0; `npm test --workspace @cubeclicker/frontend` → 83 files / 2,844 tests passed, exit 0; `npm run coverage` → exit 0 with the backend/frontend totals above.
- Feature-index check: `git diff docs/features/README.md` contains exactly the orchestrator's single `remote-spaceship-customization` row (`code_review`, `2026-11-19`); it is unstaged, as expected, and neither fix commit touches it.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Docs-only; no protocol/source change. The scoped privacy statement was checked against the leaderboard builder and the public projection; no secret, token or account identity is newly documented as public. |
| Quality | ✅ | F1–F3 corrected; no source defect; the new wording matches the shipped decoders and storage paths. One optional INFO precision note (F9). |
| Testing | ✅ | Coverage re-run above the 80% thresholds in both workspaces; docs-only change, so the r1 test-quality and banned-matcher results stand; no new test claim. |
| Real-time | ✅ | No behavior change; the r1 multi-client/reconnect/fan-out verification was on the same source tree. |
| Accessibility / UI | ✅ | No UI or markup change; r1 accessibility results stand. |
| Containerization | ✅ | No compose, Dockerfile, port, env or service change; the container contract is untouched. |
| Documentation | ✅ | AC-34 items intact and the code-gate docs now consistent: scoped leaderboard privacy + explicit projection paths (`realtime.md:492-497,510-543`), `partDefinitionV3` (`frontend-rendering.md:133`). |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1, MAJOR) | fixed | `realtime.md:492-497` scopes the claim to leaderboard/activity frames and the leaderboard placement field, names the three projection carriers and says the leaderboard snapshot never reads or carries appearance. Independently checked against `leaderboard.ts` and the `memberAppearance`/`setAppearance`/roster shapes. |
| F2 (r1, MINOR) | fixed (docs wording option) | `realtime.md:530-543` distinguishes wire fidelity (decoders preserve absence) from the storage/render gate (`memberAppearanceOf`/`copyMember`/scene roster fill); matches `protocol.ts:985-1000,1270-1285`, `server-state.ts:115-123`, `world.ts:146-160`. |
| F3 (r1, MINOR) | fixed | `frontend-rendering.md:133` now reads `partDefinitionV3(partId).slot`; the negative grep for `partDefinition(` in that file is empty. |
| F4 (r1, MINOR process) | acknowledged, no recurrence | The fix commits edit no `docs/features/README.md`; the only index diff is the orchestrator's pre-existing single `remote-spaceship-customization` row. The historical T18 bookkeeping remains a process note. |
| F5–F8 (INFO) | accepted | No action; r1 measurements/notes stand and no source changed. |
| Spec r3 M3 | fixed | The last stale docs item (the `realtime.md:493` privacy sentence) is closed by F1. |

## Residual backlog (non-blocking)

- **F4 (process note)** — keep `docs/features/README.md` edits orchestrator-owned; the uncommitted
  `remote-spaceship-customization … code_review` row is the orchestrator's and will be committed as
  `accepted` after this approval.
- **F9 (INFO)** — optional wording precision for “Appearance is carried only by …” (see Findings);
  the paragraph is correct for the public/leaderboard intent and needs no change to approve.
- **F5–F8 (INFO)** — accepted in r1: favorable bundle measurement, 16,362 B welcome measurement,
  `SpaceshipPreview.tsx` per-file coverage and the smoke-service reuse note; no code action.
- **T13/T12 seam note** — unchanged from r1: the scene world does not consume `memberAppearance`;
  `session.ts` re-applies `setSpectatedAppearance` after mount and after a remote `levelAdvanced`.
  Behavior tests pass; this is a follow-up ownership question, not a defect in this feature.
- **User-owned questions Q-1/Q-3/Q-4** remain the accepted defaults; no new open question.
