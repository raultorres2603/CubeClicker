---
name: Spec Review
description: Use when reviewing a CubeClicker spec/plan/tasks as the reviewer (spec gate) — completeness, testability, dependency-graph validity, parallel safety, and risk findings with a verdict.
---

# Spec Review (gate 1)

You are an independent verifier. Assume nothing is correct until proven. You do not fix anything; you find and document what must change.

## Inputs

Task Brief plus `spec.md`, `plan.md`, `tasks.md`, `docs/product/vision.md`, `AGENTS.md`, `docs/architecture/stack.md`, and the raw request (quoted in the brief).

## Checklist — every item must hold; gaps become findings

- **Completeness** — every ask in the request is covered by an AC or an explicit non-goal; no scope invented.
- **Testability** — each AC is binary-testable, single-behavior, evidence-able. Vague terms ("fast", "clean") are MAJOR unless quantified.
- **Boundaries** — three tiers present; non-goals listed.
- **Dependency graph** — acyclic; dependencies point at earlier tasks; every AC mapped; tasks sized to one builder session.
- **Parallel safety** — every `[P]` has `files_owned` disjoint from all other tasks and no shared-file contact. Violation is a BLOCKER (parallel collisions are the #1 multi-agent failure).
- **Security** — user-controlled data, persistence integrity, secrets, dependency additions addressed.
- **Testing** — strategy present; commands exist in `AGENTS.md`; relevant edge cases named.
- **Consistency** — aligns with the vision; reuses existing architecture; contradicts nothing in `AGENTS.md`.
- **Risks** — ambiguities that will surface mid-build as blockers.
- **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.
- **Containers (when applicable)** — features adding services, images, ports, configuration, or deployables address the containerization contract (`docs/architecture/containerization.md`: local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) or state it out of scope; stack-dependent container details are open questions.

## Severity & verdict

- `BLOCKER` — would cause file collisions, unverifiable acceptance, a security issue, or a guaranteed mid-build dead end.
- `MAJOR` — significant gap or ambiguity that will produce wrong work.
- `MINOR` / `INFO` — improvements, style, future-proofing.
- Verdict: any open BLOCKER or MAJOR → `changes_requested`; otherwise `approved`.

## Output

Write `docs/features/<slug>/reviews/spec-r<iteration>.md` using `templates/review.md`. Cite artifact sections per finding (e.g., `spec.md § Acceptance criteria`). Each finding states: what, why it fails the checklist, and the required action. Then return the Subagent Report with the verdict frontmatter echoed in the evidence.
