---
name: Task Decomposition
description: Use when turning a CubeClicker spec into the tasks.md DAG — task sizing, dependency links, file ownership, and parallel-safety markers.
---

# Task Decomposition

Produce `tasks.md` from `spec.md` and `plan.md`. The orchestrator executes it literally; ambiguity or overlap here causes collisions and rework.

## Rules

1. One task = one coherent change a builder can finish in a single session (describe it in at most two lines).
2. Every task has: `depends_on`, `files_owned`, `verify` (exact commands from `AGENTS.md`), `acceptance` (AC ids it satisfies), `status: [ ]`.
3. `files_owned` MUST be exclusive across tasks. Two tasks may never list the same file.
4. Default order: scaffolding/setup → pure logic (game math, state) → integration (state ↔ UI) → UI polish → persistence. Later tasks depend on earlier ones unless independence is proven.
5. `[P]` (parallel-safe) only when: dependencies are already-earlier tasks, `files_owned` is disjoint, and the task touches no shared file (`package.json`, lockfiles, entrypoints, global styles, routers, container definitions such as the compose file and Dockerfiles). When in doubt → `[seq]`.
6. Every AC maps to at least one task; every task maps to at least one AC, or is explicitly labeled a chore (e.g., scaffolding).
7. Keep the graph acyclic — reviewers verify this.
8. Finish with a final task `T<final> — Verify & integrate` `[seq]` that runs the full verification suite before code review.

## Output

Use `templates/tasks.md`. Include a dependency overview line at the top (and optionally a mermaid graph).
