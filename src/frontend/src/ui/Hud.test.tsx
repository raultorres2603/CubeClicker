/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HUD_BLINK_MS, Hud } from './Hud';

afterEach(() => {
  cleanup();
});

describe('Hud', () => {
  it('renders the zero state with the pinned labels and data hooks', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 0, facesDestroyed: 0 }} levelIndex={0} serverId={0} />,
    );

    expect(html).toBe(
      '<section aria-label="Game statistics">' +
        '<p>Clicks: <span data-stat="clicks">0</span></p>' +
        '<p>Faces destroyed: <span data-stat="faces-destroyed">0</span></p>' +
        '<p>Coins <span data-stat="coins">0.00</span></p>' +
        '<p>Cube <span data-stat="cube">1</span></p>' +
        '<p>Server <span data-stat="server">0</span></p>' +
        '</section>',
    );
  });

  it('renders live counters, the 1-based cube level and the server id from its props', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 42, facesDestroyed: 3 }} levelIndex={2} serverId={7} />,
    );

    expect(html).toBe(
      '<section aria-label="Game statistics">' +
        '<p>Clicks: <span data-stat="clicks">42</span></p>' +
        '<p>Faces destroyed: <span data-stat="faces-destroyed">3</span></p>' +
        '<p>Coins <span data-stat="coins">0.00</span></p>' +
        '<p>Cube <span data-stat="cube">3</span></p>' +
        '<p>Server <span data-stat="server">7</span></p>' +
        '</section>',
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

    expect(html).toBe(
      '<section aria-label="Game statistics">' +
        '<p>Clicks: <span data-stat="clicks">1</span></p>' +
        '<p>Faces destroyed: <span data-stat="faces-destroyed">1</span></p>' +
        '<p>Coins <span data-stat="coins">0.00</span></p>' +
        '<p>Cube <span data-stat="cube">1</span></p>' +
        '<p>Server <span data-stat="server">1</span></p>' +
        '<button type="button" aria-expanded="true" aria-label="Toggle HUD"></button>' +
        '</section>',
    );
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

describe('responsive overlay contract', () => {
  it('renders the HUD as the bare `main > section` overlay with no inline layout (AC-4, AC-5)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 5, facesDestroyed: 2 }} levelIndex={1} serverId={4} />,
    );

    expect(html.startsWith('<section aria-label="Game statistics">')).toBe(true);
    expect(html).not.toContain('class=');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('z-index');
    expect(html).not.toContain('width=');
    expect(html).not.toContain('height=');
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
    expect(html).toBe(
      '<section aria-label="Game statistics">' +
        '<p>Clicks: <span data-stat="clicks">1</span></p>' +
        '<p>Faces destroyed: <span data-stat="faces-destroyed">1</span></p>' +
        '<p>Coins <span data-stat="coins">0.00</span></p>' +
        '<p>Cube <span data-stat="cube">1</span></p>' +
        '<p>Server <span data-stat="server">1</span></p>' +
        '</section>',
    );
  });
});
