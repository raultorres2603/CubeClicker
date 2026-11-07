import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./game-view.css', import.meta.url), 'utf8');
const themeSource = readFileSync(new URL('./theme.ts', import.meta.url), 'utf8');
const appCss = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

/** Selector matching must ignore commentary: only real selectors count (AC-8). */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

const cssSource = withoutComments(css);
const appCssSource = withoutComments(appCss);

function ruleBody(source: string, selectorPattern: RegExp): string {
  const match = source.match(selectorPattern);
  if (match === null) {
    throw new Error(`rule not found: ${selectorPattern}`);
  }
  return match[1] ?? '';
}

function declarations(body: string): string[] {
  return body
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.length > 0);
}

function cssToken(rootDeclarations: readonly string[], name: string): string {
  const prefix = `${name}: `;
  const declaration = rootDeclarations.find((entry) => entry.startsWith(prefix));
  if (declaration === undefined) {
    throw new Error(`token not found: ${name}`);
  }
  return declaration.slice(prefix.length);
}

function themeLiteral(name: string): string {
  const match = themeSource.match(new RegExp(`export const ${name} = '([^']+)';`));
  if (match === null) {
    throw new Error(`theme literal not found: ${name}`);
  }
  return match[1] ?? '';
}

function mediaBlock(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`media block not found: ${marker}`);
  }
  const match = source.slice(start).match(/\{([\s\S]*?)\n\}/);
  if (match === null) {
    throw new Error(`media block body not found: ${marker}`);
  }
  return match[1] ?? '';
}

const PANEL_RULE = /\.hud-panel,\s*\.upgrades-panel,\s*\.customization-panel,\s*\.user-panel \.users-list\s*\{([\s\S]*?)\}/;
const RESET_RULE =
  /\.hud-panel::before,\s*\.hud-panel::after,\s*\.upgrades-panel::before,\s*\.upgrades-panel::after,\s*\.customization-panel::before,\s*\.customization-panel::after,\s*\.user-panel \.users-list::before\s*\{([\s\S]*?)\}/;

describe('reference tokens (AC-3)', () => {
  it('declares exactly one :root block with exactly the nine pinned tokens', () => {
    const rootBlocks = cssSource.match(/:root\s*\{[^}]*\}/g) ?? [];
    expect(rootBlocks).toHaveLength(1);

    const rootDeclarations = declarations(ruleBody(cssSource, /:root\s*\{([^}]*)\}/));
    expect(rootDeclarations).toEqual([
      '--panel-bg-top: rgba(5, 11, 24, 0.86)',
      '--panel-bg-bottom: rgba(10, 22, 44, 0.8)',
      '--panel-border: rgba(124, 246, 255, 0.62)',
      '--panel-glow: rgba(124, 246, 255, 0.35)',
      '--panel-radius: 1rem',
      '--users-badge-top: #d63a2f',
      '--users-badge-bottom: #a51f1f',
      '--coin-gold: #ffcc66',
      '--upgrade-green: #16a34a',
    ]);
  });

  it('mirrors every css token from the exact ui/theme.ts literal', () => {
    const pairs = [
      ['--panel-bg-top', 'PANEL_BACKGROUND_TOP', 'rgba(5, 11, 24, 0.86)'],
      ['--panel-bg-bottom', 'PANEL_BACKGROUND_BOTTOM', 'rgba(10, 22, 44, 0.8)'],
      ['--panel-border', 'PANEL_BORDER', 'rgba(124, 246, 255, 0.62)'],
      ['--panel-glow', 'PANEL_GLOW', 'rgba(124, 246, 255, 0.35)'],
      ['--panel-radius', 'PANEL_RADIUS', '1rem'],
      ['--users-badge-top', 'USERS_BADGE_TOP', '#d63a2f'],
      ['--users-badge-bottom', 'USERS_BADGE_BOTTOM', '#a51f1f'],
      ['--coin-gold', 'COIN_GOLD', '#ffcc66'],
      ['--upgrade-green', 'UPGRADE_GREEN', '#16a34a'],
    ] as const;
    const rootDeclarations = declarations(ruleBody(cssSource, /:root\s*\{([^}]*)\}/));

    for (const [cssName, themeName, value] of pairs) {
      expect(themeLiteral(themeName)).toBe(value);
      expect(cssToken(rootDeclarations, cssName)).toBe(value);
    }
  });
});

describe('rounded panel contract (AC-3)', () => {
  it('declares the one grouped rule with exactly the nine pinned declarations', () => {
    const body = ruleBody(cssSource, PANEL_RULE);
    expect(declarations(body)).toEqual([
      'border: 2px solid var(--panel-border)',
      'border-image: none',
      'border-radius: var(--panel-radius)',
      'background: linear-gradient(180deg, var(--panel-bg-top), var(--panel-bg-bottom))',
      'box-shadow: 0 0 24px var(--panel-glow)',
      '-webkit-backdrop-filter: blur(12px) saturate(1.2)',
      'backdrop-filter: blur(12px) saturate(1.2)',
      'clip-path: none',
      'filter: none',
    ]);
  });

  it('drops the metallic pseudo-elements on every rounded surface and only ::before on the list', () => {
    const body = ruleBody(cssSource, RESET_RULE);
    expect(declarations(body)).toEqual(['content: none']);
    expect(cssSource.match(/content: none;/g) ?? []).toHaveLength(1);
    expect(cssSource).not.toContain('.users-list::after');
  });
});

describe('users-on-server badge and list (AC-5)', () => {
  it('uses the specificity-safe selector with the full metallic reset', () => {
    const body = ruleBody(cssSource, /^\.user-panel > \.users-badge\s*\{([\s\S]*?)\}/m);
    expect(declarations(body)).toEqual([
      'border: 2px solid var(--panel-border)',
      'border-image: none',
      'border-radius: 999px',
      'background: linear-gradient(180deg, var(--users-badge-top), var(--users-badge-bottom))',
      'color: #ffffff',
      'clip-path: none',
      'filter: none',
      'min-height: 44px',
      'padding: 0.5rem 1rem',
    ]);
    // A plain `.users-badge` rule would lose to app.css `.user-panel > button`.
    expect(cssSource).not.toMatch(/^\s*\.users-badge\b/m);
  });

  it('overrides the app.css hover and focus painting', () => {
    expect(declarations(ruleBody(cssSource, /^\.user-panel > \.users-badge:hover\s*\{([\s\S]*?)\}/m))).toEqual([
      'color: #ffffff',
      'box-shadow: none',
      'filter: brightness(1.08)',
    ]);
    expect(
      declarations(ruleBody(cssSource, /^\.user-panel > \.users-badge:focus-visible\s*\{([\s\S]*?)\}/m)),
    ).toEqual(['outline: 2px solid var(--accent)', 'outline-offset: 2px']);
  });
});

describe('base layout ownership (AC-2)', () => {
  it('reads the four corner placements from unchanged app.css with safe-area offsets', () => {
    const hud = ruleBody(appCssSource, /main > section\s*\{([\s\S]*?)\}/);
    expect(hud).toContain('position: absolute;');
    expect(hud).toContain('top: calc(1rem + env(safe-area-inset-top, 0px));');
    expect(hud).toContain('left: calc(1rem + env(safe-area-inset-left, 0px));');

    const users = ruleBody(appCssSource, /^\.user-panel\s*\{([\s\S]*?)\}/m);
    expect(users).toContain('position: absolute;');
    expect(users).toContain('top: calc(1rem + env(safe-area-inset-top, 0px));');
    expect(users).toContain('right: calc(1rem + env(safe-area-inset-right, 0px));');

    const toggle = ruleBody(appCssSource, /^\.customization-toggle\s*\{([\s\S]*?)\}/m);
    expect(toggle).toContain('position: absolute;');
    expect(toggle).toContain('bottom: calc(1rem + env(safe-area-inset-bottom, 0px));');
    expect(toggle).toContain('left: calc(1rem + env(safe-area-inset-left, 0px));');

    const upgrades = ruleBody(appCssSource, /^\.upgrades-panel\s*\{([\s\S]*?)\}/m);
    expect(upgrades).toContain('position: absolute;');
    expect(upgrades).toContain('bottom: calc(1rem + env(safe-area-inset-bottom, 0px));');
    expect(upgrades).toContain('right: calc(1rem + env(safe-area-inset-right, 0px));');
  });

  it('declares no base position offsets for the gameplay surfaces in game-view.css', () => {
    const baseSource = cssSource.slice(0, cssSource.search(/@media/));
    const surfaceSelector =
      /\.(?:hud-panel|user-panel|users-badge|users-list|customization-toggle|upgrades-panel|customization-panel)\b/;
    const found: string[] = [];

    for (const match of baseSource.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = (match[1] ?? '').trim();
      if (!surfaceSelector.test(selector)) {
        continue;
      }
      for (const declaration of declarations(match[2] ?? '')) {
        if (/^(?:position|top|right|bottom|left)\s*:/.test(declaration)) {
          found.push(`${selector} { ${declaration}; }`);
        }
      }
    }

    expect(found).toEqual([]);
  });
});

describe('upgrades panel and buy control (AC-6)', () => {
  it('keeps pointer events and internal scrolling without owning placement', () => {
    const body = ruleBody(cssSource, /^\.upgrades-panel\s*\{([\s\S]*?)\}/m);
    expect(declarations(body)).toEqual([
      'pointer-events: auto',
      'max-width: min(22rem, calc(50vw - 1.5rem))',
      'max-height: 60vh',
      'overflow-x: hidden',
      'overflow-y: auto',
    ]);
  });

  it('lays the upgrade rows out as wrapping flex rows', () => {
    const body = ruleBody(cssSource, /^\.upgrade-row\s*\{([\s\S]*?)\}/m);
    const rowDeclarations = declarations(body);
    expect(rowDeclarations).toContain('display: flex');
    expect(rowDeclarations).toContain('flex-wrap: wrap');
    expect(rowDeclarations).toContain('align-items: center');
    expect(rowDeclarations).toContain('gap: 0.25rem 0.5rem');
  });

  it('renders the buy control as a green 44px circle with a white glyph', () => {
    const body = declarations(ruleBody(cssSource, /^\.upgrade-buy\s*\{([\s\S]*?)\}/m));
    expect(body).toContain('border-radius: 50%');
    expect(body).toContain('border: 1px solid var(--upgrade-green)');
    expect(body).toContain('background: var(--upgrade-green)');
    expect(body).toContain('color: #ffffff');
    expect(body).toContain('min-width: 44px');
    expect(body).toContain('min-height: 44px');
  });

  it('dims the disabled buy control and blocks its pointer', () => {
    expect(declarations(ruleBody(cssSource, /^\.upgrade-buy:disabled\s*\{([\s\S]*?)\}/m))).toEqual([
      'background: rgba(22, 163, 74, 0.35)',
      'color: rgba(255, 255, 255, 0.6)',
      'cursor: not-allowed',
    ]);
  });
});

describe('spaceship customization controls (AC-7)', () => {
  it('declares the exact toggle reset with a 44px target', () => {
    expect(declarations(ruleBody(cssSource, /^\.customization-toggle\s*\{([\s\S]*?)\}/m))).toEqual([
      'border: 2px solid var(--panel-border)',
      'border-image: none',
      'border-radius: var(--panel-radius)',
      'background: linear-gradient(180deg, var(--panel-bg-top), var(--panel-bg-bottom))',
      'color: var(--hud-text)',
      'clip-path: none',
      'filter: none',
      'min-height: 44px',
    ]);
  });

  it('lets the open customization panel receive input without owning placement', () => {
    expect(declarations(ruleBody(cssSource, /^\.customization-panel\s*\{([\s\S]*?)\}/m))).toEqual([
      'pointer-events: auto',
    ]);
  });
});

describe('mobile bottom band (AC-18)', () => {
  it('has exactly one 720px block and no 480px block', () => {
    expect(cssSource.match(/@media\s*\(\s*max-width:\s*720px\s*\)/g) ?? []).toHaveLength(1);
    expect(cssSource).not.toMatch(/@media\s*\(\s*max-width:\s*480px\s*\)/);
  });

  it('reduces the HUD padding and font size', () => {
    const block = mediaBlock(cssSource, '@media (max-width: 720px)');
    expect(declarations(ruleBody(block, /\.hud-panel\s*\{([\s\S]*?)\}/))).toEqual([
      'padding: 0.5rem 0.75rem',
      'font-size: 0.85rem',
    ]);
  });

  it('stacks the upgrades panel above the toggle with the pinned safe-area offsets', () => {
    const block = mediaBlock(cssSource, '@media (max-width: 720px)');
    expect(declarations(ruleBody(block, /\.upgrades-panel\s*\{([\s\S]*?)\}/))).toEqual([
      'left: calc(1rem + env(safe-area-inset-left, 0px))',
      'right: calc(1rem + env(safe-area-inset-right, 0px))',
      'bottom: calc(5rem + env(safe-area-inset-bottom, 0px))',
      'max-width: none',
      'max-height: 35vh',
      'overflow-y: auto',
    ]);
  });

  it('stacks the customization panel in the same slot', () => {
    const block = mediaBlock(cssSource, '@media (max-width: 720px)');
    expect(declarations(ruleBody(block, /\.customization-panel\s*\{([\s\S]*?)\}/))).toEqual([
      'left: calc(1rem + env(safe-area-inset-left, 0px))',
      'right: calc(1rem + env(safe-area-inset-right, 0px))',
      'bottom: calc(5rem + env(safe-area-inset-bottom, 0px))',
      'max-width: none',
      'max-height: 45vh',
      'overflow-y: auto',
    ]);
  });

  it('hides the upgrades panel while the customization panel is open', () => {
    const block = mediaBlock(cssSource, '@media (max-width: 720px)');
    expect(
      declarations(
        ruleBody(block, /main\[data-customization-open='true'\] \.upgrades-panel\s*\{([\s\S]*?)\}/),
      ),
    ).toEqual(['display: none']);
  });
});

describe('accessibility (AC-19)', () => {
  it('gives every restyled control an accent focus-visible outline', () => {
    const focusRules = [
      /^\.user-panel > \.users-badge:focus-visible\s*\{([\s\S]*?)\}/m,
      /^\.customization-toggle:focus-visible\s*\{([\s\S]*?)\}/m,
      /^\.upgrade-buy:focus-visible\s*\{([\s\S]*?)\}/m,
    ];

    for (const pattern of focusRules) {
      const body = declarations(ruleBody(cssSource, pattern));
      expect(body).toContain('outline: 2px solid var(--accent)');
      expect(body).toContain('outline-offset: 2px');
    }
  });

  it('keeps the restyled controls at least 44px in each target dimension', () => {
    expect(declarations(ruleBody(cssSource, /^\.user-panel > \.users-badge\s*\{([\s\S]*?)\}/m))).toContain(
      'min-height: 44px',
    );
    expect(declarations(ruleBody(cssSource, /^\.customization-toggle\s*\{([\s\S]*?)\}/m))).toContain(
      'min-height: 44px',
    );
    const buy = declarations(ruleBody(cssSource, /^\.upgrade-buy\s*\{([\s\S]*?)\}/m));
    expect(buy).toContain('min-width: 44px');
    expect(buy).toContain('min-height: 44px');
  });

  it('keeps the HUD row icons sized and non-shrinking', () => {
    const body = declarations(
      ruleBody(
        cssSource,
        /\.hud-row svg,\s*\.user-panel > \.users-badge svg,\s*\.upgrade-row svg,\s*\.customization-toggle svg\s*\{([\s\S]*?)\}/,
      ),
    );
    expect(body).toEqual([
      'width: 1.15rem',
      'height: 1.15rem',
      'flex: none',
      'vertical-align: middle',
    ]);
  });
});

describe('stylesheet hygiene', () => {
  it('disables animation and transition for the gameplay surfaces under reduced motion', () => {
    expect(cssSource.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/g) ?? []).toHaveLength(1);
    const block = mediaBlock(cssSource, '@media (prefers-reduced-motion: reduce)');

    for (const selector of [
      '.hud-panel,',
      '.user-panel > .users-badge,',
      '.user-panel .users-list,',
      '.upgrades-panel,',
      '.upgrade-row,',
      '.upgrade-buy,',
      '.customization-toggle,',
      '.customization-panel,',
    ]) {
      expect(block).toContain(selector);
    }
    expect(block).toContain('animation: none;');
    expect(block).toContain('transition: none;');
  });

  it('leaves auth, verification, banner and announcement chrome alone (AC-8)', () => {
    const bannedSelectors = [
      /\.auth-[a-z-]+/i,
      /\.verification-pending\b/,
      /\.connection-banner\b/,
      /\.phase-announcement\b/,
    ];

    for (const pattern of bannedSelectors) {
      expect(cssSource).not.toMatch(pattern);
    }
  });

  it('never uses !important and ends with exactly one trailing newline', () => {
    expect(cssSource).not.toContain('!important');
    expect(css.endsWith('\n')).toBe(true);
    expect(css.endsWith('\n\n')).toBe(false);
  });
});
