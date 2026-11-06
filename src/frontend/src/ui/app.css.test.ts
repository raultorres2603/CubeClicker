import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

function ruleBody(selectorPattern: RegExp): string {
  const match = css.match(selectorPattern);
  if (match === null) {
    throw new Error(`rule not found: ${selectorPattern}`);
  }
  return match[1];
}

describe('auth overlay backdrop centering (CSS guard)', () => {
  it('keeps the auth-menu/auth-forms backdrop gradient centered at 50% 50% with border-box origin', () => {
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

describe('metallic frame tokens (AC-2)', () => {
  it('declares the metal colour tokens with exact values', () => {
    expect(css).toContain('--frame-metal-light: #c9d8e4;');
    expect(css).toContain('--frame-metal-mid: #879db0;');
    expect(css).toContain('--frame-metal-dark: #3f5365;');
    expect(css).toContain('--frame-metal-deep: #23323e;');
    expect(css).toContain('--frame-glow: rgba(124, 246, 255, 0.4);');
    expect(css).toContain('--frame-glow-alert: rgba(255, 107, 107, 0.4);');
    expect(css).toContain('--frame-center-top: rgba(18, 26, 36, 0.9);');
    expect(css).toContain('--frame-center-bottom: rgba(6, 10, 20, 0.95);');
    expect(css).toContain('--frame-center-alert-start: rgba(44, 18, 22, 0.92);');
    expect(css).toContain('--frame-center-alert-end: rgba(20, 8, 10, 0.95);');
  });

  it('declares --frame-metal as a 145deg linear-gradient referencing all four metal tokens with >=6 stops', () => {
    const match = css.match(/--frame-metal:\s*linear-gradient\(\s*145deg,[\s\S]*?\);/);
    expect(match).not.toBeNull();
    const value = match![0];
    expect(value).toContain('var(--frame-metal-light)');
    expect(value).toContain('var(--frame-metal-mid)');
    expect(value).toContain('var(--frame-metal-dark)');
    expect(value).toContain('var(--frame-metal-deep)');
    const stops = (value.match(/%/g) || []).length;
    expect(stops).toBeGreaterThanOrEqual(6);
  });

  it('declares --frame-center and --frame-center-alert as linear-gradients referencing the stops', () => {
    expect(css).toMatch(/--frame-center:\s*linear-gradient\([^)]*var\(--frame-center-top\)[^)]*var\(--frame-center-bottom\)[^)]*\)/);
    expect(css).toMatch(/--frame-center-alert:\s*linear-gradient\([\s\S]*?var\(--frame-center-alert-start\)[\s\S]*?var\(--frame-center-alert-end\)[\s\S]*?\)/);
  });
});

describe('shared frame rule (AC-3)', () => {
  const re = /main > section,\s*\n\s*\.user-panel section,\s*\n\s*\.connection-banner,\s*\n\s*\.phase-announcement,\s*\n\s*\.auth-panel,\s*\n\s*\.auth-error\s*\{([\s\S]*?)\}/;
  it('exists with the ordered selector list', () => {
    expect(css).toMatch(re);
  });
  it('declares the frame technique', () => {
    const body = ruleBody(re);
    expect(body).toContain('border: 2px solid transparent;');
    expect(body).toContain('border-image: var(--frame-metal) 1;');
    expect(body).toContain('border-radius: 0;');
    expect(body).toContain('background: var(--frame-center);');
    expect(body).toContain('box-shadow: inset 0 0 0 1px rgba(201, 216, 228, 0.22);');
    expect(body).toContain('clip-path: polygon(');
    expect(body).toContain('var(--frame-cut)');
    expect(body).toContain('calc(100% - var(--frame-cut))');
    expect(body).toMatch(/filter:\s*drop-shadow\(/);
    expect(body).toContain('var(--frame-glow)');
    expect(body).toContain('drop-shadow(');
  });
  it('phase-announcement:empty suppresses the frame', () => {
    const m = css.match(/\.phase-announcement:empty\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('border-image: none;');
    expect(body).toContain('background: transparent;');
    expect(body).toContain('box-shadow: none;');
    expect(body).toContain('filter: none;');
    const m2 = css.match(/\.phase-announcement:empty::before\s*\{([\s\S]*?)\}/);
    expect(m2).not.toBeNull();
    expect(m2![1]).toContain('content: none;');
  });
});

describe('bevel tiers (AC-4)', () => {
  it('shared rule sets --frame-cut: 0.75rem', () => {
    const re = /main > section,\s*\n\s*\.user-panel section,\s*\n\s*\.connection-banner,\s*\n\s*\.phase-announcement,\s*\n\s*\.auth-panel,\s*\n\s*\.auth-error\s*\{([\s\S]*?)\}/;
    expect(ruleBody(re)).toContain('--frame-cut: 0.75rem;');
  });
  it('.auth-panel later sets --frame-cut: 1rem', () => {
    const m = css.match(/\.auth-panel\s*\{\s*\n\s*--frame-cut:\s*1rem;/);
    expect(m).not.toBeNull();
  });
  it('.connection-banner, .phase-announcement later sets --frame-cut: 0.5rem', () => {
    const m = css.match(/\.connection-banner,\s*\n\s*\.phase-announcement\s*\{\s*\n\s*--frame-cut:\s*0\.5rem;/);
    expect(m).not.toBeNull();
  });
});

describe('framed controls (AC-5)', () => {
  const re = /\.user-panel > button,\s*\n\s*\.connection-banner button,\s*\n\s*\.auth-button,\s*\n\s*\.verification-pending button\s*\{([\s\S]*?)\}/;
  it('exists with ordered selector list', () => {
    expect(css).toMatch(re);
  });
  it('declares control frame technique', () => {
    const body = ruleBody(re);
    expect(body).toContain('--frame-cut: 0.375rem;');
    expect(body).toContain('border: 1px solid transparent;');
    expect(body).toContain('border-image: var(--frame-metal) 1;');
    expect(body).toContain('border-radius: 0;');
    expect(body).toContain('background: var(--frame-center);');
    expect(body).toContain('clip-path: polygon(');
  });
});

describe('frame persistence across states (AC-6)', () => {
  const rules = [
    /\.auth-button,\s*\n\s*\.verification-pending button\s*\{([\s\S]*?)\}/,
    /\.user-panel > button,\s*\n\s*\.connection-banner button\s*\{([\s\S]*?)\}/,
    /\.auth-button-primary\s*\{([\s\S]*?)\}/,
    /\.auth-button-primary:hover\s*\{([\s\S]*?)\}/,
    /\.auth-button-secondary\s*\{([\s\S]*?)\}/,
    /\.auth-button-secondary:hover\s*\{([\s\S]*?)\}/,
    /\.auth-button:hover\s*\{([\s\S]*?)\}/,
    /\.verification-pending button:hover:not\(:disabled\)\s*\{([\s\S]*?)\}/,
    /\.user-panel > button:hover\s*\{([\s\S]*?)\}/,
    /\.connection-banner button:hover\s*\{([\s\S]*?)\}/,
  ];
  for (const re of rules) {
    it(`no background declaration in ${re}`, () => {
      const body = ruleBody(re);
      expect(body).not.toMatch(/background(?:-color|-image)?:/);
    });
  }
  it('.auth-button-primary declares inset accent box-shadow', () => {
    const body = ruleBody(/\.auth-button-primary\s*\{([\s\S]*?)\}/);
    expect(body).toContain('box-shadow: inset 0 0 0 1px var(--accent);');
  });
  it('each framed control hover changes color/filter/box-shadow', () => {
    for (const re of [/\.user-panel > button:hover\s*\{([\s\S]*?)\}/, /\.connection-banner button:hover\s*\{([\s\S]*?)\}/, /\.auth-button:hover\s*\{([\s\S]*?)\}/]) {
      const body = ruleBody(re);
      expect(body.match(/color:|filter:|box-shadow:/)).not.toBeNull();
    }
  });
});

describe('inset wells (AC-7)', () => {
  it('exactly one rule with selector list .auth-input, .verification-pending input', () => {
    const matches = css.match(/\.auth-input,\s*\n\s*\.verification-pending input\s*\{([\s\S]*?)\}/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });
  it('merged rule keeps layout and well declarations', () => {
    const body = ruleBody(/\.auth-input,\s*\n\s*\.verification-pending input\s*\{([\s\S]*?)\}/);
    for (const d of ['box-sizing', 'width', 'min-height', 'padding', 'color', 'font', 'font-size', 'letter-spacing', 'text-transform']) {
      expect(body).toMatch(new RegExp(d));
    }
    expect(body).toContain('--frame-cut: 0.25rem;');
    expect(body).toContain('border: 1px solid var(--frame-metal-dark);');
    expect(body).toContain('border-radius: 0;');
    expect(body).toContain('background: rgba(0, 0, 0, 0.42);');
    expect(body).toContain('clip-path: polygon(');
  });
  it('focus rule keeps border-color and inset box-shadow', () => {
    const body = ruleBody(/\.auth-input:focus,\s*\n\s*\.verification-pending input:focus\s*\{([\s\S]*?)\}/);
    expect(body).toContain('box-shadow: inset 0 0 0 2px var(--accent);');
    expect(body).toContain('border-color: var(--accent);');
  });
});

describe('focus rings (AC-8)', () => {
  it('user/control focus-visible group has inset ring', () => {
    const body = ruleBody(/\.user-panel > button:focus-visible,\s*\n\s*\.user-panel li button:focus-visible,\s*\n\s*\.connection-banner button:focus-visible\s*\{([\s\S]*?)\}/);
    expect(body).toContain('box-shadow: inset 0 0 0 2px var(--accent)');
  });
  it('auth focus-visible group has inset ring', () => {
    const body = ruleBody(/\.auth-button:focus-visible,\s*\n\s*\.verification-pending button:focus-visible\s*\{([\s\S]*?)\}/);
    expect(body).toContain('box-shadow: inset 0 0 0 2px var(--accent)');
  });
  it('main > section button:focus-visible has inset ring', () => {
    const body = ruleBody(/main > section button:focus-visible\s*\{([\s\S]*?)\}/);
    expect(body).toContain('box-shadow: inset 0 0 0 2px var(--accent)');
  });
  it('auth input focus has inset ring', () => {
    const body = ruleBody(/\.auth-input:focus,\s*\n\s*\.verification-pending input:focus\s*\{([\s\S]*?)\}/);
    expect(body).toContain('box-shadow: inset 0 0 0 2px var(--accent);');
  });
});

describe('frame sheen (AC-9)', () => {
  it('defines @keyframes frame-sheen animating background-position to one negative and one positive percentage', () => {
    const m = css.match(/@keyframes\s+frame-sheen\s*\{([\s\S]*?)\n\}/);
    expect(m).not.toBeNull();
    const block = m![1];
    expect(block).toMatch(/from\s*\{[\s\S]*?background-position:\s*-\d+%/);
    expect(block).toMatch(/to\s*\{[\s\S]*?background-position:\s*\d+%/);
  });
  const re = /main > section::before,\s*\n\s*\.user-panel section::before,\s*\n\s*\.connection-banner::before,\s*\n\s*\.phase-announcement::before,\s*\n\s*\.auth-panel::before\s*\{([\s\S]*?)\}/;
  it('sheen rule exists', () => {
    expect(css).toMatch(re);
  });
  it('sheen rule declarations', () => {
    const body = ruleBody(re);
    expect(body).toContain("content: '';");
    expect(body).toContain('position: absolute;');
    expect(body).toContain('inset: 0;');
    expect(body).toContain('padding: 2px;');
    expect(body).toContain('pointer-events: none;');
    expect(body).toContain('rgba(230, 245, 255, 0.6)');
    expect(body).toContain('background-size: 300% 100%;');
    expect(body).toContain('-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);');
    expect(body).toContain('-webkit-mask-composite: xor;');
    expect(body).toContain('mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);');
    expect(body).toContain('mask-composite: exclude;');
    expect(body).toMatch(/animation:\s*frame-sheen\s+\d+ms\s+linear\s+infinite/);
    const mm = body.match(/animation:\s*frame-sheen\s+(\d+)ms/);
    const n = Number(mm![1]);
    expect(n).toBeGreaterThanOrEqual(2000);
    expect(n).toBeLessThanOrEqual(6000);
    expect(body).not.toContain('inset: -2px');
  });
  it('mask-composite declarations follow their shorthands', () => {
    const body = ruleBody(re);
    const webkitMaskIdx = body.search(/^\s*-webkit-mask:/m);
    const webkitCompIdx = body.search(/^\s*-webkit-mask-composite:/m);
    const maskIdx = body.search(/^\s*mask:/m);
    const compIdx = body.search(/^\s*mask-composite:/m);
    expect(webkitCompIdx).toBeGreaterThan(webkitMaskIdx);
    expect(compIdx).toBeGreaterThan(maskIdx);
  });
  it('user-panel section, .auth-panel position relative', () => {
    const m = css.match(/\.user-panel section,\s*\n\s*\.auth-panel\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('position: relative;');
  });
});

describe('no rounded chrome (AC-10)', () => {
  it('every border-radius declaration is 0', () => {
    const matches = css.match(/border-radius:\s*[^;]+;/g) || [];
    for (const m of matches) {
      expect(m).toBe('border-radius: 0;');
    }
  });
});

describe('HUD blink (AC-12)', () => {
  it('defines @keyframes hud-blink', () => {
    expect(css).toMatch(/@keyframes\s+hud-blink\s*\{/);
  });
  it('applies hud-blink with duration <= 300ms', () => {
    const m = css.match(/main > section\[data-blinking="true"\][^{]*\{[\s\S]*?animation:\s*hud-blink\s+(\d+)ms/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(300);
  });
  it('keyframes animates filter and no box-shadow', () => {
    const m = css.match(/@keyframes\s+hud-blink\s*\{([\s\S]*?)\n\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('filter:');
    expect(m![1]).not.toContain('box-shadow:');
  });
});

describe('minimize control (AC-13)', () => {
  it('main > section button has required declarations', () => {
    const body = ruleBody(/main > section button\s*\{([\s\S]*?)\}/);
    expect(body).toContain('pointer-events: auto');
    expect(body).toContain('cursor: pointer');
    expect(body).toContain('min-width: 1.5rem;');
    expect(body).toContain('min-height: 1.5rem;');
  });
  it('button::before has content:', () => {
    expect(css).toMatch(/main > section button::before\s*\{[\s\S]*?content:/);
  });
  it('button:focus-visible has outline and inset ring', () => {
    const body = ruleBody(/main > section button:focus-visible\s*\{([\s\S]*?)\}/);
    expect(body).toMatch(/outline:\s*2px\s+solid\s+var\(--accent\)/);
    expect(body).toContain('box-shadow: inset 0 0 0 2px var(--accent)');
  });
});

describe('minimized state (AC-14)', () => {
  it('exact minimized rule has opacity or brightness', () => {
    const m = css.match(/main > section\[data-minimized="true"\]\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/opacity:|filter:\s*brightness\(/);
  });
  it('adjacent p rule collapses', () => {
    const m = css.match(/main > section\[data-minimized="true"\] p\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('max-height: 0');
    expect(body).toContain('opacity: 0');
    expect(body).toContain('overflow: hidden');
  });
});

describe('scanline (AC-11)', () => {
  it('defines @keyframes hud-scanline', () => {
    expect(css).toMatch(/@keyframes\s+hud-scanline\s*\{/);
  });
  it('applies to ::after with duration in range', () => {
    const m = css.match(/main > section::after[^{]*\{[\s\S]*?animation:\s*hud-scanline\s+(\d+)ms\s+linear\s+infinite/);
    expect(m).not.toBeNull();
    const n = Number(m![1]);
    expect(n).toBeGreaterThanOrEqual(2000);
    expect(n).toBeLessThanOrEqual(6000);
  });
  it('::after carries content, position, pointer-events', () => {
    const body = ruleBody(/main > section::after\s*\{([\s\S]*?)\}/);
    expect(body).toMatch(/content:/);
    expect(body).toContain('position: absolute');
    expect(body).toContain('pointer-events: none');
  });
  it('sheen rule does not contain hud-scanline', () => {
    const body = ruleBody(/main > section::before,\s*\n\s*\.user-panel section::before,\s*\n\s*\.connection-banner::before,\s*\n\s*\.phase-announcement::before,\s*\n\s*\.auth-panel::before\s*\{([\s\S]*?)\}/);
    expect(body).not.toContain('hud-scanline');
  });
});

describe('reduced motion (AC-15)', () => {
  it('names all required selectors', () => {
    const idx = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const block = css.slice(idx);
    const sels = [
      'main > section,',
      'main > section::before,',
      'main > section::after,',
      'main > section button,',
      'main > section[data-minimized="true"] p,',
      'main > section[data-blinking="true"],',
      '.user-panel section,',
      '.user-panel section::before,',
      '.connection-banner,',
      '.connection-banner::before,',
      '.phase-announcement,',
      '.phase-announcement::before,',
      '.auth-panel,',
      '.auth-panel::before,',
      '.auth-button,',
      '.verification-pending button,',
      '.auth-input',
    ];
    for (const s of sels) {
      expect(block).toContain(s);
    }
    expect(block).toContain('animation: none');
    expect(block).toContain('transition: none');
  });
});

describe('responsive fit (AC-16)', () => {
  it('exactly one max-width: 480px block', () => {
    const matches = css.match(/@media\s*\(\s*max-width:\s*480px\s*\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });
  it('adjusts padding/font-size for main > section inside', () => {
    const m = css.match(/@media\s*\(\s*max-width:\s*480px\s*\)\s*\{([\s\S]*?)\n\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/main > section[^{]*\{[\s\S]*?(?:padding:|font-size:)/);
  });
});

describe('alert overrides (AC-21)', () => {
  it('.auth-error declares overrides and color, no frame-erasing props', () => {
    // find the standalone .auth-error rule (not in shared list). Match a rule starting at line .auth-error {
    const idx = css.indexOf('\n.auth-error {');
    const body = css.slice(idx).match(/\{([\s\S]*?)\}/)![1];
    expect(body).toContain('--frame-center: var(--frame-center-alert);');
    expect(body).toContain('--frame-glow: var(--frame-glow-alert);');
    expect(body).toContain('color: #ffb4b4;');
    expect(body).not.toMatch(/background(?:-color|-image)?:/);
    expect(body).not.toMatch(/border(?:-radius)?:/);
    expect(body).not.toMatch(/box-shadow:/);
  });
});

describe('disabled controls (AC-23)', () => {
  it('.auth-button:disabled, .verification-pending button:disabled declares opacity and cursor, no background', () => {
    const m = css.match(/\.auth-button:disabled,\s*\n\s*\.verification-pending button:disabled\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('opacity: 0.62;');
    expect(body).toContain('cursor: progress;');
    expect(body).not.toMatch(/background/);
  });
  it('.user-panel li button:disabled declares color and cursor, no background', () => {
    const m = css.match(/\.user-panel li button:disabled\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('color: rgba(232, 246, 255, 0.62);');
    expect(body).toContain('cursor: default;');
    expect(body).not.toMatch(/background/);
  });
});

describe('HUD panel frame (CSS guard, AC-2)', () => {
  it('pins position/backdrop/overflow on base main > section', () => {
    const m = css.match(/main > section\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('position: absolute');
    expect(body).toMatch(/(?:-webkit-)?backdrop-filter[^;]*blur\(/);
    expect(body).toContain('overflow: hidden');
  });
  it('carries pointer-events: none on both detailing pseudo-elements', () => {
    for (const pseudo of ['::before', '::after']) {
      const re = new RegExp(`main > section${pseudo.replace('::', '\\:\\:')}\\s*\\{([\\s\\S]*?)\\}`);
      const m = css.match(re);
      // sheen rule is grouped for ::before, so match grouped rule
      if (pseudo === '::before') {
        const mm = css.match(/main > section::before,[\s\S]*?\{([\s\S]*?)\}/);
        expect(mm).not.toBeNull();
        expect(mm![1]).toContain('pointer-events: none');
      } else {
        expect(m).not.toBeNull();
        expect(m![1]).toContain('pointer-events: none');
      }
    }
  });
});

describe('minimize control visibility (CSS guard, AC-3, AC-4)', () => {
  it('grants pointer-events: auto, cursor: pointer, and canonical 1.5rem size to the button', () => {
    const m = css.match(/main > section button\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('pointer-events: auto');
    expect(body).toContain('cursor: pointer');
    expect(body).toContain('min-width: 1.5rem;');
    expect(body).toContain('min-height: 1.5rem;');
  });
  it('provides a visible glyph via button::before or ::after content:', () => {
    expect(css).toMatch(/main > section button::(?:before|after)\s*\{[\s\S]*?content:/);
  });
  it('defines a focus-visible outline using the accent token', () => {
    const m = css.match(/main > section button:focus-visible\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/outline:\s*2px\s+solid\s+var\(--accent\)/);
  });
});

describe('minimized state presentation (CSS guard, AC-5)', () => {
  it('dims the panel via opacity or brightness in the exact minimized rule', () => {
    const m = css.match(/main > section\[data-minimized="true"\]\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/opacity:|filter:\s*brightness\(/);
  });
  it('collapses the stat paragraphs in the adjacent p rule', () => {
    const m = css.match(/main > section\[data-minimized="true"\] p\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('max-height: 0');
    expect(body).toContain('opacity: 0');
    expect(body).toContain('overflow: hidden');
  });
});

describe('scanline detailing (CSS guard, AC-6)', () => {
  it('defines @keyframes hud-scanline', () => {
    expect(css).toMatch(/@keyframes\s+hud-scanline\s*\{/);
  });
  it('applies hud-scanline to main > section::after with a duration in 2000..6000ms', () => {
    const m = css.match(/main > section::after[^{]*\{[\s\S]*?animation:\s*hud-scanline\s+(\d+)ms\s+linear\s+infinite/);
    expect(m).not.toBeNull();
    const n = Number(m![1]);
    expect(n).toBeGreaterThanOrEqual(2000);
    expect(n).toBeLessThanOrEqual(6000);
  });
  it('carries content, position: absolute, and pointer-events: none on ::after', () => {
    const m = css.match(/main > section::after\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toMatch(/content:/);
    expect(body).toContain('position: absolute');
    expect(body).toContain('pointer-events: none');
  });
  it('does not apply hud-scanline to ::before', () => {
    const m = css.match(/main > section::before,[\s\S]*?\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain('hud-scanline');
  });
});

describe('reduced motion (CSS guard, AC-7)', () => {
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
  it('uses inset: 0 on main > section::before', () => {
    const m = css.match(/main > section::before,[\s\S]*?\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('inset: 0');
    expect(m![1]).not.toContain('inset: -1px');
    expect(m![1]).not.toContain('inset: -2px');
  });
  it('carries pointer-events: none on ::before', () => {
    const m = css.match(/main > section::before,[\s\S]*?\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('pointer-events: none');
  });
});

describe('responsive fit (CSS guard, AC-11)', () => {
  it('introduces no second max-width: 480px block', () => {
    const matches = css.match(/@media\s*\(\s*max-width:\s*480px\s*\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });
  it('adjusts padding or font-size for main > section inside the 480px block', () => {
    const m = css.match(/@media\s*\(\s*max-width:\s*480px\s*\)\s*\{([\s\S]*?)\n\}/);
    expect(m).not.toBeNull();
    const block = m![1];
    expect(block).toMatch(/main > section[^{]*\{[\s\S]*?(?:padding:|font-size:)/);
  });
});
describe('spaceship customization placement (CSS guard)', () => {
  it('positions .customization-panel as an absolutely positioned overlay at bottom-left', () => {
    const m = css.match(/\.customization-panel\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('position: absolute;');
    expect(body).toContain('top: auto;');
    expect(body).toContain('bottom: calc(4rem + env(safe-area-inset-bottom, 0px));');
    expect(body).toContain('left: calc(1rem + env(safe-area-inset-left, 0px));');
  });

  it('positions .customization-toggle as an absolutely positioned overlay at bottom-left', () => {
    const m = css.match(/\.customization-toggle\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('position: absolute;');
    expect(body).toContain('bottom: calc(1rem + env(safe-area-inset-bottom, 0px));');
    expect(body).toContain('left: calc(1rem + env(safe-area-inset-left, 0px));');
  });
});

describe('upgrades panel placement (CSS guard)', () => {
  it('positions .upgrades-panel as an absolutely positioned overlay at bottom-right', () => {
    const m = css.match(/\.upgrades-panel\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toContain('position: absolute;');
    expect(body).toContain('top: auto;');
    expect(body).toContain('bottom: calc(1rem + env(safe-area-inset-bottom, 0px));');
    expect(body).toContain('left: auto;');
    expect(body).toContain('right: calc(1rem + env(safe-area-inset-right, 0px));');
  });
});

describe('upgrades panel buy icon (CSS guard, upgrades-buy-icon)', () => {
  it('defines a .upgrades-panel button::before rule with a content: declaration', () => {
    const m = css.match(/\.upgrades-panel button::before\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/content:/);
  });

  it('overrides the inherited glyph with content: \'+\'', () => {
    const m = css.match(/\.upgrades-panel button::before\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toContain("content: '+';");
  });
});

describe('stylesheet hygiene', () => {
  it('ends with exactly one trailing newline', () => {
    expect(css.endsWith('\n')).toBe(true);
    expect(css.endsWith('\n\n')).toBe(false);
  });
});
