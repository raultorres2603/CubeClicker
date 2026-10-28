import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

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

describe('overlay motion (CSS guard, AC-7, AC-8)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('grants pointer-events: auto to main > section button', () => {
    expect(css).toContain('main > section button');
    expect(css).toContain('pointer-events: auto');
  });

  it('applies a transition with duration <= 200ms to main > section', () => {
    expect(css).toMatch(/main > section\s*\{[\s\S]*?transition:[^}]*150ms/);
  });

  it('applies scale(0.97) (or 0.98) on the minimize button :active', () => {
    expect(css).toMatch(/main > section button:active\s*\{[\s\S]*?transform:\s*scale\(0\.9[78]\)/);
  });

  it('collapses stat paragraphs when data-minimized="true"', () => {
    expect(css).toContain('main > section[data-minimized="true"]');
    expect(css).toContain('max-height: 0');
    expect(css).toContain('opacity: 0');
    expect(css).toContain('overflow: hidden');
  });

  it('disables transitions under prefers-reduced-motion: reduce', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const block = css.slice(idx);
    expect(block).toContain('transition: none');
    expect(block).toContain('animation: none');
  });
});
