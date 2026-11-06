---
feature: spaceship-customization-minor-fixes
revision: 1
status: draft
created: 2026-11-06
updated: 2026-11-06
---

# Spec — Spaceship Customization Minor Fixes (Hardening Follow-up)

## Summary

Hardening follow-up to the accepted `spaceship-customization` feature that addresses the two
non-blocking MINOR findings recorded in `docs/features/spaceship-customization/reviews/code-r1.md` (F1, F2). F1: the `welcome` and `worldEntered` variants of the `ServerMessage` union in both protocol mirrors (`src/backend/src/game/protocol.ts` and `src/frontend/src/multiplayer/protocol.ts`) omit the optional `customization` field even though the shared `Placement` payload already carries `customization?` and the codec already copies/parses it, forcing `src/frontend/src/game/session.ts` to cast through `{ customization?: CustomizationState }`. F2: the cube-completion customization grant in `src/frontend/src/game/engine.ts` reuses the existing `parts`/`appearance` references instead of spread-copying them, unlike `adoptCustomization`. This spec pins the type alignment and the defensive copy only; it introduces no wire-format, gameplay, persistence, or container changes.

## User stories

- As a maintainer, I want the protocol mirrors' `welcome`/`worldEntered` types to declare `customization?` so that consumers read it without casts.
- As a maintainer, I want the engine's grant path to copy `parts`/`appearance` so that granted state cannot alias prior state.

## Acceptance criteria

- **AC-1** — In `src/backend/src/game/protocol.ts`, the `welcome` and `worldEntered` variants of `ServerMessage` declare `customization?: CustomizationState`, mirroring the existing `economy?`/`upgrades?` fields; the backend workspace compiles (`npm run typecheck --workspace=src/backend` exits 0).
- **AC-2** — In `src/frontend/src/multiplayer/protocol.ts`, the `welcome` and `worldEntered` variants of `ServerMessage` declare `customization?: CustomizationState`, mirroring the existing `economy?`/`upgrades?` fields; the frontend workspace compiles (`npm run typecheck --workspace=src/frontend` exits 0).
- **AC-3** — `src/frontend/src/game/session.ts` no longer contains the casts `(message as { customization?: CustomizationState })`; it reads `message.customization` directly in both the `welcome` and `worldEntered` handlers, with no new casts introduced.
- **AC-4** — In `src/frontend/src/game/engine.ts`, the cube-completion grant builds `parts` and `appearance` as new objects (`{ ...customization.parts }` and `{ ...customization.appearance }`) rather than reusing `customization.parts`/`customization.appearance` references; a test mutating the granted snapshot's `parts`/`appearance` maps does not mutate the prior snapshot's maps.
- **AC-5** — All existing tests in both workspaces pass and `npm run coverage` reports ≥ 80% statements/branches/functions/lines per workspace; `npm run lint` exits 0.

## Non-goals

- No change to the wire format, message catalog, or codec behavior (no new/renamed messages, no validation changes).
- No gameplay, economy, upgrade, persistence, or schema changes.
- No container, image, port, or deployment changes (AC-18-style container diff gate not affected).
- No new dependencies.
- Does not address F3 (INFO — documentation pass already recorded for the parent feature).

## Boundaries

- ✅ Always: keep the change minimal and confined to the four source files; run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run coverage` before reporting; follow existing defensive-copy patterns.
- ⚠️ Ask first: adding dependencies; changing shared config (tsconfig, entrypoints, CI, lockfiles); deleting files.
- 🚫 Never: edit files outside the feature's task `files_owned`; weaken assertions or exclude production code from coverage without a justified, reviewer-approved reason; commit secrets; edit `.env*`.

## Security considerations

- No new user-controlled data enters the system; `customization` is already validated by the existing codecs (`parseCustomizationState` on the frontend, `copyCustomizationState` on the backend) and persisted only through the existing account path.
- No new persistence surface; no secrets client-side; no dependency additions.

## Testing strategy

- Unit: backend `protocol.test.ts` already asserts `welcomeMessage`/`worldEnteredMessage` copy customization when present and omit it when absent; frontend `protocol.test.ts` already asserts placement customization parsing; `engine.test.ts` covers the grant scenario; `session.test.ts` covers adopt-from-welcome/worldEntered.
- Integration: TypeScript compilation (`npm run typecheck`) is the integration-level check that the cast removal is valid; session tests exercise the typed read path.
- E2E / containerized: not applicable — no cross-service behavior, ports, or images change. The container diff gate (`git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile src/backend/src/server.ts`) remains untouched.
- Coverage: `npm run coverage` (both workspaces), thresholds ≥ 80% statements/branches/functions/lines per workspace; concrete assertions, no banned wildcard matchers, no useless tests.
- Verification commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`.

## Real-time considerations

Out of scope for this feature: no change to connection lifecycle, reconnection, multi-client behavior, or server authority. The `customization` payload already flows over the existing WebSocket messages; this change only aligns types and hardens an in-memory copy. No identity-vs-"no accounts" conflict is introduced.

## Containerization impact

Out of scope: no services, images, ports, environment variables, or deployables are added or changed. The decided container conventions (`docs/architecture/containerization.md`) are untouched; no compose or Dockerfile edits.

## Open questions

- None.

## Assumptions

- Workspace-scoped commands (`--workspace=src/backend`, `--workspace=src/frontend`) are acceptable as the pre-gate form for per-task verification; the final task runs the full `npm run …` suite.
- The builder may add/adjust tests in the owned test files to assert AC-4's reference inequality; no production behavior beyond the copy changes.

## Revision history

- r1 — 2026-11-06 — initial draft.