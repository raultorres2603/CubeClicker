# Build log — T0 — Permission bootstrap: builder `edit` allow entries

Task: T0 (2026-10-17) — `[seq]` chore, user-approved at the stack-selection checkpoint (status.md: `awaiting_approval → building`).
Files changed: `.opencode/agents/builder.md`, `docs/features/stack-selection/build-log-T0.md` (this file, new).
What changed & why: added exactly six `edit` `allow` entries (`README.md`, `.gitignore`, `.dockerignore`, `package-lock.json`, `compose.yaml`, `compose.smoke.yaml`) to the builder agent's `permissions:` list, inserted immediately after the existing `resource: "index.html"` allow block, in the pinned order, via an anchored, idempotent `python3` heredoc (shell write — the `edit` tool cannot open the new root paths until this commit lands; plan.md § Pinned content contracts 14). No deny entry and no other permission content changed (AC-33). T0 is the only sanctioned permission change anywhere in this feature.

Sketch (≤5 lines): capture `builder.md` baseline from `HEAD` (clean tree ⇒ build start == `HEAD`); run the anchored heredoc from the repo root on branch `feat/stack-selection`; re-run for idempotency (byte-identical, no-op); verify with the six anchor greps + `python3`/`yaml.safe_load` structural assertion; stage only the two `files_owned` paths and commit.

Decisions:
- Branch/start point: session confirmed on `main` at tip `5d47786fd10221e168f1d57990479c91781920b0`; `feat/stack-selection` did **not** exist, so it was created from exactly that tip and checked out (§ 0). Verification ran on the feature branch, and the T0 commit lands on it (tasks.md: the permission widen reaches `main` only via the explicit post-acceptance merge).
- Applied with the shell path (pre-existing `shell: *` allow), per tasks.md T0 / plan § 14 / D-15; the driver is a quoted heredoc so the script text is byte-stable across runs.
- Insert position: after the `index.html` allow block, before the `AGENTS.md` allow block — anchor-matched on the exact three-line block, never index/line-number based.
- Idempotency guard: the addition block's exact bytes must already sit immediately after the anchor → clean no-op exit 0 (no write, file byte-identical).
- Anchor-absent path: hard exit 3 with a stderr message and no write — verified on a fixture copy (§ 5; no repo file touched).
- Baseline captured from `HEAD` (working tree was clean for this path at build start, so `HEAD` == build-start content; `diff` confirmation in § 1).

Commit staging: only `files_owned` paths were staged (explicit `git add`); no `git add .` / `git add -A`; no push.

---

## 0. Build start — branch and start point

```
$ git branch --show-current
main
$ git rev-parse HEAD
5d47786fd10221e168f1d57990479c91781920b0
$ git show-ref --verify --quiet refs/heads/feat/stack-selection && echo YES || echo NO
NO
$ git switch -c feat/stack-selection
Switched to a new branch 'feat/stack-selection'
$ git branch --show-current
feat/stack-selection
$ git rev-parse HEAD
5d47786fd10221e168f1d57990479c91781920b0
$ git show-ref --heads
  5d47786fd10221e168f1d57990479c91781920b0 refs/heads/feat/project-glossary
  5d47786fd10221e168f1d57990479c91781920b0 refs/heads/feat/stack-selection
  5d47786fd10221e168f1d57990479c91781920b0 refs/heads/main
```

The target branch did not exist at build start (a pre-existing `feat/stack-selection` was the stop condition — not triggered). Branch created from the recorded `main` tip; no push performed at any point.

---

## 1. Baseline capture (build start)

Capture command:

```
git show HEAD:.opencode/agents/builder.md > /tmp/opencode/stack-t0/baseline-builder.md
sha256sum /tmp/opencode/stack-t0/baseline-builder.md
wc -c -l /tmp/opencode/stack-t0/baseline-builder.md
diff -u /tmp/opencode/stack-t0/baseline-builder.md .opencode/agents/builder.md   # confirm build-start working tree == HEAD
```

Raw output:

```
23609a015a68535cbd03d3c419265d796303dc950dfcc0ab0be108a764a92c80  /tmp/opencode/stack-t0/baseline-builder.md
 103 3782 /tmp/opencode/stack-t0/baseline-builder.md
IDENTICAL (working tree == HEAD baseline)
```

`docs/features/stack-selection/build-log-T0.md` did not exist before this task (`ABSENT (new file for T0)`) — its baseline is "no file".

Baseline excerpt (the region T0 touches — baseline lines 7–52; `git show HEAD:.opencode/agents/builder.md`):

```yaml
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: edit
    resource: "src/**"
    effect: allow
  - action: edit
    resource: "tests/**"
    effect: allow
  - action: edit
    resource: "public/**"
    effect: allow
  - action: edit
    resource: "docs/features/**/build-log*.md"
    effect: allow
  - action: edit
    resource: "package.json"
    effect: allow
  - action: edit
    resource: "tsconfig.json"
    effect: allow
  - action: edit
    resource: "*.config.*"
    effect: allow
  - action: edit
    resource: "index.html"
    effect: allow
  - action: edit
    resource: "AGENTS.md"
    effect: allow
  - action: edit
    resource: "docs/architecture/**"
    effect: allow
  - action: edit
    resource: "docs/product/**"
    effect: allow
  - action: edit
    resource: ".opencode/agents/*.md"
    effect: allow
  - action: edit
    resource: ".opencode/skills/**"
    effect: allow
  - action: edit
    resource: ".env*"
    effect: deny
```

Baseline remainder (lines 53–103: `shell`/`subagent`/`question`/`skill` permissions and all prose) is untouched by T0 — see the diff in § 6, which shows a single pure insertion of 18 lines inside the `edit` block.

Whole-file baseline sha256 = `23609a015a68535cbd03d3c419265d796303dc950dfcc0ab0be108a764a92c80` (103 lines, 3782 bytes) — recoverable as `git show HEAD:.opencode/agents/builder.md` at the parent of T0's commit.

Baseline deny entries: 10 (`effect: deny` at lines 10, 52, 58, 61, 64, 67, 70, 73, 76, 79). Baseline `effect: allow` entries: 15.

---

## 2. Bootstrap heredoc — driver

Driver file `/tmp/opencode/stack-t0/run-bootstrap.sh` (sha256 `5da6d32d56e178efcfc715ff2c195c68eccc75c436880cbadd8332c68372b99d`), run from the repo root:

```bash
#!/usr/bin/env bash
# T0 bootstrap driver — anchored, idempotent. Run from repo root.
set -euo pipefail
python3 - .opencode/agents/builder.md <<'PY'
import sys

TARGET = sys.argv[1]
ANCHOR = '    resource: "index.html"\n    effect: allow\n'
ENTRIES = ["README.md", ".gitignore", ".dockerignore", "package-lock.json",
           "compose.yaml", "compose.smoke.yaml"]

with open(TARGET, encoding="utf-8") as fh:
    text = fh.read()

i = text.find(ANCHOR)
if i == -1:
    print("ANCHOR ABSENT - aborting", file=sys.stderr)
    sys.exit(3)

j = i + len(ANCHOR)
addition = "".join(
    '  - action: edit\n    resource: "%s"\n    effect: allow\n' % e for e in ENTRIES
)

# idempotent no-op: the six entries already sit immediately after the anchor block
if text[j:j + len(addition)] == addition:
    print("already bootstrapped - no-op")
    sys.exit(0)

with open(TARGET, "w", encoding="utf-8") as fh:
    fh.write(text[:j] + addition + text[j:])
print("inserted 6 entries after index.html allow block")
PY
```

## 2a. Heredoc run #1 (first application)

```
$ bash /tmp/opencode/stack-t0/run-bootstrap.sh
inserted 6 entries after index.html allow block
exit=0

$ sha256sum .opencode/agents/builder.md
d6c55de5d77891346b620d00945aebf1049763c704b4d31fd4970a1952535b18  .opencode/agents/builder.md

$ wc -c -l .opencode/agents/builder.md
 121 4173 .opencode/agents/builder.md
```

## 2b. Heredoc run #2 (idempotency)

```
$ bash /tmp/opencode/stack-t0/run-bootstrap.sh
already bootstrapped - no-op
exit=0

$ sha256sum .opencode/agents/builder.md
d6c55de5d77891346b620d00945aebf1049763c704b4d31fd4970a1952535b18  .opencode/agents/builder.md

$ wc -c -l .opencode/agents/builder.md
 121 4173 .opencode/agents/builder.md

$ cmp /tmp/opencode/stack-t0/after-run1.md .opencode/agents/builder.md
BYTE-IDENTICAL (run #2 was a no-op)
```

Idempotency result: **byte-identical** — run #1 sha256 `d6c55de5d77891346b620d00945aebf1049763c704b4d31fd4970a1952535b18` == run #2 sha256 `d6c55de5d77891346b620d00945aebf1049763c704b4d31fd4970a1952535b18`; run #2 took the no-op branch (exit 0, no write); `cmp` against a copy of the run-#1 result is byte-equal. Size is 121 lines / 4173 bytes after both runs (baseline 103 lines / 3782 bytes → +18 lines / +391 bytes = the six 3-line entries).

---

## 3. Anchor grep — six entries present

Command:

```
grep -n 'resource: "README.md"\|resource: "\.gitignore"\|resource: "\.dockerignore"\|resource: "package-lock.json"\|resource: "compose.yaml"\|resource: "compose.smoke.yaml"' .opencode/agents/builder.md
```

Output (exit 0):

```
36:    resource: "README.md"
39:    resource: ".gitignore"
42:    resource: ".dockerignore"
45:    resource: "package-lock.json"
48:    resource: "compose.yaml"
51:    resource: "compose.smoke.yaml"
```

Six anchors present, in the pinned order, immediately after the `index.html` allow block (lines 32–34) and before the `AGENTS.md` allow block (line 54):

```yaml
  - action: edit
    resource: "index.html"
    effect: allow
  - action: edit
    resource: "README.md"
    effect: allow
  - action: edit
    resource: ".gitignore"
    effect: allow
  - action: edit
    resource: ".dockerignore"
    effect: allow
  - action: edit
    resource: "package-lock.json"
    effect: allow
  - action: edit
    resource: "compose.yaml"
    effect: allow
  - action: edit
    resource: "compose.smoke.yaml"
    effect: allow
  - action: edit
    resource: "AGENTS.md"
    effect: allow
```

---

## 4. Structural assertion (`python3` + `yaml.safe_load`)

Command (helper `/tmp/opencode/stack-t0/assert-frontmatter.py`, run against `.opencode/agents/builder.md` after the bootstrap): split the `---` frontmatter, `yaml.safe_load` it, and assert every `permissions:` item has `action`, `resource`, `effect`.

Output (exit 0):

```
frontmatter parsed OK; top-level keys: ['color', 'description', 'mode', 'model', 'permissions', 'steps']
permissions item count: 31
  [00] edit             *                                  deny
  [01] edit             src/**                             allow
  [02] edit             tests/**                           allow
  [03] edit             public/**                          allow
  [04] edit             docs/features/**/build-log*.md     allow
  [05] edit             package.json                       allow
  [06] edit             tsconfig.json                      allow
  [07] edit             *.config.*                         allow
  [08] edit             index.html                         allow
  [09] edit             README.md                          allow
  [10] edit             .gitignore                         allow
  [11] edit             .dockerignore                      allow
  [12] edit             package-lock.json                  allow
  [13] edit             compose.yaml                       allow
  [14] edit             compose.smoke.yaml                 allow
  [15] edit             AGENTS.md                          allow
  [16] edit             docs/architecture/**               allow
  [17] edit             docs/product/**                    allow
  [18] edit             .opencode/agents/*.md              allow
  [19] edit             .opencode/skills/**                allow
  [20] edit             .env*                              deny
  [21] shell            *                                  allow
  [22] shell            git push *                         deny
  [23] shell            sudo *                             deny
  [24] shell            rm -rf *                           deny
  [25] shell            curl *                             deny
  [26] shell            wget *                             deny
  [27] subagent           *                                  deny
  [28] question           *                                  deny
  [29] skill              *                                  deny
  [30] skill              web-implementation                 allow
items missing action/resource/effect: 0
STRUCTURAL ASSERTION: PASS (frontmatter parses; all 31 permission items have action+resource+effect)
```

Item count: **31** (25 baseline + 6 added). Items missing `action`/`resource`/`effect`: **0**. Entries [09]–[14] are exactly the six pinned additions; [00]–[08] and [15]–[30] are the baseline entries verbatim.

---

## 5. Anchor-absent abort path (non-zero, no write)

Extra safety evidence (no repo files touched; fixture in `/tmp/opencode/stack-t0/`): the same python body was run against a baseline copy with the `index.html` anchor line removed.

```
fixture anchored-removed check: OK
-- fixture sha before: a268182bceba813268d8ba9b956437bae928ef707a315ef5f6c3a1ebc325ddf8

$ python3 /tmp/opencode/stack-t0/body.py /tmp/opencode/stack-t0/noanchor.md
ANCHOR ABSENT - aborting
exit=3  (expected non-zero: 3)

-- fixture sha after (unchanged): a268182bceba813268d8ba9b956437bae928ef707a315ef5f6c3a1ebc325ddf8
```

Non-zero abort confirmed (exit 3, stderr message) and the target file was not modified (sha unchanged).

---

## 6. Commit diff — only the six entries added

Diff vs. the build-start baseline (§ 1), i.e. the T0 change in its entirety:

```diff
--- /tmp/opencode/stack-t0/baseline-builder.md	2026-10-17 13:14:35.695782549 +0200
+++ .opencode/agents/builder.md	2026-10-17 13:14:52.220321456 +0200
@@ -33,6 +33,24 @@
     resource: "index.html"
     effect: allow
   - action: edit
+    resource: "README.md"
+    effect: allow
+  - action: edit
+    resource: ".gitignore"
+    effect: allow
+  - action: edit
+    resource: ".dockerignore"
+    effect: allow
+  - action: edit
+    resource: "package-lock.json"
+    effect: allow
+  - action: edit
+    resource: "compose.yaml"
+    effect: allow
+  - action: edit
+    resource: "compose.smoke.yaml"
+    effect: allow
+  - action: edit
     resource: "AGENTS.md"
     effect: allow
   - action: edit
```

`git diff --stat -- .opencode/agents/builder.md`:

```
 .opencode/agents/builder.md | 18 ++++++++++++++++++
 1 file changed, 18 insertions(+)
```

Deny entries unchanged — 10 `effect: deny` items in both baseline and result, and the deny **resource set** is byte-identical (only line numbers shift, by +18):

```
DENY RESOURCE SET BYTE-IDENTICAL (10 items; only line numbers shifted)
    resource: "*"
    resource: ".env*"
    resource: "git push *"
    resource: "sudo *"
    resource: "rm -rf *"
    resource: "curl *"
    resource: "wget *"
    resource: "*"
    resource: "*"
    resource: "*"
```

`effect: allow` count: baseline 15 → after 21 (+6). Only the six `allow` entries were added; no deny entry, no other permission content, and no prose was touched.

---

## 7. Post-commit confirmation — `git show HEAD -- .opencode/agents/builder.md`

Command and raw output captured after the commit. The commit header (`commit <sha>` / `Author` / `Date` / message line) is omitted: embedding the commit's own hash inside the commit is self-referential; the hunk body — the substance — is reproduced verbatim.

```
$ git show HEAD -- .opencode/agents/builder.md
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index d32f962..5567fcd 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -32,6 +32,24 @@ permissions:
   - action: edit
     resource: "index.html"
     effect: allow
+  - action: edit
+    resource: "README.md"
+    effect: allow
+  - action: edit
+    resource: ".gitignore"
+    effect: allow
+  - action: edit
+    resource: ".dockerignore"
+    effect: allow
+  - action: edit
+    resource: "package-lock.json"
+    effect: allow
+  - action: edit
+    resource: "compose.yaml"
+    effect: allow
+  - action: edit
+    resource: "compose.smoke.yaml"
+    effect: allow
   - action: edit
     resource: "AGENTS.md"
     effect: allow
```

The diff is a single pure insertion of six 3-line `edit` `allow` entries inside the `permissions:` block — 18 insertions, 0 deletions (`git diff --stat` in § 6); no deny entry, no other permission content, no prose.

Identity check — the post-commit `git show` diff body is byte-identical to the pre-commit staged diff recorded in § 6:

```
$ git show HEAD -- .opencode/agents/builder.md > show.out
$ sed -n '/^diff --git /,$p' show.out > show-body.diff
$ sha256sum staged.diff show-body.diff
76ed16743000ed91db6530061ab7688c7ba56f60451c031ac372b75428025a9e  staged.diff
76ed16743000ed91db6530061ab7688c7ba56f60451c031ac372b75428025a9e  show-body.diff
$ diff -u staged.diff show-body.diff
IDENTICAL (diff bodies match)
```

Commit file list — exactly the two `files_owned` paths:

```
$ git show --name-only --format=%s HEAD
chore: widen builder edit permissions for stack-selection (T0)

.opencode/agents/builder.md
docs/features/stack-selection/build-log-T0.md
```

Committed `builder.md` content == the working-tree post-bootstrap file (content-addressed hashes, stable across amends):

```
$ git rev-parse HEAD:.opencode/agents/builder.md
5567fcd3a441a0b5670174de22b2d14752232c4d
$ git hash-object .opencode/agents/builder.md
5567fcd3a441a0b5670174de22b2d14752232c4d
```

Anchors and allow/deny counts re-checked against the committed blob:

```
$ git show HEAD:.opencode/agents/builder.md | grep -c 'effect: allow'
21
$ git show HEAD:.opencode/agents/builder.md | grep -c 'effect: deny'
10
$ git show HEAD:.opencode/agents/builder.md | grep -n 'resource: "README.md"\|resource: "\.gitignore"\|resource: "\.dockerignore"\|resource: "package-lock.json"\|resource: "compose.yaml"\|resource: "compose.smoke.yaml"'
36:    resource: "README.md"
39:    resource: ".gitignore"
42:    resource: ".dockerignore"
45:    resource: "package-lock.json"
48:    resource: "compose.yaml"
51:    resource: "compose.smoke.yaml"
```

Branch state after the commit (the commit was amended exactly once, to embed this § 7 evidence in the same single T0 commit; the commit sha is omitted as self-referential, the content-addressed blob hashes above are amend-stable):

```
$ git status --short --branch
## feat/stack-selection
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md
$ git log --oneline main..HEAD
<sha> chore: widen builder edit permissions for stack-selection (T0)
$ git status --short -- .env\*
(no output — 0 matches)
```

No `.env*` path appears in `git status`. Nothing was pushed — `git push` is deny-listed and was never invoked; `feat/stack-selection` exists only locally.

---

## 8. Staging discipline

`git add` was called with explicit paths only (`.opencode/agents/builder.md`, `docs/features/stack-selection/build-log-T0.md`); no `git add .` / `git add -A`. Pre-existing working-tree state outside T0's scope — the `docs/features/README.md` and `docs/features/project-glossary/status.md` modifications, and the untracked `docs/features/stack-selection/{spec,plan,tasks,status}.md` + `reviews/` — remains unstaged and uncommitted by this task (handled elsewhere). `git diff --cached --name-only` before the commit listed exactly the two `files_owned` paths.

---

## Acceptance audit

- **AC-33** — met (for T0's scope). T0 is the only permission change: this commit adds exactly the six pinned `edit` `allow` entries (`README.md`, `.gitignore`, `.dockerignore`, `package-lock.json`, `compose.yaml`, `compose.smoke.yaml`) after the `index.html` allow block and changes no other permission content (evidence: § 4 listing [09]–[14]; § 6 diff = 18 insertions, 0 deletions; deny resource set unchanged; § 3 anchor order). No `.env*` file touched (`git status --short`, § 8); no push; no provider selection or CI/deployment config added. The aggregate change set of this commit is exactly the file inventory's T0 row + this build log. Later commits' permission content is checked at T2/T7; T0 performs no other permission edit.
- No content AC applies to T0 (chore task; tasks.md T0 `acceptance: AC-33`).
- No automatic tests: T0 is a framework/permission chore outside the application stack; verification is by inspection (`grep`, `diff`, `git show`, `git status`) plus `python3` build-time aids, exactly as spec.md § Scope and AC-33 require.

## Deviations from spec

None in content or scope.

Notes (not deviations):
- The commit lands on `feat/stack-selection` (created at build start from the recorded `main` tip `5d47786…`), per tasks.md § Branch. No push.
- `python3` was used strictly as a build-time aid (heredoc application + YAML structural assertion) — no library/framework/runtime/tooling is introduced or chosen for the project.
- Untracked/modified state outside T0's scope (`docs/features/README.md` modification, `docs/features/project-glossary/status.md` modification) was deliberately left unstaged — see § 8.
