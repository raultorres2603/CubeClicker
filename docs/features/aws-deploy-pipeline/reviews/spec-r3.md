---
feature: aws-deploy-pipeline
phase: spec
iteration: 3
verdict: approved
blocking: 0
nonblocking: 1
---

# Spec Review — r3

## Summary

✅ approved — F17–F21 are genuinely resolved in r3 with concrete, internally consistent evidence: the two-line `ARG VITE_WS_URL` + `ENV VITE_WS_URL` bridge is pinned verbatim across Q-4/AC-12/AC-21(b)/(c)/Non-goals/Q-9 accounting note/Security real-time surface, plan (interfaces, file inventory, risk, doc-pass plan), and tasks (T10 greps both lines and the `git diff` guard requires exactly the pinned two lines); the mechanism is sound against `src/frontend/vite.config.ts` (`process.env.VITE_WS_URL` at build time) and the Docker-documented ARG→ENV pattern; the `-E` grep, `aws_iam_access_key` anchor, `T0 → T13` edge, and Podman 5.x note are all in place. Framework contracts (8 states, no new state, autonomy directive, `docs/features/README.md` ownership, documentation gate) are consistent; AC-1…AC-22 are binary/testable and mapped to tasks; no AC weakened; single-`production` default is internally consistent; the verification boundary (no real `terraform apply`) is honestly stated with runnable ACs against this host (wrappers for absent terraform/actionlint; Mailpit pre-start for smoke). One INFO note remains on podman-vs-Docker ARG behavior (non-blocking).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F22 | INFO | spec.md Q-4/AC-12; src/frontend/Dockerfile (planned) | The pinned claim "a bare Docker `ARG` is not a process env var" is accurate for Docker/BuildKit on the GitHub-hosted runners (the deployment target) — Docker's docs state ARG is a Dockerfile substitution variable, while ENV is what is passed through to the build execution environment; the `ARG …` + `ENV VITE_WS_URL=${VITE_WS_URL}` bridge is the documented, portable pattern. Independently verified: (i) `src/frontend/vite.config.ts:34` resolves via `process.env.VITE_WS_URL`; (ii) an end-to-end build with the two-line bridge and `--build-arg VITE_WS_URL=wss://prod.example.com/ws` bakes `wss://prod.example.com/ws` into the prod bundle (`/usr/share/nginx/html/assets/index-*.js`); (iii) a build with only the `ARG` (no `ENV`) under podman 5.8.9 still bakes the value because podman/Buildah happens to inject ARGs into the build env — that is tool-specific and must not be relied upon; the bridge is required for the Docker runners and is strictly safer. No change required; the pin stands. | None — keep the two-line bridge; optionally annotate the spec note that local podman injects ARGs but the bridge is mandatory for Docker runners (cosmetic, not blocking). | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All three clusters covered; raw request's three asks (infra, pipeline with verify-before-deploy, framework proof-of-working) mapped to ACs; deferrals explicit (Q-6 SMTP, Q-7 plan-on-PR, Q-8 first apply). |
| Testability | ✅ | AC-1…AC-22 binary/testable with pinned commands or grep anchors; AC-3 second command now effective (`grep -E`); AC-8/T7 anchor corrected to `aws_iam_access_key`. |
| Boundaries | ✅ | Three tiers present; non-goals explicit; single `src/**` carve-out well-scoped to the two pinned lines. |
| Dependency graph | ✅ | Acyclic; T0→T13 edge now explicitly encoded (T13 `depends_on: T0, T12`); every AC mapped (T-final consolidates AC-1…AC-22); mermaid graph matches the overview line. |
| Parallel safety | ✅ | Only `[P]` tasks (T11, T12) have disjoint `files_owned`; the sole cross-task file (`.opencode/agents/builder.md`) is two-phase partitioned with DAG ordering (T0 before T13). |
| Security | ✅ | OIDC + SHA pinning + least-privilege + keyless audit preserved; permission surface regulated via Q-9/AC-22; T7 anchor corrected; no static keys. |
| Testing | ✅ | Coverage bar preserved and pinned (AC-10, T-final); credential-less fmt/validate + actionlint + Mailpit-primed smoke runnable on this host (verified: tags pull, wrappers execute, cold smoke 9/12 FAIL / pre-started 12/12 PASS). |
| Consistency | ✅ | Framework contracts align with the 8-state machine and the 2026-10-16 autonomy directive; provider-choice sentences amended consistently across AGENTS.md/stack.md/containerization.md; `docs/features/README.md` remains orchestrator-owned (builder proposes row). |
| Risks | ✅ | F17 risk (Frontend WS URL bake drift) mitigation now matches the implementable two-line bridge; two-phase builder.md risk encoded in DAG. |
| Real-time (when applicable) | ✅ | Edge WS passthrough + `idle_timeout = 90` (> 2× 30 s heartbeat) + path+status health checks pinned; production WS bake resolved via the two-line bridge (F17) rather than left to a broken default. |
| Containers (when applicable) | ✅ | Containerization contract honored: app/compose/Dockerfiles otherwise untouched; deferrals resolved via AC-21; image-name/tag parity pinned; single-command local run untouched. |

## Previous round verification (r2 → r3)

| Finding | Status | Evidence |
| --- | --- | --- |
| F17 (MAJOR, Q-4/AC-12/AC-21) | fixed | r3 pins the two-line `ARG VITE_WS_URL="ws://localhost:8080/ws"` + `ENV VITE_WS_URL=${VITE_WS_URL}` bridge in spec.md (Q-4 line 135, AC-12 line 74, AC-21(b)/(c) lines 85–86, Non-goals line 94, Q-9 accounting note line 140, Security real-time surface line 117), plan.md (composition flow line 56, interfaces line 123, file inventory line 176, risk line 220, doc-pass plan line 229), tasks.md (T10 verify line 136 greps both lines; `git diff` guard requires exactly the pinned two lines). Mechanism verified against `src/frontend/vite.config.ts:34` (`process.env.VITE_WS_URL`) and an end-to-end build that bakes `wss://prod.example.com/ws` into the prod bundle. |
| F18 (MINOR, AC-3/T1 verify) | fixed | `git ls-files \| grep -E '(^|/)\.terraform/'` (with `-E`) in spec.md AC-3 (line 65) and tasks.md T1 verify (line 55); the `-E` form was empirically confirmed to match real `.terraform/` paths and to print nothing on a clean tree. |
| F19 (MINOR, T7 verify) | fixed | `grep -rn "aws_iam_access_key" infra/terraform/modules/cicd-iam/*` (must print nothing) in tasks.md T7 verify (line 109); spec.md revision history (line 159) records the change. |
| F20 (MINOR, DAG/shared file) | fixed | `T0 --> T13` edge in the mermaid graph (tasks.md line 23), dependency-overview line (line 5), shared-file discipline note (line 35), and T13 `depends_on: T0, T12` (line 161); dropped under route (b) as stated. |
| F21 (INFO, Podman version) | fixed | Assumption updated to "Podman 5.x — verified 5.8.9 on the build host" (spec.md lines 61/122; plan.md lines 131/210); host verified at 5.8.9 this round. |

## Notes / backlog (non-blocking)

- Verified-good this round: heartbeat 30 s at `src/backend/src/game/hub.test.ts:556`; cold smoke 9/12 FAIL / Mailpit-primed 12/12 PASS; terraform (1.15.9) and actionlint (1.7.12) images pull and run; `src/frontend/Dockerfile` has no `ARG VITE_WS_URL` today (confirmed — T10 owns the only `src/**` touch); builder allowlist lacks `infra/**`/`.github/**` (confirmed — T0 bootstrap under Q-9 route (a)); 8-state machine unchanged; autonomy directive respected; `docs/features/README.md` has no aws-deploy-pipeline row yet (builder proposes — correct).
- The two-line ARG+ENV bridge (F17) is the only thing that previously stood between this spec and approval; it is now pinned and empirically verified to bake `PUBLIC_WS_URL` into the prod bundle.
- The podman-vs-Docker ARG nuance (F22) is cosmetic and non-blocking; the bridge is mandatory for the Docker runners regardless.