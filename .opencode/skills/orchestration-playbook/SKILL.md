---
name: Orchestration Playbook
description: Use when running or resuming the CubeClicker feature workflow as the orchestrator — state transitions, Task Briefs, subagent scheduling, verdict parsing, loop counters, user checkpoints, and escalation.
---

# Orchestration Playbook

You run the state machine. Workers do the work; you route and record. This skill is the canonical procedure; your agent prompt is the summary.

## 1. Feature state machine

States (frontmatter `state` in `docs/features/<slug>/status.md`):

| State | Meaning | Your next action |
| --- | --- | --- |
| `planning` | Planner is writing or revising the spec | Brief Planner (§3) |
| `spec_review` | Reviewer is checking the spec | Brief Reviewer (spec mode) |
| `awaiting_approval` | Spec approved; user checkpoint | Present summary, ask user (§6) |
| `building` | Tasks being implemented | Schedule ready tasks to Builder (§4) |
| `code_review` | Reviewer is checking the build | Brief Reviewer (code mode) |
| `accepted` | Feature done | Final summary to user (§7) |
| `blocked` | A worker returned blocked | Resolve or route (§8) |
| `escalated` | Loop budget exceeded / unrecoverable | Stop and hand to user (§8) |

Transition rules:

- `planning → spec_review` when the Planner reports `completed` and spec/plan/tasks exist.
- Increment `spec_review_round` each time a spec review starts.
- `spec_review → awaiting_approval` when the verdict artifact frontmatter says `verdict: approved`.
- `spec_review → planning` when `changes_requested` and `spec_review_round < 2`; if it would exceed 2 → `escalated`.
- User feedback at the checkpoint does not consume reviewer budget; route it into the next Planner brief.
- `awaiting_approval → building` when the user approves.
- `building → code_review` when every task in `tasks.md` is `[x]`.
- Increment `build_round` each time a code review starts.
- `code_review → accepted` when `verdict: approved` and every acceptance criterion is verified met.
- `code_review → building` when `changes_requested` and `build_round < 3`; if it would exceed 3 → `escalated`.
- `code_review → planning` when the review identifies a spec defect (missing or wrong requirement). Same loop limits.
- Any state → `escalated` on a `failed` report that a single retry does not fix.

NEVER advance a state without the artifact that justifies it (verdict file, completed report). Chat claims are not evidence.

## 2. Status bookkeeping

After every transition: update `status.md` (state, counters, `updated`) and append one loop-log line:

```
- <date> — <from> → <to> — <reason> — <artifact path>
```

Mirror task checkboxes in `tasks.md` (`[ ]` → `[>]` → `[x]`) from Builder reports and code-review verification. On `accepted`, update the feature index row in `docs/features/README.md`. Create new feature directories from `templates/status.md`.

## 3. Delegation — Task Briefs

Every subagent call MUST be a Task Brief built from `templates/task-brief.md`. Hard requirements:

- `INPUTS`: exact paths the worker must read. Include the **raw user request** (or a verbatim quote) when briefing the Planner — workers cannot see this conversation.
- `SCOPE`: task IDs, spec sections, or the exact questions to answer. One phase per invocation.
- `CONSTRAINTS`: boundaries from `AGENTS.md`; files not to touch; findings from prior rounds that must be respected.
- `DELIVERABLES`: the artifacts the worker writes.
- End every brief with: `Return the Subagent Report as your final message. Do not address the user.`

Example brief (Planner):

```
ROLE: planner
FEATURE: core-click-loop
PHASE: planning
INPUTS: AGENTS.md, docs/product/vision.md, docs/architecture/stack.md
SCOPE: raw request: "<paste verbatim>"
CONSTRAINTS: stack may be NOT DECIDED — flag stack-dependent items as open questions
DELIVERABLES: spec.md, plan.md, tasks.md in docs/features/core-click-loop/
REQUIRED OUTPUT: Subagent Report. Do not address the user.
```

## 4. Scheduling (building state)

1. Read `tasks.md`. A task is **ready** when all `depends_on` are `[x]`.
2. Exactly one ready → run Builder in the foreground with a brief for that task.
3. Several ready and ALL are `[P]` with pairwise disjoint `files_owned` and no shared-file contact (`package.json`, lockfiles, entrypoints, container definitions such as the compose file and Dockerfiles) → launch them as **background** subagents (max 3) in one batch.
4. Otherwise pick the first ready `[seq]` task and run it in the foreground.
5. After each Builder report: update `tasks.md` and the loop log, then re-evaluate.

Never run a Builder before the spec gate is approved.

## 5. Verdict parsing

Read the review artifact (`reviews/spec-r<N>.md` or `reviews/code-r<N>.md`). Trust only the frontmatter: `verdict`, `blocking`, `iteration`. If the artifact is missing or malformed → re-brief the Reviewer once; still broken → `escalated`.

Findings with severity BLOCKER or MAJOR are binding and must be addressed; MINOR/INFO go into the final summary as backlog.

## 6. User checkpoint (`awaiting_approval`)

Present at most 12 lines: feature goal, acceptance-criteria count, task count (+ how many parallel-safe), notable decisions and risks, open questions. Then use the `question` tool with options: Approve / Request changes / Abort.

- Approve → `building`.
- Request changes → ask clarifying questions if needed, then `planning` with the user's guidance added to the Planner brief.
- Abort → `escalated` and stop.

## 7. Final summary (`accepted`)

One message: what was built (feature + key files), evidence (verification commands and results), review history (rounds and outcomes), backlog (MINOR/INFO findings and open questions), suggested next step. Update `docs/features/README.md`.

## 8. Blocked & escalation

- Worker `blocked` on a spec question → route to Planner (spec revision), re-review, then re-brief the blocked worker with the answer.
- Worker `blocked` on environment, stack, or tooling → set `blocked`, ask the user directly, resume with the answer.
- Worker `failed` → retry once with the error context added to the brief; second failure → `escalated`.
- Budget exceeded (`spec_review_round > 2`, `build_round > 3`) → `escalated`.

Escalation message: current state, what happened, loop-log tail, open blockers, and 2–4 concrete options (retry with guidance / revise spec / reduce scope / abort). Stop after sending it.

## 9. Session recovery

Asked to continue an existing feature: read its `status.md` and act on the current `state` per §1. Never restart the flow from scratch.

## 10. Canonical Subagent Report

Every worker ends with exactly this shape; validate before acting:

```
status: completed | blocked | failed
artifacts: [paths written or updated]
evidence: <command outputs, verdict summary, or what proves the work>
open_questions: [ ... ]
next_recommendation: <one line>
```
