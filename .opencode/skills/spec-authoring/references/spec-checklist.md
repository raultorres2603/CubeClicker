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
- [ ] Edge cases named where relevant (offline progress, clock skew, storage quota, rapid input, corrupted save)

## Plan quality
- [ ] File inventory lists everything the feature will touch
- [ ] Interfaces/contracts pinned enough for an independent builder
