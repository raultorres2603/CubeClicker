# Build log — T3 — Build the branded verification HTML template

Task: T3 (2026-11-22)
Files changed: `src/backend/src/auth/email-template.ts`, `src/backend/src/auth/email-template.test.ts`, `docs/features/brevo-smtp-email-delivery/build-log-T3.md`

## What changed & why
- Added the pure `email-template.ts` renderer: `VERIFICATION_EMAIL_SUBJECT`, `EMAIL_PALETTE`, `formatExpiryDuration`, `emailAssetUrls`, `renderVerificationEmail(url, options?)` returning `{ subject, text, html }`. No I/O, clock or randomness.
- The plain-text body and subject are byte-for-byte the previous `email.ts` strings, so Mailpit's `/token=([A-Za-z0-9]+)/` extraction keeps working; `email.ts` itself is untouched (T4 rewires it).
- The HTML is a complete `<!doctype html>` document: a `width="100%"` void wrapper, a 600px surface panel with a metallic border and cyan rim strip, hero image, 26px headline, one emerald/ink CTA (`id="verify-cta"`), a visible fallback URL, the TTL expiry sentence, and a footer with the 72px cube mark. Four layout tables, all `role="presentation"`, all CSS inline with `bgcolor` fallbacks; no `<style>`, `<link>`, `<script>`, `<svg>`, `@import`, `@font-face`, media query, web font or CSS `url(`.
- Image origins derive from `emailAssetUrls(verificationUrl)` (`new URL(...).origin`, i.e. `APP_BASE_URL`); relative/malformed/non-HTTP URLs fall back to `/email/...` without throwing.
- Added 30 deterministic tests: exact subject/text, token regex, expiry formats, document shell, table count/roles, palette whitelist + exact per-literal counts, preheader/headline/CTA/fallback/footer exact substrings, two images with alt/width/height, URL-only audit, href/text escaping, absolute + relative + malformed asset URLs, byte budgets, committed PNG signature/dimensions/bytes, and five pinned WCAG contrast ratios.

## Decisions
- **Alt text follows AC-16(a), not the T3 brief's longer strings.** AC-16(a) pins `alt="CubeClicker"` on the hero and `alt="CubeClicker cube"` on the footer mark; the brief suggested descriptive variants, but the acceptance clause is literal and T3 claims it, so the spec values ship and the tests pin them. Decorative description lives in the surrounding copy ("Welcome to CubeClicker! …").
- **Default TTL is not duplicated.** The template imports `DEFAULT_VERIFICATION_TOKEN_TTL_MS` from `config.ts` (24 h) so the expiry note and the token issuer share one constant; `config.ts` stays I/O-free.
- **Expiry rounding never understates.** `formatExpiryDuration` rounds up to whole hours, switches to days only at ≥ 48 h and whole days: `1 hour`, `24 hours`, `90 min → 2 hours`, `7 days` (AC-19(a)).
- **Palette: presence + exact-set whitelist, exact per-literal counts.** "Exactly once each" cannot be literal in an inline-CSS email (each cell needs its own colour declaration plus a `bgcolor` fallback), so the test pins each literal's exact occurrence count and asserts the set of every `#hex` token is exactly the nine pinned values with no other literal (AC-15). Counts: void 4, surface 2, cyan 4, emerald 2, text 4, muted 4, metallic 1, border 2, CTA ink 1 (24 tokens).
- **Image-blocked safety.** The CTA is a text/background table cell (emerald `#34d399`, ink `#04120c`), the raw URL is printed below it, and both images carry explicit `width`/`height` and alt text.
- **Testing-tier exception (skill § Testing bar).** T3's production module is a pure renderer with no I/O and no boundary; its unit tests fully exercise it. The integration boundary (`SmtpEmailService.sendMail` with the template) is T4's `email.test.ts`, and the containerized Mailpit proof is T9; `files_owned` here excludes both. No test/coverage exclusion was added: `email-template.ts` reports 100% statements/branches/functions/lines.

## Evidence

### `npm run lint`
```
$ npm run lint
> lint
> eslint .
lint exit=0
```

### `npm run typecheck --workspace @cubeclicker/backend`
```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit
typecheck exit=0
```

### `npm test --workspace @cubeclicker/backend`
```
$ npm test --workspace @cubeclicker/backend
 ✓ src/auth/email-template.test.ts (30 tests) 6ms
 Test Files  39 passed (39)
      Tests  1738 passed (1738)
   Start at  11:52:49
   Duration  3.40s
```

Targeted run while iterating:
```
$ npm test --workspace @cubeclicker/backend -- --run src/auth/email-template.test.ts
 ✓ src/auth/email-template.test.ts (30 tests) 6ms
 Test Files  1 passed (1)
      Tests  30 passed (30)
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend
 Test Files  39 passed (39)
      Tests  1738 passed (1738)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   96.52 |    90.58 |    99.6 |   96.52 |
 src               |   96.78 |    90.56 |     100 |   96.78 |
 src/auth          |   95.93 |    83.56 |     100 |   95.93 |
  ...l-template.ts |     100 |      100 |     100 |     100 |
  email.ts         |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|
coverage exit=0 (thresholds 80/80/80/80 met)
```

### `test -f docs/features/brevo-smtp-email-delivery/build-log-T3.md`
```
$ test -f docs/features/brevo-smtp-email-delivery/build-log-T3.md
exit 0
```

### Build-log credential guard (tasks.md T3, verbatim)
```
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T3.md
exit 0 (no match, no output)
```

### Scope check
```
$ git status --short -- src/backend/src/auth docs/features/brevo-smtp-email-delivery/build-log-T3.md
?? docs/features/brevo-smtp-email-delivery/build-log-T3.md
?? src/backend/src/auth/email-template.test.ts
?? src/backend/src/auth/email-template.ts
```
Only the three `files_owned` paths are added; `email.ts`, `app.ts`, compose files and docs outside the build log are untouched.

## Acceptance audit
- **AC-15 → met.** Complete HTML document with all tables `role="presentation"` (4/4), inline CSS only, exactly the nine pinned literals and no other `#hex` token, preheader/headline/exactly one `id="verify-cta"` (`Verify email`, escaped href), visible fallback URL, expiry sentence, footer copy, and no `<script>`/`<style>`/`<svg>`/`@import`/`url(`. Evidence: `renderVerificationEmail — document shell`, `pinned palette`, `structure and copy` tests.
- **AC-16(a) → met.** Exactly two images: `http://localhost:5173/email/cubeclicker-hero.png` (600×200, `alt="CubeClicker"`) and `…/cubeclicker-cube.png` (72×72, `alt="CubeClicker cube"`); URL audit proves no third URL; CTA is text/background and the raw URL is visible. `sendMail` has no attachments (T4 owns that call; T3 supplies no attachments/CID). Evidence: image and URL-audit tests.
- **AC-16(e) → met.** `emailAssetUrls('/verify?token=x')` and `emailAssetUrls('not a url')` each return exactly `{ hero: '/email/cubeclicker-hero.png', cube: '/email/cubeclicker-cube.png' }`; rendering both URLs produces the CTA and visible raw URL without throwing. Evidence: `emailAssetUrls` and relative/malformed render tests.
- **AC-17(b) → met.** HTML is 4,322 bytes ≤ 20,480. Evidence: byte-budget test (exact value pinned).
- **AC-17(c) → met.** text + HTML + both referenced PNG bytes = 9,448 < 102,400; the five palette pairs pin 16.98:1, 10.15:1, 10.99:1, 15.89:1 and 9.96:1, all ≥ 4.5:1. Evidence: combined-budget and contrast tests.
- **AC-18(a) → met.** Plain-text body is byte-for-byte the previous body and the subject is unchanged; `/token=([A-Za-z0-9]+)/` extracts `abc123def456` from both HTML and text (three raw-token occurrences in HTML: CTA href, fallback href, fallback text). Evidence: plain-text/token tests.
- **AC-19(a) → met.** Default renders `This link expires in 24 hours.`; `3_600_000` renders `1 hour.`; `604_800_000` renders `7 days.` Evidence: expiry tests.
- **Not claimed here (owned by other tasks).** AC-16(b)/(c)/(d) are T2/T9/T8 (assets committed, serving proof, deployed recipe); AC-16(a)'s `sendMail` no-attachments half is T4; AC-18(b) is T9; AC-19(b) is T5.

## Deviations from spec
None. One deliberate reading: the T3 brief suggested longer image alt strings, but AC-16(a) pins the exact short alt text; the spec values ship. The palette phrase "exactly once each where applicable" is impossible for inline-CSS email cells (shared colours repeat across cells and `bgcolor` fallbacks); the tests pin the exact occurrence counts and the exact-set whitelist per AC-15's "no other `#rrggbb`".
