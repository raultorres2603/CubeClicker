# Build log — T1 — Brighten starfield and add twinkle
Task: T1 (2026-10-28)
Files changed: src/frontend/src/render/starfield.ts, src/frontend/src/render/starfield.test.ts
What changed & why: Raised STAR_MIN_BRIGHTNESS to 0.75 and STAR_SIZE to 0.8 (both now exported); set PointsMaterial opacity base to 1.0; added STARFIELD_OPACITY_BASE/AMPLITUDE/PULSE_PERIOD_MS exports; accumulate pulseTimeMs in update and modulate opacity per pinned formula; expose readonly pulseTimeMs and averageBrightness; add optional reducedMotion 4th param (amplitude 0 when true). averageBrightness computed as mean of stored per-star RGB color channels.
Decisions: averageBrightness derived from the stored Float32 color attribute so it exactly matches the mean of per-star color channel values; reducedMotion defaults to false via `=== true` check.
Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/frontend` → exit 0 (Test Files 40 passed, Tests 870 passed)
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (All files 94.99% stmts / 94.82% branches / 96.41% funcs / 94.99% lines)
Acceptance audit: AC-1 met (constants 0.75/0.8/1.0/1200); AC-2 met (pulseTimeMs/opacity formula/reduced motion); AC-3 met (averageBrightness exposed); AC-8 met (reduced motion opacity 1.0).
Deviations from spec: none
