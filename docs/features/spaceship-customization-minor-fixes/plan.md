---
feature: spaceship-customization-minor-fixes
revision: 1
---

# Plan — Spaceship Customization Minor Fixes (Hardening Follow-up)

## Architecture

Four source files, two workspaces, no new modules:

- `src/backend/src/game/protocol.ts` — add `customization?: CustomizationState` to the `welcome` and `worldEntered` variants of `ServerMessage`, mirroring `economy?`/`upgrades?`. `CustomizationState` is already defined in this file and `placementPayload` already copies it defensively.
- `src/frontend/src/multiplayer/protocol.ts` — same type addition to the frontend mirror's `welcome`/`worldEntered` variants. `CustomizationState` is imported from `../game/types`; `parsePlacement` already parses `customization` defensively.
- `src/frontend/src/game/session.ts` — replace the two `(message as { customization?: CustomizationState })` reads with direct `message.customization` reads (now type-safe).
- `src/frontend/src/game/engine.ts` — in the cube-completion branch of `explode`, spread-copy `parts` and `appearance` when granting `+1` lootbox/key, matching `adoptCustomization`.

Data flow is unchanged: the server builds `welcome`/`worldEntered` from `Placement` (which already includes `customization?`), the frontend decodes via `parsePlacement`, and `session.ts` calls `engine.adoptCustomization`. The engine grant path only changes reference identity of the two nested maps.

## Interfaces / contracts

`ServerMessage` (both mirrors), `welcome`/`worldEntered` variants gain:

```
customization?: CustomizationState;
```

where `CustomizationState = { lootboxes: number; keys: number; parts: Record<string, number>; appearance: Record<string, string> }`.

Engine grant becomes:

```
customization = {
  lootboxes: customization.lootboxes + 1,
  keys: customization.keys + 1,
  parts: { ...customization.parts },
  appearance: { ...customization.appearance },
};
```

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/game/protocol.ts` | Edit | Add `customization?` to `welcome`/`worldEntered` variants |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Mirror the same type addition |
| `src/frontend/src/game/session.ts` | Edit | Remove the two casts; read `message.customization` directly |
| `src/frontend/src/game/engine.ts` | Edit | Spread-copy `parts`/`appearance` on cube-completion grant |
| `src/frontend/src/game/engine.test.ts` | Edit (maybe) | Assert defensive copy on grant (AC-4) |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Add the field to the type only; no codec changes | Codecs already copy/parse `customization`; the gap is purely the declared type | Re-deriving the variant from `Placement` (larger, riskier) |
| 2 | Spread-copy in the engine grant, matching `adoptCustomization` | Consistent with existing defensive-copy convention; avoids shared mutable state | Using `copyCustomizationState` helper (not exported from engine; spread is the established local style) |
| 3 | Keep session.ts logic unchanged apart from the read | Behavior already correct; only the cast is removed | Refactoring the handler (out of scope) |

## Risks & mitigations

- Risk: adding an optional field to a discriminated-union variant could surface excess-property errors in test helpers that spread `customization`. Mitigation: spread-conditionals are not subject to excess-property checks; verified by the existing `session.test.ts` helpers.
- Risk: defensive-copy change could break a test that asserts reference equality of `parts`/`appearance` across the grant. Mitigation: update such tests in the owned `engine.test.ts` to assert value equality instead; no production behavior change.
- Risk: type-only change could be missed by coverage. Mitigation: final task runs full `npm run coverage`.

## Open questions

- None.