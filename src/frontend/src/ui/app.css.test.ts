import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Weak regression guard for the auth-overlay backdrop centering (cube-centering).
 *
 * This test runs in the default node environment and has NO layout engine, so it cannot
 * assert anything about the rendered geometry of the backdrop or the cube. It only checks
 * that the CSS source still contains the two tokens the centering fix depends on:
 *   - `circle at 50% 50%` (radial-gradient focal point)
 *   - `background-origin: border-box` (percentage resolves against the full viewport box)
 *
 * Real visual centering still requires a browser/DOM layout engine and is out of scope for
 * the node test environment. If the rule is removed or the tokens change, this guard fails;
 * it does NOT prove the backdrop is visually centered.
 */
describe('auth overlay backdrop centering (CSS guard)', () => {
  it('keeps the auth-menu/auth-forms backdrop gradient centered at 50% 50% with border-box origin', () => {
    const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

    const match = css.match(/\.auth-menu,\s*\n\s*\.auth-forms\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('auth-menu/auth-forms rule not found in app.css');
    }
    const rule = match[1];

    expect(rule).toContain('circle at 50% 50%');
    expect(rule).toContain('background-origin: border-box');
  });
});