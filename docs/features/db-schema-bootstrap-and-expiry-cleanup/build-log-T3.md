# Build log — T3 — DB lifecycle configuration

Task: T3 (2026-11-24)
Files changed: `src/backend/src/db/lifecycle-config.ts`, `src/backend/src/db/lifecycle-config.test.ts`
What changed & why: new pure parser `loadDbLifecycleConfig(env)` for the two DB lifecycle services, with `DB_SCHEMA_BOOTSTRAP_ENABLED` (default `true`), `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` (default `true`) and `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` (default `3_600_000`, 60,000–86,400,000). Strict parsing throws an `Error` naming the exact variable for invalid values, including empty strings, so startup fails loudly (AC-14/D10).

Decisions:
- Mirrored the existing strict-parsing patterns: boolean reads/errors match `observability/config.ts` (`true|false|1|0`), integer reads/errors match `auth/config.ts` (`/^-?\d+$/` + min/max). Helper functions are local to this module per the plan (D10); extracting shared parsing helpers would edit out-of-scope shared config files.
- Exported `DEFAULT_CLEANUP_INTERVAL_MS`, `MIN_CLEANUP_INTERVAL_MS`, `MAX_CLEANUP_INTERVAL_MS` exactly as pinned in `plan.md` § Lifecycle configuration so T6/T9 reuse the constants instead of duplicating literals.
- Error messages pin concrete text: booleans `<VAR> must be a boolean ("true", "false", "1", or "0"); received "<raw>"`; interval `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS must be an integer between 60000 and 86400000; received "<raw>"`.
- Integration-tier exception (documented): `lifecycle-config.ts` is a side-effect-free function over an environment object with no I/O, route, socket, component or framework boundary, so there is no integration surface to exercise here. Its integration consumer is T8's `server.ts` wiring (`loadDbLifecycleConfig(env)` feeding `runDatabaseStartup`/cleanup), which AC-21/AC-22 cover in `server.test.ts`. The unit suite still covers every branch (100% statements/branches/functions/lines for the file).
- No dependency, config, compose, `.env*` or documentation change: the three variables are documented by T10 (AC-26), and T9 adds the container/render values.

Evidence (raw):

`npm run lint` → exit 0

```text

> lint
> eslint .

```

First full lint attempt at 09:14 hit a transient parse error in a parallel worker's mid-edit file (`src/backend/src/observability/logging.test.ts:476:19 Parsing error: ')' expected`, owned by T1, not T3); `npx eslint src/backend/src/db/lifecycle-config.ts src/backend/src/db/lifecycle-config.test.ts` passed (`SCOPED LINT OK`), and the re-run above passed with zero errors.

`npm run typecheck` → exit 0

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

```

`npm run test --workspace @cubeclicker/backend -- src/db/lifecycle-config.test.ts` → exit 0

```text

> test
> vitest run src/db/lifecycle-config.test.ts


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/lifecycle-config.test.ts (29 tests) 4ms

 Test Files  1 passed (1)
      Tests  29 passed (29)
   Start at  09:15:31
   Duration  267ms (transform 36ms, setup 0ms, collect 34ms, tests 4ms, environment 0ms, prepare 51ms)

```

The 29 cases cover: exact default object, pinned interval constants, `true|1|false|0` for both booleans, in-range interval bounds (`60000`, `120000`, `3600000`, `86400000`), out-of-range (`59999`, `86400001`, `-60000`, `0`), non-integers (`60000.5`, `1e5`, `1h`, ` 60000`), empty strings for all three variables with exact messages, field-crossing independence, and unrelated env vars ignored. Assertions use exact values/whole objects; no wildcard matchers.

`npm run coverage --workspace @cubeclicker/backend` → exit 0

```text
 Test Files  43 passed (43)
      Tests  1856 passed (1856)
   Start at  09:15:32
   Duration  3.91s (transform 5.30s, setup 0ms, collect 14.97s, tests 15.70s, environment 10ms, prepare 4.94s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.76 |    90.88 |   99.62 |   95.76 |
 src/db            |   77.54 |    94.94 |     100 |   77.54 |
  ...cle-config.ts |     100 |      100 |     100 |     100 |
```

All four workspace aggregates are ≥ 80 (statements 95.76, branches 90.88, functions 99.62, lines 95.76) and `lifecycle-config.ts` is at 100% on all four. The run also counted a parallel worker's then-untracked, test-less `src/db/schema-contract.ts` (T2, not owned by T3) at 0%, which is why `src/db` shows 77.54%; the aggregate gate still passed and the command exited 0.

Acceptance audit:
- AC-14 → met. `loadDbLifecycleConfig({})` returns `{ bootstrapEnabled: true, cleanupEnabled: true, cleanupIntervalMs: 3_600_000 }` (exact `toEqual`); `true`/`1` and `false`/`0` accepted for both booleans; `60000`–`86400000` accepted for the interval; `DB_SCHEMA_BOOTSTRAP_ENABLED=maybe`/`''`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=yes`/`''`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=59999`/`86400001`/`''` each throw an `Error` whose exact message names the variable (`toThrowError(new Error(...))`).
- Integration-tier exception recorded above (pure config parser; T8 `server.ts` is the integration consumer).

Deviations from spec: none. `.env*` untouched (manual boundary; no task-owned edit). No new dependency; `package.json`/`package-lock.json` unchanged by this task.
