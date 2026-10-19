import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Hud } from './Hud';

/**
 * HUD integration test through React SSR (AC-1, AC-11, AC-14): the component under the
 * real `react-dom/server` renderer, asserting the exact markup a first paint produces.
 */
describe('Hud', () => {
  it('renders the zero state with the pinned labels and data hooks', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 0, facesDestroyed: 0 }} levelIndex={0} />,
    );

    expect(html).toBe(
      '<section aria-label="Game statistics">' +
        '<p>Clicks: <span data-stat="clicks">0</span></p>' +
        '<p>Faces destroyed: <span data-stat="faces-destroyed">0</span></p>' +
        '<p>Cube <span data-stat="cube">1</span></p>' +
        '</section>',
    );
  });

  it('renders live counters and the 1-based cube level from its props', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 42, facesDestroyed: 3 }} levelIndex={2} />,
    );

    expect(html).toBe(
      '<section aria-label="Game statistics">' +
        '<p>Clicks: <span data-stat="clicks">42</span></p>' +
        '<p>Faces destroyed: <span data-stat="faces-destroyed">3</span></p>' +
        '<p>Cube <span data-stat="cube">3</span></p>' +
        '</section>',
    );
  });

  it('is not a live region: neither counter span carries role or aria-live (AC-14)', () => {
    const html = renderToStaticMarkup(
      <Hud stats={{ clicks: 42, facesDestroyed: 3 }} levelIndex={2} />,
    );

    // Exact span markup: `data-stat` is the only attribute on either counter…
    expect(html).toContain('<span data-stat="clicks">42</span>');
    expect(html).toContain('<span data-stat="faces-destroyed">3</span>');
    // …and the HUD contributes no live-region semantics at all.
    expect(html).not.toContain('role=');
    expect(html).not.toContain('aria-live');
  });
});
