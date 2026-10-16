# Build log — T0 — Permission bootstrap: builder `edit` allow entries

Task: T0 (2026-10-16) — `[seq]` chore, user-authorized by the 2026-10-16 directive (spec.md Q-1, resolved r3).
Files changed: `.opencode/agents/builder.md`, `docs/features/online-realtime-workflow/build-log-T0.md` (this file).
What changed & why: added exactly five `edit` `allow` entries (`AGENTS.md`, `docs/architecture/**`, `docs/product/**`, `.opencode/agents/*.md`, `.opencode/skills/**`) to the builder agent's `permissions:` list, inserted immediately after the existing `resource: "index.html"` allow block, via an anchored, idempotent `python3` heredoc (shell write — the `edit` tool cannot open `.opencode/**` until this commit lands). No deny entry and no other permission content changed (AC-24). T0 is the only sanctioned permission change anywhere in this feature.

Decisions:
- Applied with the shell path (pre-existing `shell: *` allow), per tasks.md T0 / plan D-9; the reproduce-able driver is a quoted heredoc so the script text is byte-stable across runs.
- Insert position: after the `index.html` allow block, before the `.env*` deny block — anchor-anchored, never index/line-number based.
- Idempotency guard: presence of the `resource: "AGENTS.md"` entry followed by `effect: allow` → clean no-op exit 0 (no write, file byte-identical).
- Anchor-absent path: hard exit 3 with a stderr message and no write — verified on a fixture copy (§ 5).
- Baseline captured from `HEAD` (working tree was clean at build start, so `HEAD` == build-start content).

Commit staging: only `files_owned` paths were staged (explicit `git add`); no `git add .` / `git add -A`; no push.

---

## 1. Baseline capture (build start)

Capture command:

```
git show HEAD:.opencode/agents/builder.md > /tmp/opencode/t0/baseline-builder.md
sha256sum /tmp/opencode/t0/baseline-builder.md
wc -c -l /tmp/opencode/t0/baseline-builder.md
diff -u /tmp/opencode/t0/baseline-builder.md .opencode/agents/builder.md   # confirm build-start working tree == HEAD
```

Raw output:

```
1c5d222e8b1982784737917180df702ab3eca130f8d971417375174ddf99a5a3  /tmp/opencode/t0/baseline-builder.md
  86 2741 /tmp/opencode/t0/baseline-builder.md
IDENTICAL (working tree == HEAD baseline)
```

Baseline excerpt (the region T0 touches — baseline lines 7–37; `git show HEAD:.opencode/agents/builder.md`):

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
    resource: ".env*"
    effect: deny
```

Baseline remainder (lines 38–86: `shell`/`subagent`/`question`/`skill` permissions and all prose) is untouched by T0 — see the commit diff in § 6, which shows a single pure insertion of 15 lines inside the `edit` block. Full baseline is pinned by sha256 `1c5d222e8b1982784737917180df702ab3eca130f8d971417375174ddf99a5a3` (86 lines, 2741 bytes) and is recoverable as `git show HEAD:.opencode/agents/builder.md` at the parent of T0's commit.

Whole-file baseline sha256 = `1c5d222e8b1982784737917180df702ab3eca130f8d971417375174ddf99a5a3`.

---

## 2. Bootstrap heredoc — driver

Driver file `/tmp/opencode/t0/run-bootstrap.sh` (sha256 `c178282ec62b1d1e97372ab51ebb6c07e43d983bb8588f39b116237b373086db`), run from the repo root:

```bash
#!/usr/bin/env bash
# T0 bootstrap driver — anchored, idempotent. Run from repo root.
set -euo pipefail
python3 - .opencode/agents/builder.md <<'PY'
import sys

TARGET = sys.argv[1]
ANCHOR = '    resource: "index.html"\n    effect: allow\n'
ENTRIES = ["AGENTS.md", "docs/architecture/**", "docs/product/**",
           ".opencode/agents/*.md", ".opencode/skills/**"]

with open(TARGET, encoding="utf-8") as fh:
    text = fh.read()

# idempotent no-op: the five entries are already present after the anchor entry
marker = '    resource: "%s"' % ENTRIES[0]
if marker in text and text.split(marker, 1)[1].startswith('\n    effect: allow'):
    print("already bootstrapped - no-op")
    sys.exit(0)

i = text.find(ANCHOR)
if i == -1:
    print("ANCHOR ABSENT - aborting", file=sys.stderr)
    sys.exit(3)

j = i + len(ANCHOR)
addition = "".join(
    '  - action: edit\n    resource: "%s"\n    effect: allow\n' % e for e in ENTRIES
)
with open(TARGET, "w", encoding="utf-8") as fh:
    fh.write(text[:j] + addition + text[j:])
print("inserted 5 entries after index.html allow block")
PY
```

## 2a. Heredoc run #1 (first application)

```
$ bash /tmp/opencode/t0/run-bootstrap.sh
inserted 5 entries after index.html allow block
exit=0

$ sha256sum .opencode/agents/builder.md
7eb8a152d4086cf3bdb42a7c26493f789ca32a690d4e0cb973f02413f9f9bcf4  .opencode/agents/builder.md

$ wc -c -l .opencode/agents/builder.md
 101 3085 .opencode/agents/builder.md
```

## 2b. Heredoc run #2 (idempotency)

```
$ bash /tmp/opencode/t0/run-bootstrap.sh
already bootstrapped - no-op
exit=0

$ sha256sum .opencode/agents/builder.md
7eb8a152d4086cf3bdb42a7c26493f789ca32a690d4e0cb973f02413f9f9bcf4  .opencode/agents/builder.md

$ wc -c -l .opencode/agents/builder.md
 101 3085 .opencode/agents/builder.md
```

Idempotency result: **byte-identical** — run #1 sha256 `7eb8a152d4086cf3bdb42a7c26493f789ca32a690d4e0cb973f02413f9f9bcf4` == run #2 sha256 `7eb8a152d4086cf3bdb42a7c26493f789ca32a690d4e0cb973f02413f9f9bcf4`; run #2 wrote nothing (no-op branch, exit 0); size is 101 lines / 3085 bytes after both runs (baseline 86 lines / 2741 bytes → +15 lines / +344 bytes = the five 3-line entries).

---

## 3. Anchor grep — five entries present

Command:

```
grep -n 'resource: "AGENTS.md"\|resource: "docs/architecture/\*\*"\|resource: "docs/product/\*\*"\|resource: "\.opencode/agents/\*\.md"\|resource: "\.opencode/skills/\*\*"' .opencode/agents/builder.md
```

Output (exit 0):

```
36:    resource: "AGENTS.md"
39:    resource: "docs/architecture/**"
42:    resource: "docs/product/**"
45:    resource: ".opencode/agents/*.md"
48:    resource: ".opencode/skills/**"
```

Five anchors present, in the pinned order.

---

## 4. Structural assertion (`python3` + `yaml.safe_load`)

Command (run against `.opencode/agents/builder.md` after the bootstrap):

```python
python3 - <<'PY'
import sys, yaml
p = ".opencode/agents/builder.md"
text = open(p, encoding="utf-8").read()
assert text.startswith("---\n"), "no frontmatter opener"
end = text.index("\n---\n", 3)
data = yaml.safe_load(text[4:end+1])
items = data["permissions"]
required = {"action", "resource", "effect"}
missing = [(i, it) for i, it in enumerate(items) if not required <= set(it)]
...
PY
```

Output (exit 0):

```
frontmatter parsed OK; top-level keys: ['color', 'description', 'mode', 'model', 'permissions', 'steps']
permissions item count: 25
  [00] edit               *                                  deny
  [01] edit               src/**                             allow
  [02] edit               tests/**                           allow
  [03] edit               public/**                          allow
  [04] edit               docs/features/**/build-log*.md     allow
  [05] edit               package.json                       allow
  [06] edit               tsconfig.json                      allow
  [07] edit               *.config.*                         allow
  [08] edit               index.html                         allow
  [09] edit               AGENTS.md                          allow
  [10] edit               docs/architecture/**               allow
  [11] edit               docs/product/**                    allow
  [12] edit               .opencode/agents/*.md              allow
  [13] edit               .opencode/skills/**                allow
  [14] edit               .env*                              deny
  [15] shell              *                                  allow
  [16] shell              git push *                         deny
  [17] shell              sudo *                             deny
  [18] shell              rm -rf *                           deny
  [19] shell              curl *                             deny
  [20] shell              wget *                             deny
  [21] subagent           *                                  deny
  [22] question           *                                  deny
  [23] skill              *                                  deny
  [24] skill              web-implementation                 allow
items missing action/resource/effect: 0
STRUCTURAL ASSERTION: PASS (frontmatter parses; all 25 permission items have action+resource+effect)
```

Item count: **25** (20 baseline + 5 added). Items missing `action`/`resource`/`effect`: **0**. Entries [09]–[13] are exactly the five pinned additions; [00]–[08] and [14]–[24] are the baseline entries verbatim.

---

## 5. Anchor-absent abort path (non-zero, no write)

Extra safety evidence (no repo files touched; fixture in `/tmp`): the same heredoc body was run against a baseline copy with the `index.html` anchor removed.

```
fixture /tmp/opencode/t0/noanchor.md written (anchor removed)
-- fixture sha before: f315233daa28e3e65b1d56606e61866ceed0a116ed2d0c4ecd247ad327530359

$ python3 /tmp/opencode/t0/body.py /tmp/opencode/t0/noanchor.md
ANCHOR ABSENT - aborting
exit=3  (expected non-zero: 3)

-- fixture sha after (unchanged): f315233daa28e3e65b1d56606e61866ceed0a116ed2d0c4ecd247ad327530359
```

Non-zero abort confirmed (exit 3) and the target file was not modified (sha unchanged).

---

## 6. Commit diff — only the five entries added

Staged diff (`git diff --cached -- .opencode/agents/builder.md`, captured before the commit) — identical to the commit's `git show HEAD -- .opencode/agents/builder.md` (see § 7):

```diff
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index 14fafb5..793b678 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -32,6 +32,21 @@ permissions:
   - action: edit
     resource: "index.html"
     effect: allow
+  - action: edit
+    resource: "AGENTS.md"
+    effect: allow
+  - action: edit
+    resource: "docs/architecture/**"
+    effect: allow
+  - action: edit
+    resource: "docs/product/**"
+    effect: allow
+  - action: edit
+    resource: ".opencode/agents/*.md"
+    effect: allow
+  - action: edit
+    resource: ".opencode/skills/**"
+    effect: allow
   - action: edit
     resource: ".env*"
     effect: deny
```

`git diff --stat`:

```
 .opencode/agents/builder.md | 15 +++++++++++++++
 1 file changed, 15 insertions(+)
```

Deny entries unchanged — `grep -n 'effect: deny'` count is 10 in both baseline and result, and all deny resources are byte-identical:

```
baseline: 10:    effect: deny   37:  43:  46:  49:  52:  55:  58:  61:  64:
after:    10:    effect: deny   52:  58:  61:  64:  67:  70:  73:  76:  79:
resources (both): "*" (edit), ".env*" (edit), "git push *", "sudo *", "rm -rf *", "curl *", "wget *", "*" (subagent), "*" (question), "*" (skill) — all deny, unchanged
```

Only the five `allow` entries were added; no deny entry, no other permission content, and no prose was touched.

---

## 7. Post-commit confirmation — `git show HEAD -- .opencode/agents/builder.md`

Command and raw output captured after the commit. The commit header (`commit <sha>` / Author / Date) is omitted: embedding the commit's own hash inside the commit is self-referential; the hunk body — the substance — is reproduced verbatim.

```
$ git show HEAD -- .opencode/agents/builder.md
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index 14fafb5..793b678 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -32,6 +32,21 @@ permissions:
   - action: edit
     resource: "index.html"
     effect: allow
+  - action: edit
+    resource: "AGENTS.md"
+    effect: allow
+  - action: edit
+    resource: "docs/architecture/**"
+    effect: allow
+  - action: edit
+    resource: "docs/product/**"
+    effect: allow
+  - action: edit
+    resource: ".opencode/agents/*.md"
+    effect: allow
+  - action: edit
+    resource: ".opencode/skills/**"
+    effect: allow
   - action: edit
     resource: ".env*"
     effect: deny
```

Identity check — the post-commit `git show` diff body is byte-identical to the pre-commit staged diff recorded in § 6:

```
$ git show HEAD -- .opencode/agents/builder.md > show.out
$ sed -n '/^diff --git /,$p' show.out > show-body.diff
$ sha256sum staged.diff show-body.diff
67c62b053596e5fecd04b1c950e4870c65c814bc92683292a165c379c91e344d  staged.diff
67c62b053596e5fecd04b1c950e4870c65c814bc92683292a165c379c91e344d  show-body.diff
$ diff -u staged.diff show-body.diff
IDENTICAL (diff bodies match)
```

Commit file list — exactly the two `files_owned` paths (sha-free `--format=%s` to avoid the self-referential hash):

```
$ git show --name-only --format=%s HEAD
chore: widen builder edit permissions for online-realtime-workflow (T0)

.opencode/agents/builder.md
docs/features/online-realtime-workflow/build-log-T0.md
```

Committed `builder.md` content == the working-tree post-bootstrap file (content-addressed hashes, stable across amends):

```
$ git rev-parse HEAD:.opencode/agents/builder.md
793b678274f585af94d461fbdaec6a15659fd091
$ git hash-object .opencode/agents/builder.md
793b678274f585af94d461fbdaec6a15659fd091
```

Anchors and allow-entry count re-checked against the committed blob:

```
$ git show HEAD:.opencode/agents/builder.md | grep -c 'effect: allow'
15
$ git show HEAD:.opencode/agents/builder.md | grep -n 'resource: "AGENTS.md"\|resource: "docs/architecture/\*\*"\|resource: "docs/product/\*\*"\|resource: "\.opencode/agents/\*\.md"\|resource: "\.opencode/skills/\*\*"'
36:    resource: "AGENTS.md"
39:    resource: "docs/architecture/**"
42:    resource: "docs/product/**"
45:    resource: ".opencode/agents/*.md"
48:    resource: ".opencode/skills/**"
```

---

## Acceptance audit

- **AC-24** — met. T0 is the only permission change: this commit adds exactly the five pinned `edit` `allow` entries (`AGENTS.md`, `docs/architecture/**`, `docs/product/**`, `.opencode/agents/*.md`, `.opencode/skills/**`) after the `index.html` allow block and changes no other permission content (evidence § 4 listing [09]–[13]; § 6 diff = 15 insertions, 0 deletions; deny set unchanged). No other task commit exists yet.
- **AC-25** (`builder.md` T0 phase) — met. Diff vs. the T0 build-start baseline (§ 1, sha256 `1c5d222e…`) contains exactly the five entries and nothing else (§ 6).
- No content AC applies to T0 (chore task; tasks.md T0 `acceptance: AC-24`).
- No tests: no automated commands exist (stack NOT DECIDED, `AGENTS.md` § Commands TBD); verification is inspection + `grep` + `python3` aids, as the spec requires.

## Deviations from spec

None in content or scope.

Notes (not deviations):
- The commit was made on the current branch `main` (the orchestrator's pipeline branch at build start; no `feat/<slug>` branch existed and creating one is out of T0's scope). No push.
- `python3` was used strictly as a build-time aid (heredoc application + YAML structural assertion) — no library/framework/runtime/tooling is introduced or chosen; stack remains NOT DECIDED.
- Untracked artifacts outside T0's scope (`docs/features/project-glossary/**`, `docs/features/project-glossary/status.md` modification) were deliberately left unstaged (§ 8).

## 8. Staging discipline

`git add` was called with explicit paths only (`.opencode/agents/builder.md`, `docs/features/online-realtime-workflow/build-log-T0.md`); no `git add .` / `git add -A`. Untracked/modified files outside `files_owned` (e.g. `docs/features/project-glossary/**`) remain unstaged and were not committed.
