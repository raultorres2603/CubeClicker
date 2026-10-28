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

describe('HUD panel frame (CSS guard, AC-2)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('pins the futuristic frame tokens in the base main > section rule', () => {
    const match = css.match(/main > section\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('base main > section rule not found');
    }
    const rule = match[1];
    expect(rule).toContain('position: absolute');
    expect(rule).toMatch(/(?:-webkit-)?backdrop-filter[^;]*blur\(/);
    expect(rule).toMatch(/box-shadow:[^;]*rgba\(124,\s*246,\s*255/);
    expect(rule).toMatch(/border:[^;]*rgba\(124,\s*246,\s*255/);
    expect(rule).toContain('overflow: hidden');
  });

  it('carries pointer-events: none on both detailing pseudo-elements', () => {
    for (const pseudo of ['::before', '::after']) {
      const match = css.match(new RegExp(`main > section${pseudo.replace('::', '\\:\\:')}\\s*\\{([\\s\\S]*?)\\}`));
      if (match === null) {
        throw new Error(`main > section${pseudo} rule not found`);
      }
      expect(match[1]).toContain('pointer-events: none');
    }
  });
});

describe('minimize control visibility (CSS guard, AC-3, AC-4)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('grants pointer-events: auto, cursor: pointer, and canonical 1.5rem size to the button', () => {
    const match = css.match(/main > section button\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('main > section button rule not found');
    }
    const rule = match[1];
    expect(rule).toContain('pointer-events: auto');
    expect(rule).toContain('cursor: pointer');
    expect(rule).toContain('min-width: 1.5rem;');
    expect(rule).toContain('min-height: 1.5rem;');
  });

  it('converts the rem size to at least 24px at a 16px root', () => {
    const match = css.match(/main > section button\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('main > section button rule not found');
    }
    const rule = match[1];
    const minWidth = rule.match(/min-width:\s*([\d.]+)rem/);
    if (minWidth === null) {
      throw new Error('min-width rem declaration not found');
    }
    expect(Number(minWidth[1]) * 16).toBeGreaterThanOrEqual(24);
  });

  it('provides a visible glyph via button::before or ::after content:', () => {
    expect(css).toMatch(/main > section button::(?:before|after)\s*\{[\s\S]*?content:/);
  });

  it('defines a focus-visible outline using the accent token', () => {
    const match = css.match(/main > section button:focus-visible\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('main > section button:focus-visible rule not found');
    }
    expect(match[1]).toMatch(/outline:\s*2px\s+solid\s+var\(--accent\)/);
  });
});

describe('minimized state presentation (CSS guard, AC-5)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('dims the panel via opacity or brightness in the exact minimized rule', () => {
    const match = css.match(/main > section\[data-minimized="true"\]\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('exact minimized rule not found');
    }
    expect(match[1]).toMatch(/opacity:|filter:\s*brightness\(/);
  });

  it('collapses the stat paragraphs in the adjacent p rule', () => {
    const match = css.match(/main > section\[data-minimized="true"\] p\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('minimized p rule not found');
    }
    const rule = match[1];
    expect(rule).toContain('max-height: 0');
    expect(rule).toContain('opacity: 0');
    expect(rule).toContain('overflow: hidden');
  });
});

describe('scanline detailing (CSS guard, AC-6)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('defines @keyframes hud-scanline', () => {
    expect(css).toMatch(/@keyframes\s+hud-scanline\s*\{/);
  });

  it('applies hud-scanline to main > section::after with a duration in 2000..6000ms', () => {
    const match = css.match(/main > section::after[^{]*\{[\s\S]*?animation:\s*hud-scanline\s+(\d+)ms\s+linear\s+infinite/);
    if (match === null) {
      throw new Error('hud-scanline on ::after not found');
    }
    const n = Number(match[1]);
    expect(n).toBeGreaterThanOrEqual(2000);
    expect(n).toBeLessThanOrEqual(6000);
  });

  it('carries content, position: absolute, and pointer-events: none on ::after', () => {
    const match = css.match(/main > section::after\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('main > section::after rule not found');
    }
    const rule = match[1];
    expect(rule).toMatch(/content:/);
    expect(rule).toContain('position: absolute');
    expect(rule).toContain('pointer-events: none');
  });

  it('does not apply hud-scanline to ::before', () => {
    const match = css.match(/main > section::before\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('main > section::before rule not found');
    }
    expect(match[1]).not.toContain('hud-scanline');
  });
});

describe('reduced motion (CSS guard, AC-7)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('disables animation and transition for the required selectors', () => {
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const block = css.slice(idx);
    expect(block).toContain('main > section::after');
    expect(block).toContain('animation: none');
    expect(block).toContain('transition: none');
  });

  it('names each required selector in the reduced-motion block', () => {
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const block = css.slice(idx);
    for (const sel of [
      'main > section,',
      'main > section::before,',
      'main > section::after,',
      'main > section button,',
      'main > section[data-minimized="true"] p,',
      'main > section[data-blinking="true"],',
    ]) {
      expect(block).toContain(sel);
    }
  });
});

describe('border light retained (CSS guard, AC-8)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('uses inset: 0 on main > section::before', () => {
    const match = css.match(/main > section::before\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('main > section::before rule not found');
    }
    expect(match[1]).toContain('inset: 0');
    expect(match[1]).not.toContain('inset: -1px');
  });

  it('retains border-light-travel on ::before', () => {
    const match = css.match(/main > section::before\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('main > section::before rule not found');
    }
    expect(match[1]).toContain('animation: border-light-travel');
  });

  it('carries pointer-events: none on ::before', () => {
    const match = css.match(/main > section::before\s*\{([\s\S]*?)\}/);
    if (match === null) {
      throw new Error('main > section::before rule not found');
    }
    expect(match[1]).toContain('pointer-events: none');
  });
});

describe('responsive fit (CSS guard, AC-11)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('introduces no second max-width: 480px block', () => {
    const matches = css.match(/@media\s*\(\s*max-width:\s*480px\s*\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('adjusts padding or font-size for main > section inside the 480px block', () => {
    const match = css.match(/@media\s*\(\s*max-width:\s*480px\s*\)\s*\{([\s\S]*?)\n\}/);
    if (match === null) {
      throw new Error('480px media block not found');
    }
    const block = match[1];
    expect(block).toMatch(/main > section[^{]*\{[\s\S]*?(?:padding:|font-size:)/);
  });
});
