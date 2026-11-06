# Build Log — T2

Task: Add `customization?: CustomizationState` to frontend protocol `welcome`/`worldEntered` variants.

## Changes

- `src/frontend/src/multiplayer/protocol.ts`: added `customization?: CustomizationState;` to both `welcome` and `worldEntered` variants of `ServerMessage`. `parsePlacement` already parsed `customization` defensively (no change needed).

## Verification evidence

### lint
```
$ npm run lint
> lint
> eslint .

(exit 0)
```

### typecheck
```
$ npm run typecheck --workspace @cubeclicker/frontend
> typecheck
> tsc --noEmit

(exit 0)
```

### test
```
$ npm test --workspace @cubeclicker/frontend -- protocol
> test
> vitest run protocol

 RUN  v3.2.7 .../src/frontend

 ✓ src/multiplayer/protocol.test.ts (171 tests) 18ms

 Test Files  1 passed (1)
      Tests  171 passed (171)
```
