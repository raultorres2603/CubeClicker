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

describe('animated border light (CSS guard, AC-1, AC-2)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('defines @keyframes border-light-travel', () => {
    expect(css).toMatch(/@keyframes\s+border-light-travel\s*\{/);
  });

  it('applies border-light-travel to a rule whose selector contains main > section', () => {
    const match = css.match(/main > section[^{]*\{[\s\S]*?animation:\s*border-light-travel\s+(\d+)ms\s+linear\s+infinite/);
    if (match === null) {
      throw new Error('border-light-travel on main > section not found');
    }
    const n = Number(match[1]);
    expect(n).toBeGreaterThanOrEqual(2000);
    expect(n).toBeLessThanOrEqual(6000);
  });

  it('applies border-light-travel to a rule whose selector contains .user-panel', () => {
    const match = css.match(/\.user-panel[^{]*\{[\s\S]*?animation:\s*border-light-travel\s+(\d+)ms\s+linear\s+infinite/);
    if (match === null) {
      throw new Error('border-light-travel on .user-panel not found');
    }
    const n = Number(match[1]);
    expect(n).toBeGreaterThanOrEqual(2000);
    expect(n).toBeLessThanOrEqual(6000);
  });

  it('disables the border-light animation under prefers-reduced-motion for main > section', () => {
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const block = css.slice(idx);
    const match = block.match(/main > section[^{]*\{[\s\S]*?animation:\s*none/);
    expect(match).not.toBeNull();
  });

  it('disables the border-light animation under prefers-reduced-motion for .user-panel', () => {
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const block = css.slice(idx);
    const match = block.match(/\.user-panel[^{]*\{[\s\S]*?animation:\s*none/);
    expect(match).not.toBeNull();
  });
});

describe('HUD blink (CSS guard, AC-4)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('defines @keyframes hud-blink', () => {
    expect(css).toMatch(/@keyframes\s+hud-blink\s*\{/);
  });

  it('applies hud-blink to main > section[data-blinking="true"] with duration <= 300ms', () => {
    const match = css.match(/main > section\[data-blinking="true"\][^{]*\{[\s\S]*?animation:\s*hud-blink\s+(\d+)ms/);
    if (match === null) {
      throw new Error('hud-blink on main > section[data-blinking="true"] not found');
    }
    const n = Number(match[1]);
    expect(n).toBeLessThanOrEqual(300);
  });

  it('disables the blink animation under prefers-reduced-motion for main > section[data-blinking="true"]', () => {
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const block = css.slice(idx);
    const match = block.match(/main > section\[data-blinking="true"\][^{]*\{[\s\S]*?animation:\s*none/);
    expect(match).not.toBeNull();
  });
});
