# Build log — T2 (smoke-test-hygiene)

## Change
- `tests/e2e/smoke.mjs`: `pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS)` now uses `timeoutMs` for the readiness deadline; Mailpit readiness call site passes `MAILPIT_TIMEOUT_MS`.

## Verify

### `node --check tests/e2e/smoke.mjs`
```
$ node --check tests/e2e/smoke.mjs
exit=0
```

### Source inspection
```
$ grep -n "pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS)" tests/e2e/smoke.mjs
75:async function pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS) {

$ grep -n "}, MAILPIT_TIMEOUT_MS);" tests/e2e/smoke.mjs
602:  }, MAILPIT_TIMEOUT_MS);
```

Backend/frontend poll call sites unchanged (default `READY_TIMEOUT_MS`).

## Status
completed