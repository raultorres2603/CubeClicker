import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { MOTION } from '../game/motion';

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

describe('mobile bands (AC-18)', () => {
  it('has exactly one 720px block and no 480px block', () => {
    expect(cssSource.match(/@media\s*\(\s*max-width:\s*720px\s*\)/g) ?? []).toHaveLength(1);
    expect(cssSource).not.toMatch(/@media\s*\(\s*max-width:\s*480px\s*\)/);
  });

  it('reserves the pill width in the HUD while reducing its padding and font size', () => {
    const block = mediaBlock(cssSource, '@media (max-width: 720px)');
    expect(declarations(ruleBody(block, /\.hud-panel\s*\{([\s\S]*?)\}/))).toEqual([
      'box-sizing: border-box',
      'padding: 0.5rem 0.75rem',
      'font-size: 0.85rem',
      'max-width: calc(100vw - 2rem - 9rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))',
    ]);
  });

  it('caps the users panel and tightens the mobile pill', () => {
    const block = mediaBlock(cssSource, '@media (max-width: 720px)');
    expect(declarations(ruleBody(block, /^\s*\.user-panel\s*\{([\s\S]*?)\}/m))).toEqual([
      'max-width: 8.5rem',
    ]);
    expect(declarations(ruleBody(block, /\.user-panel > \.users-badge\s*\{([\s\S]*?)\}/))).toEqual([
      'padding: 0.5rem 0.5rem',
      'font-size: 0.8rem',
    ]);
  });

  it('keeps at least a 0.5rem (8px) gap between the HUD reserve and the pill cap', () => {
    const block = mediaBlock(cssSource, '@media (max-width: 720px)');
    const hudMaxWidth = declarations(ruleBody(block, /\.hud-panel\s*\{([\s\S]*?)\}/)).find(
      (declaration) => declaration.startsWith('max-width: '),
    );
    if (hudMaxWidth === undefined) {
      throw new Error('mobile HUD max-width not found');
    }
    const reserve = hudMaxWidth.match(/-\s*(\d+(?:\.\d+)?)rem\s*-\s*env\(safe-area-inset-left/);
    const cap = ruleBody(block, /^\s*\.user-panel\s*\{([\s\S]*?)\}/m).match(
      /max-width:\s*(\d+(?:\.\d+)?)rem/,
    );
    if (reserve === null || cap === null) {
      throw new Error('mobile reserve or cap not found');
    }

    expect(Number(reserve[1])).toBe(9);
    expect(Number(cap[1])).toBe(8.5);
    const gapRem = Number(reserve[1]) - Number(cap[1]);
    expect(gapRem).toBeGreaterThanOrEqual(0.5);
    expect(gapRem * 16).toBeGreaterThanOrEqual(8);
  });

  it('adds no top-band position declaration inside the 720px block (AC-2)', () => {
    const block = mediaBlock(cssSource, '@media (max-width: 720px)');
    const topBandRules = [
      ['.hud-panel', /^\s*\.hud-panel\s*\{([\s\S]*?)\}/m],
      ['.user-panel', /^\s*\.user-panel\s*\{([\s\S]*?)\}/m],
      ['.user-panel > .users-badge', /^\s*\.user-panel > \.users-badge\s*\{([\s\S]*?)\}/m],
    ] as const;
    const found: string[] = [];

    for (const [selector, pattern] of topBandRules) {
      for (const declaration of declarations(ruleBody(block, pattern))) {
        if (/^(?:position|top|right|bottom|left)\s*:/.test(declaration)) {
          found.push(`${selector} { ${declaration}; }`);
        }
      }
    }

    expect(found).toEqual([]);
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

describe('motion tokens v2 (AC-34, T12)', () => {
  const MAIN_RULE = /^main\s*\{([\s\S]*?)\}/m;

  it('declares exactly the thirteen CSS-mapped tokens on main, not :root', () => {
    const mainDeclarations = declarations(ruleBody(cssSource, MAIN_RULE));
    expect(mainDeclarations).toEqual([
      '--motion-coin-pop-ms: 1100ms',
      '--motion-loot-charge-ms: 420ms',
      '--motion-loot-orb-ms: 250ms',
      '--motion-loot-flash-ms: 120ms',
      '--motion-loot-reveal-ms: 360ms',
      '--motion-loot-settle-ms: 140ms',
      '--motion-level-burst-ms: 760ms',
      '--motion-banner-peak-ms: 250ms',
      '--motion-banner-settle-ms: 450ms',
      '--motion-banner-halo-ms: 250ms',
      '--motion-equip-row-ms: 260ms',
      '--motion-equip-pulse-ms: 260ms',
      '--motion-upgrade-pulse-ms: 260ms',
    ]);
    const rootDeclarations = declarations(ruleBody(cssSource, /:root\s*\{([^}]*)\}/));
    expect(rootDeclarations.filter((entry) => entry.startsWith('--motion-'))).toEqual([]);
  });

  it('mirrors each mapped value from MOTION', () => {
    const mainDeclarations = declarations(ruleBody(cssSource, MAIN_RULE));
    const pairs = [
      ['--motion-coin-pop-ms', 'coinPopMs'],
      ['--motion-loot-charge-ms', 'lootboxChargeMs'],
      ['--motion-loot-orb-ms', 'orbOvershootMs'],
      ['--motion-loot-flash-ms', 'lootboxFlashMs'],
      ['--motion-loot-reveal-ms', 'lootboxRevealMs'],
      ['--motion-loot-settle-ms', 'lootboxSettleMs'],
      ['--motion-level-burst-ms', 'levelBurstMs'],
      ['--motion-banner-peak-ms', 'bannerPeakMs'],
      ['--motion-banner-settle-ms', 'bannerOvershootMs'],
      ['--motion-banner-halo-ms', 'bannerHaloMs'],
      ['--motion-equip-row-ms', 'equipRowFlashMs'],
      ['--motion-equip-pulse-ms', 'equipPulseMs'],
      ['--motion-upgrade-pulse-ms', 'upgradePulseMs'],
    ] as const;

    for (const [cssName, token] of pairs) {
      expect(cssToken(mainDeclarations, cssName)).toBe(`${MOTION[token]}ms`);
    }
  });
});

describe('lootbox reveal (AC-41)', () => {
  it('uses the 1290 ms envelope and the five pinned phase tokens', () => {
    expect(
      MOTION.lootboxChargeMs +
        MOTION.orbOvershootMs +
        MOTION.lootboxFlashMs +
        MOTION.lootboxRevealMs +
        MOTION.lootboxSettleMs,
    ).toBe(1290);
    expect(MOTION.lootboxTotalMs).toBe(1290);

    const root = ruleBody(cssSource, /^\.lootbox-reveal\s*\{([\s\S]*?)\}/m);
    expect(root).toContain('animation: lootbox-reveal 1290ms linear both');

    const envelope = ruleBody(cssSource, /@keyframes\s+lootbox-reveal\s*\{([\s\S]*?)\n\}/);
    expect(envelope).toContain('51.94%');
    expect(envelope).toContain('56%');
    expect(envelope).toContain('61.24%');
    expect(envelope).toContain('filter: brightness(2.4)');

    const orb = ruleBody(cssSource, /^\.lootbox-orb\s*\{([\s\S]*?)\}/m);
    expect(orb).toContain('var(--motion-loot-charge-ms)');
    expect(orb).toContain('var(--motion-loot-orb-ms)');
    expect(orb).toContain('var(--motion-loot-flash-ms)');
    const orbOvershoot = ruleBody(
      cssSource,
      /@keyframes\s+lootbox-orb-overshoot\s*\{([\s\S]*?)\n\}/,
    );
    expect(orbOvershoot).toContain('scale(1.25)');

    const card = ruleBody(cssSource, /^\.lootbox-reveal-card\s*\{([\s\S]*?)\}/m);
    expect(card).toContain('var(--motion-loot-reveal-ms)');
    expect(card).toContain('var(--motion-loot-settle-ms)');
    const cardReveal = ruleBody(cssSource, /@keyframes\s+lootbox-reveal-card\s*\{([\s\S]*?)\n\}/);
    expect(cardReveal).toContain('scale(1.08)');

    const flash = ruleBody(cssSource, /^\.lootbox-flash\s*\{([\s\S]*?)\}/m);
    expect(flash).toContain('var(--motion-loot-flash-ms)');
    const flashKeyframes = ruleBody(
      cssSource,
      /@keyframes\s+lootbox-flash\s*\{([\s\S]*?)\n\}/,
    );
    expect(flashKeyframes).toContain('opacity: 0.85');
  });

  it('instantly settles and hides the flash under reduced motion', () => {
    const reduced = ruleBody(
      cssSource,
      /\.lootbox-reveal\[data-reduced-motion='true'\][\s\S]*?\{([\s\S]*?)\}/,
    );
    expect(reduced).toContain('animation: none');
    expect(cssSource).toContain(
      ".lootbox-reveal[data-reduced-motion='true'] .lootbox-flash",
    );
  });
});

describe('coin popup (AC-39)', () => {
  it('runs the 1100 ms popup with the 45 px rise and 0.7 start scale', () => {
    expect(MOTION.coinPopMs).toBe(1100);
    expect(MOTION.coinRisePx).toBe(45);

    const pop = ruleBody(cssSource, /^\.hud-coin-pop\s*\{([\s\S]*?)\}/m);
    expect(pop).toContain('animation: coin-pop var(--motion-coin-pop-ms)');
    expect(pop).toContain('color: var(--coin-gold)');

    const keyframes = ruleBody(cssSource, /@keyframes\s+coin-pop\s*\{([\s\S]*?)\n\}/);
    expect(keyframes).toContain('7.27%');
    expect(keyframes).toContain('20%');
    expect(keyframes).toContain('scale(0.7)');
    expect(keyframes).toContain('translateY(-45px)');
    expect(keyframes).toContain('opacity: 0');
  });

  it('never animates the HUD panel and adds no shake', () => {
    expect(cssSource).not.toMatch(/@keyframes\s+[a-z-]*shake/i);
    expect(cssSource).not.toMatch(/random/i);
    const hud = ruleBody(cssSource, PANEL_RULE);
    expect(hud).not.toMatch(/(?:animation|transform|translate|rotate|scale)\s*:/);
  });
});

describe('level burst and banner (AC-40)', () => {
  it('runs the 760 ms burst with the pinned counts and banner keyframes', () => {
    expect(MOTION.levelBurstMs).toBe(760);
    expect(MOTION.bannerPeakMs).toBe(250);
    expect(MOTION.bannerOvershootMs).toBe(450);
    expect(MOTION.bannerHaloMs).toBe(250);
    expect(MOTION.levelRayGold).toBe(16);
    expect(MOTION.levelRayCyan).toBe(8);
    expect(MOTION.levelRingCount).toBe(3);
    expect(MOTION.levelStarCount).toBe(12);
    expect(MOTION.levelCoinCount).toBe(20);

    const burst = ruleBody(cssSource, /^\.level-burst\s*\{([\s\S]*?)\}/m);
    expect(burst).toContain('var(--motion-level-burst-ms)');
    const burstKeyframes = ruleBody(cssSource, /@keyframes\s+level-burst\s*\{([\s\S]*?)\n\}/);
    expect(burstKeyframes).toContain('32.89%');

    const banner = ruleBody(cssSource, /^\.level-banner\s*\{([\s\S]*?)\}/m);
    expect(banner).toContain('var(--motion-banner-settle-ms)');
    const bannerKeyframes = ruleBody(cssSource, /@keyframes\s+level-banner\s*\{([\s\S]*?)\n\}/);
    expect(bannerKeyframes).toContain('rotate(-8deg)');
    expect(bannerKeyframes).toContain('37.78%');
    expect(bannerKeyframes).toContain('55.56%');
    expect(bannerKeyframes).toContain('scale(1.08)');
    expect(bannerKeyframes).toContain('rotate(2deg)');
    expect(bannerKeyframes).toContain('rotate(-2deg)');
    expect(bannerKeyframes).toContain('scale(1) rotate(0deg)');

    const halo = ruleBody(cssSource, /^\.level-banner-halo\s*\{([\s\S]*?)\}/m);
    expect(halo).toContain('var(--motion-banner-halo-ms)');
  });

  it('uses the pinned 150 ms ≤15 % reduced overlay and a static reduced banner', () => {
    const overlay = ruleBody(
      cssSource,
      /\.level-complete\[data-reduced-motion='true'\]::before\s*\{([\s\S]*?)\}/,
    );
    expect(overlay).toContain('animation: level-reduced-overlay 150ms ease-out both');

    const overlayKeyframes = ruleBody(
      cssSource,
      /@keyframes\s+level-reduced-overlay\s*\{([\s\S]*?)\n\}/,
    );
    expect(overlayKeyframes).toContain('opacity: 0.15');

    const reducedBanner = ruleBody(
      cssSource,
      /\.level-complete\[data-reduced-motion='true'\] \.level-banner\s*\{([\s\S]*?)\}/,
    );
    expect(reducedBanner).toContain('animation: level-banner-reduced 120ms linear both');
    expect(cssSource).toContain(
      ".level-complete[data-reduced-motion='true'] .level-burst",
    );
  });
});

describe('equip and upgrade feedback (AC-43)', () => {
  it('flashes the equipped row for 260 ms with no transform', () => {
    expect(MOTION.equipRowFlashMs).toBe(260);
    const rule = ruleBody(
      cssSource,
      /^\.customization-slot\[data-equipping='true'\]\s*\{([\s\S]*?)\}/m,
    );
    expect(rule).toContain('animation: equip-row-flash var(--motion-equip-row-ms)');
    const keyframes = ruleBody(cssSource, /@keyframes\s+equip-row-flash\s*\{([\s\S]*?)\n\}/);
    expect(keyframes).not.toContain('transform');
    expect(keyframes).toContain('var(--accent)');
  });

  it('pulses the purchased upgrade row for 260 ms without pulsing the panel', () => {
    expect(MOTION.upgradePulseMs).toBe(260);
    const rule = ruleBody(
      cssSource,
      /^\.upgrade-row\[data-purchased='true'\]\s*\{([\s\S]*?)\}/m,
    );
    expect(rule).toContain('animation: upgrade-purchased var(--motion-upgrade-pulse-ms)');
    const keyframes = ruleBody(cssSource, /@keyframes\s+upgrade-purchased\s*\{([\s\S]*?)\n\}/);
    expect(keyframes).toContain('scale(1.02)');
    expect(keyframes).toContain('scale(1)');
    const panel = ruleBody(cssSource, /^\.upgrades-panel\s*\{([\s\S]*?)\}/m);
    expect(panel).not.toMatch(/(?:animation|transform|translate|rotate|scale)\s*:/);
  });
});

describe('no screen shake (AC-44)', () => {
  it('keeps main and the three panels free of transform/translate/rotate/scale', () => {
    const main = ruleBody(cssSource, /^main\s*\{([\s\S]*?)\}/m);
    const hud = ruleBody(cssSource, PANEL_RULE);
    const upgrades = ruleBody(cssSource, /^\.upgrades-panel\s*\{([\s\S]*?)\}/m);
    const customization = ruleBody(cssSource, /^\.customization-panel\s*\{([\s\S]*?)\}/m);

    for (const body of [main, hud, upgrades, customization]) {
      expect(body).not.toMatch(/(?:transform|translate|rotate|scale)\s*:/);
    }
  });
});

describe('motion accessibility (AC-30, AC-48)', () => {
  it('gives every customization control an accent focus-visible ring', () => {
    const focus = declarations(
      ruleBody(
        cssSource,
        /^\.customization-open:focus-visible,\s*\n\s*\.customization-equip:focus-visible,\s*\n\s*\.customization-unequip:focus-visible,\s*\n\s*\.customization-reveal-equip:focus-visible,\s*\n\s*\.customization-reveal-dismiss:focus-visible\s*\{([\s\S]*?)\}/m,
      ),
    );
    expect(focus).toEqual(['outline: 2px solid var(--accent)', 'outline-offset: 2px']);
  });

  it('disables every new animation in the reduced-motion block', () => {
    const block = mediaBlock(cssSource, '@media (prefers-reduced-motion: reduce)');
    for (const selector of [
      '.hud-coin-pop,',
      '.customization-slot,',
      ".upgrade-row[data-purchased='true'],",
      '.lootbox-reveal,',
      '.lootbox-orb,',
      '.lootbox-flash,',
      '.lootbox-reveal-card,',
      '.level-complete,',
      '.level-burst,',
      '.level-banner,',
      '.level-banner-halo,',
    ]) {
      expect(block).toContain(selector);
    }
    expect(block).toContain('animation: none;');
    expect(block).toContain('transition: none;');
  });
});
