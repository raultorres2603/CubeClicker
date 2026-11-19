# Build log — code review r1 fixes — documentation

Task: code-review r1 remediation (2026-11-19)
Files changed: `docs/architecture/realtime.md`, `docs/architecture/frontend-rendering.md`,
`docs/features/remote-spaceship-customization/build-log-code-r1-fixes.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `1f95cd6` — `docs: clarify appearance projection boundaries` (not pushed; the hash is
recorded by the follow-up `docs: record code-r1 fix commit hash` commit, because a commit cannot
embed its own hash).

## Sketch (≤5 lines)

- F1: scope the leaderboard `### Privacy and rollback` sentence to leaderboard/activity frames and
  leaderboard placement fields, and state the appearance-projection exception explicitly.
- F2: narrow "every frontend decode/copy path" to storage/copy paths and add a transport paragraph:
  decoders preserve absence; `memberAppearanceOf`/`copyMember`/the reducer default to `{}`.
- F3: rename the reveal doc's stale `partDefinition` to `partDefinitionV3`.
- No source/test/spec/plan/tasks/status/review edits; re-run the T17 docs recipe and record it.

## What changed & why

- **F1 (MAJOR) — `docs/architecture/realtime.md` § Live leaderboard → `### Privacy and rollback`.**
  The paragraph no longer claims globally that no frame carries appearance. It now scopes the
  property to the frames and fields the leaderboard owns and names the exception:

  > No **leaderboard or activity** frame — and no leaderboard placement field — carries
  > `accountId`, token, email, IP, coins, upgrade levels, appearance, free text or any
  > client-supplied string. Appearance is carried only by the public appearance projection
  > (§ Public appearance projection): the `MemberState.appearance` field on server-originated
  > rosters, the `memberAppearance` server frame and the guest `setAppearance` report; the
  > leaderboard snapshot never reads or carries it.

  The surrounding claims were re-checked against the shipped protocol: `leaderboardUpdate` carries
  `serverId`, `at`, per-entry `playerId`/`name` and integer counters only; the placement
  `leaderboard` field carries the same snapshot; the activity frames carry ids, clock, catalog
  numbers, `partId` and roster-published `name`. `welcome`/`worldEntered`/`memberJoined` are not
  leaderboard/activity frames and are the documented appearance carriers. For extra precision the
  leaderboard counter paragraph (`### Session counters`) now also lists `member.appearance` among
  the values the snapshot never reads — the snapshot reads exactly the three session counters, as
  pinned by the T6 leaderboard tests.

- **F2 (MINOR) — `docs/architecture/realtime.md` § Public appearance projection → `### Field, frames
  and normalization`.** "Every frontend **decode**/copy path" was too broad: the decoders preserve
  absence. The sentence now says "Every frontend **storage**/copy path", and a new paragraph records
  the transport behavior explicitly:

  > Wire fidelity is separate from that read gate: the member wire paths — `parseMemberState` in
  > `multiplayer/protocol.ts` and the backend's `copyMemberState` — preserve an **absent**
  > `appearance` instead of injecting `{}`, which keeps legacy payloads and the accepted
  > full-literal fixtures byte-faithful. Absence is resolved at the storage/render boundary:
  > `memberAppearanceOf` reads an absent or malformed field as `{}`, and the reducer's `copyMember`
  > (used by `welcome`, `worldEntered` and `memberJoined`) and the scene's roster copy always store
  > `appearance: memberAppearanceOf(member)`, so every member stored in `WorldState` and every copy
  > the scene reads carries `{}` or a valid record.

  Source verified before writing: frontend `parseMemberState` returns `undefined` for an absent
  field (`... (appearance === undefined ? {} : { appearance })`), backend `copyMemberState` spreads
  the field only when present, `memberAppearanceOf` returns `parseAppearance(...) ?? {}`,
  `server-state.ts copyMember` always assigns `appearance: memberAppearanceOf(member)`, and
  `render/world.ts copyMember` does the same. No source or spec change (the review offered the
  docs-wording option; the brief fixed that option).

- **F3 (MINOR) — `docs/architecture/frontend-rendering.md` § Lootbox reveal stage.**
  `partDefinition(partId).slot` → `partDefinitionV3(partId).slot` at line 133, matching
  `render/lootbox-reveal.ts:41,154` and `ui/LootboxReveal.tsx:50,121`. It is the only
  `partDefinition` occurrence in the file; the negative grep below proves none remain.

- **No other edits.** T17's exact accepted phrases, the `## Public appearance projection` and
  `## Remote ships` headings, the observability allow-lists and the glossary are untouched. No
  source, test, spec, plan, tasks, status, review, features-index, compose, Dockerfile or package
  file changed. `docs/features/README.md` remains as it was before this task (the orchestrator's
  uncommitted `remote-spaceship-customization` row); it is not staged.

## Decisions

1. **Scope, don't delete, the privacy claim (F1).** The paragraph's purpose is that the leaderboard
   never widens the leaderboard's own public surface, and that stays true. Scoping it to
   leaderboard/activity frames plus the leaderboard placement field keeps every original exclusion
   while the projection exception is stated in the same paragraph. No cross-reference to a section
   that does not exist: the projection section follows this one in the same document.
2. **Docs-only resolution for F2.** The review's two candidate fixes were code normalization or
   narrowed docs. The brief mandates docs-only, and the runtime behavior is already safe by
   construction (decoders preserve absence; every stored/render path defaults it). The docs now
   describe both halves instead of over-claiming the decoder.
3. **One docs commit.** The T17 recipe, greps and the full gate were re-run on the final tree; this
   log is part of the committed change. No feature-artifact bookkeeping was added.
4. **F4 (process note) acknowledged.** No `docs/features/README.md` edit is made here; the
   pre-existing dirty path is recorded below as a known non-empty status gate and left to the
   orchestrator.
5. **F5–F8 (INFO) require no action** and no doc change; they are accepted in `reviews/code-r1.md`.

## Evidence

The recipe ran on the final documentation tree. `src/`, `tests/`, `compose.yaml`,
`compose.smoke.yaml`, both Dockerfiles, `package.json` and `package-lock.json` are unchanged; the
only tracked modifications are the two owned architecture docs (and the pre-existing orchestrator
`docs/features/README.md`, which is not staged).

### `npm run lint` — EXIT 0

```
> lint
> eslint .

EXIT:0
```

### `npm run typecheck` — EXIT 0

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT:0
```

### `npm test --workspace @cubeclicker/frontend` — EXIT 0

```
 Test Files  83 passed (83)
      Tests  2844 passed (2844)
   Start at  11:28:35
   Duration  4.29s (transform 10.05s, setup 0ms, collect 27.96s, tests 17.02s, environment 11.84s, prepare 7.36s)

EXIT:0
```

(The `HTMLCanvasElement.getContext()` / `THREE.WebGLRenderer` stderr lines are the pre-existing
jsdom WebGL fallback noise from the UI suites; every file and test passes. The count matches the T18
baseline — docs-only changes cannot alter it.)

### `npm run coverage` — EXIT 0 (skill DoD gate, extra to the docs recipe)

```
 Test Files  38 passed (38)
      Tests  1694 passed (1694)
All files          |   96.46 |    90.49 |    99.59 |   96.46 |
 Test Files  83 passed (83)
      Tests  2844 passed (2844)
All files          |   97.15 |    96.75 |   98.36 |   97.15 |

EXIT:0
```

Backend: 96.46 statements / 90.49 branches / 99.59 functions / 96.46 lines. Frontend: 97.15 / 96.75 /
98.36 / 97.15. All four metrics are ≥ 80 in both workspaces; no config, threshold or exclusion was
changed.

### T17 exact greps — all EXIT 0

```
$ grep -F "remote player spaceships" README.md
Players earn points by clicking the cube ... The world also renders **remote player spaceships**: while spectating another member ...
EXIT:0
$ grep -F "1,351 spaceship parts" README.md
Players earn points by clicking the cube ... The catalog now holds **1,351 spaceship parts** across eleven **part slots** ...
EXIT:0
$ grep -F "form and finish picker" README.md
Players earn points by clicking the cube ... a **form and finish picker** narrows each row ...
EXIT:0
$ grep -F "shot styles" README.md
Players earn points by clicking the cube ... **shot styles** ... equipped **shot styles** ...
EXIT:0
$ grep -F "## Public appearance projection" docs/architecture/realtime.md
## Public appearance projection
EXIT:0
$ grep -F "## Remote ships" docs/architecture/frontend-rendering.md
## Remote ships
EXIT:0
$ grep -cF "setAppearance" docs/architecture/observability.md
2
EXIT:0
$ ! grep -E "five part-group tabs|ten part slots|n/4" README.md
EXIT:0
```

(The README matches are the T17 paragraph, unchanged by this task; the exact phrases are present
and the stale-text negative grep is empty.)

### Finding-specific negative/positive greps — all EXIT 0

```
$ ! grep -F "No frame or placement object" docs/architecture/realtime.md
EXIT:0
$ grep -F "No **leaderboard or activity** frame" docs/architecture/realtime.md
username) and integer session counters. No **leaderboard or activity** frame — and no leaderboard
EXIT:0
$ grep -F "Wire fidelity is separate from that read gate" docs/architecture/realtime.md
Wire fidelity is separate from that read gate: the member wire paths — `parseMemberState` in
EXIT:0
$ ! grep -F "Every frontend decode/copy path" docs/architecture/realtime.md
EXIT:0
$ grep -F "Every frontend storage/copy path" docs/architecture/realtime.md
Every frontend storage/copy path (`copyMember`, `reduceWorldState`, the scene's roster copy) passes
EXIT:0
$ grep -n "partDefinitionV3(partId).slot" docs/architecture/frontend-rendering.md
133:- **Try-on, never a mutation.** The slot is resolved from the pinned catalog (`partDefinitionV3(partId).slot`), never from the wire `slot`; ...
EXIT:0
$ ! grep -F "partDefinition(" docs/architecture/frontend-rendering.md
EXIT:0
```

### Scope checks

```
$ git diff --name-only
docs/architecture/frontend-rendering.md
docs/architecture/realtime.md
docs/features/README.md
EXIT:0

$ git diff --stat -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json docs/features/remote-spaceship-customization
(no output)
EXIT:0
```

`docs/features/README.md` is the pre-existing orchestrator row (see the status-gate block below);
it is not staged and not part of this task. The commit stages exactly the two owned architecture
docs plus this log.

```
$ git diff --check
EXIT:0

$ git status --porcelain
 M docs/architecture/frontend-rendering.md
 M docs/architecture/realtime.md
 M docs/features/README.md
?? docs/features/remote-spaceship-customization/build-log-code-r1-fixes.md
?? docs/features/remote-spaceship-customization/plan.md
?? docs/features/remote-spaceship-customization/reviews/
?? docs/features/remote-spaceship-customization/spec.md
?? docs/features/remote-spaceship-customization/status.md
?? docs/features/remote-spaceship-customization/tasks.md
EXIT:0
```

`docs/features/remote-spaceship-customization/{spec,plan,tasks,status,reviews}` are the
orchestrator's untracked artifacts (unchanged by this task). The only two tracked code docs in the
diff are the owned ones; the commit stages exactly those two files plus this log.

### `git status --porcelain -- docs/features ':(exclude)docs/features/remote-spaceship-customization'` — EXIT 0, **not empty**

```
 M docs/features/README.md
EXIT:0
```

This is the same pre-existing, orchestrator-owned feature-index row recorded in `build-log-T17.md`
and `build-log-T18.md`: the diff is the single `remote-spaceship-customization` row (state
`code_review`, date `2026-11-19`), not a builder edit. This task did **not** touch the file; clearing
the gate requires its owner to commit the row. It is left unstaged.

## Acceptance audit

- **F1 (MAJOR) — met.** `realtime.md`'s `### Privacy and rollback` no longer contains the unqualified
  "No frame or placement object carries ... appearance" claim (`! grep` exits 0); the sentence is
  scoped to leaderboard/activity frames and the leaderboard placement field, and the appearance
  projection exception is explicit. The neighbouring privacy statements (activity feed privacy,
  counter exclusion, projection-only payload) were re-read against the shipped protocol and remain
  correct; `member.appearance` was added to the leaderboard's never-read list.
- **F2 (MINOR) — met.** The docs now distinguish wire fidelity (frontend `parseMemberState` and
  backend `copyMemberState` preserve an absent field) from the read gate (`memberAppearanceOf`,
  `copyMember`, the reducer paths and the scene's roster copy default to `{}`); no source or spec
  edit.
- **F3 (MINOR) — met.** `frontend-rendering.md:133` names `partDefinitionV3`; no stale
  `partDefinition(` remains in the file.
- **T17 AC-34 items intact.** Both architecture headings and the four README phrases are present; the
  observability `setAppearance` entry remains; the stale-text grep is empty.
- **No out-of-scope edit.** `git diff --stat` over `src`, `tests`, container files, packages and the
  feature directory is empty; `spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/` and
  `docs/features/README.md` are untouched (`docs/features/README.md` is a pre-existing dirty path,
  not staged).

## Deviations from spec

- **Feature-index status gate is non-empty** (` M docs/features/README.md`): pre-existing and
  orchestrator-owned, recorded in T17/T18 and left untouched, exactly as the review's F4 process
  note requires. No other deviation: no dependency, behavior, schema, container or package change.
