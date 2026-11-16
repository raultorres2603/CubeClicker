/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HUD_BLINK_MS, Hud, formatCoinPop } from './Hud';

afterEach(() => {
  cleanup();
});

const CURSOR_ICON =
  '<svg aria-hidden="true" data-icon="cursor" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<path d="M5.5 3.2l14 7.6-6.3 1.6-2.9 6.4z" fill="currentColor" stroke-width="1.1"></path>' +
  '</svg>';

const CUBE_ICON =
  '<svg aria-hidden="true" data-icon="cube" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<path d="M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2z"></path>' +
  '<path d="M4 7.2l8 4.4 8-4.4M12 11.6v9.6"></path>' +
  '</svg>';

const COIN_ICON =
  '<svg aria-hidden="true" data-icon="coin" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<circle cx="12" cy="12" r="8.75"></circle>' +
  '<path d="M12 7.4l1.12 3.06 3.25.12-2.56 2.01.89 3.13L12 13.9l-2.7 1.82.89-3.13-2.56-2.01 3.25-.12z" fill="currentColor" stroke-width="1"></path>' +
  '</svg>';

const KEY_ICON =
  '<svg aria-hidden="true" data-icon="key" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<circle cx="8" cy="8" r="4.2"></circle>' +
  '<path d="M11 11l8 8M16.2 16.2l2.2-2.2M18.7 18.7l2-2"></path>' +
  '</svg>';

const LOOTBOX_ICON =
  '<svg aria-hidden="true" data-icon="lootbox" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<path d="M3.5 8.5h17v11.2h-17z"></path>' +
  '<path d="M3.5 8.5l2.4-4.2h12.2l2.4 4.2M10.2 8.5v11.2M13.8 8.5v11.2"></path>' +
  '<path d="M9.4 8.5h5.2v3.1H9.4z"></path>' +
  '</svg>';

const SERVER_ICON =
  '<svg aria-hidden="true" data-icon="server" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<rect x="3.5" y="4" width="17" height="6" rx="1.8"></rect>' +
  '<rect x="3.5" y="14" width="17" height="6" rx="1.8"></rect>' +
  '<circle cx="7" cy="7" r="0.9" fill="currentColor" stroke="none"></circle>' +
  '<circle cx="7" cy="17" r="0.9" fill="currentColor" stroke="none"></circle>' +
  '<path d="M11 7h6M11 17h6"></path>' +
  '</svg>';

/**
 * The exact AC-19 HUD markup: header + level chip, the `Resources` group with three
 * resource chips, the three stat rows inside `.hud-grid`, and the optional toggle last.
 */
function hudMarkup({
  clicks,
  facesDestroyed,
  coins = '0.00',
  cube,
  server,
  keys = 0,
  lootboxes = 0,
  minimized = false,
  blinking = false,
  toggle = false,
}: {
  clicks: number;
  facesDestroyed: number;
  coins?: string;
  cube: number;
  server: number;
  keys?: number;
  lootboxes?: number;
  minimized?: boolean;
  blinking?: boolean;
  toggle?: boolean;
}): string {
  return (
    '<section aria-label="Game statistics" class="hud-panel"' +
    (minimized ? ' data-minimized="true"' : '') +
    (blinking ? ' data-blinking="true"' : '') +
    '>' +
    '<div class="hud-header">' +
    '<h2 class="hud-title">Pilot status</h2>' +
    `<span class="hud-level" data-stat="cube">Cube ${cube}</span>` +
    '</div>' +
    '<div class="hud-resources" role="group" aria-label="Resources">' +
    `<span data-resource="coins">${COIN_ICON}Coins <span class="hud-resource-value" data-stat="coins">${coins}</span></span>` +
    `<span data-resource="keys">${KEY_ICON}Keys <span class="hud-resource-value" data-stat="keys">${keys}</span></span>` +
    `<span data-resource="lootboxes">${LOOTBOX_ICON}Lootboxes <span class="hud-resource-value" data-stat="lootboxes">${lootboxes}</span></span>` +
    '</div>' +
    '<div class="hud-grid">' +
    `<p class="hud-row" data-row="clicks">${CURSOR_ICON}Clicks: <span data-stat="clicks">${clicks}</span></p>` +
    `<p class="hud-row" data-row="faces-destroyed">${CUBE_ICON}Faces destroyed: <span data-stat="faces-destroyed">${facesDestroyed}</span></p>` +
    `<p class="hud-row" data-row="server">${SERVER_ICON}Server <span data-stat="server">${server}</span></p>` +
    '</div>' +
    (toggle
      ? `<button type="button" aria-expanded="${minimized ? 'false' : 'true'}" aria-label="Toggle HUD"></button>`
      : '') +
    '</section>'
  );
}

describe('Hud', () => {
  it('renders the zero state with the pinned header, resources, stat rows and hud-panel class', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 0, facesDestroyed: 0 }} levelIndex={0} serverId={0} />,
    );

    expect(html).toBe(hudMarkup({ clicks: 0, facesDestroyed: 0, cube: 1, server: 0 }));
  });

  it('renders live counters, the 1-based cube level, the server id, keys and lootboxes from its props', () => {
    const html = renderToStaticMarkup(
      <Hud
        stats={{ clicks: 42, facesDestroyed: 3, coins: 12.5 }}
        levelIndex={2}
        serverId={7}
        keys={4}
        lootboxes={2}
      />,
    );

    expect(html).toBe(
      hudMarkup({
        clicks: 42,
        facesDestroyed: 3,
        coins: '12.50',
        cube: 3,
        server: 7,
        keys: 4,
        lootboxes: 2,
      }),
    );
  });

  it('renders the header title as a real level-2 heading with the level chip beneath it (AC-19, AC-29)', () => {
    const { container } = render(
      <Hud stats={{ clicks: 0, facesDestroyed: 0 }} levelIndex={4} serverId={2} />,
    );
    const header = container.querySelector('.hud-header');

    expect(screen.getByRole('heading', { level: 2, name: 'Pilot status' })).toBe(
      container.querySelector('h2'),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Pilot status' }).getAttribute('class')).toBe(
      'hud-title',
    );
    expect(header?.children).toHaveLength(2);
    expect(header?.children[0].textContent).toBe('Pilot status');
    expect(header?.children[1].tagName).toBe('SPAN');
    expect(header?.children[1].getAttribute('class')).toBe('hud-level');
    expect(header?.children[1].getAttribute('data-stat')).toBe('cube');
    expect(header?.children[1].textContent).toBe('Cube 5');
  });

  it('renders exactly three resource chips in the Resources group with icons, labels and values (AC-19)', () => {
    const { container } = render(
      <Hud
        stats={{ clicks: 0, facesDestroyed: 0, coins: 1.5 }}
        levelIndex={0}
        serverId={3}
        keys={2}
        lootboxes={6}
      />,
    );
    const group = screen.getByRole('group', { name: 'Resources' });
    const chips = Array.from(group.querySelectorAll('[data-resource]'));

    expect(chips.map((chip) => chip.getAttribute('data-resource'))).toEqual([
      'coins',
      'keys',
      'lootboxes',
    ]);
    expect(chips.map((chip) => chip.querySelector('svg')?.getAttribute('data-icon'))).toEqual([
      'coin',
      'key',
      'lootbox',
    ]);
    expect(chips.map((chip) => chip.querySelector('svg')?.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
      'true',
    ]);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Coins 1.50',
      'Keys 2',
      'Lootboxes 6',
    ]);
    expect(
      chips.map((chip) => chip.querySelector('.hud-resource-value')?.getAttribute('data-stat')),
    ).toEqual(['coins', 'keys', 'lootboxes']);
    expect(
      chips.map((chip) => chip.querySelector('.hud-resource-value')?.textContent),
    ).toEqual(['1.50', '2', '6']);
    expect(container.querySelectorAll('.hud-resources [data-resource]')).toHaveLength(3);
  });

  it('renders exactly three stat rows (clicks, faces-destroyed, server) inside .hud-grid (AC-19)', () => {
    const { container } = render(
      <Hud stats={{ clicks: 7, facesDestroyed: 2 }} levelIndex={1} serverId={9} />,
    );
    const grid = container.querySelector('.hud-grid');
    const rows = Array.from(container.querySelectorAll('p.hud-row'));

    expect(grid).not.toBeNull();
    expect(grid?.querySelectorAll('p.hud-row')).toHaveLength(3);
    expect(rows.map((row) => row.getAttribute('data-row'))).toEqual([
      'clicks',
      'faces-destroyed',
      'server',
    ]);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Clicks: 7',
      'Faces destroyed: 2',
      'Server 9',
    ]);
    expect(rows.map((row) => row.querySelector('svg')?.getAttribute('data-icon'))).toEqual([
      'cursor',
      'cube',
      'server',
    ]);
    expect(rows.map((row) => row.querySelector('svg')?.getAttribute('focusable'))).toEqual([
      'false',
      'false',
      'false',
    ]);
    // The retired coins/cube rows no longer live in the grid (AC-19).
    expect(container.querySelector('p[data-row="coins"]')).toBeNull();
    expect(container.querySelector('p[data-row="cube"]')).toBeNull();
  });

  it('never renders the same data-stat value twice (AC-19)', () => {
    const { container } = render(
      <Hud
        stats={{ clicks: 1, facesDestroyed: 2, coins: 3 }}
        levelIndex={4}
        serverId={5}
        keys={6}
        lootboxes={7}
      />,
    );
    const hooks = Array.from(container.querySelectorAll('[data-stat]')).map(
      (element) => element.getAttribute('data-stat'),
    );

    expect(hooks).toEqual([
      'cube',
      'coins',
      'keys',
      'lootboxes',
      'clicks',
      'faces-destroyed',
      'server',
    ]);
    expect(new Set(hooks).size).toBe(7);
  });

  it('is not a live region: the only role is the named Resources group (AC-19, AC-31)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 42, facesDestroyed: 3 }} levelIndex={2} serverId={3} />,
    );

    expect(html).toContain('<span data-stat="clicks">42</span>');
    expect(html).toContain('<span data-stat="faces-destroyed">3</span>');
    expect(html).toContain('<span data-stat="server">3</span>');
    expect(html.match(/role="/g)).toHaveLength(1);
    expect(html).toContain('role="group" aria-label="Resources"');
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="log"');
  });

  it('renders no toggle button and no data-minimized attribute by default (AC-19)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 1, facesDestroyed: 1 }} levelIndex={0} serverId={1} />,
    );

    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-minimized');
  });

  it('renders the toggle button as the last child when onToggleMinimize is provided (AC-19)', () => {
    const html = renderToStaticMarkup(
      <Hud
        stats={{ clicks: 1, facesDestroyed: 1 }}
        levelIndex={0}
        serverId={1}
        onToggleMinimize={() => {}}
      />,
    );

    expect(html).toBe(hudMarkup({ clicks: 1, facesDestroyed: 1, cube: 1, server: 1, toggle: true }));
    expect(
      html.endsWith(
        '<button type="button" aria-expanded="true" aria-label="Toggle HUD"></button></section>',
      ),
    ).toBe(true);
  });

  it('sets aria-expanded from minimized on the 24 px toggle button (AC-19)', () => {
    const html = renderToStaticMarkup(
      <Hud
        stats={{ clicks: 0, facesDestroyed: 0 }}
        levelIndex={0}
        serverId={0}
        minimized
        onToggleMinimize={() => {}}
      />,
    );

    expect(html).toBe(
      hudMarkup({ clicks: 0, facesDestroyed: 0, cube: 1, server: 0, minimized: true, toggle: true }),
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-minimized="true"');
    // The minimize target is the accepted `main > section button` 1.5rem control, not a
    // new 44 px control: it carries no size class or inline size.
    expect(html).not.toContain('gf-cta');
    expect(html).not.toContain('style=');
  });

  it('carries data-minimized="true" only when minimized (AC-19)', () => {
    const minimizedHtml = renderToStaticMarkup(
      <Hud
        stats={{ clicks: 0, facesDestroyed: 0 }}
        levelIndex={0}
        serverId={0}
        minimized
      />,
    );
    const expandedHtml = renderToStaticMarkup(
      <Hud
        stats={{ clicks: 0, facesDestroyed: 0 }}
        levelIndex={0}
        serverId={0}
        minimized={false}
      />,
    );

    expect(minimizedHtml).toContain('data-minimized="true"');
    expect(expandedHtml).not.toContain('data-minimized');
  });

  it('keeps the header, the resource strip and the grid rendered when minimized (AC-19)', () => {
    const { container } = render(
      <Hud
        stats={{ clicks: 3, facesDestroyed: 1, coins: 2 }}
        levelIndex={1}
        serverId={4}
        keys={1}
        lootboxes={2}
        minimized
        onToggleMinimize={() => {}}
      />,
    );
    const section = container.querySelector('section');

    expect(section?.getAttribute('data-minimized')).toBe('true');
    // The visible/hidden split is `.hud-panel[data-minimized='true'] .hud-grid { display:
    // none; }` in game-view.css (T7); the header and the resources are never hidden.
    expect(container.querySelector('.hud-header')).not.toBeNull();
    expect(container.querySelector('.hud-resources')).not.toBeNull();
    expect(container.querySelector('.hud-grid')).not.toBeNull();
    expect(container.querySelector('.hud-header')?.textContent).toBe('Pilot statusCube 2');
    expect(screen.getByRole('group', { name: 'Resources' }).querySelectorAll('[data-resource]')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Toggle HUD' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('calls onToggleMinimize when the toggle button is clicked (AC-19)', async () => {
    const handler = vi.fn();
    render(
      <Hud
        stats={{ clicks: 0, facesDestroyed: 0 }}
        levelIndex={0}
        serverId={0}
        onToggleMinimize={handler}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Toggle HUD' }));

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('responsive overlay contract', () => {
  it('renders the HUD as a `main > section` overlay with the hud-panel class and no inline layout (AC-4)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 5, facesDestroyed: 2 }} levelIndex={1} serverId={4} />,
    );

    expect(html.slice(0, html.indexOf('>'))).toBe(
      '<section aria-label="Game statistics" class="hud-panel"',
    );
    expect(html).not.toContain('style=');
    expect(html).not.toContain('z-index');
  });

  it('has no interactive descendants unless a toggle handler is provided (AC-4)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 3, facesDestroyed: 1 }} levelIndex={2} serverId={7} />,
    );

    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('aria-live');
  });
});

describe('HUD_BLINK_MS', () => {
  it('is exported as 200', () => {
    expect(HUD_BLINK_MS).toBe(200);
  });
});

describe('Hud blinking prop (AC-3)', () => {
  it('carries data-blinking="true" when blinking is true', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 1, facesDestroyed: 1 }} levelIndex={0} serverId={1} blinking />,
    );
    expect(html).toContain('data-blinking="true"');
  });

  it('carries data-blinking="true" when blinking is explicitly true', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 1, facesDestroyed: 1 }} levelIndex={0} serverId={1} blinking={true} />,
    );
    expect(html).toContain('data-blinking="true"');
  });

  it('carries no data-blinking attribute when blinking is false', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 1, facesDestroyed: 1 }} levelIndex={0} serverId={1} blinking={false} />,
    );
    expect(html).not.toContain('data-blinking');
  });

  it('carries no data-blinking attribute when blinking is omitted (default markup unchanged)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 1, facesDestroyed: 1 }} levelIndex={0} serverId={1} />,
    );
    expect(html).not.toContain('data-blinking');
    expect(html).toBe(hudMarkup({ clicks: 1, facesDestroyed: 1, cube: 1, server: 1 }));
  });
});

describe('Hud coin popups (AC-39)', () => {
  it('renders no coin-pop container when there is no gain', () => {
    const { container } = render(
      <Hud stats={{ clicks: 0, facesDestroyed: 0, coins: 0 }} levelIndex={0} serverId={0} />,
    );

    expect(container.querySelector('[data-coin-pops="true"]')).toBeNull();
    expect(container.querySelectorAll('[data-coin-pop]')).toHaveLength(0);
  });

  it('renders one exact +<delta> popup per queued gain inside the coins chip', () => {
    const { container } = render(
      <Hud
        stats={{ clicks: 0, facesDestroyed: 0, coins: 1.25 }}
        levelIndex={0}
        serverId={0}
        coinPops={[
          { id: 1, amount: 0.5 },
          { id: 2, amount: 0.25 },
          { id: 3, amount: 0.4 },
        ]}
      />,
    );

    const coinsChip = container.querySelector('[data-resource="coins"]');
    const pops = Array.from(coinsChip?.querySelectorAll<HTMLElement>('[data-coin-pop]') ?? []);
    expect(pops).toHaveLength(3);
    expect(pops.map((pop) => pop.getAttribute('data-coin-pop'))).toEqual(['1', '2', '3']);
    expect(pops.map((pop) => pop.getAttribute('data-amount'))).toEqual(['0.5', '0.25', '0.4']);
    expect(pops.map((pop) => pop.textContent)).toEqual(['+0.50', '+0.25', '+0.40']);
    expect(container.querySelector('[data-coin-pops="true"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    // The popup queue never escapes the coins chip.
    expect(container.querySelectorAll('.hud-coin-pops')).toHaveLength(1);
    expect(coinsChip?.querySelector('.hud-resource-value')?.textContent).toBe('1.25');
  });

  it('updates the numeric HUD value in the same frame without a HUD pulse', () => {
    const { container } = render(
      <Hud
        stats={{ clicks: 4, facesDestroyed: 1, coins: 2.75 }}
        levelIndex={1}
        serverId={3}
        coinPops={[{ id: 7, amount: 0.75 }]}
      />,
    );

    const section = container.querySelector('section');
    expect(section?.getAttribute('class')).toBe('hud-panel');
    expect(section?.hasAttribute('data-blinking')).toBe(false);
    expect(container.querySelector('[data-stat="coins"]')?.textContent).toBe('2.75');
    expect(container.querySelector('[data-coin-pop="7"]')?.textContent).toBe('+0.75');
  });

  it('formats deltas to exactly two decimals with a leading plus', () => {
    expect(formatCoinPop(0.5)).toBe('+0.50');
    expect(formatCoinPop(2)).toBe('+2.00');
    expect(formatCoinPop(0.125)).toBe('+0.13');
  });
});
