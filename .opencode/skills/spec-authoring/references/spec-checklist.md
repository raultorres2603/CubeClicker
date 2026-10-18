# Spec checklist — run before reporting

## Completeness vs request
- [ ] Every explicit ask is covered by at least one AC or listed as a non-goal or open question
- [ ] Nothing beyond the request is invented without being flagged

## Acceptance criteria
- [ ] Numbered, binary-testable, one behavior each (no conjoined criteria)
- [ ] Bad: "clicking feels fast and satisfying" → Good: "a click updates the counter within the same frame (no visible lag at 60 fps)"
- [ ] Each AC can cite evidence: a test, a command, or an observable step

## Boundaries & scope
- [ ] Three tiers present and specific
- [ ] Non-goals listed
- [ ] Spec covers exactly one feature

## Dependency & sizing (with tasks.md)
- [ ] Every task sized to one builder session, exclusive `files_owned`
- [ ] Dependency graph acyclic; `[P]` only with disjoint files and no shared-file contact
- [ ] Every AC maps to at least one task; every task maps to an AC (or is labeled chore)

## Security
- [ ] User-controlled data identified (names, imports, URLs)
- [ ] Persistence integrity considered (validation on load, corruption handling)
- [ ] No secrets in the client bundle; dependency additions flagged as ⚠️ Ask first

## Testing strategy
- [ ] Commands exist in AGENTS.md (else flagged as an open question)
- [ ] Unit and integration tiers both defined (unit = one module with injected dependencies; integration = modules through real boundaries) — plus containerized e2e where cross-service behavior is claimed
- [ ] The exact coverage command (`npm run coverage`) and thresholds (≥ 80% statements/branches/functions/lines, per workspace) named — or a justified deviation
- [ ] The assertion-quality bar reflected where test design is specified (concrete expected values; no banned wildcard matchers; no useless tests)
- [ ] Every behavior-change task carries its test deliverables and a coverage verify step
- [ ] Edge cases named where relevant (offline progress, clock skew, storage quota, rapid input, corrupted save)

## Plan quality
- [ ] File inventory lists everything the feature will touch
- [ ] Interfaces/contracts pinned enough for an independent builder

## Real-time (when the feature touches shared/cross-client state)
- [ ] Connection lifecycle, reconnection, multi-client behavior, and server authority addressed — or explicitly out of scope
- [ ] Identity vs. "no accounts" conflicts flagged as open questions

## Containers (when the feature adds services, images, ports, configuration, or deployables)
- [ ] Containerization impact addressed per `docs/architecture/containerization.md` (local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) — or explicitly out of scope
- [ ] Container details follow the settled conventions (`docs/architecture/containerization.md`); deviations are flagged as open questions for a user-owned amendment
