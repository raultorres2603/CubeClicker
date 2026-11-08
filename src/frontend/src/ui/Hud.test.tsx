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

const CUBE_LEVEL_ICON =
  '<svg aria-hidden="true" data-icon="cube-level" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<path d="M9 3.6l6.4 3.3v6.9L9 17.1l-6.4-3.3V6.9z"></path>' +
  '<path d="M2.6 6.9L9 10.2l6.4-3.3M9 10.2v6.9"></path>' +
  '<path d="M18.2 12.2V5.4M15.4 8.2l2.8-2.8 2.8 2.8"></path>' +
  '</svg>';

const SERVER_ICON =
  '<svg aria-hidden="true" data-icon="server" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<rect x="3.5" y="4" width="17" height="6" rx="1.8"></rect>' +
  '<rect x="3.5" y="14" width="17" height="6" rx="1.8"></rect>' +
  '<circle cx="7" cy="7" r="0.9" fill="currentColor" stroke="none"></circle>' +
  '<circle cx="7" cy="17" r="0.9" fill="currentColor" stroke="none"></circle>' +
  '<path d="M11 7h6M11 17h6"></path>' +
  '</svg>';

/** The exact reference HUD markup: panel class, five icon rows, optional toggle last. */
function hudMarkup({
  clicks,
  facesDestroyed,
  coins = '0.00',
  cube,
  server,
  minimized = false,
  blinking = false,
  toggle = false,
}: {
  clicks: number;
  facesDestroyed: number;
  coins?: string;
  cube: number;
  server: number;
  minimized?: boolean;
  blinking?: boolean;
  toggle?: boolean;
}): string {
  return (
    '<section aria-label="Game statistics" class="hud-panel"' +
    (minimized ? ' data-minimized="true"' : '') +
    (blinking ? ' data-blinking="true"' : '') +
    '>' +
    `<p class="hud-row" data-row="clicks">${CURSOR_ICON}Clicks: <span data-stat="clicks">${clicks}</span></p>` +
    `<p class="hud-row" data-row="faces-destroyed">${CUBE_ICON}Faces destroyed: <span data-stat="faces-destroyed">${facesDestroyed}</span></p>` +
    `<p class="hud-row" data-row="coins">${COIN_ICON}Coins <span data-stat="coins">${coins}</span></p>` +
    `<p class="hud-row" data-row="cube">${CUBE_LEVEL_ICON}Cube <span data-stat="cube">${cube}</span></p>` +
    `<p class="hud-row" data-row="server">${SERVER_ICON}Server <span data-stat="server">${server}</span></p>` +
    (toggle
      ? `<button type="button" aria-expanded="${minimized ? 'false' : 'true'}" aria-label="Toggle HUD"></button>`
      : '') +
    '</section>'
  );
}

describe('Hud', () => {
  it('renders the zero state with the pinned labels, data hooks and hud-panel class', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 0, facesDestroyed: 0 }} levelIndex={0} serverId={0} />,
    );

    expect(html).toBe(hudMarkup({ clicks: 0, facesDestroyed: 0, cube: 1, server: 0 }));
  });

  it('renders live counters, the 1-based cube level and the server id from its props', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 42, facesDestroyed: 3, coins: 12.5 }} levelIndex={2} serverId={7} />,
    );

    expect(html).toBe(
      hudMarkup({ clicks: 42, facesDestroyed: 3, coins: '12.50', cube: 3, server: 7 }),
    );
  });

  it('is not a live region: neither counter span carries role or aria-live (AC-14)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 42, facesDestroyed: 3 }} levelIndex={2} serverId={3} />,
    );

    expect(html).toContain('<span data-stat="clicks">42</span>');
    expect(html).toContain('<span data-stat="faces-destroyed">3</span>');
    expect(html).toContain('<span data-stat="server">3</span>');
    expect(html).not.toContain('role=');
    expect(html).not.toContain('aria-live');
  });

  it('renders no toggle button and no data-minimized attribute by default (AC-6)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 1, facesDestroyed: 1 }} levelIndex={0} serverId={1} />,
    );

    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-minimized');
  });

  it('renders the toggle button as the last child when onToggleMinimize is provided (AC-6)', () => {
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

  it('sets aria-expanded from minimized on the toggle button (AC-6)', () => {
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
  });

  it('carries data-minimized="true" only when minimized (AC-6)', () => {
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

  it('calls onToggleMinimize when the toggle button is clicked (AC-6)', async () => {
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

describe('Hud icon rows (AC-4, AC-19)', () => {
  it('renders five decorative icon rows in the pinned order with the pinned labels and values', () => {
    const { container } = render(
      <Hud stats={{ clicks: 0, facesDestroyed: 0 }} levelIndex={0} serverId={0} />,
    );
    const rows = Array.from(container.querySelectorAll('p.hud-row'));

    expect(rows.map((row) => row.getAttribute('data-row'))).toEqual([
      'clicks',
      'faces-destroyed',
      'coins',
      'cube',
      'server',
    ]);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Clicks: 0',
      'Faces destroyed: 0',
      'Coins 0.00',
      'Cube 1',
      'Server 0',
    ]);
    expect(rows.map((row) => row.querySelectorAll('svg')).map((icons) => icons.length)).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect(rows.map((row) => row.querySelector('svg')?.getAttribute('data-icon'))).toEqual([
      'cursor',
      'cube',
      'coin',
      'cube-level',
      'server',
    ]);
    expect(rows.map((row) => row.querySelector('svg')?.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
      'true',
      'true',
      'true',
    ]);
    expect(rows.map((row) => row.querySelector('svg')?.getAttribute('focusable'))).toEqual([
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(container.querySelector('section')?.getAttribute('class')).toBe('hud-panel');
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
    expect(html).not.toContain('role=');
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

  it('renders one exact +<delta> popup per queued gain in queue order', () => {
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

    const pops = Array.from(container.querySelectorAll<HTMLElement>('[data-coin-pop]'));
    expect(pops).toHaveLength(3);
    expect(pops.map((pop) => pop.getAttribute('data-coin-pop'))).toEqual(['1', '2', '3']);
    expect(pops.map((pop) => pop.getAttribute('data-amount'))).toEqual(['0.5', '0.25', '0.4']);
    expect(pops.map((pop) => pop.textContent)).toEqual(['+0.50', '+0.25', '+0.40']);
    expect(container.querySelector('[data-coin-pops="true"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
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
