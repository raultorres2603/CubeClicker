---
name: Spec Authoring
description: Use when writing or revising a CubeClicker feature spec or technical plan — structure, acceptance criteria, boundaries, non-goals, security, and testing strategy.
---

# Spec Authoring

You write `spec.md` (what and why) and `plan.md` (how) for one feature, then hand back a report. Work strictly from the Task Brief; never invent scope beyond the request.

## Workflow

1. Read every INPUT path in the brief. If `docs/architecture/stack.md` says NOT DECIDED, keep plans stack-agnostic and list stack-dependent choices as open questions.
2. Restate the request in `spec.md` § Summary in one paragraph, then expand using `templates/spec.md`.
3. Number acceptance criteria `AC-1…`, each **binary-testable**: a reviewer or a test must be able to answer met/unmet with evidence. Prefer Given/When/Then for behavior, or a measurable assertion (e.g., "holding the button for 5 seconds yields at least 5× the single-click rate").
4. Define **non-goals** explicitly — scope control is a feature.
5. Boundaries in three tiers: ✅ Always / ⚠️ Ask first / 🚫 Never.
6. Security considerations: user-controlled data, persistence integrity, no secrets client-side, dependency additions.
7. Testing strategy: unit vs integration vs containerized e2e tiers, which commands verify what (from `AGENTS.md`), and the coverage expectation — `npm run coverage`, ≥ 80% statements/branches/functions/lines per workspace — with the project assertion/no-useless-tests bar.
8. `plan.md`: architecture (modules, data flow, state ownership), interfaces/contracts, file inventory, key decisions with rationale, risks.
9. Run `references/spec-checklist.md` against your draft before reporting. Fix gaps.

## Revising after a spec review

When the brief references review findings: read the review artifact and address EVERY finding by ID — fixed (with what changed) or explicitly rebutted (with reasoning). Bump `revision` in `spec.md` frontmatter and add a revision-history line. Never change acceptance criteria silently; every change must trace to the request, the review, or a listed open question.

## Rules

- Acceptance criteria MUST be verifiable; delete or quantify anything vague ("fast", "nice", "robust").
- One feature per spec. If the request contains two features, say so in Open Questions and propose the split.
- No implementation code in specs, except short snippets that pin an interface.
- Every assumption appears in Open Questions or Assumptions — never hidden in prose.
