/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// jsdom rewrites `import.meta.url` to an http URL, so read from the workspace cwd
// (the frontend package root), like the other CSS-backed component tests do.
const rawCss = readFileSync('src/ui/app.css', 'utf8');
const rawGameViewCss = readFileSync('src/ui/game-view.css', 'utf8');

/** Selector matching must ignore commentary: only real selectors/declarations count. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

const css = withoutComments(rawCss);
const gameViewCss = withoutComments(rawGameViewCss);

interface CssRule {
  selector: string;
  body: string;
}

/** Splits a stylesheet into top-level rules; `@media` bodies stay nested. */
function topLevelRules(source: string): CssRule[] {
  const rules: CssRule[] = [];
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
    rules.push({ selector, body: source.slice(open + 1, cursor - 1) });
    index = cursor;
  }
  return rules;
}

const rules = topLevelRules(css).filter((rule) => !rule.selector.startsWith('@'));

function normalizeSelector(selector: string): string {
  return selector
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .join(', ');
}

function findRule(selector: string): CssRule {
  const expected = normalizeSelector(selector);
  const matches = rules.filter((rule) => normalizeSelector(rule.selector) === expected);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one rule for "${expected}", found ${matches.length}`);
  }
  return matches[0]!;
}

function ruleBody(selector: string): string {
  return findRule(selector).body;
}

/** First rule with this selector (for surfaces that also carry a later utility rule). */
function firstRuleBody(selector: string): string {
  const expected = normalizeSelector(selector);
  const match = rules.find((rule) => normalizeSelector(rule.selector) === expected);
  if (match === undefined) {
    throw new Error(`rule not found: "${expected}"`);
  }
  return match.body;
}

/** Property map of one declaration block; every value is exact (no normalisation). */
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

const SHARED_FRAME_SELECTORS = [
  '.hud-panel',
  '.upgrades-panel',
  '.customization-panel',
  '.activity-feed',
  '.leaderboard',
  '.user-panel .users-list',
  '.connection-banner',
  '.phase-announcement',
  '.auth-panel',
  '.auth-error',
  'main > section',
];

const SHARED_FRAME_SELECTOR_LIST = SHARED_FRAME_SELECTORS.join(', ');

function withPseudo(pseudo: '::before' | '::after'): string {
  return SHARED_FRAME_SELECTORS.map((selector) => `${selector}${pseudo}`).join(', ');
}

describe('Neon Forge tokens (AC-17)', () => {
  it('declares every --gf-* token with its exact pinned value', () => {
    const root = declarations(ruleBody(':root'));
    const tokens: ReadonlyArray<readonly [string, string]> = [
      ['--gf-void', '#04060d'],
      ['--gf-surface-top', 'rgba(10, 18, 34, 0.94)'],
      ['--gf-surface-bottom', 'rgba(5, 10, 20, 0.9)'],
      ['--gf-surface-raised', 'rgba(18, 30, 52, 0.94)'],
      ['--gf-rim', 'rgba(124, 246, 255, 0.56)'],
      ['--gf-rim-strong', '#7cf6ff'],
      ['--gf-rim-warm', '#ffb35c'],
      ['--gf-text', '#e8f6ff'],
      ['--gf-text-muted', 'rgba(232, 246, 255, 0.76)'],
      ['--gf-gold', '#ffcc66'],
      ['--gf-amber', '#ffb35c'],
      ['--gf-amber-deep', '#ff7a1a'],
      ['--gf-success', '#34d399'],
      ['--gf-danger', '#ff6b6b'],
      ['--gf-rare', '#60a5fa'],
      ['--gf-epic', '#c084fc'],
      ['--gf-grid', 'rgba(124, 246, 255, 0.05)'],
      ['--gf-scanline', 'rgba(124, 246, 255, 0.06)'],
      ['--gf-shadow', 'rgba(0, 0, 0, 0.55)'],
      ['--gf-panel-glow', 'rgba(124, 246, 255, 0.2)'],
      ['--gf-radius-panel', '1rem'],
      ['--gf-radius-control', '0.6rem'],
      ['--gf-chamfer', '0.65rem'],
      ['--gf-chamfer-auth', '1.1rem'],
      ['--gf-focus', '#7cf6ff'],
      ['--gf-cta-text', '#1a1206'],
    ];
    for (const [name, value] of tokens) {
      expect(root.get(name), `${name} is declared exactly once`).toBe(value);
    }
    expect([...root.keys()].filter((name) => name.startsWith('--gf-'))).toHaveLength(
      tokens.length,
    );
  });

  it('keeps the accepted shell tokens with their existing values', () => {
    const root = declarations(ruleBody(':root'));
    expect(root.get('--hud-text')).toBe('#e8f6ff');
    expect(root.get('--hud-background')).toBe('rgba(6, 10, 20, 0.72)');
    expect(root.get('--accent')).toBe('#7cf6ff');
    expect(root.get('--page-background')).toBe('#000000');
  });

  it('removes the retired metallic --frame-* tokens and their rules', () => {
    expect(css).not.toMatch(/--frame-[\w-]+\s*:/);
    expect(css).not.toContain('border-image');
    expect(css).not.toContain('frame-sheen');
    expect(css).not.toContain('hud-scanline');
    expect(css).not.toContain('@keyframes frame-sheen');
    expect(css).not.toContain('@keyframes hud-scanline');
  });

  it('does not shadow the accepted --panel-* tokens owned by game-view.css', () => {
    expect(css).not.toContain('--panel-');
    for (const token of [
      '--panel-bg-top: rgba(5, 11, 24, 0.86);',
      '--panel-bg-bottom: rgba(10, 22, 44, 0.8);',
      '--panel-border: rgba(124, 246, 255, 0.62);',
      '--panel-glow: rgba(124, 246, 255, 0.35);',
      '--panel-radius: 1rem;',
      '--users-badge-top: #d63a2f;',
      '--users-badge-bottom: #a51f1f;',
      '--coin-gold: #ffcc66;',
      '--upgrade-green: #16a34a;',
    ]) {
      expect(gameViewCss).toContain(token);
    }
  });
});

describe('shared Neon Forge frame (AC-18)', () => {
  it('is one grouped rule with exactly the pinned selector list', () => {
    const matches = rules.filter(
      (rule) => normalizeSelector(rule.selector) === SHARED_FRAME_SELECTOR_LIST,
    );
    expect(matches).toHaveLength(1);
  });

  it('declares the exact graphite-glass frame declarations', () => {
    const frame = declarations(ruleBody(SHARED_FRAME_SELECTOR_LIST));
    expect(frame.get('border')).toBe('1px solid var(--gf-rim)');
    expect(frame.get('border-radius')).toBe('var(--gf-radius-panel)');
    expect(frame.get('clip-path')).toBe(
      'polygon(var(--gf-chamfer) 0, 100% 0, 100% calc(100% - var(--gf-chamfer)), calc(100% - var(--gf-chamfer)) 100%, 0 100%)',
    );
    expect(frame.get('background')).toBe(
      'repeating-linear-gradient(0deg, transparent 0 23px, var(--gf-grid) 23px 24px), linear-gradient(180deg, var(--gf-surface-top), var(--gf-surface-bottom))',
    );
    expect(frame.get('color')).toBe('var(--gf-text)');
    expect(frame.get('box-shadow')).toBe(
      'inset 0 1px 0 rgba(232, 246, 255, 0.16), inset 0 0 0 1px rgba(124, 246, 255, 0.08), inset 0 0 40px var(--gf-shadow), inset 0 0 24px var(--gf-panel-glow)',
    );
    expect(frame.get('-webkit-backdrop-filter')).toBe('blur(14px) saturate(1.2)');
    expect(frame.get('backdrop-filter')).toBe('blur(14px) saturate(1.2)');
    expect([...frame.keys()]).toHaveLength(8);
  });

  it('deliberately omits position, filter and any outer shadow', () => {
    const frame = declarations(ruleBody(SHARED_FRAME_SELECTOR_LIST));
    expect(frame.has('position')).toBe(false);
    expect(frame.has('filter')).toBe(false);
    const shadow = frame.get('box-shadow') ?? '';
    const layers: string[] = [];
    let current = '';
    let depth = 0;
    for (const character of shadow) {
      if (character === '(') depth += 1;
      if (character === ')') depth -= 1;
      if (character === ',' && depth === 0) {
        layers.push(current.trim());
        current = '';
      } else {
        current += character;
      }
    }
    layers.push(current.trim());
    expect(layers).toHaveLength(4);
    for (const layer of layers) {
      expect(layer.startsWith('inset ')).toBe(true);
    }
  });

  it('keeps every framed surface positioned by the accepted rules', () => {
    // The shared frame must not override the HUD/pre-welcome absolute placement.
    const hud = declarations(firstRuleBody('main > section'));
    expect(hud.get('position')).toBe('absolute');
    expect(hud.get('top')).toBe('calc(1rem + env(safe-area-inset-top, 0px))');
    expect(hud.get('left')).toBe('calc(1rem + env(safe-area-inset-left, 0px))');
  });

  it('gives only .auth-panel, .auth-error and .user-panel .users-list a containing block', () => {
    const position = declarations(
      ruleBody('.auth-panel, .auth-error, .user-panel .users-list'),
    );
    expect([...position.keys()]).toEqual(['position']);
    expect(position.get('position')).toBe('relative');
    expect(rules.filter((rule) => rule.body.trim() === 'position: relative;')).toHaveLength(
      1,
    );
  });

  it('retargets the auth chamfer/radius and the compact banner/phase chamfer', () => {
    const auth = declarations(ruleBody('.auth-panel'));
    expect(auth.get('--gf-chamfer')).toBe('var(--gf-chamfer-auth)');
    expect(auth.get('--gf-radius-panel')).toBe('1.25rem');

    const compact = declarations(ruleBody('.connection-banner, .phase-announcement'));
    expect([...compact.keys()]).toEqual(['--gf-chamfer']);
    expect(compact.get('--gf-chamfer')).toBe('0.45rem');
  });

  it('declares the top light edge for every framed surface', () => {
    expect(rules.filter((rule) => normalizeSelector(rule.selector) === withPseudo('::before'))).toHaveLength(1);
    const edge = declarations(ruleBody(withPseudo('::before')));
    expect(edge.get('content')).toBe("''");
    expect(edge.get('position')).toBe('absolute');
    expect(edge.get('left')).toBe('var(--gf-chamfer)');
    expect(edge.get('right')).toBe('0');
    expect(edge.get('top')).toBe('0');
    expect(edge.get('height')).toBe('1px');
    expect(edge.get('background')).toBe(
      'linear-gradient(90deg, transparent 0%, var(--gf-rim-strong) 50%, transparent 100%)',
    );
    expect(edge.get('pointer-events')).toBe('none');
    expect([...edge.keys()]).toHaveLength(8);
  });

  it('declares the left status rail for every framed surface', () => {
    expect(rules.filter((rule) => normalizeSelector(rule.selector) === withPseudo('::after'))).toHaveLength(1);
    const rail = declarations(ruleBody(withPseudo('::after')));
    expect(rail.get('content')).toBe("''");
    expect(rail.get('position')).toBe('absolute');
    expect(rail.get('left')).toBe('0');
    expect(rail.get('top')).toBe('var(--gf-chamfer)');
    expect(rail.get('width')).toBe('2px');
    expect(rail.get('height')).toBe('40%');
    expect(rail.get('background')).toBe(
      'linear-gradient(180deg, var(--gf-rim-strong) 0%, transparent 100%)',
    );
    expect(rail.get('box-shadow')).toBe('inset -2px 0 8px var(--gf-rim-strong)');
    expect(rail.get('pointer-events')).toBe('none');
    expect([...rail.keys()]).toHaveLength(9);
  });

  it('drops every bit of chrome from the empty phase announcement', () => {
    const empty = declarations(ruleBody('.phase-announcement:empty'));
    expect(empty.get('padding')).toBe('0');
    expect(empty.get('border')).toBe('none');
    expect(empty.get('background')).toBe('transparent');
    expect(empty.get('box-shadow')).toBe('none');
    expect(empty.get('filter')).toBe('none');
    expect(empty.get('clip-path')).toBe('none');
    expect([...empty.keys()]).toHaveLength(6);

    for (const selector of [
      '.phase-announcement:empty::before',
      '.phase-announcement:empty::after',
    ]) {
      const pseudo = declarations(ruleBody(selector));
      expect([...pseudo.keys()]).toEqual(['content']);
      expect(pseudo.get('content')).toBe('none');
    }
  });

  it('never regains the retired metallic frame', () => {
    expect(css).not.toContain('border-image');
    expect(css).not.toContain('--frame-cut');
    const frame = declarations(ruleBody(SHARED_FRAME_SELECTOR_LIST));
    expect(frame.has('filter')).toBe(false);
  });
});

describe('auth chrome (AC-26)', () => {
  it('builds the scrim from --gf-void, two radial gradients and a scanline', () => {
    const overlay = ruleBody('.auth-menu, .auth-forms');
    const background = declarations(overlay).get('background') ?? '';
    expect(background).toContain('var(--gf-void)');
    expect(background.match(/radial-gradient\(/g)).toHaveLength(2);
    expect(background).toContain('repeating-linear-gradient(0deg');
    expect(background).toContain('var(--gf-scanline)');
    expect(declarations(overlay).get('background-origin')).toBe('border-box');
  });

  it('renders the auth title as an uppercase wordmark with a gradient bar', () => {
    const title = declarations(ruleBody('.auth-title'));
    expect(title.get('font-size')).toBe('clamp(2rem, 6vw, 2.8rem)');
    expect(title.get('font-weight')).toBe('800');
    expect(title.get('letter-spacing')).toBe('0.18em');
    expect(title.get('text-transform')).toBe('uppercase');
    expect(title.get('color')).toBe('var(--gf-text)');

    const bar = declarations(ruleBody('.auth-title::after'));
    expect(bar.get('content')).toBe("''");
    expect(bar.get('display')).toBe('block');
    expect(bar.get('height')).toBe('2px');
    expect(bar.get('background')).toBe(
      'linear-gradient(90deg, var(--gf-rim-strong), transparent)',
    );
  });

  it('keeps secondary auth buttons glass and >= 48px', () => {
    const button = declarations(ruleBody('.auth-button, .verification-pending button'));
    expect(button.get('min-height')).toBe('48px');
    expect(button.get('border')).toBe('1px solid var(--gf-rim)');
    expect(button.get('border-radius')).toBe('var(--gf-radius-control)');
    expect(button.get('background')).toBe('var(--gf-surface-raised)');
    expect(button.get('color')).toBe('var(--gf-text)');
  });

  it('makes the primary auth action the amber CTA with dark ink', () => {
    const primary = declarations(ruleBody('.auth-button-primary'));
    expect(primary.get('background')).toBe(
      'linear-gradient(180deg, var(--gf-amber), var(--gf-amber-deep))',
    );
    expect(primary.get('color')).toBe('var(--gf-cta-text)');
    expect(primary.get('border-color')).toBe('var(--gf-rim-warm)');
  });

  it('keeps the input well inset and at least 44px with a cyan focus ring', () => {
    const input = declarations(ruleBody('.auth-input, .verification-pending input'));
    expect(input.get('min-height')).toBe('44px');
    expect(input.get('border')).toBe('1px solid var(--gf-rim)');
    expect(input.get('border-radius')).toBe('var(--gf-radius-control)');
    expect(input.get('background')).toBe('rgba(0, 0, 0, 0.42)');
    expect(input.get('box-shadow')).toBe('inset 0 2px 8px var(--gf-shadow)');
    expect(input.has('clip-path')).toBe(false);
    expect(input.has('border-image')).toBe(false);

    const focus = declarations(ruleBody('.auth-input:focus, .verification-pending input:focus'));
    expect(focus.get('border-color')).toBe('var(--gf-focus)');
    expect(focus.get('outline')).toBe('2px solid var(--gf-focus)');
    expect(focus.get('box-shadow')).toBe('inset 0 0 0 2px var(--gf-focus)');
  });

  it('paints the auth error through the danger channel', () => {
    const error = declarations(ruleBody('.auth-error'));
    expect(error.get('--gf-rim')).toBe('rgba(255, 107, 107, 0.56)');
    expect(error.get('color')).toBe('var(--gf-danger)');
    expect(error.has('background')).toBe(false);
    expect(error.has('border')).toBe(false);
  });

  it('gives every auth control the shared gf-focus ring', () => {
    const focus = declarations(
      ruleBody('.auth-button:focus-visible, .verification-pending button:focus-visible'),
    );
    expect(focus.get('outline')).toBe('2px solid var(--gf-focus)');
    expect(focus.get('outline-offset')).toBe('2px');
    expect(focus.get('box-shadow')).toBe('inset 0 0 0 2px var(--gf-focus)');
  });
});

describe('control states (AC-28)', () => {
  it('makes .gf-cta the amber 44px primary action', () => {
    const cta = declarations(ruleBody('.gf-cta'));
    expect(cta.get('background')).toBe(
      'linear-gradient(180deg, var(--gf-amber), var(--gf-amber-deep))',
    );
    expect(cta.get('color')).toBe('var(--gf-cta-text)');
    expect(cta.get('min-height')).toBe('44px');
    expect(cta.get('border')).toBe('1px solid var(--gf-rim-warm)');
    expect(cta.get('border-radius')).toBe('var(--gf-radius-control)');
  });

  it('brightens the CTA on hover and adds the warm rim', () => {
    const hover = declarations(ruleBody('.gf-cta:hover'));
    expect(hover.get('filter')).toBe('brightness(1.08)');
    expect(hover.get('border-color')).toBe('var(--gf-rim-warm)');
    expect(hover.get('box-shadow')).toBe('inset 0 0 0 1px var(--gf-rim-warm)');
  });

  it('presses the CTA down 1px and shows the gf-focus ring', () => {
    const active = declarations(ruleBody('.gf-cta:active'));
    expect(active.get('transform')).toBe('translateY(1px)');

    const focus = declarations(ruleBody('.gf-cta:focus-visible'));
    expect(focus.get('outline')).toBe('2px solid var(--gf-focus)');
    expect(focus.get('outline-offset')).toBe('2px');
  });

  it('fades the disabled CTA without any glow', () => {
    const disabled = declarations(ruleBody('.gf-cta:disabled'));
    expect(disabled.get('opacity')).toBe('0.5');
    expect(disabled.get('box-shadow')).toBe('none');
    expect(disabled.get('filter')).toBe('none');
    expect(disabled.get('cursor')).toBe('not-allowed');
  });

  it('keeps the secondary controls glass, 44px and gf-focus ringed', () => {
    const secondary = declarations(
      ruleBody(
        '.user-panel > button, .connection-banner button, .customization-equip, .customization-unequip',
      ),
    );
    expect(secondary.get('border')).toBe('1px solid var(--gf-rim)');
    expect(secondary.get('border-radius')).toBe('var(--gf-radius-control)');
    expect(secondary.get('background')).toBe('var(--gf-surface-raised)');
    expect(secondary.get('color')).toBe('var(--gf-text)');

    const focus = declarations(
      ruleBody(
        '.user-panel > button:focus-visible, .user-panel li button:focus-visible, .connection-banner button:focus-visible, .customization-equip:focus-visible, .customization-unequip:focus-visible',
      ),
    );
    expect(focus.get('outline')).toBe('2px solid var(--gf-focus)');
    expect(focus.get('outline-offset')).toBe('2px');
    expect(focus.get('box-shadow')).toBe('inset 0 0 0 2px var(--gf-focus)');
  });

  it('keeps the CTA and secondary glass chrome across hover/active/disabled states', () => {
    const states = [
      '.gf-cta:hover',
      '.gf-cta:active',
      '.gf-cta:disabled',
      '.auth-button:hover',
      '.auth-button-primary:hover',
      '.user-panel > button:hover, .connection-banner button:hover, .customization-equip:hover, .customization-unequip:hover',
      '.user-panel > button:active, .connection-banner button:active, .customization-equip:active, .customization-unequip:active',
      '.user-panel > button:disabled, .connection-banner button:disabled, .customization-equip:disabled, .customization-unequip:disabled',
    ];
    for (const selector of states) {
      const state = declarations(ruleBody(selector));
      expect(state.has('background'), `${selector} keeps its background`).toBe(false);
      expect(state.has('border-image'), `${selector} keeps its border`).toBe(false);
      expect(state.has('clip-path'), `${selector} keeps its shape`).toBe(false);
    }
  });

  it('keeps a disabled state on every app.css secondary control', () => {
    const disabled = declarations(
      ruleBody(
        '.user-panel > button:disabled, .connection-banner button:disabled, .customization-equip:disabled, .customization-unequip:disabled',
      ),
    );
    expect(disabled.get('opacity')).toBe('0.5');
    expect(disabled.get('box-shadow')).toBe('none');
    expect(disabled.get('filter')).toBe('none');
    expect(disabled.get('cursor')).toBe('not-allowed');
  });

  it('keeps the panel targets at 44px and the HUD minimize at the accepted 1.5rem', () => {
    const panelTargets = declarations(
      ruleBody(
        '.customization-open, .customization-equip, .customization-unequip, .customization-reveal-equip, .customization-reveal-dismiss',
      ),
    );
    expect(panelTargets.get('min-width')).toBe('44px');
    expect(panelTargets.get('min-height')).toBe('44px');

    const minimize = declarations(ruleBody('main > section button'));
    expect(minimize.get('min-width')).toBe('1.5rem');
    expect(minimize.get('min-height')).toBe('1.5rem');
    expect(minimize.get('pointer-events')).toBe('auto');
    expect(minimize.get('cursor')).toBe('pointer');
  });
});

describe('typography (AC-29)', () => {
  it('declares the panel-title role on every gameplay title and the auth wordmark', () => {
    const titles = declarations(
      ruleBody(
        '.hud-title, .upgrades-title, .activity-feed-title, .leaderboard-title, .customization-title, .users-list-title',
      ),
    );
    expect(titles.get('font-size')).toBe('0.72rem');
    expect(titles.get('font-weight')).toBe('800');
    expect(titles.get('letter-spacing')).toBe('0.18em');
    expect(titles.get('text-transform')).toBe('uppercase');
    expect(titles.get('color')).toBe('var(--gf-text)');
  });

  it('declares the HUD level chip role', () => {
    const level = declarations(ruleBody('.hud-level'));
    expect(level.get('font-size')).toBe('0.8rem');
    expect(level.get('font-weight')).toBe('800');
    expect(level.get('letter-spacing')).toBe('0.1em');
    expect(level.get('text-transform')).toBe('uppercase');
  });

  it('declares the HUD resource-value role with tabular numerals', () => {
    const value = declarations(ruleBody('.hud-resource-value'));
    expect(value.get('font-size')).toBe('1.05rem');
    expect(value.get('font-weight')).toBe('700');
    expect(value.get('letter-spacing')).toBe('0.02em');
    expect(value.get('font-variant-numeric')).toBe('tabular-nums');
  });

  it('declares the button role on every shell control', () => {
    const buttons = declarations(
      ruleBody(
        '.gf-cta, .upgrade-buy, .customization-equip, .customization-unequip, .users-badge, .connection-banner button',
      ),
    );
    expect(buttons.get('font-size')).toBe('0.9rem');
    expect(buttons.get('font-weight')).toBe('700');
    expect(buttons.get('letter-spacing')).toBe('0.08em');
    expect(buttons.get('text-transform')).toBe('uppercase');
    expect(buttons.get('font-family')).toBe('inherit');
  });

  it('keeps the body font stack unchanged', () => {
    const body = declarations(ruleBody('body'));
    expect(body.get('font-family')).toBe(
      "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
    );
  });
});

describe('responsive fit and reduced motion (AC-31)', () => {
  it('keeps exactly one max-width: 480px block with the compact auth/HUD sizing', () => {
    expect(css.match(/@media \(max-width: 480px\)/g)).toHaveLength(1);
    const block = css.match(/@media \(max-width: 480px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(block).toContain('padding: 0.75rem;');
    expect(block).toContain('padding: 1.15rem;');
    expect(block).toContain('font-size: 1.75rem;');
    expect(block).toContain('min-height: 48px;');
    expect(block).toContain('main > section');
    expect(block).toContain('font-size: 0.85rem;');
  });

  it('disables every app.css transition/animation and press transform under reduced motion', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const selector of [
      'main > section,',
      'main > section button,',
      'main > section[data-blinking="true"],',
      '.auth-button,',
      '.verification-pending button,',
      '.auth-input,',
      '.gf-cta,',
      '.user-panel > button,',
      '.connection-banner button,',
      '.customization-equip,',
      '.customization-unequip {',
    ]) {
      expect(block).toContain(selector);
    }
    expect(block).toContain('transition: none;');
    expect(block).toContain('animation: none;');
    expect(block).toContain('main > section button:active,');
    expect(block).toContain('.gf-cta:active,');
    expect(block).toContain('transform: none;');
  });

  it('keeps the accepted placement of the shell surfaces', () => {
    const phase = declarations(ruleBody('.phase-announcement'));
    expect(phase.get('position')).toBe('absolute');
    expect(phase.get('left')).toBe('50%');
    expect(phase.get('bottom')).toBe('calc(1.5rem + env(safe-area-inset-bottom, 0px))');
    expect(phase.get('transform')).toBe('translateX(-50%)');
    expect(phase.get('pointer-events')).toBe('none');

    const banner = declarations(ruleBody('.connection-banner'));
    expect(banner.get('position')).toBe('absolute');
    expect(banner.get('top')).toBe('calc(1rem + env(safe-area-inset-top, 0px))');
    expect(banner.get('left')).toBe('50%');
    expect(banner.get('pointer-events')).toBe('none');

    const users = declarations(ruleBody('.user-panel'));
    expect(users.get('position')).toBe('absolute');
    expect(users.get('top')).toBe('calc(1rem + env(safe-area-inset-top, 0px))');
    expect(users.get('right')).toBe('calc(1rem + env(safe-area-inset-right, 0px))');
  });

  it('keeps the accepted customization/upgrades/toggle placements', () => {
    const panel = declarations(ruleBody('.customization-panel'));
    expect(panel.get('position')).toBe('absolute');
    expect(panel.get('top')).toBe('auto');
    expect(panel.get('bottom')).toBe('calc(4rem + env(safe-area-inset-bottom, 0px))');
    expect(panel.get('left')).toBe('calc(1rem + env(safe-area-inset-left, 0px))');
    expect(panel.get('max-height')).toBe('60vh');

    const toggle = declarations(ruleBody('.customization-toggle'));
    expect(toggle.get('position')).toBe('absolute');
    expect(toggle.get('bottom')).toBe('calc(1rem + env(safe-area-inset-bottom, 0px))');
    expect(toggle.get('left')).toBe('calc(1rem + env(safe-area-inset-left, 0px))');

    const upgrades = declarations(ruleBody('.upgrades-panel'));
    expect(upgrades.get('position')).toBe('absolute');
    expect(upgrades.get('bottom')).toBe('calc(1rem + env(safe-area-inset-bottom, 0px))');
    expect(upgrades.get('right')).toBe('calc(1rem + env(safe-area-inset-right, 0px))');
  });

  it('keeps the accepted HUD blink and minimize affordance', () => {
    expect(css).toContain('@keyframes hud-blink');
    const blink = css.match(/main > section\[data-blinking="true"\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(blink).toContain('animation: hud-blink 200ms ease;');
    const glyph = declarations(ruleBody('main > section button::before'));
    expect(glyph.get('content')).toBe("'▾'");
    const focus = declarations(ruleBody('main > section button:focus-visible'));
    expect(focus.get('outline')).toBe('2px solid var(--accent)');
    expect(focus.get('box-shadow')).toBe('inset 0 0 0 2px var(--accent)');

    const minimized = declarations(ruleBody('main > section[data-minimized="true"]'));
    expect(minimized.get('gap')).toBe('0.125rem');
    expect(minimized.get('opacity')).toBe('0.75');
  });

  it('keeps the panel slots, variant lists and preview styling', () => {
    const lists = declarations(ruleBody('.customization-slots, .customization-variants'));
    expect(lists.get('display')).toBe('flex');
    expect(lists.get('flex-direction')).toBe('column');
    expect(lists.get('list-style')).toBe('none');
    expect(lists.get('margin')).toBe('0');
    expect(lists.get('padding')).toBe('0');

    const preview = declarations(ruleBody('.spaceship-preview'));
    expect(preview.get('border')).toBe('1px solid var(--gf-rim)');
    expect(preview.get('height')).toBe('12rem');

    const slot = declarations(ruleBody('.customization-slot'));
    expect(slot.get('border-top')).toBe('1px solid rgba(124, 246, 255, 0.18)');
  });

  it('does not scale, translate or animate the customization panel itself', () => {
    const panel = declarations(ruleBody('.customization-panel'));
    for (const property of ['transform', 'translate', 'rotate', 'scale', 'animation']) {
      expect(panel.has(property)).toBe(false);
    }
  });
});

describe('stylesheet integration (AC-18, AC-26, AC-28, AC-29)', () => {
  const SHELL_MARKUP = `
    <main>
      <section aria-label="Game statistics"><p>Clicks: <span data-stat="clicks">0</span></p></section>
      <div class="connection-banner"><span>Connection lost</span><button type="button">Retry</button></div>
      <div class="phase-announcement" role="status" aria-live="polite"></div>
      <div class="auth-forms">
        <section class="auth-panel">
          <h2 class="auth-title">Welcome back</h2>
          <form class="auth-form">
            <label class="auth-field"><span>Username</span><input class="auth-input" name="username" /></label>
            <p class="auth-error" role="alert">request failed</p>
            <div class="auth-actions">
              <button class="auth-button auth-button-primary" type="submit">Login</button>
              <button class="auth-button auth-button-secondary" type="button">Cancel</button>
            </div>
          </form>
        </section>
      </div>
      <button class="gf-cta" type="button">Open lootbox</button>
    </main>
  `;

  function withShellStyles(markup: string, run: (root: HTMLElement) => void): void {
    const style = document.createElement('style');
    style.textContent = rawCss;
    document.head.append(style);
    const root = document.createElement('div');
    root.innerHTML = markup;
    document.body.append(root);
    try {
      run(root);
    } finally {
      root.remove();
      style.remove();
    }
  }

  it('cascades the shared frame and the accepted placements onto real markup', () => {
    withShellStyles(SHELL_MARKUP, (root) => {
      const hudSection = root.querySelector<HTMLElement>('main > section');
      if (hudSection === null) throw new Error('HUD section missing');
      const hud = window.getComputedStyle(hudSection);
      expect(hud.position).toBe('absolute');
      expect(hud.pointerEvents).toBe('none');
      expect(hud.clipPath).toBe(
        'polygon(var(--gf-chamfer) 0, 100% 0, 100% calc(100% - var(--gf-chamfer)), calc(100% - var(--gf-chamfer)) 100%, 0 100%)',
      );

      const panel = root.querySelector<HTMLElement>('.auth-panel');
      if (panel === null) throw new Error('auth panel missing');
      const auth = window.getComputedStyle(panel);
      expect(auth.position).toBe('relative');
      expect(auth.display).toBe('flex');
      expect(auth.getPropertyValue('--gf-chamfer')).toBe('var(--gf-chamfer-auth)');
      expect(auth.getPropertyValue('--gf-radius-panel')).toBe('1.25rem');
      expect(auth.borderRadius).toBe('var(--gf-radius-panel)');
      expect(auth.boxShadow).toBe(
        'inset 0 1px 0 rgba(232, 246, 255, 0.16), inset 0 0 0 1px rgba(124, 246, 255, 0.08), inset 0 0 40px var(--gf-shadow), inset 0 0 24px var(--gf-panel-glow)',
      );

      const banner = root.querySelector<HTMLElement>('.connection-banner');
      if (banner === null) throw new Error('connection banner missing');
      const bannerStyle = window.getComputedStyle(banner);
      expect(bannerStyle.position).toBe('absolute');
      expect(bannerStyle.transform).toBe('translateX(-50%)');
      expect(bannerStyle.getPropertyValue('--gf-chamfer')).toBe('0.45rem');

      const emptyPhase = root.querySelector<HTMLElement>('.phase-announcement');
      if (emptyPhase === null) throw new Error('phase announcement missing');
      const empty = window.getComputedStyle(emptyPhase);
      expect(empty.padding).toBe('0px');
      expect(empty.borderTopStyle).toBe('none');
      expect(empty.boxShadow).toBe('none');
      expect(empty.filter).toBe('none');
      expect(empty.clipPath).toBe('none');
    });
  });

  it('cascades the auth/CTA control sizes and typography onto real markup', () => {
    withShellStyles(SHELL_MARKUP, (root) => {
      const title = root.querySelector<HTMLElement>('.auth-title');
      if (title === null) throw new Error('auth title missing');
      const titleStyle = window.getComputedStyle(title);
      expect(titleStyle.fontSize).toBe('44.8px');
      expect(titleStyle.fontWeight).toBe('800');
      expect(titleStyle.letterSpacing).toBe('8.064px');
      expect(titleStyle.textTransform).toBe('uppercase');

      const authButton = root.querySelector<HTMLElement>('.auth-button');
      if (authButton === null) throw new Error('auth button missing');
      const authButtonStyle = window.getComputedStyle(authButton);
      expect(authButtonStyle.minHeight).toBe('48px');
      expect(authButtonStyle.borderRadius).toBe('var(--gf-radius-control)');
      expect(authButtonStyle.textTransform).toBe('uppercase');

      const input = root.querySelector<HTMLElement>('.auth-input');
      if (input === null) throw new Error('auth input missing');
      const inputStyle = window.getComputedStyle(input);
      expect(inputStyle.minHeight).toBe('44px');
      expect(inputStyle.boxSizing).toBe('border-box');
      expect(inputStyle.borderRadius).toBe('var(--gf-radius-control)');

      const error = root.querySelector<HTMLElement>('.auth-error');
      if (error === null) throw new Error('auth error missing');
      const errorStyle = window.getComputedStyle(error);
      expect(errorStyle.getPropertyValue('--gf-rim')).toBe('rgba(255,107,107,0.56)');
      expect(errorStyle.padding).toBe('9.6px 12px');

      const retry = root.querySelector<HTMLElement>('.connection-banner button');
      if (retry === null) throw new Error('retry button missing');
      const retryStyle = window.getComputedStyle(retry);
      expect(retryStyle.minWidth).toBe('44px');
      expect(retryStyle.minHeight).toBe('44px');
      expect(retryStyle.borderRadius).toBe('var(--gf-radius-control)');
      expect(retryStyle.fontSize).toBe('14.4px');
      expect(retryStyle.textTransform).toBe('uppercase');

      const cta = root.querySelector<HTMLElement>('.gf-cta');
      if (cta === null) throw new Error('CTA missing');
      const ctaStyle = window.getComputedStyle(cta);
      expect(ctaStyle.minHeight).toBe('44px');
      expect(ctaStyle.borderRadius).toBe('var(--gf-radius-control)');
      expect(ctaStyle.color).toBe('var(--gf-cta-text)');
      expect(ctaStyle.fontSize).toBe('14.4px');
      expect(ctaStyle.textTransform).toBe('uppercase');
    });
  });
});

describe('stylesheet hygiene (AC-33)', () => {
  it('references no external asset or font in either stylesheet', () => {
    for (const source of [css, gameViewCss]) {
      expect(source).not.toContain('url(http');
      expect(source).not.toContain('@font-face');
      expect(source).not.toContain('data:image');
      expect(source).not.toContain('@import');
      expect(source).not.toContain('<img');
    }
  });

  it('never importance-flags a declaration', () => {
    expect(css).not.toContain('!important');
  });

  it('ends with exactly one trailing newline', () => {
    expect(rawCss.endsWith('\n')).toBe(true);
    expect(rawCss.endsWith('\n\n')).toBe(false);
  });
});
