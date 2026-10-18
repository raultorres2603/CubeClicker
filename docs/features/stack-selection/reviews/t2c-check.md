---
feature: stack-selection
phase: oversight (T2c focused check, pre-T3 gate)
iteration: 1
verdict: clean
blocking: 0
nonblocking: 1
reviewed_commit: 5afe0fb (parent 3f8483d; baseline 7ec718f)
---
# T2c Focused Oversight Check — commit `5afe0fb`

## Verdict

✅ **clean** — gate is open for T3. All five scope items verified independently (no builder log trusted as evidence): the commit contains exactly the five T2c paths and exactly the four contract-16 pinned replacements; the `.opencode/agents/builder.md` permission block is byte-frozen (sha256-identical to the post-T2 baseline at `7ec718f`); the negative grep over `.opencode/` at `5afe0fb` returns no hits, and a broadened case-insensitive scan finds no stale `docker` token in any other form. One non-blocking MINOR evidence nit in the build log itself (F1) — no effect on the artifact content or AC-33.

## Scope verification (commits read via `git` only; no repo mutation)

| # | Check | Result | Raw evidence |
| --- | --- | --- | --- |
| 1a | File list = exactly five T2c paths | ✅ | `git show --stat 5afe0fb` → `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md`, `.opencode/skills/code-review/checklists/quality.md`, `docs/features/stack-selection/build-log-T2c.md` — "5 files changed, 170 insertions(+), 4 deletions(-)" (166 of the insertions are the build log; `4/4` = the four one-line replacements). `git log -1 --format='%P' 5afe0fb` → `3f8483d`; `%P` of `3f8483d` → `7ec718f` — parent chain matches the brief. |
| 1b | No content beyond the pins | ✅ | Per-file numstat is `2 +-\|1 + 1` (one hunk each) in the full `git diff 3f8483d 5afe0fb`; net content = exactly 4 insertions + 4 deletions, one line per file. |
| 2 | Permission freeze (AC-33) | ✅ | `git show 7ec718f:.opencode/agents/builder.md \| sed -n '1,101p' \| sha256sum` → `891015a593990d7629df4249f9e506578bdb0c608cd5b7cf28b6378763698999`; same extraction at `5afe0fb` → identical hash (equals the value recorded in `build-log-T2c.md` § Baseline). Closing `---` verified at line 101, so lines 1–101 are the whole frontmatter. Full-file diff `7ec718f`→`5afe0fb`: exactly one changed content line (hunk `@@ -109,7 +109,7 @@`, changed line = 112); `git diff 7ec718f 3f8483d -- .opencode/agents/builder.md` is empty, so the post-T2 blob (`fb9b4b15456c4221cf393b7abd5609fc4f5a0716`, matching the build-log baseline capture) is unchanged straight into T2c. |
| 3a | Pin exactness vs contract 16 | ✅ | Each `5afe0fb` blob line matches contract 16 token-for-token at its pinned line — extracted and diffed, not eyeballed from the log: builder.md:112 `Docker images + Docker Compose` → `Podman images + Podman Compose (`podman compose`)` (rest of line byte-identical); SKILL.md:27 `` `docker compose up`-style single-command local dev `` → `` `podman compose up`-style single-command local dev ``; engineering-principles.md:57 `…beyond Docker + Compose.` → `…beyond Podman with a working compose provider.`; quality.md:41 checkbox → `podman compose up`-style. Parent blob hashes equal the build-log recorded baselines (`fefd33667a…`, `d223add212…`, `63c9dd1b51…`), and `git diff 7ec718f 3f8483d` over the three skill files is empty. Each new token occurs exactly once in its blob (`grep -c` = 1). |
| 3b | Filename mentions untouched | ✅ | `git grep -n 'Dockerfile\|\.dockerignore' 5afe0fb — <four files>` → `builder.md:42` (`resource: ".dockerignore"`), `builder.md:112` (`src/*/Dockerfile`), `SKILL.md:27` (`src/*/Dockerfile`); engineering-principles.md and quality.md have none — matches build-log-T2c.md §5. |
| 4 | Negative grep at `5afe0fb` | ✅ | `git grep -nE 'docker compose up\|Docker images \+ Docker Compose\|Docker \+ Compose' 5afe0fb -- .opencode/` → exit 1, no hits. Broadened: `git grep -niE 'docker' 5afe0fb -- .opencode/` minus `dockerfile/dockerignore/dockerfile:` → zero hits, so no stale token survives in any other form either. |
| 5 | Commit metadata | ✅ | Subject exactly the pinned `docs: align remaining framework Docker references with Podman (T2c)` (plan.md:19 / tasks.md:64). Committer timestamp 36 s after author (10:30:49 → 10:31:25) is consistent with a pre-finalize amend; the diff IS the audit — `git diff 3f8483d 5afe0fb` shows nothing beyond the five paths, so amend or not, no content escaped. `status.md:49` records T2c completed already with the focused check as the T3 gate — consistent with this brief. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `docs/features/stack-selection/build-log-T2c.md:153–160` (§ Post-commit verification) | The in-log `git show --stat HEAD` records `build-log-T2c.md \| 140 +++` and "144 insertions", while the actual final commit is 166 lines for the log and 170(+) — the stat was captured before the last append and re-attributed to the final HEAD. Corroborated by the author/committer timestamp delta (10:30:49 vs 10:31:25), consistent with appending the post-commit section and amending. Every claim inside the section independently holds against the final commit (this check re-derived all of them), so nothing is misrepresented in substance — but a future T2-row style diff against the in-log stat will not match. | None gate-level. Carry-forward for T7's evidence pass: cross-check recorded stats against live `git show --stat` (or note "stat captured pre-append"). Builder-side fix optional; reviewer does not edit the log. | open |

## Not verified here (out of this oversight check's scope)

- Full post-build code review of the feature (a later gate).
- Anything outside `.opencode/**` and the two commits named in the brief.
