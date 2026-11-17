/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { MOTION } from '../game/motion';

// jsdom rewrites `import.meta.url` to an http URL, so read from the workspace cwd
// (the frontend package root), like the other CSS-backed tests do.
const css = readFileSync('src/ui/game-view.css', 'utf8');
const themeSource = readFileSync('src/ui/theme.ts', 'utf8');
const appCss = readFileSync('src/ui/app.css', 'utf8');

/** Selector matching must ignore commentary: only real selectors/declarations count. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

const cssSource = withoutComments(css);
const appCssSource = withoutComments(appCss);

interface CssRule {
  selector: string;
  body: string;
}

/** Splits a stylesheet into top-level rules; `@media`/`@keyframes` bodies stay nested. */
function topLevelRules(source: string): CssRule[] {
  const parsed: CssRule[] = [];
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf('{', index);
    if (open === -1) {
      break;
    }
    const selector = source.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === '{') {
        depth += 1;
      } else if (source[cursor] === '}') {
        depth -= 1;
      }
      cursor += 1;
    }
    parsed.push({ selector, body: source.slice(open + 1, cursor - 1) });
    index = cursor;
  }
  return parsed;
}

function normalizeSelector(selector: string): string {
  return selector
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .join(', ');
}

function parseRules(source: string): CssRule[] {
  return topLevelRules(source).map((rule) => ({
    selector: normalizeSelector(rule.selector),
    body: rule.body,
  }));
}

const rules = parseRules(cssSource);
const appRules = parseRules(appCssSource);

function findRule(sourceRules: readonly CssRule[], selector: string): CssRule {
  const expected = normalizeSelector(selector);
  const matches = sourceRules.filter((rule) => rule.selector === expected);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one rule for "${expected}", found ${matches.length}`);
  }
  return matches[0]!;
}

function findFirstRule(sourceRules: readonly CssRule[], selector: string): CssRule {
  const expected = normalizeSelector(selector);
  const match = sourceRules.find((rule) => rule.selector === expected);
  if (match === undefined) {
    throw new Error(`rule not found: "${expected}"`);
  }
  return match;
}

function ruleBody(selector: string): string {
  return findRule(rules, selector).body;
}

function mediaRules(marker: string): CssRule[] {
  return parseRules(findRule(rules, marker).body);
}

/** Flattens media blocks so typography/layering guards also see nested rules. */
function flatten(sourceRules: readonly CssRule[]): CssRule[] {
  const flat: CssRule[] = [];
  for (const rule of sourceRules) {
    if (rule.selector.startsWith('@media')) {
      flat.push(...flatten(parseRules(rule.body)));
    } else {
      flat.push(rule);
    }
  }
  return flat;
}

const allCssRules = flatten(rules);

function declarations(body: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const chunk of body.split(';')) {
    const colon = chunk.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const property = chunk.slice(0, colon).trim();
    if (property.length > 0) {
      entries.set(property, chunk.slice(colon + 1).trim());
    }
  }
  return entries;
}

function declarationList(body: string): string[] {
  return body
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.length > 0);
}

function themeLiteral(name: string): string {
  const match = themeSource.match(new RegExp(`export const ${name} = '([^']+)';`));
  if (match === null) {
    throw new Error(`theme literal not found: ${name}`);
  }
  return match[1] ?? '';
}

const SURFACE_SELECTORS = [
  '.hud-panel',
  '.upgrades-panel',
  '.customization-panel',
  '.activity-feed',
  '.leaderboard',
  '.user-panel .users-list',
] as const;

describe('accepted gameplay tokens (AC-17)', () => {
  it('declares exactly one :root block with exactly the nine pinned tokens', () => {
    const rootRules = rules.filter((rule) => rule.selector === ':root');
    expect(rootRules).toHaveLength(1);
    expect(declarationList(rootRules[0]!.body)).toEqual([
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
    const root = declarations(ruleBody(':root'));

    for (const [cssName, themeName, value] of pairs) {
      expect(themeLiteral(themeName)).toBe(value);
      expect(root.get(cssName)).toBe(value);
    }
  });
});

describe('Neon Forge frame ownership (AC-18)', () => {
  it('removes the old rounded grouped rule and every metallic pseudo-element reset', () => {
    const oldGroupedSelector = SURFACE_SELECTORS.join(', ');
    expect(rules.some((rule) => rule.selector === oldGroupedSelector)).toBe(false);
    expect(cssSource).not.toContain('border-image');
    expect(cssSource).not.toContain('content: none');
    expect(cssSource).not.toMatch(/clip-path:\s*none/);
  });

  it('declares no frame repaint on a shared surface element', () => {
    const frameProperties =
      /^(?:border|border-radius|background|box-shadow|clip-path|-webkit-backdrop-filter|backdrop-filter)\s*:/;
    const offenders: string[] = [];

    for (const rule of allCssRules) {
      if (!(SURFACE_SELECTORS as readonly string[]).includes(rule.selector)) {
        continue;
      }
      for (const declaration of declarationList(rule.body)) {
        if (frameProperties.test(declaration)) {
          offenders.push(`${rule.selector} { ${declaration}; }`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the one shared frame and the whole AC-29 typography block in app.css', () => {
    expect(appCssSource).toContain(
      '.hud-panel,\n.upgrades-panel,\n.customization-panel,\n.activity-feed,\n.leaderboard,\n.user-panel .users-list,\n.connection-banner,\n.phase-announcement,\n.auth-panel,\n.auth-error,\nmain > section {',
    );
    expect(appCssSource).toContain(
      '.hud-title,\n.upgrades-title,\n.activity-feed-title,\n.leaderboard-title,\n.customization-title,\n.users-list-title {',
    );
  });
});

describe('accepted placements and typography ownership (AC-18, AC-29)', () => {
  it('reads the four corner placements from app.css with safe-area offsets', () => {
    const hud = declarations(findFirstRule(appRules, 'main > section').body);
    expect(hud.get('position')).toBe('absolute');
    expect(hud.get('top')).toBe('calc(1rem + env(safe-area-inset-top, 0px))');
    expect(hud.get('left')).toBe('calc(1rem + env(safe-area-inset-left, 0px))');

    const users = declarations(findRule(appRules, '.user-panel').body);
    expect(users.get('position')).toBe('absolute');
    expect(users.get('top')).toBe('calc(1rem + env(safe-area-inset-top, 0px))');
    expect(users.get('right')).toBe('calc(1rem + env(safe-area-inset-right, 0px))');

    const toggle = declarations(findRule(appRules, '.customization-toggle').body);
    expect(toggle.get('position')).toBe('absolute');
    expect(toggle.get('bottom')).toBe('calc(1rem + env(safe-area-inset-bottom, 0px))');
    expect(toggle.get('left')).toBe('calc(1rem + env(safe-area-inset-left, 0px))');

    const upgrades = declarations(findRule(appRules, '.upgrades-panel').body);
    expect(upgrades.get('position')).toBe('absolute');
    expect(upgrades.get('bottom')).toBe('calc(1rem + env(safe-area-inset-bottom, 0px))');
    expect(upgrades.get('right')).toBe('calc(1rem + env(safe-area-inset-right, 0px))');
  });

  it('adds no base position offsets for the gameplay surface elements', () => {
    const baseSource = cssSource.slice(0, cssSource.search(/@media/));
    const baseRules = parseRules(baseSource);
    const baseSelectors = [
      '.hud-panel',
      '.upgrades-panel',
      '.customization-panel',
      '.user-panel > .users-badge',
      '.users-list',
      '.customization-toggle',
    ];
    const offenders: string[] = [];

    for (const selector of baseSelectors) {
      for (const rule of baseRules.filter((candidate) => candidate.selector === selector)) {
        for (const declaration of declarationList(rule.body)) {
          if (/^(?:position|top|right|bottom|left)\s*:/.test(declaration)) {
            offenders.push(`${selector} { ${declaration}; }`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('leaves every AC-29 typographic declaration to app.css', () => {
    const typographic =
      /^(?:font-size|font-weight|letter-spacing|text-transform|font-family|line-height|font-variant-numeric)\s*:/;
    const ac29Selectors = [
      '.hud-title',
      '.upgrades-title',
      '.activity-feed-title',
      '.leaderboard-title',
      '.customization-title',
      '.users-list-title',
      '.hud-level',
      '.hud-resource-value',
    ];
    const offenders: string[] = [];

    for (const rule of allCssRules) {
      if (!ac29Selectors.some((selector) => rule.selector.includes(selector))) {
        continue;
      }
      for (const declaration of declarationList(rule.body)) {
        if (typographic.test(declaration)) {
          offenders.push(`${rule.selector} { ${declaration}; }`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps only the title spacing rule for the gameplay titles', () => {
    expect(
      declarationList(findRule(rules, '.activity-feed-title, .leaderboard-title').body),
    ).toEqual(['margin-bottom: 0.35rem']);
    expect(declarationList(ruleBody('.users-list-title'))).toEqual(['margin-bottom: 0.45rem']);
    expect(declarationList(ruleBody('.upgrades-title'))).toEqual(['margin-bottom: 0.1rem']);
  });
});

describe('HUD layout and minimized contract (AC-19)', () => {
  it('lays the header out with the level chip opposite the title', () => {
    expect(declarationList(ruleBody('.hud-header'))).toEqual([
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'gap: 0.5rem',
    ]);
    expect(declarationList(ruleBody('.hud-level'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'flex: none',
      'padding: 0.15rem 0.45rem',
      'border: 1px solid var(--gf-rim)',
      'border-radius: 999px',
      'background: var(--gf-surface-raised)',
      'color: var(--gf-rim-strong)',
      'white-space: nowrap',
    ]);
  });

  it('wraps the resource strip into pill chips', () => {
    expect(declarationList(ruleBody('.hud-resources'))).toEqual([
      'display: flex',
      'flex-wrap: wrap',
      'gap: 0.35rem',
      'margin-top: 0.15rem',
    ]);
    expect(declarationList(ruleBody('.hud-resources [data-resource]'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'gap: 0.3rem',
      'min-height: 1.6rem',
      'padding: 0.2rem 0.45rem',
      'border: 1px solid var(--gf-rim)',
      'border-radius: 999px',
      'background: var(--gf-surface-raised)',
      'white-space: nowrap',
    ]);
    expect(declarationList(ruleBody(".hud-resources [data-stat='coins']"))).toEqual([
      'color: var(--gf-gold)',
    ]);
  });

  it('sizes every decorative HUD/resource/panel icon without shrinking', () => {
    expect(
      declarationList(
        ruleBody(
          '.hud-row svg, .hud-resources [data-resource] svg, .user-panel > .users-badge svg, .upgrade-row svg, .customization-toggle svg',
        ),
      ),
    ).toEqual(['width: 1.15rem', 'height: 1.15rem', 'flex: none', 'vertical-align: middle']);
  });

  it('stacks the three stat rows in the grid and hides only the grid when minimized', () => {
    expect(declarationList(ruleBody('.hud-panel .hud-grid'))).toEqual([
      'display: flex',
      'flex-direction: column',
      'gap: 0.2rem',
      'margin-top: 0.15rem',
    ]);
    expect(declarationList(ruleBody(".hud-panel[data-minimized='true'] .hud-grid"))).toEqual([
      'display: none',
    ]);
    expect(cssSource).not.toContain("main > section[data-minimized='true'] p");
    expect(appCssSource).not.toContain("main > section[data-minimized='true'] p");
  });

  it('keeps the stat row flex line', () => {
    expect(declarationList(ruleBody('.hud-row'))).toEqual([
      'display: flex',
      'align-items: center',
      'gap: 0.5rem',
      'margin: 0',
    ]);
  });

  it('anchors the coin popups inside the coins resource chip', () => {
    expect(declarationList(ruleBody(".hud-panel [data-resource='coins']"))).toEqual([
      'position: relative',
    ]);
    expect(declarationList(ruleBody('.hud-coin-pops'))).toEqual([
      'position: absolute',
      'top: 50%',
      'left: 2.75rem',
      'display: block',
      'pointer-events: none',
    ]);
  });
});

describe('crew panel chrome (AC-24)', () => {
  it('keeps the red 44px pill with the warm Neon Forge rim', () => {
    expect(declarationList(ruleBody('.user-panel > .users-badge'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'gap: 0.35rem',
      'border: 1px solid var(--gf-rim-warm)',
      'border-radius: 999px',
      'background: linear-gradient(180deg, var(--users-badge-top), var(--users-badge-bottom))',
      'color: #ffffff',
      'min-height: 44px',
      'padding: 0.5rem 1rem',
      'cursor: pointer',
    ]);
    expect(declarationList(ruleBody('.user-panel > .users-badge:hover'))).toEqual([
      'color: #ffffff',
      'box-shadow: inset 0 0 0 1px var(--gf-rim-warm)',
      'filter: brightness(1.08)',
    ]);
  });

  it('renders the count badge, the Crew heading spacing and the scrolling list', () => {
    expect(declarationList(ruleBody('.users-count'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'flex: none',
      'min-width: 1.4rem',
      'height: 1.4rem',
      'padding: 0 0.35rem',
      'border-radius: 999px',
      'background: var(--gf-void)',
      'color: var(--gf-rim-strong)',
      'font-size: 0.72rem',
      'font-weight: 800',
      'font-variant-numeric: tabular-nums',
    ]);
    expect(declarationList(ruleBody('.user-panel .users-list'))).toEqual([
      'max-height: 50vh',
      'padding: 0.6rem',
      'overflow-x: hidden',
      'overflow-y: auto',
    ]);
  });

  it('renders each member button as a raised card with a level chip', () => {
    expect(declarationList(ruleBody('.user-panel li button'))).toEqual([
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'gap: 0.3rem 0.5rem',
      'border: 1px solid var(--gf-rim)',
      'background: var(--gf-surface-raised)',
    ]);
    expect(declarationList(ruleBody('.user-panel li button[data-level]::after'))).toEqual([
      "content: 'Cube ' attr(data-level)",
      'flex: none',
      'padding: 0.05rem 0.35rem',
      'border: 1px solid var(--gf-rim)',
      'border-radius: 999px',
      'color: var(--gf-rim-strong)',
      'font-size: 0.68rem',
      'font-weight: 700',
      'letter-spacing: 0.08em',
      'text-transform: uppercase',
    ]);
  });

  it('pulses the shared live dot and stops it for the session preference', () => {
    expect(declarationList(ruleBody('.gf-live-dot'))).toEqual([
      'display: inline-block',
      'flex: none',
      'width: 0.45rem',
      'height: 0.45rem',
      'margin-right: 0.35rem',
      'border-radius: 50%',
      'background: var(--gf-success)',
      'box-shadow: 0 0 6px var(--gf-success)',
      'vertical-align: middle',
      'animation: gf-live-pulse var(--motion-ui-glow-pulse-ms) ease-in-out infinite alternate',
    ]);
    const keyframes = findRule(rules, '@keyframes gf-live-pulse').body;
    expect(keyframes).toContain('transform: scale(0.85)');
    expect(keyframes).toContain('transform: scale(1)');
  });
});

describe('upgrades chrome (AC-20, AC-28)', () => {
  it('keeps the interactive scroll panel and its balance line', () => {
    expect(declarationList(ruleBody('.upgrades-panel'))).toEqual([
      'pointer-events: auto',
      'max-width: min(22rem, calc(50vw - 1.5rem))',
      'max-height: 60vh',
      'overflow-x: hidden',
      'overflow-y: auto',
    ]);
    expect(declarationList(ruleBody('.upgrades-balance'))).toEqual([
      'margin: 0 0 0.35rem',
      'color: var(--gf-gold)',
      'font-size: 0.9rem',
      'font-weight: 700',
      'font-variant-numeric: tabular-nums',
    ]);
  });

  it('lays the upgrade rows out as wrapping flex rows with an affordable cost accent', () => {
    expect(declarationList(ruleBody('.upgrade-row'))).toEqual([
      'display: flex',
      'flex-wrap: wrap',
      'align-items: center',
      'gap: 0.25rem 0.5rem',
      'padding: 0.5rem 0',
      'border-top: 1px solid rgba(124, 246, 255, 0.18)',
    ]);
    expect(declarationList(ruleBody('.upgrade-row:first-child'))).toEqual(['border-top: none']);
    expect(declarationList(ruleBody(".upgrade-row[data-affordable='true'] [data-cost]"))).toEqual([
      'color: var(--gf-success)',
    ]);
  });

  it('fills the level pips through the success channel', () => {
    expect(declarationList(ruleBody('.upgrade-pips'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'gap: 0.15rem',
      'flex: none',
    ]);
    expect(declarationList(ruleBody('.upgrade-pip'))).toEqual([
      'width: 0.45rem',
      'height: 0.45rem',
      'border: 1px solid var(--gf-rim)',
      'border-radius: 999px',
      'background: transparent',
    ]);
    expect(declarationList(ruleBody(".upgrade-pip[data-filled='true']"))).toEqual([
      'border-color: var(--gf-success)',
      'background: var(--gf-success)',
    ]);
  });

  it('keeps the circular green buy control with the success rim', () => {
    expect(declarationList(ruleBody('.upgrade-buy'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'border-radius: 50%',
      'border: 1px solid var(--gf-success)',
      'background: var(--upgrade-green)',
      'color: #ffffff',
      'min-width: 44px',
      'min-height: 44px',
      'padding: 0',
      'font: inherit',
      'font-size: 1.2rem',
      'font-weight: 700',
      'line-height: 1',
      'cursor: pointer',
      'transition: transform var(--motion-ui-button-press-ms) ease',
    ]);
    expect(declarationList(ruleBody('.upgrade-buy:disabled'))).toEqual([
      'background: rgba(22, 163, 74, 0.35)',
      'color: rgba(255, 255, 255, 0.6)',
      'cursor: not-allowed',
    ]);
  });
});

describe('spaceship hangar chrome (AC-21)', () => {
  it('keeps the panel interactive and chips the lootbox/key counts', () => {
    expect(declarationList(ruleBody('.customization-panel'))).toEqual(['pointer-events: auto']);
    expect(declarationList(ruleBody('.customization-counts'))).toEqual([
      'display: flex',
      'flex-wrap: wrap',
      'gap: 0.4rem',
      'font-variant-numeric: tabular-nums',
    ]);
    expect(declarationList(ruleBody('.gf-chip'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'gap: 0.3rem',
      'padding: 0.2rem 0.5rem',
      'border: 1px solid var(--gf-rim)',
      'border-radius: 999px',
      'background: var(--gf-surface-raised)',
      'color: var(--gf-text)',
      'font-size: 0.72rem',
      'font-weight: 600',
      'letter-spacing: 0.12em',
      'text-transform: uppercase',
      'white-space: nowrap',
    ]);
  });

  it('renders the rarity swatch and the rare/epic name channels', () => {
    expect(declarationList(ruleBody('.customization-swatch'))).toEqual([
      'width: 0.75rem',
      'height: 0.75rem',
      'border: 1px solid rgba(232, 246, 255, 0.35)',
      'border-radius: 0.2rem',
      'flex: none',
    ]);
    expect(
      declarationList(ruleBody(".customization-variant[data-rarity='rare'] .customization-variant-name")),
    ).toEqual(['color: var(--gf-rare)']);
    expect(
      declarationList(ruleBody(".customization-variant[data-rarity='epic'] .customization-variant-name")),
    ).toEqual(['color: var(--gf-epic)']);
  });

  it('keeps the toggle at z-index 21 above the layer-20 reveal', () => {
    expect(declarationList(ruleBody('.customization-toggle'))).toEqual([
      'z-index: 21',
      'display: inline-flex',
      'align-items: center',
      'gap: 0.35rem',
      'border: 1px solid var(--gf-rim)',
      'border-radius: var(--gf-radius-control)',
      'background: var(--gf-surface-raised)',
      'color: var(--gf-text)',
      'min-height: 44px',
      'padding: 0.45rem 0.85rem',
      'cursor: pointer',
      'transition: transform var(--motion-ui-button-press-ms) ease, filter var(--motion-ui-button-press-ms) ease',
    ]);
    const toggleZ = Number(declarations(ruleBody('.customization-toggle')).get('z-index'));
    const revealZ = Number(
      declarations(ruleBody(".customization-panel[data-reveal-active='true']")).get('z-index'),
    );
    expect(toggleZ).toBe(21);
    expect(revealZ).toBe(20);
    expect(toggleZ).toBeGreaterThan(revealZ);
  });

  it('declares the layer-20 reveal spotlight animation in the base rule', () => {
    expect(declarationList(ruleBody(".customization-panel[data-reveal-active='true']"))).toEqual([
      'z-index: 20',
      'animation: reveal-spotlight var(--motion-ui-reveal-spotlight-ms) ease-out both',
    ]);
    const keyframes = findRule(rules, '@keyframes reveal-spotlight').body;
    expect(keyframes).toContain('opacity: 0.35');
    expect(keyframes).toContain('opacity: 1');
    expect(keyframes).not.toContain('transform');
  });

  it('centres the desktop spotlight in the 721px block with the complete override', () => {
    const desktop = mediaRules('@media (min-width: 721px)');
    expect(
      declarationList(
        findRule(desktop, ".customization-panel[data-reveal-active='true']").body,
      ),
    ).toEqual([
      'top: 50%',
      'left: 50%',
      'right: auto',
      'bottom: auto',
      'transform: translate(-50%, -50%)',
      'width: min(34rem, calc(100vw - 2rem))',
      'max-width: min(34rem, calc(100vw - 2rem))',
      'max-height: min(88vh, 42rem)',
      'z-index: 20',
    ]);
  });

  it('keeps the 720px reveal as a safe-area bottom sheet at layer 20', () => {
    const mobile = mediaRules('@media (max-width: 720px)');
    expect(
      declarationList(
        findRule(mobile, ".customization-panel[data-reveal-active='true']").body,
      ),
    ).toEqual([
      'top: auto',
      'left: calc(1rem + env(safe-area-inset-left, 0px))',
      'right: calc(1rem + env(safe-area-inset-right, 0px))',
      'bottom: calc(5rem + env(safe-area-inset-bottom, 0px))',
      'transform: none',
      'width: auto',
      'max-width: none',
      'max-height: 60vh',
      'z-index: 20',
    ]);
  });

  it('adds no scrim and no data-reveal-active on main', () => {
    expect(cssSource).not.toMatch(/scrim/i);
    expect(cssSource).not.toContain('main[data-reveal-active');
    expect(cssSource).not.toContain("main[data-reveal-active='true']");
  });
});

describe('reveal stage, rarity and epic flourish (AC-14)', () => {
  it('makes the stage the unclipped relative containing block', () => {
    expect(declarationList(ruleBody('.lootbox-stage'))).toEqual([
      'position: relative',
      'flex: 0 0 auto',
      'width: 100%',
      'height: 12rem',
      'overflow: visible',
    ]);
    expect(declarationList(ruleBody('.lootbox-stage-canvas, .lootbox-fallback-ship'))).toEqual([
      'display: block',
      'width: 100%',
      'height: 100%',
    ]);
    expect(declarationList(ruleBody('.lootbox-fallback-ship'))).toEqual([
      'color: var(--gf-rim-strong)',
      'fill: none',
      'stroke: currentColor',
      'stroke-width: 1.4',
    ]);
  });

  it('declares the exact epic-only eight-ray flourish', () => {
    const flourish = declarations(
      ruleBody(".lootbox-reveal[data-rarity='epic'] .lootbox-stage::before"),
    );
    expect(flourish.get('content')).toBe("''");
    expect(flourish.get('position')).toBe('absolute');
    expect(flourish.get('inset')).toBe('50% auto auto 50%');
    expect(flourish.get('width')).toBe('18rem');
    expect(flourish.get('height')).toBe('18rem');
    expect(flourish.get('transform')).toBe('translate(-50%, -50%)');
    expect(flourish.get('background')).toBe(
      'repeating-conic-gradient(from 0deg, var(--gf-epic) 0deg 2deg, transparent 2deg 45deg)',
    );
    expect(flourish.get('-webkit-mask')).toBe(
      'radial-gradient(circle, transparent 0 28%, #000 32% 62%, transparent 66%)',
    );
    expect(flourish.get('mask')).toBe(
      'radial-gradient(circle, transparent 0 28%, #000 32% 62%, transparent 66%)',
    );
    expect(flourish.get('opacity')).toBe('0');
    expect(flourish.get('animation')).toBe(
      'epic-ray-burst var(--motion-loot-reveal-ms) ease-out both',
    );
    expect(flourish.get('pointer-events')).toBe('none');
    expect([...flourish.keys()]).toHaveLength(12);

    // A 45° repeating period in a 360° circle is exactly eight rays.
    const period = flourish.get('background')?.match(/transparent 2deg (\d+)deg/)?.[1];
    expect(period).toBe('45');
    expect(360 / Number(period)).toBe(8);
    expect(flourish.get('background')).toContain('2deg 45deg');
  });

  it('runs the flourish keyframes from 0.6 to 1.2 scale with a 22.5° quarter-step turn', () => {
    const keyframes = findRule(rules, '@keyframes epic-ray-burst').body;
    expect(keyframes).toContain('opacity: 0');
    expect(keyframes).toContain('transform: translate(-50%, -50%) scale(0.6) rotate(0deg)');
    expect(keyframes).toContain('30%');
    expect(keyframes).toContain('opacity: 0.9');
    expect(keyframes).toContain('transform: translate(-50%, -50%) scale(1.2) rotate(22.5deg)');
  });

  it('uses the rare and epic channels on the rarity label', () => {
    const rarity = declarations(ruleBody('.lootbox-reveal-rarity'));
    expect(rarity.get('color')).toBe('var(--gf-rare)');
    expect(
      declarations(ruleBody(".lootbox-reveal[data-rarity='rare'] .lootbox-reveal-rarity")).get(
        'color',
      ),
    ).toBe('var(--gf-rare)');
    expect(
      declarations(ruleBody(".lootbox-reveal[data-rarity='epic'] .lootbox-reveal-rarity")).get(
        'color',
      ),
    ).toBe('var(--gf-epic)');
  });

  it('removes the flourish under the session preference and prefers-reduced-motion', () => {
    expect(
      declarationList(
        ruleBody(".lootbox-reveal[data-reduced-motion='true'] .lootbox-stage::before"),
      ),
    ).toEqual(['animation: none', 'opacity: 0']);
    const reduced = findRule(
      mediaRules('@media (prefers-reduced-motion: reduce)'),
      ".lootbox-reveal[data-rarity='epic'] .lootbox-stage::before",
    );
    expect(declarationList(reduced.body)).toEqual(['animation: none', 'opacity: 0']);
  });

  it('keeps the stage card/controls readable and the buttons 44px-capable', () => {
    const card = declarations(ruleBody('.lootbox-reveal-card'));
    expect(card.get('display')).toBe('flex');
    expect(card.get('flex')).toBe('0 0 auto');
    expect(card.has('overflow')).toBe(false);
    expect(declarationList(ruleBody('.lootbox-reveal-actions'))).toEqual([
      'display: flex',
      'flex-wrap: wrap',
      'justify-content: center',
      'gap: 0.5rem',
    ]);
    expect(declarationList(ruleBody('.customization-reveal-equip'))).toEqual([
      'border-color: var(--gf-rim-warm)',
      'background: linear-gradient(180deg, var(--gf-amber), var(--gf-amber-deep))',
      'color: var(--gf-cta-text)',
    ]);
  });

  it('gives the new reveal/toggle/buy controls the gf-focus ring', () => {
    expect(
      declarationList(
        ruleBody(
          '.customization-reveal-equip:focus-visible, .customization-reveal-dismiss:focus-visible, .customization-toggle:focus-visible, .upgrade-buy:focus-visible',
        ),
      ),
    ).toEqual([
      'outline: 2px solid var(--gf-focus)',
      'outline-offset: 2px',
      'box-shadow: inset 0 0 0 2px var(--gf-focus)',
    ]);
  });
});

describe('activity feed chrome (AC-22)', () => {
  it('pins the top-center placement below the banner', () => {
    expect(declarationList(ruleBody('.activity-feed'))).toEqual([
      'position: absolute',
      'top: calc(4.25rem + env(safe-area-inset-top, 0px))',
      'left: 50%',
      'box-sizing: border-box',
      'width: min(24rem, calc(100vw - 2rem))',
      'max-height: 30vh',
      'padding: 0.5rem 0.75rem',
      'overflow: hidden',
      'color: var(--gf-text)',
      'pointer-events: none',
      'transform: translateX(-50%)',
    ]);
    expect(declarationList(ruleBody('.activity-feed-list'))).toEqual([
      'display: flex',
      'flex-direction: column',
      'gap: 0.15rem',
      'margin: 0',
      'padding: 0',
      'list-style: none',
      'font-size: 0.85rem',
    ]);
  });

  it('lays each event on one line with its own glyph', () => {
    expect(declarationList(ruleBody('.activity-feed li'))).toEqual([
      'display: flex',
      'align-items: baseline',
      'gap: 0.4rem',
      'animation: activity-feed-entry 160ms ease-out both',
    ]);
    expect(declarationList(ruleBody('.activity-feed li::before'))).toEqual([
      "content: ''",
      'flex: none',
      'width: 0.5rem',
      'height: 0.5rem',
      'background: var(--gf-rim-strong)',
    ]);
  });

  it('renders a distinct glyph/colour per event type', () => {
    const glyphs: ReadonlyArray<readonly [string, readonly string[]]> = [
      [
        "cubeCleared",
        ['background: var(--gf-success)'],
      ],
      [
        "fastClear",
        [
          "content: '»'",
          'width: auto',
          'height: auto',
          'color: var(--gf-amber)',
          'font-size: 0.8rem',
          'line-height: 1',
        ],
      ],
      [
        "levelMilestone",
        ['background: var(--gf-gold)', 'transform: rotate(45deg)'],
      ],
      [
        "epicLoot",
        [
          'background: var(--gf-epic)',
          'clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
        ],
      ],
      [
        "memberJoined",
        ['background: var(--gf-rim-strong)', 'border-radius: 50%'],
      ],
      [
        "memberLeft",
        ['background: var(--gf-text-muted)', 'border-radius: 50%'],
      ],
    ];

    for (const [eventType, expected] of glyphs) {
      expect(
        declarationList(ruleBody(`.activity-feed li[data-event-type='${eventType}']::before`)),
      ).toEqual(expected);
    }
  });

  it('keeps the 160 ms entry and both reduced-motion paths', () => {
    const keyframes = findRule(rules, '@keyframes activity-feed-entry').body;
    expect(keyframes).toContain('opacity: 0');
    expect(keyframes).toContain('transform: translateY(-0.25rem)');
    expect(
      declarationList(ruleBody(".activity-feed[data-reduced-motion='true'] li")),
    ).toEqual(['animation: none']);
    expect(
      declarationList(ruleBody(".activity-feed[data-reduced-motion='true'] .gf-live-dot")),
    ).toEqual(['animation: none']);
  });
});

describe('leaderboard chrome (AC-23)', () => {
  it('pins the non-interactive desktop left rail', () => {
    expect(declarationList(ruleBody('.leaderboard'))).toEqual([
      'position: absolute',
      'top: calc(16rem + env(safe-area-inset-top, 0px))',
      'left: calc(1rem + env(safe-area-inset-left, 0px))',
      'box-sizing: border-box',
      'width: min(17rem, calc(100vw - 2rem))',
      'max-height: 40vh',
      'padding: 0.5rem 0.75rem',
      'overflow: hidden',
      'color: var(--gf-text)',
      'pointer-events: none',
    ]);
  });

  it('clears the Neon Forge HUD on the desktop left rail (T12 manual-review regression)', () => {
    const railTop = declarations(ruleBody('.leaderboard')).get('top') ?? '';
    expect(railTop).toBe('calc(16rem + env(safe-area-inset-top, 0px))');

    // The AC-19 HUD footprint below its 1rem top edge, rounded up to 12.5rem:
    // header/level chip 1.545 + resource strip 2.145 + stat grid 4.54 + minimize 1.58
    // + three 0.25 flex gaps + 1.5 block padding + 0.125 rim = 12.185rem; bottom ≈ 13.185rem.
    const HUD_TOP_REM = 1;
    const HUD_FOOTPRINT_REM = 12.5;
    const MIN_CLEARANCE_REM = 1;
    const railTopRem = Number(railTop.match(/calc\(([\d.]+)rem/)?.[1]);

    expect(railTopRem).toBe(16);
    expect(railTopRem).toBeGreaterThanOrEqual(
      HUD_TOP_REM + HUD_FOOTPRINT_REM + MIN_CLEARANCE_REM,
    );

    // The HUD keeps its accepted top-left placement; only the rail moved down.
    const hud = declarations(findFirstRule(appRules, 'main > section').body);
    expect(hud.get('top')).toBe('calc(1rem + env(safe-area-inset-top, 0px))');
  });

  it('wraps each row with a medal and a bar', () => {
    expect(declarationList(ruleBody('.leaderboard-list'))).toEqual([
      'display: flex',
      'flex-direction: column',
      'gap: 0.15rem',
      'margin: 0',
      'padding: 0',
      'list-style: none',
      'font-size: 0.85rem',
    ]);
    expect(declarationList(ruleBody('.leaderboard li'))).toEqual([
      'display: flex',
      'flex-wrap: wrap',
      'align-items: baseline',
      'gap: 0.35rem',
      'animation: leaderboard-entry 160ms ease-out both',
    ]);
    expect(declarationList(ruleBody('.leaderboard-medal'))).toEqual([
      'flex: none',
      'width: 0.55rem',
      'height: 0.55rem',
      'border-radius: 50%',
      'background: var(--gf-rim-strong)',
    ]);
    expect(declarationList(ruleBody('.leaderboard-bar'))).toEqual([
      'display: block',
      'flex: 0 0 auto',
      'height: 2px',
      'margin-top: 0.1rem',
      'border-radius: 999px',
      'background: var(--gf-rim-strong)',
    ]);
  });

  it('paints gold/silver/bronze/cyan medals and the fixed bar widths by rank', () => {
    expect(
      declarationList(ruleBody(".leaderboard li[data-rank='1'] .leaderboard-medal")),
    ).toEqual(['background: var(--gf-gold)', 'box-shadow: 0 0 6px var(--gf-gold)']);
    expect(declarationList(ruleBody(".leaderboard li[data-rank='1'] .leaderboard-bar"))).toEqual([
      'width: 100%',
      'background: var(--gf-gold)',
    ]);
    expect(
      declarationList(ruleBody(".leaderboard li[data-rank='2'] .leaderboard-medal")),
    ).toEqual(['background: #cbd5e1']);
    expect(declarationList(ruleBody(".leaderboard li[data-rank='2'] .leaderboard-bar"))).toEqual([
      'width: 80%',
      'background: #cbd5e1',
    ]);
    expect(
      declarationList(ruleBody(".leaderboard li[data-rank='3'] .leaderboard-medal")),
    ).toEqual(['background: #d08b4f']);
    expect(declarationList(ruleBody(".leaderboard li[data-rank='3'] .leaderboard-bar"))).toEqual([
      'width: 64%',
      'background: #d08b4f',
    ]);
    expect(
      declarationList(
        ruleBody(
          ".leaderboard li[data-rank='4'] .leaderboard-medal, .leaderboard li[data-rank='5'] .leaderboard-medal",
        ),
      ),
    ).toEqual(['background: var(--gf-rim-strong)']);
    expect(declarationList(ruleBody(".leaderboard li[data-rank='4'] .leaderboard-bar"))).toEqual([
      'width: 50%',
    ]);
    expect(declarationList(ruleBody(".leaderboard li[data-rank='5'] .leaderboard-bar"))).toEqual([
      'width: 40%',
    ]);
  });

  it('keeps the rank/name/score/totals text styling and both reduced-motion paths', () => {
    expect(declarationList(ruleBody('.leaderboard-rank'))).toEqual([
      'flex: none',
      'color: var(--gf-rim-strong)',
      'font-variant-numeric: tabular-nums',
      'font-weight: 700',
    ]);
    expect(declarationList(ruleBody('.leaderboard-name'))).toEqual([
      'min-width: 0',
      'overflow: hidden',
      'text-overflow: ellipsis',
      'white-space: nowrap',
      'font-weight: 600',
    ]);
    expect(declarationList(ruleBody('.leaderboard-score'))).toEqual([
      'flex: none',
      'margin-left: auto',
      'color: var(--gf-text-muted)',
      'font-variant-numeric: tabular-nums',
    ]);
    expect(declarationList(ruleBody('.leaderboard-totals'))).toEqual([
      'margin: 0.35rem 0 0',
      'padding-top: 0.3rem',
      'border-top: 1px solid rgba(124, 246, 255, 0.18)',
      'font-size: 0.75rem',
      'color: var(--gf-text-muted)',
    ]);
    expect(
      declarationList(ruleBody(".leaderboard[data-reduced-motion='true'] li")),
    ).toEqual(['animation: none']);
    expect(
      declarationList(ruleBody(".leaderboard[data-reduced-motion='true'] .gf-live-dot")),
    ).toEqual(['animation: none']);
  });
});

describe('connection banner chrome (AC-25)', () => {
  it('pulses one status dot and colours it per transport status', () => {
    expect(declarationList(ruleBody('.connection-dot'))).toEqual([
      'flex: none',
      'width: 0.55rem',
      'height: 0.55rem',
      'border-radius: 50%',
      'background: var(--gf-rim-strong)',
      'box-shadow: 0 0 8px var(--gf-rim-strong)',
      'animation: connection-dot-pulse var(--motion-ui-glow-pulse-ms) ease-in-out infinite alternate',
    ]);
    expect(declarationList(ruleBody(".connection-banner[data-status='connecting']"))).toEqual([
      '--gf-rim: rgba(124, 246, 255, 0.56)',
    ]);
    expect(
      declarationList(ruleBody(".connection-banner[data-status='connecting'] .connection-dot")),
    ).toEqual(['background: var(--gf-rim-strong)', 'box-shadow: 0 0 8px var(--gf-rim-strong)']);
    expect(declarationList(ruleBody(".connection-banner[data-status='disconnected']"))).toEqual([
      '--gf-rim: rgba(255, 179, 92, 0.56)',
    ]);
    expect(
      declarationList(ruleBody(".connection-banner[data-status='disconnected'] .connection-dot")),
    ).toEqual(['background: var(--gf-amber)', 'box-shadow: 0 0 8px var(--gf-amber)']);
    expect(declarationList(ruleBody(".connection-banner[data-status='exhausted']"))).toEqual([
      '--gf-rim: rgba(255, 107, 107, 0.56)',
    ]);
    expect(
      declarationList(ruleBody(".connection-banner[data-status='exhausted'] .connection-dot")),
    ).toEqual(['background: var(--gf-danger)', 'box-shadow: 0 0 8px var(--gf-danger)']);
  });
});

describe('runtime chrome (AC-18, AC-27)', () => {
  it('renders the deferred status/error on its own Neon Forge surface', () => {
    expect(declarationList(ruleBody('.game-runtime-status, .game-runtime-error'))).toEqual([
      'position: absolute',
      'top: 50%',
      'left: 50%',
      'display: flex',
      'flex-wrap: wrap',
      'align-items: center',
      'justify-content: center',
      'gap: 0.5rem 0.75rem',
      'max-width: min(28rem, calc(100vw - 2rem))',
      'margin: 0',
      'padding: 0.75rem 1rem',
      'border: 1px solid var(--gf-rim)',
      'border-radius: var(--gf-radius-panel)',
      'background: linear-gradient(180deg, var(--gf-surface-top), var(--gf-surface-bottom))',
      'color: var(--gf-text)',
      'text-align: center',
      'transform: translate(-50%, -50%)',
    ]);
    expect(declarationList(ruleBody('.game-runtime-error button'))).toEqual([
      'min-height: 44px',
      'padding: 0.5rem 1rem',
      'border: 1px solid var(--gf-rim-warm)',
      'border-radius: var(--gf-radius-control)',
      'background: var(--gf-surface-raised)',
      'color: var(--gf-text)',
      'font: inherit',
      'cursor: pointer',
    ]);
  });
});

describe('ambience and layering (AC-27)', () => {
  it('paints one procedural scanline/vignette/corner-glow layer over the canvas', () => {
    expect(declarationList(ruleBody('.game-ambience'))).toEqual([
      'position: absolute',
      'inset: 0',
      'z-index: 2',
      'pointer-events: none',
      'background: radial-gradient(circle at 50% 50%, transparent 0 58%, rgba(4, 6, 13, 0.55) 100%), radial-gradient(circle at 14% 86%, rgba(124, 246, 255, 0.14), transparent 38%)',
    ]);
    expect(declarationList(ruleBody('.game-ambience::before'))).toEqual([
      "content: ''",
      'position: absolute',
      'inset: 0',
      'background: repeating-linear-gradient(0deg, transparent 0 2px, var(--gf-scanline) 2px 3px)',
      'animation: ambience-scanline var(--motion-ui-glow-pulse-ms) ease-in-out infinite alternate',
    ]);
    const keyframes = findRule(rules, '@keyframes ambience-scanline').body;
    expect(keyframes).toContain('opacity: 0.35');
    expect(keyframes).toContain('transform: translateY(2px)');
  });

  it('disables the ambience for the session reduced-motion preference outside the media block', () => {
    // A top-level `ruleBody` lookup proves the session selector is not inside the media
    // query: the OS preference and the session preference each disable the scanline.
    expect(
      declarationList(
        ruleBody(
          ".game-ambience[data-reduced-motion='true'], .game-ambience[data-reduced-motion='true']::before",
        ),
      ),
    ).toEqual(['animation: none', 'transition: none']);
  });

  it('puts the canvas at 0, the ambience at 2 and every panel at 3', () => {
    expect(declarationList(ruleBody('main > canvas'))).toEqual([
      'position: relative',
      'z-index: 0',
    ]);
    expect(
      declarationList(
        ruleBody(
          '.hud-panel, .upgrades-panel, .customization-panel, .activity-feed, .leaderboard, .user-panel .users-list, .connection-banner, .phase-announcement, .user-panel, .game-runtime-status, .game-runtime-error, main > section',
        ),
      ),
    ).toEqual(['z-index: 3']);
  });

  it('keeps level 5, reveal 20, toggle 21 and auth 100', () => {
    expect(declarations(ruleBody('.level-complete')).get('z-index')).toBe('5');
    expect(
      declarations(ruleBody(".customization-panel[data-reveal-active='true']")).get('z-index'),
    ).toBe('20');
    expect(declarations(ruleBody('.customization-toggle')).get('z-index')).toBe('21');
    expect(
      declarations(findRule(appRules, '.auth-menu, .auth-forms').body).get('z-index'),
    ).toBe('100');
  });

  it('disables the scanline, dots and flourish under reduced motion', () => {
    const reduced = mediaRules('@media (prefers-reduced-motion: reduce)');
    const group = findRule(
      reduced,
      '.hud-panel, .hud-panel::before, .hud-panel::after, .user-panel > .users-badge, .user-panel .users-list, .user-panel .users-list::before, .upgrades-panel, .upgrades-panel::before, .upgrades-panel::after, .upgrade-row, .upgrade-buy, .customization-toggle, .customization-panel, .customization-panel::before, .customization-panel::after, .activity-feed li, .leaderboard li, .hud-coin-pop, .customization-slot, .upgrade-row[data-purchased=\'true\'], .lootbox-reveal, .lootbox-flash, .lootbox-reveal-card, .level-complete, .level-complete::before, .level-burst, .level-banner, .level-banner-halo, .level-ray, .level-ring, .level-star, .level-coin, .game-ambience::before, .gf-live-dot, .connection-dot, .lootbox-reveal[data-rarity=\'epic\'] .lootbox-stage::before',
    );
    expect(declarationList(group.body)).toEqual(['animation: none', 'transition: none']);
  });
});

describe('mobile bands (AC-30)', () => {
  it('has exactly one 720px block, one 721px block and one short-viewport block', () => {
    expect(
      rules.filter((rule) => rule.selector === '@media (max-width: 720px)'),
    ).toHaveLength(1);
    expect(
      rules.filter((rule) => rule.selector === '@media (min-width: 721px)'),
    ).toHaveLength(1);
    expect(
      rules.filter(
        (rule) => rule.selector === '@media (max-width: 720px) and (max-height: 600px)',
      ),
    ).toHaveLength(1);
    expect(cssSource).not.toMatch(/@media\s*\(max-width:\s*480px\)/);
  });

  it('reserves the pill width in the HUD while reducing its padding and font size', () => {
    const block = mediaRules('@media (max-width: 720px)');
    expect(declarationList(findRule(block, '.hud-panel').body)).toEqual([
      'box-sizing: border-box',
      'padding: 0.5rem 0.75rem',
      'font-size: 0.85rem',
      'max-width: calc(100vw - 2rem - 9rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))',
    ]);
    expect(declarationList(findRule(block, '.user-panel').body)).toEqual(['max-width: 8.5rem']);
    expect(declarationList(findRule(block, '.hud-header').body)).toEqual(['flex-wrap: wrap']);
    expect(declarationList(findRule(block, '.user-panel > .users-badge').body)).toEqual([
      'padding: 0.5rem 0.5rem',
      'font-size: 0.8rem',
    ]);
  });

  it('keeps at least a 0.5rem gap between the HUD reserve and the pill cap', () => {
    const block = mediaRules('@media (max-width: 720px)');
    const hudMaxWidth = declarations(findRule(block, '.hud-panel').body).get('max-width') ?? '';
    const reserve = hudMaxWidth.match(/-\s*(\d+(?:\.\d+)?)rem\s*-\s*env\(safe-area-inset-left/);
    const cap = findRule(block, '.user-panel').body.match(/max-width:\s*(\d+(?:\.\d+)?)rem/);
    if (reserve === null || cap === null) {
      throw new Error('mobile reserve or cap not found');
    }
    expect(Number(reserve[1])).toBe(9);
    expect(Number(cap[1])).toBe(8.5);
    expect(Number(reserve[1]) - Number(cap[1])).toBeGreaterThanOrEqual(0.5);
  });

  it('stacks the upgrades and customization panels above the toggle', () => {
    const block = mediaRules('@media (max-width: 720px)');
    expect(declarationList(findRule(block, '.upgrades-panel').body)).toEqual([
      'left: calc(1rem + env(safe-area-inset-left, 0px))',
      'right: calc(1rem + env(safe-area-inset-right, 0px))',
      'bottom: calc(5rem + env(safe-area-inset-bottom, 0px))',
      'max-width: none',
      'max-height: 35vh',
      'overflow-y: auto',
    ]);
    expect(declarationList(findRule(block, '.customization-panel').body)).toEqual([
      'left: calc(1rem + env(safe-area-inset-left, 0px))',
      'right: calc(1rem + env(safe-area-inset-right, 0px))',
      'bottom: calc(5rem + env(safe-area-inset-bottom, 0px))',
      'max-width: none',
      'max-height: 45vh',
      'overflow-y: auto',
    ]);
    expect(
      declarationList(findRule(block, "main[data-customization-open='true'] .upgrades-panel").body),
    ).toEqual(['display: none']);
  });

  it('moves the feed and leaderboard below the HUD and caps them', () => {
    const block = mediaRules('@media (max-width: 720px)');
    expect(declarationList(findRule(block, '.activity-feed').body)).toEqual([
      'top: calc(10rem + env(safe-area-inset-top, 0px))',
      'max-height: 6rem',
    ]);
    expect(declarationList(findRule(block, '.leaderboard').body)).toEqual([
      'top: calc(17rem + env(safe-area-inset-top, 0px))',
      'width: min(14rem, calc(100vw - 2rem))',
      'max-height: 18vh',
    ]);
    expect(declarationList(findRule(block, '.leaderboard-list').body)).toEqual([
      'font-size: 0.75rem',
    ]);

    // 17rem clears the feed band (10rem top + 6rem max-height = 16rem).
    const feedTop = Number(
      declarations(findRule(block, '.activity-feed').body).get('top')?.match(/([\d.]+)rem/)?.[1],
    );
    const feedMaxHeight = Number(
      declarations(findRule(block, '.activity-feed').body).get('max-height')?.match(/([\d.]+)rem/)?.[1],
    );
    const railTop = Number(
      declarations(findRule(block, '.leaderboard').body).get('top')?.match(/([\d.]+)rem/)?.[1],
    );
    expect(feedTop).toBe(10);
    expect(feedMaxHeight).toBe(6);
    expect(railTop).toBe(17);
    expect(railTop).toBeGreaterThan(feedTop + feedMaxHeight);
  });

  it('caps the rail at 12vh with a smaller font on very short phones', () => {
    const block = mediaRules('@media (max-width: 720px) and (max-height: 600px)');
    expect(declarationList(findRule(block, '.leaderboard').body)).toEqual([
      'max-height: 12vh',
    ]);
    expect(declarationList(findRule(block, '.leaderboard-list').body)).toEqual([
      'font-size: 0.7rem',
    ]);
  });
});

describe('motion map (AC-32)', () => {
  const MAIN_RULE = 'main';

  it('declares exactly the seventeen CSS-mapped tokens on main, not :root', () => {
    expect(declarationList(ruleBody(MAIN_RULE))).toEqual([
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
      '--motion-ui-panel-enter-ms: 220ms',
      '--motion-ui-button-press-ms: 90ms',
      '--motion-ui-glow-pulse-ms: 2400ms',
      '--motion-ui-reveal-spotlight-ms: 260ms',
    ]);
    expect(
      declarationList(ruleBody(':root')).filter((entry) => entry.startsWith('--motion-')),
    ).toEqual([]);
  });

  it('maps every value from the MOTION tokens', () => {
    const mainDeclarations = declarations(ruleBody(MAIN_RULE));
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
      ['--motion-ui-panel-enter-ms', 'uiPanelEnterMs'],
      ['--motion-ui-button-press-ms', 'uiButtonPressMs'],
      ['--motion-ui-glow-pulse-ms', 'uiGlowPulseMs'],
      ['--motion-ui-reveal-spotlight-ms', 'uiRevealSpotlightMs'],
    ] as const;

    for (const [cssName, token] of pairs) {
      expect(mainDeclarations.get(cssName)).toBe(`${MOTION[token]}ms`);
    }
  });

  it('uses the new durations in the reveal, press, glow and ambience animations', () => {
    expect(
      declarations(ruleBody('.customization-toggle')).get('transition'),
    ).toContain('var(--motion-ui-button-press-ms)');
    expect(
      declarations(ruleBody(".customization-panel[data-reveal-active='true']")).get('animation'),
    ).toContain('var(--motion-ui-reveal-spotlight-ms)');
    expect(declarations(ruleBody('.gf-live-dot')).get('animation')).toContain(
      'var(--motion-ui-glow-pulse-ms)',
    );
    expect(declarations(ruleBody('.connection-dot')).get('animation')).toContain(
      'var(--motion-ui-glow-pulse-ms)',
    );
    expect(declarations(ruleBody('.game-ambience::before')).get('animation')).toContain(
      'var(--motion-ui-glow-pulse-ms)',
    );
  });
});

describe('reduced motion (AC-14, AC-27, AC-31)', () => {
  it('has exactly one prefers-reduced-motion block', () => {
    expect(
      rules.filter((rule) => rule.selector === '@media (prefers-reduced-motion: reduce)'),
    ).toHaveLength(1);
  });

  it('disables the accepted reveal/event/level motion and the new ambience/dots', () => {
    const reduced = mediaRules('@media (prefers-reduced-motion: reduce)');
    const selectors = reduced.map((rule) => rule.selector);
    const block = reduced.map((rule) => `${rule.selector}{${rule.body}}`).join('\n');

    for (const selector of [
      '.activity-feed li,',
      '.leaderboard li,',
      '.lootbox-reveal,',
      '.lootbox-flash,',
      '.lootbox-reveal-card,',
      '.gf-live-dot,',
      '.connection-dot,',
    ]) {
      expect(block).toContain(selector);
    }
    expect(block).toContain('.game-ambience::before,');
    expect(selectors).toContain(
      ".lootbox-reveal[data-rarity='epic'] .lootbox-stage::before",
    );
    expect(block).toContain('animation: none;');
    expect(block).toContain('transition: none;');
  });

  it('keeps the runtime chrome out of the reduced-motion block', () => {
    const reduced = mediaRules('@media (prefers-reduced-motion: reduce)');
    expect(reduced.some((rule) => rule.selector.includes('.game-runtime-status'))).toBe(false);
    expect(reduced.some((rule) => rule.selector.includes('.game-runtime-error'))).toBe(false);
  });
});

describe('stylesheet integration (AC-18, AC-19, AC-21, AC-27)', () => {
  function withGameStyles(markup: string, run: (root: HTMLElement) => void): void {
    const appStyle = document.createElement('style');
    appStyle.textContent = appCss;
    const gameStyle = document.createElement('style');
    gameStyle.textContent = css;
    document.head.append(appStyle, gameStyle);
    const root = document.createElement('div');
    root.innerHTML = markup;
    document.body.append(root);
    try {
      run(root);
    } finally {
      root.remove();
      appStyle.remove();
      gameStyle.remove();
    }
  }

  it('cascades the shared frame, the minimized grid and the layer stack onto real markup', () => {
    const markup = `
      <main>
        <canvas></canvas>
        <div class="game-ambience" aria-hidden="true"></div>
        <section class="hud-panel" aria-label="Game statistics" data-minimized="true">
          <div class="hud-header"><h2 class="hud-title">Pilot status</h2><span class="hud-level" data-stat="cube">Cube 3</span></div>
          <div class="hud-resources" role="group" aria-label="Resources"><span data-resource="coins"><span class="hud-resource-value" data-stat="coins">1.00</span></span></div>
          <div class="hud-grid"><p class="hud-row" data-row="clicks">Clicks: <span data-stat="clicks">4</span></p></div>
        </section>
        <button class="customization-toggle" type="button">Customize</button>
        <section class="customization-panel" aria-label="Spaceship customization" data-reveal-active="true">
          <div class="lootbox-reveal" data-rarity="epic"><div class="lootbox-stage"></div></div>
        </section>
      </main>
    `;

    withGameStyles(markup, (root) => {
      const canvas = root.querySelector('main > canvas');
      if (canvas === null) throw new Error('canvas missing');
      const canvasStyle = window.getComputedStyle(canvas);
      expect(canvasStyle.position).toBe('relative');
      expect(canvasStyle.zIndex).toBe('0');

      const ambience = root.querySelector('.game-ambience');
      if (ambience === null) throw new Error('ambience missing');
      const ambienceStyle = window.getComputedStyle(ambience);
      expect(ambienceStyle.position).toBe('absolute');
      expect(ambienceStyle.zIndex).toBe('2');
      expect(ambienceStyle.pointerEvents).toBe('none');

      const hud = root.querySelector('.hud-panel');
      if (hud === null) throw new Error('HUD missing');
      const hudStyle = window.getComputedStyle(hud);
      expect(hudStyle.position).toBe('absolute');
      expect(hudStyle.zIndex).toBe('3');
      expect(hudStyle.clipPath).toBe(
        'polygon(var(--gf-chamfer) 0, 100% 0, 100% calc(100% - var(--gf-chamfer)), calc(100% - var(--gf-chamfer)) 100%, 0 100%)',
      );

      const header = root.querySelector('.hud-header');
      if (header === null) throw new Error('HUD header missing');
      expect(window.getComputedStyle(header).display).toBe('flex');

      const grid = root.querySelector('.hud-grid');
      if (grid === null) throw new Error('HUD grid missing');
      expect(window.getComputedStyle(grid).display).toBe('none');

      const toggle = root.querySelector('.customization-toggle');
      if (toggle === null) throw new Error('toggle missing');
      expect(window.getComputedStyle(toggle).zIndex).toBe('21');

      const panel = root.querySelector('.customization-panel');
      if (panel === null) throw new Error('panel missing');
      expect(window.getComputedStyle(panel).zIndex).toBe('20');

      const stage = root.querySelector('.lootbox-stage');
      if (stage === null) throw new Error('stage missing');
      expect(window.getComputedStyle(stage).position).toBe('relative');
    });
  });

  it('shows the stat grid when expanded and keeps the normal panel at layer 3', () => {
    const markup = `
      <main>
        <section class="hud-panel" aria-label="Game statistics">
          <div class="hud-grid"><p class="hud-row" data-row="clicks">Clicks: <span data-stat="clicks">4</span></p></div>
        </section>
        <section class="customization-panel" aria-label="Spaceship customization" data-reveal-active="false"></section>
      </main>
    `;

    withGameStyles(markup, (root) => {
      const grid = root.querySelector('.hud-grid');
      if (grid === null) throw new Error('HUD grid missing');
      expect(window.getComputedStyle(grid).display).toBe('flex');

      const panel = root.querySelector('.customization-panel');
      if (panel === null) throw new Error('panel missing');
      expect(window.getComputedStyle(panel).zIndex).toBe('3');
    });
  });
});

describe('stylesheet hygiene (AC-33, AC-34)', () => {
  it('never importance-flags a declaration', () => {
    expect(cssSource).not.toContain('!important');
  });

  it('references no external asset, font or import', () => {
    expect(cssSource).not.toContain('url(http');
    expect(cssSource).not.toContain('@font-face');
    expect(cssSource).not.toContain('data:image');
    expect(cssSource).not.toContain('@import');
    expect(cssSource).not.toContain('<img');
  });

  it('adds no screen shake or randomness', () => {
    expect(cssSource).not.toMatch(/@keyframes\s+[a-z-]*shake/i);
    expect(cssSource).not.toMatch(/random/i);
    for (const selector of ['main', '.upgrades-panel', '.customization-panel']) {
      expect(ruleBody(selector)).not.toMatch(/(?:transform|translate|rotate|scale)\s*:/);
    }
  });

  it('does not move the canvas or add a second rAF-style scene rule (AC-34)', () => {
    expect(cssSource).not.toContain('requestAnimationFrame');
    expect(cssSource).not.toContain('will-change');
  });

  it('ends with exactly one trailing newline', () => {
    expect(css.endsWith('\n')).toBe(true);
    expect(css.endsWith('\n\n')).toBe(false);
  });
});
