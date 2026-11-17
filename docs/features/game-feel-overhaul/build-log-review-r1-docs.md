# Build log — review r1 docs/evidence fixes (F1, F2, F5, F7)

Task: game-feel-overhaul code-review r1 docs/evidence fixes (2026-11-17)
Branch: `feat/game-feel-overhaul`, reviewed tip `544cce8` (not pushed)
Files changed by this fix:

- `docs/product/glossary.md` — F1 restore of the accepted T11 glossary diff.
- `docs/features/game-feel-overhaul/spec.md` — F5 AC-28/per-surface wording clarification.
- `docs/features/game-feel-overhaul/build-log-T11.md` — F2 waiver section, F7 smoke
  provenance, gate evidence refreshed at `544cce8`.
- `docs/features/game-feel-overhaul/build-log-review-r1-docs.md` (this file).

No source, test, CSS, container or package file was changed.

## What changed & why

1. **F1 (BLOCKER) — glossary regression.** The squash lost the T11 glossary pass.
   `docs/product/glossary.md` is restored verbatim from the accepted state at `af97f5a`:
   `lootbox reveal` is the 1290 ms 3D-stage wording, `### reveal stage` exists, and
   `motion token` says 17 CSS-mapped durations. The restore keeps every presence term
   (`### presence` and the presence-aware `server member` wording) because `af97f5a` already
   contained them; `git diff af97f5a -- docs/product/glossary.md` is empty, so no other
   feature's definition is dropped.
2. **F2 (BLOCKER) — trace waiver.** `build-log-T11.md` gains
   `## Manual trace waiver (2026-11-17)`: the user explicitly waived the AC-15 `workMs` and
   AC-34 main-scene trace requirement because the build environment is headless; the
   real-browser visual pass plus the code-pinned draw/triangle/allocation/30 fps budgets are
   accepted, and no trace table is claimed as passed. `status.md` already records the waiver
   in its 2026-11-17 loop log.
3. **F5 (MINOR) — `.users-badge` radius.** `spec.md` AC-28 and the per-surface Users row now
   state that the crew pill intentionally keeps its capsule `border-radius: 999px`, while
   the other badge/control surfaces use `--gf-radius-control` and the circular `.upgrade-buy`
   keeps 50%; a revision-history `r3a` note records the wording clarification (no scope or
   CSS change).
4. **F7 (INFO) — smoke provenance.** The smoke `frontend-prod` image was rebuilt from
   `544cce8`, its container recreated, and `npm run smoke` re-run so the 28/28 result is
   tied to the reviewed tip (image id and prod asset recorded in `build-log-T11.md`).
5. **Full gate re-run at `544cce8`** with the docs edits in the working tree (no source
   change): lint, typecheck, both test suites, both coverage tables, build, smoke,
   protected-file gates against `BASE=5ef561e`, and the README/frontend-rendering/glossary
   doc greps. Raw output is in `build-log-T11.md` § Gate evidence / § Protected-file proof /
   § Documentation gates.

## Evidence

- F1 restore:

```text
$ git diff af97f5a -- docs/product/glossary.md
(empty; exit 0)
$ grep -n "^### presence$\|^### prestige$\|^### reveal stage$" docs/product/glossary.md
118:### prestige
123:### presence
128:### reveal stage
$ grep -c "17 CSS-mapped durations" docs/product/glossary.md
1
```

- F5 spec clarification:

```text
$ grep -n "999px" docs/features/game-feel-overhaul/spec.md
158:| Users `.user-panel` | crew pill (capsule shape, `border-radius: 999px`) with a count badge, …
178:- **AC-28 — Control states.** … `.users-badge` intentionally keeps the capsule crew-pill shape (`border-radius: 999px`); …
399:- r3a — 2026-11-17 — **wording clarification, no scope change** (code-review r1 F5): …
```

- F7 smoke provenance:

```text
$ podman image inspect cubeclicker-frontend:prod-smoke --format '{{.Id}}'
4b4d7e12231406c75559e5964f3a0f618a63a16900f371d600e6c696df386de4
$ podman inspect cubeclicker-frontend-prod-1 --format '{{.Image}}'
4b4d7e12231406c75559e5964f3a0f618a63a16900f371d600e6c696df386de4
prod asset: /assets/index-6XwuB9OH.js (101,707 B decompressed)
SMOKE PASS (28/28 checks)
```

- Full gate at the tip (`build-log-T11.md` holds the raw blocks):

```text
npm run lint → 0
npm run typecheck → 0
npm test → 0 (backend 37 files / 1538 tests; frontend 78 files / 2439 tests)
npm run coverage → 0 (backend 96.2 / 89.92 / 99.57 / 96.2;
                      frontend 96.84 / 96.51 / 98.04 / 96.84)
npm run build → 0 (initial 99,970 B; three 154,617 B; total 280,670 B gzip;
                   bundle-report.json 1,884 B)
npm run smoke → 0 (28/28, rebuilt tip image)
protected diff/status gates (BASE=5ef561e) → 0/0 and 0/0
doc greps (README / frontend-rendering / glossary) → all PASS, stale phrases ABSENT
```

## Acceptance audit (review r1 docs items)

- **F1 → met.** Glossary restored exactly from `af97f5a`; all three defects (3D wording,
  `### reveal stage`, 17 durations) fixed; presence terms preserved; AC-35 greps pass.
- **F2 → met by explicit user waiver.** Waiver recorded in the T11 log and in `status.md`;
  no trace is claimed as passed.
- **F5 → met.** AC-28, the per-surface Users row and the `r3a` revision note state the
  capsule 999 px pilot-pill radius; no CSS change.
- **F7 → met.** Smoke image rebuilt from the reviewed tip; image id and prod asset recorded;
  28/28 PASS.

## Deviations from spec

None. This is a documentation/evidence-only change; no AC, budget or threshold was relaxed.
The manual traces remain recorded as “not executed — environment” and are covered by the
user waiver only.
