import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ConnectionBanner } from './ConnectionBanner';
import { Hud } from './Hud';
import { UserPanel } from './UserPanel';

/**
 * HUD integration test through React SSR (AC-1, AC-11, AC-14; `Server` line AC-23): the
 * component under the real `react-dom/server` renderer, asserting the exact markup a
 * first paint produces. The `Server <serverId>` line is the T14 addition; the existing
 * stats markup is retained verbatim.
 */
describe('Hud', () => {
  it('renders the zero state with the pinned labels and data hooks', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 0, facesDestroyed: 0 }} levelIndex={0} serverId={0} />,
    );

    expect(html).toBe(
      '<section aria-label="Game statistics">' +
        '<p>Clicks: <span data-stat="clicks">0</span></p>' +
        '<p>Faces destroyed: <span data-stat="faces-destroyed">0</span></p>' +
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
        '<p>Cube <span data-stat="cube">3</span></p>' +
        '<p>Server <span data-stat="server">7</span></p>' +
        '</section>',
    );
  });

  it('is not a live region: neither counter span carries role or aria-live (AC-14)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 42, facesDestroyed: 3 }} levelIndex={2} serverId={3} />,
    );

    // Exact span markup: `data-stat` is the only attribute on each value span…
    expect(html).toContain('<span data-stat="clicks">42</span>');
    expect(html).toContain('<span data-stat="faces-destroyed">3</span>');
    expect(html).toContain('<span data-stat="server">3</span>');
    // …and the HUD contributes no live-region semantics at all.
    expect(html).not.toContain('role=');
    expect(html).not.toContain('aria-live');
  });
});

/**
 * Responsive overlay contract (AC-4, AC-5, AC-13, AC-14; Q-3).
 *
 * T1 owns every `app.css` rule. These tests pin the markup those rules select, so a
 * component restyle cannot silently break the absolute placement, the safe-area
 * offsets, the pointer-events split or the 44 px tap targets. The workspace has no DOM
 * environment (SSR-only, spec § Assumptions), so markup structure is the component-level
 * evidence; computed layout is verified manually at T5.
 */
describe('responsive overlay contract', () => {
  it('renders the HUD as the bare `main > section` overlay with no inline layout (AC-4, AC-5)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 5, facesDestroyed: 2 }} levelIndex={1} serverId={4} />,
    );

    // `main > section` carries the absolute placement and the `env(safe-area-inset-*)`
    // offsets; a class, inline style or z-index would bypass or compete with those rules
    // on notched devices.
    expect(html.startsWith('<section aria-label="Game statistics">')).toBe(true);
    expect(html).not.toContain('class=');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('z-index');
    expect(html).not.toContain('width=');
    expect(html).not.toContain('height=');
  });

  it('has no interactive descendants, so `pointer-events: none` passes gestures to the canvas (AC-4)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 3, facesDestroyed: 1 }} levelIndex={2} serverId={7} />,
    );

    // The HUD is read-only: no focusable/clickable element needs `pointer-events: auto`,
    // so every pointer gesture reaches the canvas beneath the overlay.
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('tabindex');
    // AC-14: the HUD contributes no announcement stream of its own.
    expect(html).not.toContain('role=');
    expect(html).not.toContain('aria-live');
  });

  it('keeps the banner and panel selector hooks with the tap targets as direct children (AC-4, AC-5, AC-13)', () => {
    const banner = renderToStaticMarkup(
      <ConnectionBanner status="exhausted" onRetry={() => {}} />,
    );
    const panel = renderToStaticMarkup(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[]}
        spectating
        onSpectate={() => {}}
        onReturn={() => {}}
      />,
    );

    // `.connection-banner button` and `.user-panel > button` are the 44 px selectors:
    // Retry, Users on Server and Return to my cube must stay direct children.
    expect(banner).toBe(
      '<div class="connection-banner"><span>Connection lost</span>' +
        '<button type="button">Retry</button></div>',
    );
    expect(panel).toBe(
      '<div class="user-panel">' +
        '<button type="button" aria-expanded="false">Users on Server</button>' +
        '<button type="button">Return to my cube</button>' +
        '</div>',
    );

    // Inline positioning/sizing would override app.css on small or notched screens, and
    // the overlays must not add a second live region (App keeps exactly one, AC-14).
    for (const html of [banner, panel]) {
      expect(html).not.toContain('style=');
      expect(html).not.toContain('z-index');
      expect(html).not.toContain('width=');
      expect(html).not.toContain('height=');
      expect(html).not.toContain('role=');
      expect(html).not.toContain('aria-live');
    }
  });
});
