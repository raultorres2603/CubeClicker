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

/** Splits a grouped selector list into its trimmed, whitespace-normalized parts. */
function selectorParts(selector: string): string[] {
  return selector
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter((part) => part.length > 0);
}

/**
 * Minimal CSS specificity as `[ids, classes, elements]` counts. Attribute selectors and
 * pseudo-classes count as classes, pseudo-elements and type names as elements, and `:not()`
 * contributes the specificity of its argument (AC-17's specificity guard needs exactly this).
 */
function selectorSpecificity(selector: string): readonly [number, number, number] {
  const skipIdent = (from: number): number => {
    let cursor = from;
    while (cursor < selector.length && /[\w-]/.test(selector.charAt(cursor))) {
      cursor += 1;
    }
    return cursor;
  };
  let ids = 0;
  let classes = 0;
  let elements = 0;
  let index = 0;
  while (index < selector.length) {
    const char = selector.charAt(index);
    if (char === '#') {
      ids += 1;
      index = skipIdent(index + 1);
    } else if (char === '.') {
      classes += 1;
      index = skipIdent(index + 1);
    } else if (char === '[') {
      classes += 1;
      index = selector.indexOf(']', index) + 1;
    } else if (char === ':') {
      if (selector.charAt(index + 1) === ':') {
        elements += 1;
        index = skipIdent(index + 2);
      } else if (selector.startsWith(':not(', index)) {
        const open = index + ':not('.length;
        const close = selector.indexOf(')', open);
        const inner = selectorSpecificity(selector.slice(open, close));
        ids += inner[0];
        classes += inner[1];
        elements += inner[2];
        index = close + 1;
      } else {
        classes += 1;
        index = skipIdent(index + 1);
      }
    } else if (/[a-zA-Z]/.test(char)) {
      elements += 1;
      index = skipIdent(index);
    } else {
      index += 1;
    }
  }
  return [ids, classes, elements];
}

/** True when `candidate` is equal to or more specific than `reference`. */
function specificityAtLeast(
  candidate: readonly [number, number, number],
  reference: readonly [number, number, number],
): boolean {
  if (candidate[0] !== reference[0]) {
    return candidate[0] > reference[0];
  }
  if (candidate[1] !== reference[1]) {
    return candidate[1] > reference[1];
  }
  return candidate[2] >= reference[2];
}

function themeLiteral(name: string): string {
  const match = themeSource.match(new RegExp(`export const ${name} = '([^']+)';`));
  if (match === null) {
    throw new Error(`theme literal not found: ${name}`);
  }
  return match[1] ?? '';
}

/** Injects both real stylesheets, mounts `markup` and cleans the DOM up afterwards. */
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

const SURFACE_SELECTORS = [
  '.hud-panel',
  '.upgrades-panel',
  '.customization-panel',
  '.activity-feed',
  '.leaderboard',
  '.user-panel .users-list',
] as const;

/**
 * The single OS reduced-motion block's exact selector list (AC-17): the accepted shell
 * selectors plus the scoped hangar-boot/tab/crew selectors, so the (0,2,0) boot rules and
 * the previously broken (0,2,0) `reveal-spotlight` rule are both stopped by the OS query.
 */
const OS_REDUCED_SELECTOR_PARTS = [
  '.hud-panel',
  '.hud-panel::before',
  '.hud-panel::after',
  '.user-panel > .users-badge',
  '.user-panel .users-list',
  '.user-panel .users-list::before',
  '.user-panel .users-list::after',
  '.user-panel .users-list .users-list-title',
  '.upgrades-panel',
  '.upgrades-panel::before',
  '.upgrades-panel::after',
  '.upgrade-row',
  '.upgrade-buy',
  '.customization-toggle',
  '.customization-panel',
  '.customization-panel::before',
  '.customization-panel::after',
  ".customization-panel:not([data-reveal-active='true'])",
  ".customization-panel:not([data-reveal-active='true'])::before",
  ".customization-panel:not([data-reveal-active='true'])::after",
  ".customization-panel:not([data-reveal-active='true']) .customization-title",
  ".customization-panel[data-reveal-active='true']",
  '.customization-tabs',
  '.customization-tab',
  '.customization-tabpanel',
  '.activity-feed li',
  '.leaderboard li',
  '.hud-coin-pop',
  '.customization-slot',
  ".upgrade-row[data-purchased='true']",
  '.lootbox-reveal',
  '.lootbox-flash',
  '.lootbox-reveal-card',
  '.level-complete',
  '.level-complete::before',
  '.level-burst',
  '.level-banner',
  '.level-banner-halo',
  '.level-ray',
  '.level-ring',
  '.level-star',
  '.level-coin',
  '.game-ambience::before',
  '.gf-live-dot',
  '.connection-dot',
  ".lootbox-reveal[data-rarity='epic'] .lootbox-stage::before",
] as const;
const OS_REDUCED_SELECTOR = OS_REDUCED_SELECTOR_PARTS.join(', ');

/**
 * The extended top-level session block (AC-17): the accepted `<main data-reduced-motion>`
 * list plus the same scoped boot/tab/crew selectors, each `main[…]`-prefixed so it wins on
 * specificity and the file keeps exactly one session block.
 */
const SESSION_REDUCED_SELECTOR_PARTS = [
  "main[data-reduced-motion='true'] > section",
  "main[data-reduced-motion='true'] > section button",
  "main[data-reduced-motion='true'] > section[data-blinking='true']",
  "main[data-reduced-motion='true'] .hud-coin-pop",
  "main[data-reduced-motion='true'] .gf-live-dot",
  "main[data-reduced-motion='true'] .connection-dot",
  "main[data-reduced-motion='true'] .customization-toggle",
  "main[data-reduced-motion='true'] .upgrade-buy",
  "main[data-reduced-motion='true'] .customization-panel:not([data-reveal-active='true'])",
  "main[data-reduced-motion='true'] .customization-panel:not([data-reveal-active='true'])::before",
  "main[data-reduced-motion='true'] .customization-panel:not([data-reveal-active='true'])::after",
  "main[data-reduced-motion='true'] .customization-panel:not([data-reveal-active='true']) .customization-title",
  "main[data-reduced-motion='true'] .customization-tabs",
  "main[data-reduced-motion='true'] .customization-tab",
  "main[data-reduced-motion='true'] .customization-tabpanel",
  "main[data-reduced-motion='true'] .user-panel .users-list",
  "main[data-reduced-motion='true'] .user-panel .users-list::before",
  "main[data-reduced-motion='true'] .user-panel .users-list::after",
  "main[data-reduced-motion='true'] .user-panel .users-list .users-list-title",
  "main[data-reduced-motion='true'] .customization-panel[data-reveal-active='true']",
] as const;
const SESSION_REDUCED_SELECTOR = SESSION_REDUCED_SELECTOR_PARTS.join(', ');

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

describe('crew panel chrome (AC-24, AC-20)', () => {
  it('swaps the pill to Neon Forge glass and moves the warm gradient to the count badge', () => {
    expect(declarationList(ruleBody('.user-panel > .users-badge'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'gap: 0.35rem',
      'border: 1px solid var(--gf-rim)',
      'border-radius: 999px',
      'background: var(--gf-surface-raised)',
      'color: var(--gf-text)',
      'min-height: 44px',
      'padding: 0.5rem 1rem',
      'cursor: pointer',
    ]);
    expect(declarationList(ruleBody('.user-panel > .users-badge:hover'))).toEqual([
      'border-color: var(--gf-rim-strong)',
      'filter: brightness(1.08)',
    ]);
  });

  it('keeps both accepted warm tokens declared and consumed by the count badge (AC-17)', () => {
    const root = declarations(ruleBody(':root'));
    expect(root.get('--users-badge-top')).toBe('#d63a2f');
    expect(root.get('--users-badge-bottom')).toBe('#a51f1f');

    // The gradient moved from the pill to the count badge: each token is referenced once.
    expect(cssSource.match(/var\(--users-badge-top\)/g)).toHaveLength(1);
    expect(cssSource.match(/var\(--users-badge-bottom\)/g)).toHaveLength(1);
    expect(ruleBody('.user-panel > .users-badge')).not.toContain('users-badge-top');
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
      'background: linear-gradient(180deg, var(--users-badge-top), var(--users-badge-bottom))',
      'color: #ffffff',
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

describe('hangar tab chrome (AC-7, AC-9, AC-22)', () => {
  it('makes the tab strip a sticky auto-fit grid over the Neon Forge gradient', () => {
    expect(declarationList(ruleBody('.customization-tabs'))).toEqual([
      'position: sticky',
      'top: 0',
      'z-index: 1',
      'display: grid',
      'grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr))',
      'gap: 0.25rem',
      'padding: 0.15rem 0 0.35rem',
      'background: linear-gradient(180deg, var(--gf-surface-top), var(--gf-surface-bottom))',
    ]);
  });

  it('keeps every track at least 80 px wide and the chips at 44 px', () => {
    const tabs = declarations(ruleBody('.customization-tabs'));
    const track = (tabs.get('grid-template-columns') ?? '').match(/minmax\(([\d.]+)rem, 1fr\)/);
    if (track === null) {
      throw new Error('auto-fit track minimum not found');
    }
    const minTrackRem = Number(track[1]);
    expect(minTrackRem).toBe(5);
    expect(minTrackRem * 16).toBe(80);

    const tab = declarations(ruleBody('.customization-tab'));
    expect(tab.get('min-height')).toBe('44px');
    expect(Number.parseInt(tab.get('min-height') ?? '', 10)).toBe(44);

    // 320 px -> 20rem; the accepted `app.css` insets and horizontal padding leave a
    // 16rem content box: three 5rem tracks + two 0.25rem gaps fit, a fourth does not.
    const panelBase = declarations(findRule(appRules, '.customization-panel').body);
    const inset = (panelBase.get('left') ?? '').match(/calc\(([\d.]+)rem/);
    if (inset === null) {
      throw new Error('panel inset not found');
    }
    const insetRem = Number(inset[1]);
    const paddingParts = (panelBase.get('padding') ?? '').split(' ');
    expect(insetRem).toBe(1);
    expect(paddingParts).toEqual(['0.75rem', '1rem']);
    const horizontalPaddingRem = Number((paddingParts[1] ?? '').replace('rem', ''));
    expect(horizontalPaddingRem).toBe(1);
    const phoneContentRem = 20 - 2 * insetRem - 2 * horizontalPaddingRem;
    expect(phoneContentRem).toBe(16);

    const gapRem = Number((tabs.get('gap') ?? '').replace('rem', ''));
    expect(gapRem).toBe(0.25);
    const threeTracksRem = 3 * minTrackRem + 2 * gapRem;
    expect(threeTracksRem).toBe(15.5);
    expect(threeTracksRem).toBeLessThan(phoneContentRem);
    expect(4 * minTrackRem + 3 * gapRem).toBeGreaterThan(phoneContentRem);
  });

  it('declares the exact tab chip body, hover, selected and focus states', () => {
    expect(declarationList(ruleBody('.customization-tab'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'gap: 0.25rem',
      'min-height: 44px',
      'padding: 0.25rem 0.4rem',
      'border: 1px solid var(--gf-rim)',
      'border-radius: var(--gf-radius-control)',
      'background: var(--gf-surface-raised)',
      'color: var(--gf-text-muted)',
      'font-family: inherit',
      'font-size: 0.68rem',
      'font-weight: 700',
      'letter-spacing: 0.06em',
      'text-transform: uppercase',
      'white-space: nowrap',
      'cursor: pointer',
    ]);
    expect(declarationList(ruleBody('.customization-tab:hover'))).toEqual([
      'border-color: var(--gf-rim-strong)',
      'color: var(--gf-text)',
    ]);
    expect(declarationList(ruleBody(".customization-tab[aria-selected='true']"))).toEqual([
      'border-color: var(--gf-rim-strong)',
      'color: var(--gf-text)',
      'box-shadow: inset 0 -2px 0 var(--gf-rim-strong)',
    ]);
    expect(declarationList(ruleBody('.customization-tab:focus-visible'))).toEqual([
      'outline: 2px solid var(--gf-focus)',
      'outline-offset: 2px',
    ]);
  });

  it('renders the owned/total badge at the pinned metrics', () => {
    expect(declarationList(ruleBody('.customization-tab-badge'))).toEqual([
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'flex: none',
      'min-width: 1.1rem',
      'height: 1.1rem',
      'padding: 0 0.2rem',
      'border-radius: 999px',
      'background: var(--gf-void)',
      'color: var(--gf-rim-strong)',
      'font-size: 0.6rem',
      'font-weight: 700',
      'font-variant-numeric: tabular-nums',
      'white-space: nowrap',
    ]);
  });

  it('paints the whole tab chrome with --gf-* tokens and no literal colour', () => {
    const tabSelectors = rules
      .map((rule) => rule.selector)
      .filter((selector) => selector.startsWith('.customization-tab'));
    expect(tabSelectors).toEqual([
      '.customization-tabs',
      '.customization-tab',
      '.customization-tab:hover',
      ".customization-tab[aria-selected='true']",
      '.customization-tab:focus-visible',
      '.customization-tab-badge',
      '.customization-tabpanel',
    ]);

    const literalColours: string[] = [];
    for (const rule of allCssRules.filter((candidate) =>
      candidate.selector.startsWith('.customization-tab'),
    )) {
      for (const declaration of declarationList(rule.body)) {
        if (/#[0-9a-fA-F]{3,8}\b/.test(declaration) || /rgba?\(/.test(declaration)) {
          literalColours.push(`${rule.selector} { ${declaration}; }`);
        }
      }
    }
    expect(literalColours).toEqual([]);
  });

  it('fades the keyed tabpanel in and stacks label/badge at 720 px', () => {
    expect(declarationList(ruleBody('.customization-tabpanel'))).toEqual([
      'animation: tab-panel-in var(--motion-tab-switch-ms) ease-out both',
    ]);
    const panel = declarations(ruleBody('.customization-tabpanel'));
    expect(panel.has('overflow')).toBe(false);
    expect(panel.has('height')).toBe(false);
    expect(panel.has('max-height')).toBe(false);

    const block = mediaRules('@media (max-width: 720px)');
    expect(declarationList(findRule(block, '.customization-tab').body)).toEqual([
      'flex-direction: column',
      'gap: 0.1rem',
      'padding: 0.25rem 0.3rem',
      'font-size: 0.66rem',
      'letter-spacing: 0.04em',
    ]);
    // The stacked direction is a phone-only override: the base chip stays a row.
    expect(declarations(ruleBody('.customization-tab')).has('flex-direction')).toBe(false);
  });

  it('shrinks the preview on short viewports without a second scroll box', () => {
    expect(declarationList(ruleBody('.customization-panel .spaceship-preview'))).toEqual([
      'height: min(12rem, 26vh)',
    ]);
    expect(
      rules.filter((rule) => rule.selector === '@media (max-height: 760px)'),
    ).toHaveLength(1);
    expect(
      declarationList(
        findRule(
          mediaRules('@media (max-height: 760px)'),
          '.customization-panel .spaceship-preview',
        ).body,
      ),
    ).toEqual(['height: 8rem']);

    const panelBase = declarations(findRule(appRules, '.customization-panel').body);
    expect(panelBase.get('max-width')).toBe('min(22rem, calc(100vw - 2rem))');
    expect(panelBase.get('max-height')).toBe('60vh');
    expect(panelBase.get('overflow-x')).toBe('hidden');
    expect(panelBase.get('overflow-y')).toBe('auto');

    const nestedScroll = allCssRules
      .filter((rule) => rule.selector.includes('.customization-tab'))
      .flatMap((rule) =>
        declarationList(rule.body).filter((declaration) =>
          /^overflow(?:-[xy])?\s*:/.test(declaration),
        ),
      );
    expect(nestedScroll).toEqual([]);
  });
});

describe('menu boot animation (AC-12, AC-13, AC-14, AC-15, AC-16, AC-18)', () => {
  const keyframeStops = (name: string): CssRule[] =>
    parseRules(findRule(rules, `@keyframes ${name}`).body);

  const MENU_KEYFRAMES = [
    [
      'menu-boot',
      [
        ['0%', ['opacity: 0', 'border-color: var(--gf-rim-strong)']],
        ['12%', ['opacity: 0.62']],
        ['22%', ['opacity: 0.14']],
        ['34%', ['opacity: 0.86']],
        ['46%', ['opacity: 0.48']],
        ['60%', ['opacity: 1', 'border-color: var(--gf-rim)']],
        ['100%', ['opacity: 1', 'border-color: var(--gf-rim)']],
      ],
    ],
    [
      'menu-scan',
      [
        ['0%', ['right: 100%', 'opacity: 0.15']],
        ['45%', ['right: 0', 'opacity: 1']],
        ['70%', ['right: 0', 'opacity: 0.4']],
        ['100%', ['right: 0', 'opacity: 1']],
      ],
    ],
    [
      'menu-rail',
      [
        ['0%', ['height: 8%', 'opacity: 0.1']],
        ['100%', ['height: 40%', 'opacity: 1']],
      ],
    ],
    [
      'menu-chroma',
      [
        ['0%', ['text-shadow: -1px 0 var(--gf-rare), 1px 0 var(--gf-rim-strong)']],
        ['50%', ['text-shadow: 1px 0 var(--gf-amber), -1px 0 var(--gf-rare)']],
        ['100%', ['text-shadow: none']],
      ],
    ],
    [
      'tab-panel-in',
      [
        ['0%', ['opacity: 0']],
        ['100%', ['opacity: 1']],
      ],
    ],
  ] as const;

  it('declares every pinned stop of the four beats and the tab swap', () => {
    for (const [name, stops] of MENU_KEYFRAMES) {
      const parsed = keyframeStops(name);
      expect(parsed.map((stop) => stop.selector)).toEqual(stops.map(([selector]) => selector));
      expect(parsed.map((stop) => declarationList(stop.body))).toEqual(
        stops.map(([, expected]) => [...expected]),
      );
    }
  });

  it('never animates transform, filter, backdrop-filter, clip-path, margin or left', () => {
    const banned = /^(?:transform|filter|backdrop-filter|clip-path|margin(?:-[a-z]+)?|left)\s*:/;
    const offenders: string[] = [];
    for (const [name] of MENU_KEYFRAMES) {
      for (const stop of keyframeStops(name)) {
        for (const declaration of declarationList(stop.body)) {
          if (banned.test(declaration)) {
            offenders.push(`@keyframes ${name} ${stop.selector} { ${declaration}; }`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the only box geometry on the two pseudo-element beats', () => {
    const geometry = /^(?:width|height|right|left|top|bottom|inset|margin|padding)\b\s*:/;
    const geometryFor = (name: string): string[] =>
      keyframeStops(name).flatMap((stop) =>
        declarationList(stop.body).filter((declaration) => geometry.test(declaration)),
      );

    expect(geometryFor('menu-boot')).toEqual([]);
    expect(geometryFor('menu-scan')).toEqual([
      'right: 100%',
      'right: 0',
      'right: 0',
      'right: 0',
    ]);
    expect(geometryFor('menu-rail')).toEqual(['height: 8%', 'height: 40%']);
    expect(geometryFor('menu-chroma')).toEqual([]);
    expect(geometryFor('tab-panel-in')).toEqual([]);
  });

  it('declares no exit keyframe and no reverse direction (AC-16)', () => {
    const names = rules
      .filter((rule) => rule.selector.startsWith('@keyframes '))
      .map((rule) => rule.selector.slice('@keyframes '.length));
    expect(names.filter((name) => /-(?:out|exit|close|leave)$/.test(name))).toEqual([]);
    expect(cssSource).not.toContain('animation-direction');
    expect(cssSource).not.toContain('animation-fill-mode');
  });

  it('pins the four boot rule sets and the tab-swap rule', () => {
    expect(
      declarationList(
        ruleBody(".customization-panel:not([data-reveal-active='true']), .user-panel .users-list"),
      ),
    ).toEqual(['animation: menu-boot var(--motion-menu-boot-ms) linear both']);
    expect(
      declarationList(
        ruleBody(
          ".customization-panel:not([data-reveal-active='true'])::before, .user-panel .users-list::before",
        ),
      ),
    ).toEqual(['animation: menu-scan var(--motion-menu-boot-ms) linear both']);
    expect(
      declarationList(
        ruleBody(
          ".customization-panel:not([data-reveal-active='true'])::after, .user-panel .users-list::after",
        ),
      ),
    ).toEqual(['animation: menu-rail var(--motion-menu-flicker-ms) steps(2, end) both']);
    expect(
      declarationList(
        ruleBody(
          ".customization-panel:not([data-reveal-active='true']) .customization-title, .user-panel .users-list .users-list-title",
        ),
      ),
    ).toEqual(['animation: menu-chroma var(--motion-menu-chroma-ms) steps(3, end) both']);
    expect(declarationList(ruleBody('.customization-tabpanel'))).toEqual([
      'animation: tab-panel-in var(--motion-tab-switch-ms) ease-out both',
    ]);
  });

  it('animates exactly the two user-opened menus and their titles (AC-12, AC-13, AC-14)', () => {
    const bootRules = rules.filter(
      (rule) => !rule.selector.startsWith('@keyframes') && /animation:\s*menu-/.test(rule.body),
    );
    expect(bootRules.map((rule) => rule.selector)).toEqual([
      ".customization-panel:not([data-reveal-active='true']), .user-panel .users-list",
      ".customization-panel:not([data-reveal-active='true'])::before, .user-panel .users-list::before",
      ".customization-panel:not([data-reveal-active='true'])::after, .user-panel .users-list::after",
      ".customization-panel:not([data-reveal-active='true']) .customization-title, .user-panel .users-list .users-list-title",
    ]);

    // Negative sweep: no other shell surface may reference any menu beat.
    const bannedSurfaces = [
      '.hud-panel',
      '.upgrades-panel',
      '.activity-feed',
      '.leaderboard',
      '.connection-banner',
      '.phase-announcement',
      '.auth-menu',
      '.auth-panel',
      '.game-runtime-status',
      '.game-runtime-error',
    ] as const;
    const offenders: string[] = [];
    for (const rule of rules) {
      if (!/animation:\s*(?:menu-|tab-panel-in)/.test(rule.body)) {
        continue;
      }
      for (const part of selectorParts(rule.selector)) {
        for (const surface of bannedSurfaces) {
          if (
            part === surface ||
            part.startsWith(`${surface} `) ||
            part.startsWith(`${surface}:`) ||
            part.startsWith(`${surface}.`)
          ) {
            offenders.push(part);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the reveal branch on its own spotlight and never on a menu beat', () => {
    expect(declarationList(ruleBody(".customization-panel[data-reveal-active='true']"))).toEqual([
      'z-index: 20',
      'animation: reveal-spotlight var(--motion-ui-reveal-spotlight-ms) ease-out both',
    ]);

    const revealStateRules = rules.filter((rule) =>
      selectorParts(rule.selector).some(
        (part) => part.endsWith("[data-reveal-active='true']") && !part.includes(':not('),
      ),
    );
    expect(
      revealStateRules
        .filter((rule) => /menu-(?:boot|scan|rail|chroma)/.test(rule.body))
        .map((rule) => rule.selector),
    ).toEqual([]);
  });
});

describe('HUD minimize control (AC-21)', () => {
  it('compacts the control to a right-aligned 24 px chevron, not a 44 px target', () => {
    expect(declarationList(ruleBody('.hud-panel > button'))).toEqual([
      'align-self: flex-end',
      'width: 1.5rem',
      'height: 1.5rem',
      'min-width: 1.5rem',
      'min-height: 1.5rem',
      'padding: 0',
      'border: 1px solid var(--gf-rim)',
      'border-radius: var(--gf-radius-control)',
      'background: var(--gf-surface-raised)',
      'color: var(--gf-rim-strong)',
    ]);

    const control = declarations(ruleBody('.hud-panel > button'));
    expect(control.get('width')).toBe('1.5rem');
    expect(Number.parseFloat(control.get('width') ?? '') * 16).toBe(24);
    expect(Number.parseFloat(control.get('min-height') ?? '') * 16).toBe(24);
    expect(Number.parseFloat(control.get('min-height') ?? '') * 16).toBeLessThan(44);

    expect(
      declarationList(ruleBody('.hud-panel > button:hover, .hud-panel > button:focus-visible')),
    ).toEqual(['border-color: var(--gf-rim-strong)', 'color: var(--gf-focus)']);

    expect(
      declarationList(ruleBody(".hud-panel[data-minimized='true'] > button::before")),
    ).toEqual(["content: '▴'"]);

    // `app.css` keeps the expanded glyph that the minimized rule flips.
    expect(
      declarations(findRule(appRules, '.hud-panel > button::before').body).get('content'),
    ).toBe("'▾'");
  });
});

describe('themed scrollbars (AC-19)', () => {
  const SCROLLBAR_SURFACES = '.customization-panel, .upgrades-panel, .user-panel .users-list';

  it('adds one thin-scrollbar rule without merging into the accepted surface bodies', () => {
    expect(declarationList(ruleBody(SCROLLBAR_SURFACES))).toEqual([
      'scrollbar-width: thin',
      'scrollbar-color: var(--gf-rim) transparent',
    ]);
    expect(rules.filter((rule) => rule.selector === normalizeSelector(SCROLLBAR_SURFACES))).toHaveLength(1);

    // The scrollbar declarations live in their own rule: each surface keeps one base rule.
    for (const selector of ['.customization-panel', '.upgrades-panel', '.user-panel .users-list']) {
      expect(rules.filter((rule) => rule.selector === selector)).toHaveLength(1);
    }
  });

  it('styles exactly the four WebKit scrollbar parts on the three surfaces', () => {
    const parts = [
      [
        '.customization-panel::-webkit-scrollbar, .upgrades-panel::-webkit-scrollbar, .user-panel .users-list::-webkit-scrollbar',
        ['width: 6px', 'height: 6px'],
      ],
      [
        '.customization-panel::-webkit-scrollbar-track, .upgrades-panel::-webkit-scrollbar-track, .user-panel .users-list::-webkit-scrollbar-track',
        ['background: transparent'],
      ],
      [
        '.customization-panel::-webkit-scrollbar-thumb, .upgrades-panel::-webkit-scrollbar-thumb, .user-panel .users-list::-webkit-scrollbar-thumb',
        ['background: rgba(124, 246, 255, 0.35)', 'border-radius: 999px'],
      ],
      [
        '.customization-panel::-webkit-scrollbar-thumb:hover, .upgrades-panel::-webkit-scrollbar-thumb:hover, .user-panel .users-list::-webkit-scrollbar-thumb:hover',
        ['background: rgba(124, 246, 255, 0.55)'],
      ],
    ] as const;

    for (const [selector, expected] of parts) {
      expect(declarationList(ruleBody(selector))).toEqual(expected);
      expect(rules.filter((rule) => rule.selector === normalizeSelector(selector))).toHaveLength(1);
    }
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
    const group = findRule(reduced, OS_REDUCED_SELECTOR);
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

  it('declares exactly the twenty-one CSS-mapped tokens on main, not :root', () => {
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
      '--motion-menu-boot-ms: 320ms',
      '--motion-menu-flicker-ms: 120ms',
      '--motion-menu-chroma-ms: 90ms',
      '--motion-tab-switch-ms: 140ms',
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
      ['--motion-menu-boot-ms', 'menuBootMs'],
      ['--motion-menu-flicker-ms', 'menuFlickerMs'],
      ['--motion-menu-chroma-ms', 'menuChromaMs'],
      ['--motion-tab-switch-ms', 'tabSwitchMs'],
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

  it('disables the same motion under the session reduced-motion marker (AC-31)', () => {
    // A top-level `findRule` lookup proves the session switch lives outside the OS media
    // query, so the in-game preference works even when the platform query is unset.
    const sessionRule = findRule(rules, SESSION_REDUCED_SELECTOR);
    expect(declarationList(sessionRule.body)).toEqual(['animation: none', 'transition: none']);
  });

  it('keeps exactly one OS block and one extended session block (AC-17)', () => {
    expect(
      rules.filter((rule) => rule.selector === '@media (prefers-reduced-motion: reduce)'),
    ).toHaveLength(1);
    expect(
      rules.filter((rule) => rule.selector.startsWith("main[data-reduced-motion='true']")),
    ).toHaveLength(1);

    const reduced = mediaRules('@media (prefers-reduced-motion: reduce)');
    expect(declarationList(findRule(reduced, OS_REDUCED_SELECTOR).body)).toEqual([
      'animation: none',
      'transition: none',
    ]);
    expect(declarationList(findRule(rules, SESSION_REDUCED_SELECTOR).body)).toEqual([
      'animation: none',
      'transition: none',
    ]);
  });

  it('stops every animated menu selector with equal-or-higher specificity, after its rule (AC-17)', () => {
    // Hand-counted specificities pin the helper, so the guard cannot pass vacuously.
    expect(selectorSpecificity(".customization-panel:not([data-reveal-active='true'])")).toEqual([
      0, 2, 0,
    ]);
    expect(
      selectorSpecificity(
        ".customization-panel:not([data-reveal-active='true']) .customization-title",
      ),
    ).toEqual([0, 3, 0]);
    expect(selectorSpecificity('.customization-tabpanel')).toEqual([0, 1, 0]);
    expect(selectorSpecificity(SESSION_REDUCED_SELECTOR_PARTS[8] ?? '')).toEqual([0, 3, 1]);

    // A bare `.customization-panel` (0,1,0) loses to the (0,2,0) boot: the scoped selector is
    // the fix, not the accepted bare one.
    expect(
      specificityAtLeast(
        selectorSpecificity('.customization-panel'),
        selectorSpecificity(".customization-panel:not([data-reveal-active='true'])"),
      ),
    ).toBe(false);
    expect(
      specificityAtLeast(
        selectorSpecificity('.user-panel .users-list'),
        selectorSpecificity('.user-panel .users-list .users-list-title'),
      ),
    ).toBe(false);

    const guardPairs = [
      [
        ".customization-panel:not([data-reveal-active='true'])",
        ".customization-panel:not([data-reveal-active='true'])",
      ],
      [
        ".customization-panel:not([data-reveal-active='true'])::before",
        ".customization-panel:not([data-reveal-active='true'])::before",
      ],
      [
        ".customization-panel:not([data-reveal-active='true'])::after",
        ".customization-panel:not([data-reveal-active='true'])::after",
      ],
      [
        ".customization-panel:not([data-reveal-active='true']) .customization-title",
        ".customization-panel:not([data-reveal-active='true']) .customization-title",
      ],
      ['.customization-tabs', '.customization-tabs'],
      ['.customization-tab', '.customization-tab'],
      ['.customization-tabpanel', '.customization-tabpanel'],
      ['.user-panel .users-list', '.user-panel .users-list'],
      ['.user-panel .users-list::before', '.user-panel .users-list::before'],
      ['.user-panel .users-list::after', '.user-panel .users-list::after'],
      [
        '.user-panel .users-list .users-list-title',
        '.user-panel .users-list .users-list-title',
      ],
      [
        ".customization-panel[data-reveal-active='true']",
        ".customization-panel[data-reveal-active='true']",
      ],
    ] as const;

    const mediaStart = cssSource.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(mediaStart).toBeGreaterThan(0);
    const osSelectors = mediaRules('@media (prefers-reduced-motion: reduce)').flatMap((rule) =>
      selectorParts(rule.selector),
    );
    const sessionSelectors = selectorParts(SESSION_REDUCED_SELECTOR);

    for (const [producing, offSwitch] of guardPairs) {
      // (a) The producing rule is written before the OS block (equal specificity → later wins).
      const producingIndex = cssSource.indexOf(producing);
      expect(producingIndex).toBeGreaterThan(-1);
      expect(producingIndex).toBeLessThan(mediaStart);

      // (b) Both off-switches carry a selector with equal or higher specificity.
      expect(osSelectors).toContain(offSwitch);
      expect(
        specificityAtLeast(selectorSpecificity(offSwitch), selectorSpecificity(producing)),
      ).toBe(true);
      const sessionOffSwitch = `main[data-reduced-motion='true'] ${offSwitch}`;
      expect(sessionSelectors).toContain(sessionOffSwitch);
      expect(
        specificityAtLeast(
          selectorSpecificity(sessionOffSwitch),
          selectorSpecificity(producing),
        ),
      ).toBe(true);
    }
  });
});

describe('stylesheet integration (AC-18, AC-19, AC-21, AC-27)', () => {
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

  it('cascades the session reduced-motion switches onto real markup', () => {
    const markup = `
      <main data-reduced-motion="true">
        <section class="hud-panel" aria-label="Game statistics" data-blinking="true">
          <span class="hud-coin-pop" data-coin-pop="1">+1.00</span>
          <span class="gf-live-dot"></span>
        </section>
        <div class="connection-banner"><span class="connection-dot"></span></div>
        <button class="customization-toggle" type="button">Customize</button>
        <section class="customization-panel" aria-label="Spaceship customization" data-reveal-active="true">
          <div class="lootbox-reveal" data-rarity="rare"></div>
        </section>
        <section class="customization-panel" aria-label="Spaceship customization" data-reveal-active="false" data-active-tab="frame">
          <h2 class="customization-title">Spaceship hangar</h2>
          <div class="customization-tabs" role="tablist" aria-label="Spaceship part groups">
            <button type="button" role="tab" class="customization-tab" id="customization-tab-frame" data-tab="frame" aria-selected="true" tabindex="0">Frame<span class="customization-tab-badge" data-owned="0" data-total="4" aria-hidden="true">0/4</span></button>
          </div>
          <div class="customization-tabpanel" role="tabpanel" id="customization-tabpanel" data-tabpanel="frame" aria-labelledby="customization-tab-frame"></div>
        </section>
        <section class="user-panel">
          <button type="button" class="users-badge" aria-expanded="true"><span class="users-count" data-count="1" aria-hidden="true">1</span></button>
          <section class="users-list" aria-label="Users on server">
            <h2 class="users-list-title">Crew</h2>
            <ul></ul>
          </section>
        </section>
        <section class="upgrades-panel" aria-label="Upgrades">
          <button class="upgrade-buy" type="button" aria-label="Buy"></button>
        </section>
      </main>
    `;

    withGameStyles(markup, (root) => {
      for (const selector of [
        '.gf-live-dot',
        '.connection-dot',
        '.hud-coin-pop',
        '.customization-panel',
        '.customization-title',
        '.customization-tabs',
        '.customization-tab',
        '.customization-tabpanel',
        '.user-panel .users-list',
        '.user-panel .users-list .users-list-title',
      ]) {
        const element = root.querySelector(selector);
        if (element === null) throw new Error(`${selector} missing`);
        expect(window.getComputedStyle(element).animationName).toBe('none');
      }

      const hud = root.querySelector('.hud-panel');
      if (hud === null) throw new Error('HUD missing');
      expect(window.getComputedStyle(hud).animationName).toBe('none');
      expect(window.getComputedStyle(hud).transitionDuration).toBe('0s');

      for (const selector of ['.customization-toggle', '.upgrade-buy']) {
        const element = root.querySelector(selector);
        if (element === null) throw new Error(`${selector} missing`);
        expect(window.getComputedStyle(element).transitionDuration).toBe('0s');
      }

      // The extended session block really selects the boot surfaces: the scoped parts of the
      // one session rule are the ones that match, which is what stops the (0,2,0) boot.
      const sessionParts = selectorParts(findRule(rules, SESSION_REDUCED_SELECTOR).selector);
      const matchingParts = (selector: string): string[] => {
        const element = root.querySelector(selector);
        if (element === null) throw new Error(`${selector} missing`);
        return sessionParts.filter((part) => element.matches(part));
      };

      expect(matchingParts('.customization-panel[data-reveal-active="false"]')).toEqual([
        "main[data-reduced-motion='true'] > section",
        "main[data-reduced-motion='true'] .customization-panel:not([data-reveal-active='true'])",
      ]);
      expect(matchingParts('.customization-panel[data-reveal-active="true"]')).toEqual([
        "main[data-reduced-motion='true'] > section",
        "main[data-reduced-motion='true'] .customization-panel[data-reveal-active='true']",
      ]);
      expect(matchingParts('.customization-tabs')).toEqual([
        "main[data-reduced-motion='true'] .customization-tabs",
      ]);
      expect(matchingParts('.customization-tab')).toEqual([
        "main[data-reduced-motion='true'] > section button",
        "main[data-reduced-motion='true'] .customization-tab",
      ]);
      expect(matchingParts('.customization-tabpanel')).toEqual([
        "main[data-reduced-motion='true'] .customization-tabpanel",
      ]);
      expect(matchingParts('.user-panel .users-list')).toEqual([
        "main[data-reduced-motion='true'] .user-panel .users-list",
      ]);
      expect(matchingParts('.user-panel .users-list .users-list-title')).toEqual([
        "main[data-reduced-motion='true'] .user-panel .users-list .users-list-title",
      ]);
    });
  });

  it('gates the menu boot to the normal hangar and the crew list on real markup', () => {
    const markup = `
      <main>
        <section class="hud-panel" aria-label="Game statistics"></section>
        <section class="customization-panel" aria-label="Spaceship customization" data-reveal-active="false" data-active-tab="frame">
          <h2 class="customization-title">Spaceship hangar</h2>
          <div class="customization-tabpanel" role="tabpanel"></div>
        </section>
        <section class="customization-panel" aria-label="Spaceship customization" data-reveal-active="true">
          <h2 class="customization-title">Spaceship hangar</h2>
        </section>
        <section class="user-panel">
          <section class="users-list" aria-label="Users on server">
            <h2 class="users-list-title">Crew</h2>
          </section>
        </section>
        <section class="upgrades-panel" aria-label="Upgrades"></section>
      </main>
    `;

    withGameStyles(markup, (root) => {
      const requirement = (selector: string): Element => {
        const element = root.querySelector(selector);
        if (element === null) throw new Error(`${selector} missing`);
        return element;
      };
      const normalPanel = requirement('.customization-panel[data-reveal-active="false"]');
      const revealPanel = requirement('.customization-panel[data-reveal-active="true"]');
      const crewList = requirement('.user-panel .users-list');
      const crewTitle = requirement('.user-panel .users-list .users-list-title');
      const normalTitle = requirement('.customization-panel[data-reveal-active="false"] .customization-title');

      const [panelBeat, crewBeat] = selectorParts(
        ".customization-panel:not([data-reveal-active='true']), .user-panel .users-list",
      );
      expect(panelBeat).toBe(".customization-panel:not([data-reveal-active='true'])");
      expect(crewBeat).toBe('.user-panel .users-list');
      if (panelBeat === undefined || crewBeat === undefined) {
        throw new Error('boot selector pair missing');
      }
      expect(normalPanel.matches(panelBeat)).toBe(true);
      expect(revealPanel.matches(panelBeat)).toBe(false);
      expect(crewList.matches(crewBeat)).toBe(true);
      expect(requirement('.hud-panel').matches(crewBeat)).toBe(false);

      const [titleBeat, crewTitleBeat] = selectorParts(
        ".customization-panel:not([data-reveal-active='true']) .customization-title, .user-panel .users-list .users-list-title",
      );
      if (titleBeat === undefined || crewTitleBeat === undefined) {
        throw new Error('title beat selector pair missing');
      }
      expect(normalTitle.matches(titleBeat)).toBe(true);
      expect(crewTitle.matches(crewTitleBeat)).toBe(true);

      // The reveal branch never matches the boot, so it keeps only its own spotlight.
      const bootSelectorParts = selectorParts(
        ".customization-panel:not([data-reveal-active='true']), .customization-panel:not([data-reveal-active='true'])::before, .customization-panel:not([data-reveal-active='true'])::after, .customization-panel:not([data-reveal-active='true']) .customization-title",
      ).filter((part) => !part.includes('::'));
      expect(bootSelectorParts).toEqual([
        ".customization-panel:not([data-reveal-active='true'])",
        ".customization-panel:not([data-reveal-active='true']) .customization-title",
      ]);
      expect(bootSelectorParts.filter((part) => revealPanel.matches(part))).toEqual([]);
      expect(
        selectorParts(".customization-panel[data-reveal-active='true']").filter((part) =>
          revealPanel.matches(part),
        ),
      ).toEqual([".customization-panel[data-reveal-active='true']"]);
    });
  });

  it('cascades the glass crew pill and the warm count badge onto real markup (AC-20)', () => {
    const markup = `
      <main>
        <section class="user-panel">
          <button type="button" class="users-badge" aria-expanded="false">
            <span class="gf-live-dot" aria-hidden="true"></span>Users on Server
            <span class="users-count" data-count="3" aria-hidden="true">3</span>
          </button>
        </section>
      </main>
    `;

    withGameStyles(markup, (root) => {
      const pill = root.querySelector('.user-panel > .users-badge');
      const count = root.querySelector('.users-count');
      if (pill === null || count === null) throw new Error('crew pill missing');

      const pillStyle = window.getComputedStyle(pill);
      expect(pillStyle.minHeight).toBe('44px');
      expect(pillStyle.borderRadius).toBe('999px');
      expect(pillStyle.padding).toBe('8px 16px');
      expect(pillStyle.cursor).toBe('pointer');

      const countStyle = window.getComputedStyle(count);
      expect(countStyle.minWidth).toBe('22.4px');
      expect(countStyle.height).toBe('22.4px');
      expect(countStyle.fontSize).toBe('11.52px');
      expect(countStyle.fontWeight).toBe('800');
      expect(countStyle.color).toBe('rgb(255, 255, 255)');
    });
  });

  it('parses both stylesheets with the boot and off-switch rules intact', () => {
    const appStyle = document.createElement('style');
    appStyle.textContent = appCss;
    const gameStyle = document.createElement('style');
    gameStyle.textContent = css;
    document.head.append(appStyle, gameStyle);
    try {
      const parsed = gameStyle.sheet === null ? [] : Array.from(gameStyle.sheet.cssRules);
      const selectorTexts = parsed.map((rule) =>
        rule.cssText.slice(0, rule.cssText.indexOf('{')).trim().replace(/\s+/g, ' '),
      );

      for (const keyframe of ['menu-boot', 'menu-scan', 'menu-rail', 'menu-chroma', 'tab-panel-in']) {
        expect(selectorTexts.filter((text) => text === `@keyframes ${keyframe}`)).toHaveLength(1);
      }
      expect(selectorTexts).toContain(
        ".customization-panel:not([data-reveal-active='true']), .user-panel .users-list",
      );
      expect(selectorTexts).toContain(SESSION_REDUCED_SELECTOR);
      expect(selectorTexts).toContain('@media (prefers-reduced-motion: reduce)');
      expect(selectorTexts.filter((text) => text === '@media (prefers-reduced-motion: reduce)')).toHaveLength(
        1,
      );
    } finally {
      appStyle.remove();
      gameStyle.remove();
    }
  });

  it('cascades the sticky tab grid, the 44 px chip and the badge metrics', () => {
    const markup = `
      <main>
        <section class="customization-panel" aria-label="Spaceship customization" data-reveal-active="false" data-active-tab="wings">
          <div class="customization-tabs" role="tablist" aria-label="Spaceship part groups">
            <button type="button" role="tab" class="customization-tab" id="customization-tab-wings" data-tab="wings" aria-selected="true" tabindex="0">Wings<span class="customization-tab-badge" data-owned="1" data-total="4" aria-hidden="true">1/4</span></button>
          </div>
          <div class="customization-tabpanel" role="tabpanel" id="customization-tabpanel" data-tabpanel="wings" aria-labelledby="customization-tab-wings"></div>
        </section>
      </main>
    `;

    withGameStyles(markup, (root) => {
      const tabs = root.querySelector('.customization-tabs');
      if (tabs === null) throw new Error('tab strip missing');
      const tabsStyle = window.getComputedStyle(tabs);
      expect(tabsStyle.display).toBe('grid');
      expect(tabsStyle.gridTemplateColumns).toBe('repeat(auto-fit, minmax(5rem, 1fr))');
      expect(tabsStyle.gap).toBe('0.25rem');
      expect(tabsStyle.position).toBe('sticky');
      expect(tabsStyle.top).toBe('0px');
      expect(tabsStyle.zIndex).toBe('1');

      const tab = root.querySelector('.customization-tab');
      if (tab === null) throw new Error('tab missing');
      const tabStyle = window.getComputedStyle(tab);
      expect(tabStyle.display).toBe('inline-flex');
      expect(tabStyle.minHeight).toBe('44px');
      expect(tabStyle.padding).toBe('4px 6.4px');
      expect(tabStyle.fontSize).toBe('10.88px');
      expect(tabStyle.textTransform).toBe('uppercase');
      expect(tabStyle.whiteSpace).toBe('nowrap');
      expect(tabStyle.cursor).toBe('pointer');

      const badge = root.querySelector('.customization-tab-badge');
      if (badge === null) throw new Error('tab badge missing');
      const badgeStyle = window.getComputedStyle(badge);
      expect(badgeStyle.display).toBe('inline-flex');
      expect(badgeStyle.minWidth).toBe('17.6px');
      expect(badgeStyle.height).toBe('17.6px');
      expect(badgeStyle.fontSize).toBe('9.6px');
      expect(badgeStyle.whiteSpace).toBe('nowrap');
    });
  });

  it('cascades the compact 24 px HUD chevron onto real markup', () => {
    const markup = `
      <main>
        <section class="hud-panel" aria-label="Game statistics" data-minimized="true">
          <button type="button" aria-expanded="false" aria-label="Toggle HUD"></button>
        </section>
        <section class="customization-panel" aria-label="Spaceship customization">
          <div class="spaceship-preview"></div>
        </section>
      </main>
    `;

    withGameStyles(markup, (root) => {
      const button = root.querySelector('.hud-panel > button');
      if (button === null) throw new Error('HUD minimize control missing');
      const buttonStyle = window.getComputedStyle(button);
      expect(buttonStyle.alignSelf).toBe('flex-end');
      expect(buttonStyle.width).toBe('24px');
      expect(buttonStyle.height).toBe('24px');
      expect(buttonStyle.minWidth).toBe('24px');
      expect(buttonStyle.minHeight).toBe('24px');
      expect(buttonStyle.padding).toBe('0px');
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
