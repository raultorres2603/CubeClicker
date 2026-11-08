# Build log — T5 — Hub + app migration to v2

Task: T5 (2026-11-08)
Files changed: `src/backend/src/game/hub.ts`, `src/backend/src/game/hub.test.ts`, `src/backend/src/app.test.ts`, `docs/features/spaceship-cursor-loot-animations/build-log-T5.md`
What changed & why:
- `hub.ts` now imports the v2 catalog (`parts-v2.ts`) instead of the legacy `parts.ts`: opens use `selectLootPart(random)` with the **captured hub RNG**, equip/unequip use `setSlotAppearance`, and the legacy `body-*`/`wings-*`/`engine-*` ids expand server-side to one/two slots with all-or-nothing ownership (AC-12, AC-18…AC-22, AC-28).
- Opens take a per-member `openingMembers` in-flight guard (dropped silently, released on success/failure/exception), broadcast `customizationUpdate` to every joined connection of the account, and send `lootboxOpened` to the opening connection only (AC-18/AC-19/AC-20/AC-26).
- **Draw order (F21):** one captured RNG stream; a join/completion draws one next-cube grid value and every account open that passes the guard draws exactly one weighted loot value, synchronously before the repository await. Documented in `hub.ts` above `const random = deps.random()`; never `deps.random()` per open.
- `hub.test.ts` rewritten for the v2 consumers: weighted/seed draws, opener-only reveal, per-member guard, concurrent tabs, standard-part equip, v2/legacy ownership (full/partial), no-op re-equip/unequip, rejoin/no-reveal.
- `app.test.ts` adds real-app (real WS) account join/open/equip/unequip across two tabs plus a late third connection, and the AC-33 legacy-row normalization fixture. A `queuedCount()` test helper asserts silence without leaking a `next()` waiter.

Decisions:
- The legacy equip target map lives in `hub.ts` because T5 may not edit `parts-v2.ts` (T1 owns it); it covers exactly the seven legacy `body-*`/`wings-*`/`engine-*` ids. Nose/cockpit legacy ids are v2 ids and resolve through `isValidPartId`.
- A repository exception during an open sends no protocol error (there is no pinned internal-error code); the guard is released in `finally` and the client may retry (no transport auto-retry, AC-20). Covered by a test.
- `lootboxOpened.parts` is filtered to positive integers because the AC-24 codec requires positive part counts; zero-count entries are semantically absent.
- For a legacy multi-slot equip only slots that differ from the target are written (one `setSlotAppearance` per changed slot), then one `customizationUpdate` is broadcast; re-equipping every target is a no-op.
- Unequip treats both a missing appearance slot and a slot explicitly set to its standard part as "already default" → no write, no broadcast (AC-22).

Evidence:

```
$ npm run lint
> lint
> eslint .

/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/src/render/cube-view.ts
  321:41  error  '_instant' is assigned a value but never used  @typescript-eslint/no-unused-vars
  344:19  error  '_dtMs' is defined but never used              @typescript-eslint/no-unused-vars

/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/src/render/spaceship.ts
  46:3  error  'SPACESHIP_IGNITION_COUNT' is defined but never used  @typescript-eslint/no-unused-vars

✖ 3 problems (3 errors, 0 warnings)
exit=1
```

Root lint is **transiently red only in T9's in-flight frontend files** (`src/frontend/src/render/cube-view.ts`, `src/frontend/src/render/spaceship.ts`); T5 did not edit frontend files. Scoped lint of the T5 files is green:

```
$ npx eslint src/backend/src/game/hub.ts src/backend/src/game/hub.test.ts src/backend/src/app.test.ts
exit=0
```

```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit
exit=0
```

```
$ npm test --workspace @cubeclicker/backend
 Test Files  24 passed (24)
      Tests  868 passed (868)
   Duration  3.12s (transform 2.16s, setup 0ms, collect 6.07s, tests 8.86s, environment 4ms, prepare 1.94s)
exit=0
```

(`hub.test.ts` 93 passed; `app.test.ts` 22 passed.)

```
$ npm run coverage --workspace @cubeclicker/backend
 Test Files  24 passed (24)
      Tests  868 passed (868)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.43 |    87.71 |    99.7 |   95.43 |
 src               |   80.54 |    84.44 |     100 |   80.54 |
  app.ts           |   80.54 |    84.44 |     100 |   80.54 | ...46,159,226-243
 ...
 src/game          |   96.53 |    95.35 |   99.26 |   96.53 |
  hub.ts           |   92.98 |    90.57 |     100 |   92.98 | ...1005,1037-1038
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
 ...
-------------------|---------|----------|---------|---------|-------------------
exit=0
```

Thresholds are ≥80 for statements/branches/functions/lines in the backend workspace; the command exited 0 (no threshold violation).

Acceptance audit:
- AC-12 → met. `hub.test.ts` “allows equipping a standard v2 part without it appearing in parts (AC-12)” equips `wing-left-default` with an empty `parts` map and asserts the exact `customizationUpdate`/stored appearance; standard legacy pair ids are covered by “expands a standard legacy pair id to both slots without ownership”.
- AC-18 → met. “openLootbox consumes the weighted draw…” asserts `hull-obsidian` (rare, hull), the opener-only `lootboxOpened` with absolute state, and the stored state; “seeded draws consume the captured hub RNG in order and grant different parts” asserts two different parts (`hull-obsidian`, `tail-fin-comet`) and `randomFactories() === 1` (captured RNG, F21). Draw order documented in `hub.ts`.
- AC-19 → met. `no_lootbox`/`no_key`/zero-both tests assert the exact single error frame, no `customizationUpdate`/`lootboxOpened`, and unchanged stored state; check order is `no_lootbox` first.
- AC-20 → met. “drops a second open from the same member while the first awaits the repository” asserts one repository call and one reveal; “releases the in-flight guard after a repository exception” asserts a later open succeeds; “lets independent account connections open concurrently” asserts two calls, two reveals and both lootbox/key pairs consumed.
- AC-21 → met. Unknown id → `unknown_part`; unowned rare/epic → `not_owned` with unchanged state; standard parts always allowed; server-derived slots; legacy target set tests (`body-gold` full/unowned, `wings-silver` both/partial, `engine-blue` both/partial); `unknown_slot` only on unequip.
- AC-22 → met. Owned v2 equip asserts exactly one `customizationUpdate`; legacy two-slot equip asserts one broadcast with both slots; re-equip test asserts no message and `setSlotAppearance` not called; unequip deletes one slot (other preserved) and broadcasts to both account tabs; unknown slot → `unknown_slot`; missing/default-slot unequip is a no-op.
- AC-26 → met. `hub.test.ts` multi-tab open/equip/unequip tests assert every joined account connection receives `customizationUpdate` and only the opener receives `lootboxOpened`; the guest peer receives nothing. Rejoin test asserts `welcome.customization` and no reveal. `app.test.ts` proves the same over real sockets, including a late connection adopting persisted state with no reveal.
- AC-28 → met. Legacy map + all-or-nothing ownership tests above; nose/cockpit legacy ids are covered by the v2 equip tests (`nose-crimson`) and the v2 catalog.
- AC-33 → met. `app.test.ts` “normalizes a legacy customization row on account join (AC-33 fixture)” seeds `parts={"wings-silver":2,"engine-blue":1,"body-gold":1}` and legacy appearance, then asserts the exact normalized `welcome.customization` (both wings/ignitions, hull, slot keys/values). Rejoin/equip persistence is asserted in the multi-tab test.

Deviations from spec: none. Root `npm run lint` is red only because T9's in-flight frontend files are not yet lint-clean (exact output above); T5's owned files lint clean and the backend workspace (typecheck/tests/coverage) is green.
