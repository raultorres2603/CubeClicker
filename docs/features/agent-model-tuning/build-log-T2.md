# Build log — T2 — Verify & integrate

Task: T2 (2026-10-19)
Files changed: `docs/features/agent-model-tuning/build-log-T2.md` (only; no source, config, or agent file was edited — verification is read-only by design)

## What changed & why (≤5 lines)

- Independent re-run of every T1 check against the **committed** T1 state (`7ed1791`), not the working tree: exact-line `grep -Fx` (×4), uniqueness (`grep -c "^model:"` = 1, ×4), `python3` + `yaml.safe_load` frontmatter parse + `model` equality (×4).
- Diff scope vs both the T1 commit and the recorded pre-feature ref `02228acbefac7eafe03ca4ef31e0ed7f743fbc9e`: exactly `4 files changed, 4 insertions(+), 4 deletions(-)`, all eight content `-`/`+` lines are `model:` lines; every other byte proven identical (per-file stripped-model-line SHA-256 equal to baseline; 0 CR bytes).
- Completeness (AC-6): tracked-file search finds model definitions only in the four agent files plus five historical `docs/features/**` build logs; `opencode.jsonc` and `.opencode/commands/feature.md` are byte-identical to the pre-feature ref and contain no model key.
- Catalog cross-check (AC-7) against `spec.md` § Catalog basis, plus a live `opencode-go` re-query (enrichment): all four file targets equal spec **and** tasks tables byte-for-byte, each variant valid; live catalog 23/23 rows identical to the recorded table.
- Cost boundary (AC-8) and scope discipline (AC-9) re-verified from the spec's exclusion list and the T1 commit's `--name-status`/diff. No AC failed, no drift, nothing fixed.

## Decisions

- All file-state evidence is taken from `git show 7ed1791:<path>` (committed state), and additionally cross-checked against the working tree via `git hash-object` vs `git rev-parse 7ed1791:<path>` — all four blobs `IDENTICAL`, so there is no uncommitted drift between what was verified and what T1 committed.
- AC-5 is proven two ways: (a) the diff-shape check (`4 files changed, 4 insertions(+), 4 deletions(-)`; every content `-`/`+` line is a `model:` line; each removed line equals the baseline recorded in `build-log-T1.md`), and (b) a strong byte-identity check — SHA-256 of each file with its `model:` line removed, baseline (`02228acb`) vs committed T1 (`7ed1791`), identical for all four, which covers the entire `permissions:` block, prose, CR/LF bytes, and every other frontmatter key.
- AC-6 uses `git grep` (tracked files only) as the configuration search. The literal `grep -rn … .` from the task brief was also run; it additionally hits 20 lines in 4 files under the gitignored, untracked `node_modules/` tree (vendored dependency source — `fastify`, `@types/node`, `three`) and 0 lines under `src/*/node_modules/`. Those are not repository configuration and are not tracked by git (`git ls-files node_modules` = 0 files; `.gitignore:2 node_modules/`); the tracked-file search is the configuration-complete result the AC describes.
- AC-9 nuance recorded, not papered over: a naive `grep 'permissions:'` over the **whole** T1 commit diff does match, because (i) unchanged **context** lines in the four agent hunks quote `permissions:` (prefixed with a space, not `+`/`-`) and (ii) `build-log-T1.md` — added by the same commit — quotes the diff and the word `permissions:` inside fenced blocks and prose. Scoped to added/deleted lines of the agent-file diffs, there are **no** matches, and the byte-identity check proves the permission blocks are unchanged. Both raw results are recorded below.
- Live catalog re-query is enrichment only (spec Q-3 / AC-7 basis is the files + recorded catalog). The spec's `none` token for models with no effort variants is normalized to the live empty array `[]` for comparison; all five such rows are non-chosen models.
- `npm run coverage` intentionally NOT run and NOT claimed — N/A by design (`spec.md` § Testing strategy; tasks.md verification note). No test files exist or are needed for this feature.

## Evidence

Environment: `python3` 3.14.8, PyYAML 6.0.3, repository root `/var/home/raultorraco/Documents/Projects/CubeClicker`, branch `main`, run 2026-10-19.

### 0. Target commit identification and recorded anchor

```
$ git log --oneline --grep 'OpenCode Go (T1)'
7ed1791 chore: retune agent models to OpenCode Go (T1)

$ git rev-parse HEAD
7ed179175bbb3cecc2e6a08fcc2d3844f1aa06e1
```

- T1 commit: `7ed179175bbb3cecc2e6a08fcc2d3844f1aa06e1` — matches the subject claim (`7ed1791`) and was `HEAD` at verification time (the T2 docs commit later landed on top of it).
- Pre-feature baseline recorded in `build-log-T1.md` § 0: `02228acbefac7eafe03ca4ef31e0ed7f743fbc9e` — used verbatim as the AC-6/AC-9 anchor (no relative refs).

```
$ git log --oneline 02228acbefac7eafe03ca4ef31e0ed7f743fbc9e..HEAD    # run before the T2 commit
7ed1791 chore: retune agent models to OpenCode Go (T1)
```

Only the T1 commit sat between the anchor and `HEAD` at verification time; no concurrent `cube-game-frontend` commit is interleaved on this range.

### 1. AC-1…AC-4 — exact-line presence (`grep -Fx`)

```
$ for f in orchestrator planner builder reviewer; do grep -Fx "<target>" .opencode/agents/$f.md; echo "rc=$?"; done
=== orchestrator ===
model: opencode-go/deepseek-v4.1-flash#low
rc=0
=== planner ===
model: opencode-go/deepseek-v4-pro#max
rc=0
=== builder ===
model: opencode-go/deepseek-v4.1-flash#high
rc=0
=== reviewer ===
model: opencode-go/qwen3.7-plus#max
rc=0
```

### 2. AC-1…AC-4 — uniqueness (`grep -c "^model:"`)

```
=== uniqueness: grep -c '^model:' ===
orchestrator  = 1
planner       = 1
builder       = 1
reviewer      = 1
=== also -Fx count (must be 1) ===
orchestrator 1
planner 1
builder 1
reviewer 1
```

### 3. AC-1…AC-4 — frontmatter parse + `model` equality (`python3` + `yaml.safe_load`)

```
$ python3 - <<'PY' ... yaml.safe_load(frontmatter); assert data["model"] == expected ... PY
OK  .opencode/agents/orchestrator.md: data['model']='opencode-go/deepseek-v4.1-flash#low' expected='opencode-go/deepseek-v4.1-flash#low' (frontmatter keys=6 includes permissions=True)
OK  .opencode/agents/planner.md: data['model']='opencode-go/deepseek-v4-pro#max' expected='opencode-go/deepseek-v4-pro#max' (frontmatter keys=6 includes permissions=True)
OK  .opencode/agents/builder.md: data['model']='opencode-go/deepseek-v4.1-flash#high' expected='opencode-go/deepseek-v4.1-flash#high' (frontmatter keys=6 includes permissions=True)
OK  .opencode/agents/reviewer.md: data['model']='opencode-go/qwen3.7-plus#max' expected='opencode-go/qwen3.7-plus#max' (frontmatter keys=6 includes permissions=True)
PARSE ALL OK
exit=0
```

All four frontmatters parse with 6 keys each and still contain the `permissions` block.

### 4. Committed state == verified state

```
$ for f in orchestrator planner builder reviewer; do
    a=$(git rev-parse 7ed1791:.opencode/agents/$f.md); b=$(git hash-object .opencode/agents/$f.md); ...
orchestrator.md        b208cf7da9ee58fd0ccea0091049a9918880dbf0  IDENTICAL
planner.md             2e455f222ee8796767fca11c650bad31b81ab710  IDENTICAL
builder.md             69bbb4030c977913da7292d3a692e9bc2cbb07b0  IDENTICAL
reviewer.md            cdbe1710905519b6894a630a80f4c9ecf01a5b62  IDENTICAL

$ git diff --stat HEAD -- .opencode/agents/
(empty; rc=0)
```

### 5. AC-5 — diff scope vs the T1 commit and vs the pre-feature ref

```
$ git show --stat --format='%H %s' 7ed1791 -- .opencode/agents/
7ed179175bbb3cecc2e6a08fcc2d3844f1aa06e1 chore: retune agent models to OpenCode Go (T1)

 .opencode/agents/builder.md      | 2 +-
 .opencode/agents/orchestrator.md | 2 +-
 .opencode/agents/planner.md      | 2 +-
 .opencode/agents/reviewer.md     | 2 +-
 4 files changed, 4 insertions(+), 4 deletions(-)

$ git diff --stat 02228acbefac7eafe03ca4ef31e0ed7f743fbc9e..HEAD -- .opencode/agents/
 .opencode/agents/builder.md      | 2 +-
 .opencode/agents/orchestrator.md | 2 +-
 .opencode/agents/planner.md      | 2 +-
 .opencode/agents/reviewer.md     | 2 +-
 4 files changed, 4 insertions(+), 4 deletions(-)

$ git show 7ed1791 --format='' -- .opencode/agents/ | grep -E '^[+-]' | grep -vE '^(---|\+\+\+)'
-model: opencode/deepseek-v4.1-flash-free#high
+model: opencode-go/deepseek-v4.1-flash#high
-model: opencode/deepseek-v4.1-flash-free#high
+model: opencode-go/deepseek-v4.1-flash#low
-model: opencode/deepseek-v4.1-flash-free#max
+model: opencode-go/deepseek-v4-pro#max
-model: opencode/glm-5.3-flash-free#max
+model: opencode-go/qwen3.7-plus#max
count=8
```

Re-run after the T2 commit landed: the `02228acb..HEAD` stat is identical (T2 touches no agent file).

Per-file check against the baselines recorded in `build-log-T1.md` § 0 (each removed line must equal the recorded baseline line exactly; exactly one `-` and one `+` per file; all other bytes identical; no CR):

```
[orchestrator] removed==recorded-baseline=PASS removed==file-line4-at-baseline=PASS exactly-one-minus=PASS exactly-one-plus=PASS plus-line-is-model=PASS all-other-bytes-identical=PASS no-CR=PASS sha_wo_model=2e18120ba5f6e407a9b1a3e4d897ef11413430759795416a47453430e69f2ed6
[planner] removed==recorded-baseline=PASS removed==file-line4-at-baseline=PASS exactly-one-minus=PASS exactly-one-plus=PASS plus-line-is-model=PASS all-other-bytes-identical=PASS no-CR=PASS sha_wo_model=2ec938438a6c351b29c271c6737d9cb0643d6d5b232f3aad079c37ff5787f869
[builder] removed==recorded-baseline=PASS removed==file-line4-at-baseline=PASS exactly-one-minus=PASS exactly-one-plus=PASS plus-line-is-model=PASS all-other-bytes-identical=PASS no-CR=PASS sha_wo_model=bab6cc5c40635dbfad4958ff539e05d26d093886f4736c89c3cdd1fe30106d40
[reviewer] removed==recorded-baseline=PASS removed==file-line4-at-baseline=PASS exactly-one-minus=PASS exactly-one-plus=PASS plus-line-is-model=PASS all-other-bytes-identical=PASS no-CR=PASS sha_wo_model=1949dfc1728f410a333ac53a5ef731ccab8d4a087ee6215434c0480153bde5a7
AC-5 BASELINE COMPARISON: ALL PASS
exit=0
```

The four `sha_wo_model` values equal the per-file stripped-line hashes recorded by T1 (`build-log-T1.md` § 6), so every byte other than the `model:` line — including both full `permissions:` blocks per file, `description`, `mode`, `color`, `steps`, and all prose — is identical between baseline and committed state.

### 6. AC-6 — completeness of model definitions in live configuration

Tracked-file search (configuration basis; `git grep` searches tracked files only):

```
$ git grep -n -E "^[[:space:]]*model[[:space:]]*[:=]" -- .
.opencode/agents/builder.md:4:model: opencode-go/deepseek-v4.1-flash#high
.opencode/agents/orchestrator.md:4:model: opencode-go/deepseek-v4.1-flash#low
.opencode/agents/planner.md:4:model: opencode-go/deepseek-v4-pro#max
.opencode/agents/reviewer.md:4:model: opencode-go/qwen3.7-plus#max
docs/features/containerized-workflow/build-log-T2.md:54:model: opencode/deepseek-v4.1-flash-free#max
docs/features/containerized-workflow/build-log-T4.md:76:model: opencode/glm-5.3-flash-free#max
docs/features/online-realtime-workflow/build-log-T3.md:113:model: opencode/deepseek-v4.1-flash-free#high
docs/features/online-realtime-workflow/build-log-T3.md:198:model: opencode/deepseek-v4.1-flash-free#max
docs/features/online-realtime-workflow/build-log-T4.md:78:model: opencode/deepseek-v4.1-flash-free#high
docs/features/online-realtime-workflow/build-log-T5.md:121:model: opencode/glm-5.3-flash-free#max
rc=0

tracked hits outside agent files + docs/features: 0
```

Four live definitions, all in `.opencode/agents/*.md`; the remaining six hits are five historical build logs (one log contains two) — run records, not configuration, exactly as spec § Current state & verification basis states.

Literal repo-wide search from the task brief, with the vendored-dependency hits accounted for:

```
$ grep -rn --exclude-dir=.git "^\s*model\s*[:=]" .
./.opencode/agents/builder.md:4:model: opencode-go/deepseek-v4.1-flash#high
./.opencode/agents/planner.md:4:model: opencode-go/deepseek-v4-pro#max
./.opencode/agents/orchestrator.md:4:model: opencode-go/deepseek-v4.1-flash#low
./.opencode/agents/reviewer.md:4:model: opencode-go/qwen3.7-plus#max
./docs/features/online-realtime-workflow/build-log-T3.md:113:model: opencode/deepseek-v4.1-flash-free#high
./docs/features/online-realtime-workflow/build-log-T3.md:198:model: opencode/deepseek-v4.1-flash-free#max
./docs/features/online-realtime-workflow/build-log-T4.md:78:model: opencode/deepseek-v4.1-flash-free#high
./docs/features/online-realtime-workflow/build-log-T5.md:121:model: opencode/glm-5.3-flash-free#max
./docs/features/containerized-workflow/build-log-T2.md:54:model: opencode/deepseek-v4.1-flash-free#max
./docs/features/containerized-workflow/build-log-T4.md:76:model: opencode/glm-5.3-flash-free#max
./node_modules/fastify/test/schema-serialization.test.js:572:      model: {
./node_modules/@types/node/os.d.ts:13:        model: string;
./node_modules/three/examples/jsm/loaders/3MFLoader.js:271:				model: modelParts,
./node_modules/three/examples/jsm/loaders/FBXLoader.js:1066:						model = this.createCamera( relationships );
... (17 further `three/examples/jsm/loaders/FBXLoader.js` lines: model = this.createLight/… )
rc=0

node_modules hits: 20 in 4 files
src/*/node_modules hits: 0
tracked node_modules files: 0
.gitignore:2 node_modules/
```

Interpretation (recorded, not hidden): the 20 `node_modules/` hits are third-party, gitignored, untracked dependency source — not repository configuration. No live configuration defines a model outside `.opencode/agents/*.md`.

Config files untouched by the feature:

```
$ git diff 02228acbefac7eafe03ca4ef31e0ed7f743fbc9e -- opencode.jsonc .opencode/commands/feature.md
(empty; rc=0)
$ git diff 02228acb -- opencode.jsonc | wc -l          -> 0
$ git diff 02228acb -- .opencode/commands/feature.md | wc -l -> 0
$ grep -n -i "model" opencode.jsonc .opencode/commands/feature.md
rc=1 (no match — no model reference in either file)
```

Also: `git grep -n -I -E '"model"|^\s*model\s*[:=]' -- '*.json' '*.jsonc' '*.yaml' '*.yml' '*.toml' '*.js' '*.ts' '*.cjs' '*.mjs'` → `rc=1` (no tracked non-Markdown config/source file defines a model key).

Post-write re-run (after this log was created): `git grep … | grep -vE '^(\.opencode/agents/|docs/features/)'` → `rc=1` (no hits outside the four agent files and `docs/features/`), and the literal search now additionally matches 4 lines in this log (§ 1's `grep -Fx` output) — the run record quoting its own evidence, under the same `docs/features/**` build-log carve-out as the five historical logs.

### 7. AC-7 — catalog cross-check (spec table + live re-query)

Files vs normative tables (spec § Model mapping, tasks.md § Change set) and against spec § Catalog basis:

```
agent         file model                               spec table                               tasks table                              price    variant
orchestrator  opencode-go/deepseek-v4.1-flash#low      opencode-go/deepseek-v4.1-flash#low      opencode-go/deepseek-v4.1-flash#low      0.15/0.6 True  (file==spec==tasks: True)
planner       opencode-go/deepseek-v4-pro#max          opencode-go/deepseek-v4-pro#max          opencode-go/deepseek-v4-pro#max          0.66/1.98 True  (file==spec==tasks: True)
builder       opencode-go/deepseek-v4.1-flash#high     opencode-go/deepseek-v4.1-flash#high     opencode-go/deepseek-v4.1-flash#high     0.15/0.6 True  (file==spec==tasks: True)
reviewer      opencode-go/qwen3.7-plus#max             opencode-go/qwen3.7-plus#max             opencode-go/qwen3.7-plus#max             0.4/1.6 True  (file==spec==tasks: True)
AC-7: MET
exit=0
```

Each target is well-formed `opencode-go/<model-id>#<variant>`; `low` ∈ deepseek-v4.1-flash {low, high, max}, `high` ∈ deepseek-v4.1-flash {low, high, max}, `max` ∈ deepseek-v4-pro {high, max}, `max` ∈ qwen3.7-plus {none, high, max}.

Live re-query (enrichment, not the AC basis) via the platform `models` tool, provider `opencode-go`, 2026-10-19:

```
total=23, returned=23
spec catalog rows=23  live rows=23
ids only in spec: NONE
ids only in live: NONE
mismatches: 0   (after normalizing the spec's "none" = no-effort-variant token to the live [] array; all such rows are non-chosen models)

chosen-target live comparison:
  opencode-go/deepseek-v4.1-flash: spec=(0.15, 0.6, ['low', 'high', 'max']) live=(0.15, 0.6, ['low', 'high', 'max']) exact-match=True
  opencode-go/deepseek-v4-pro: spec=(0.66, 1.98, ['high', 'max']) live=(0.66, 1.98, ['high', 'max']) exact-match=True
  opencode-go/qwen3.7-plus: spec=(0.4, 1.6, ['none', 'high', 'max']) live=(0.4, 1.6, ['none', 'high', 'max']) exact-match=True
```

All 23 models report `status: active`; no id/variant/price drift against the recorded catalog.

### 8. AC-8 — cost boundary

```
AC-8 chosen models: deepseek-v4-pro, deepseek-v4.1-flash, qwen3.7-plus
AC-8 excluded-list overlap: NONE
AC-8 chosen prices: deepseek-v4-pro=0.66/1.98, deepseek-v4.1-flash=0.15/0.6, qwen3.7-plus=0.4/1.6
AC-8 highest: deepseek-v4-pro=0.66/1.98
AC-8: MET
```

Exclusion list used (spec § Cost boundary): top-price `gemini-4-argon-contributor`, `kimi-k3`, `qwen3.8-max`, `grok-4.7`; above-ceiling `glm-5.3`, `step-5-preview`, `kimi-k2.7-code`, `hy4-preview`. Zero overlap. Highest chosen unit price is the planner's `0.66/1.98`, strictly below the nearest excluded model (`hy4-preview`, `0.834/2.501`).

### 9. AC-9 — scope discipline

```
$ git show --name-status --format='%H %s' 7ed1791
7ed179175bbb3cecc2e6a08fcc2d3844f1aa06e1 chore: retune agent models to OpenCode Go (T1)

M	.opencode/agents/builder.md
M	.opencode/agents/orchestrator.md
M	.opencode/agents/planner.md
M	.opencode/agents/reviewer.md
A	docs/features/agent-model-tuning/build-log-T1.md

$ git show --name-only --format='' 7ed1791 | grep -E '^(src/|tests/|package|compose|\.github|Dockerfile|.*Dockerfile|tsconfig|vitest|eslint|\.env)'
rc=1 (no application/test/config/container/CI path)

$ git show 7ed1791 --format='' -- .opencode/agents/ | grep -E '^[+-].*(permissions:|steps:|color:|description:|mode:|action:|effect:|resource:)'
rc=1 (no matches — no frontmatter key other than `model:` added or removed)

$ git show 7ed1791 --format='' -- .opencode/agents/ | grep -nE '^ permissions:'
13: permissions:
26: permissions:
39: permissions:
52: permissions:
```

The only `permissions:` occurrences inside the agent diff are **unchanged context lines** (leading space, neither `+` nor `-`). Naive whole-commit grep for the token also matches the T1 build log's own quoted diff and prose (`+ permissions:` inside fenced blocks) — an artifact of the log documenting the context, not a config change; the strong byte-identity check (§ 5) is the dispositive evidence. Whole-repo diff vs the pre-feature ref:

```
$ git diff --name-status 02228acbefac7eafe03ca4ef31e0ed7f743fbc9e..HEAD    # final state, after the T2 commit
M	.opencode/agents/builder.md
M	.opencode/agents/orchestrator.md
M	.opencode/agents/planner.md
M	.opencode/agents/reviewer.md
A	docs/features/agent-model-tuning/build-log-T1.md
A	docs/features/agent-model-tuning/build-log-T2.md
```

Exactly the four agent files + the two feature-dir build-log artifacts. The T2 commit adds only `docs/features/agent-model-tuning/build-log-T2.md` (see § 10).

### 10. Commit

Command (explicit path only; never `git add .` / `git add -A`):

```
git add docs/features/agent-model-tuning/build-log-T2.md
git commit -m "docs: agent-model-tuning T2 verification evidence"
```

Staged path (exactly the T2 `files_owned` set):

```
docs/features/agent-model-tuning/build-log-T2.md
```

Commit evidence — sha-free `--format=%s` (house precedent: `build-log-T1.md` § 9, since this log is part of its own commit):

```
$ git show --name-only --format=%s HEAD
docs: agent-model-tuning T2 verification evidence

docs/features/agent-model-tuning/build-log-T2.md
```

Re-run after the commit landed: output identical (single file: `docs/features/agent-model-tuning/build-log-T2.md`; commit identified by its subject `docs: agent-model-tuning T2 verification evidence`; sha-free format per house precedent to avoid a self-referential hash, and no line count cited for the same reason).

## Acceptance evidence table

| AC | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| AC-1 | orchestrator: unique `^model:` line = `model: opencode-go/deepseek-v4.1-flash#low`; frontmatter parses, `model` equal | **met** | § 1 rc=0; § 2 count=1; § 3 `data['model']='opencode-go/deepseek-v4.1-flash#low'` |
| AC-2 | planner: unique `^model:` line = `model: opencode-go/deepseek-v4-pro#max`; frontmatter parses, `model` equal | **met** | § 1 rc=0; § 2 count=1; § 3 `data['model']='opencode-go/deepseek-v4-pro#max'` |
| AC-3 | builder: unique `^model:` line = `model: opencode-go/deepseek-v4.1-flash#high`; frontmatter parses, `model` equal | **met** | § 1 rc=0; § 2 count=1; § 3 `data['model']='opencode-go/deepseek-v4.1-flash#high'` |
| AC-4 | reviewer: unique `^model:` line = `model: opencode-go/qwen3.7-plus#max`; frontmatter parses, `model` equal | **met** | § 1 rc=0; § 2 count=1; § 3 `data['model']='opencode-go/qwen3.7-plus#max'` |
| AC-5 | Diff vs recorded baseline = exactly one removed + one added `model:` line per file; all other bytes identical; stat = `4 files changed, 4 insertions(+), 4 deletions(-)` | **met** | § 5 stat identical for `git show 7ed1791` and `git diff 02228acb..HEAD`; 8 content `+`/`-` lines all `model:`; per-file removed line == `build-log-T1.md` baseline; stripped-model SHA-256 identical ×4; 0 CR |
| AC-6 | Only the four agent files define models in live config; historical `docs/features/**` logs are records; `opencode.jsonc` unchanged and no model key; `feature.md` no model ref | **met** | § 6 tracked search: 4 agent + 5 historical logs, 0 live hits outside; `opencode.jsonc`/`feature.md` diff vs `02228acb` empty (0 lines), grep no model, non-Markdown config search rc=1; literal repo grep's only extra hits are 20 gitignored `node_modules` lines (untracked dependency code) |
| AC-7 | Targets byte-for-byte equal to spec normative table and tasks change set; well-formed `opencode-go/<id>#<variant>`; variant valid per § Catalog basis | **met** | § 7 file==spec==tasks True ×4; variant validity True ×4; live re-query 23/23 rows match, chosen targets exact-match |
| AC-8 | No chosen target in exclusion list; no chosen price > 0.66/1.98 | **met** | § 8 overlap NONE; highest `deepseek-v4-pro=0.66/1.98` |
| AC-9 | Feature commits only touch four agent files + `docs/features/agent-model-tuning/**`; no `permissions:`/`steps`/`color`/`description`/`mode` changes; no app/test/config/container/CI file | **met** | § 9 T1 `--name-status` = 4 `M` agent files + 1 `A` feature-dir log; T2 = 1 `A` feature-dir log; app-path grep rc=1; scoped frontmatter-key diff grep rc=1; whole-repo diff vs `02228acb` = those 6 paths only; context-only `permissions:` occurrences documented |

## Acceptance audit

- **AC-1** → met. Exactly one `^model:` line; full content equals the target (grep -Fx rc=0, count 1); YAML `model` = `opencode-go/deepseek-v4.1-flash#low`.
- **AC-2** → met. Exactly one `^model:` line; `model: opencode-go/deepseek-v4-pro#max`; YAML equality confirmed.
- **AC-3** → met. Exactly one `^model:` line; `model: opencode-go/deepseek-v4.1-flash#high`; YAML equality confirmed.
- **AC-4** → met. Exactly one `^model:` line; `model: opencode-go/qwen3.7-plus#max`; YAML equality confirmed.
- **AC-5** → met. `4 files changed, 4 insertions(+), 4 deletions(-)`; all eight content lines are `model:` pairs; each removed line equals the T1-recorded baseline; all other bytes identical per stripped-line SHA-256; 0 CR bytes.
- **AC-6** → met. Tracked-file search finds only the four agent definitions plus five historical build logs; `opencode.jsonc` and `.opencode/commands/feature.md` byte-identical to `02228acb` and model-free; untracked `node_modules` hits are dependency code, not configuration.
- **AC-7** → met. File values equal spec and tasks tables byte-for-byte; ids/variants valid per spec § Catalog basis and per live re-query (exact 23/23 match).
- **AC-8** → met. No excluded model chosen; ceiling `0.66/1.98` holds (planner).
- **AC-9** → met. Feature commits contain only the four agent files + feature-dir docs; no frontmatter key other than `model:` appears as an added/removed line; no app/test/config/container/CI path.

## Deviations from spec

None. No AC failed; no drift found. Two evidence clarifications recorded (not deviations, both consistent with the spec's own carve-outs):

1. The literal `grep -rn … .` includes 20 untracked, gitignored `node_modules/` lines (vendored dependency source); spec § Current state & change surface describes the *configuration* result, which `git grep` over tracked files confirms exactly.
2. A whole-commit grep for the token `permissions:` hits unchanged context lines in the agent hunks and T1's build log's quoted diff/prose; no `permissions:` line is added or removed anywhere, proven by the scoped diff grep and byte-identity hashes.

## Coverage

`npm run coverage` not run and not claimed — N/A by design (`spec.md` § Testing strategy; `tasks.md` verification note). This feature changes no application/test source; the change surface is four YAML scalars in agent configs outside all workspaces.
