import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Hud } from './Hud';

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
