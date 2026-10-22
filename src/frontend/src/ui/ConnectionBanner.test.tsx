import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ConnectionBanner } from './ConnectionBanner';

/**
 * Connection banner integration tests through React SSR (AC-22, T14). The workspace has
 * no DOM environment, so the pinned evidence is the exact markup each transport status
 * produces; the `Retry` command's connection behaviour is pinned by
 * `multiplayer/transport.test.ts` + `game/session.test.ts`.
 */
describe('ConnectionBanner', () => {
  it('renders the pinned connecting copy', () => {
    const html = renderToStaticMarkup(
      <ConnectionBanner status="connecting" onRetry={() => {}} />,
    );

    expect(html).toBe('<div class="connection-banner">Connecting…</div>');
  });

  it('renders the pinned retrying copy while the bounded retry runs', () => {
    const html = renderToStaticMarkup(
      <ConnectionBanner status="disconnected" onRetry={() => {}} />,
    );

    expect(html).toBe('<div class="connection-banner">Connection lost — retrying…</div>');
  });

  it('renders the exhausted copy with the pinned Retry button', () => {
    const html = renderToStaticMarkup(
      <ConnectionBanner status="exhausted" onRetry={() => {}} />,
    );

    expect(html).toBe(
      '<div class="connection-banner">' +
        '<span>Connection lost</span>' +
        '<button type="button">Retry</button>' +
        '</div>',
    );
  });

  it('renders nothing while connected', () => {
    const html = renderToStaticMarkup(
      <ConnectionBanner status="connected" onRetry={() => {}} />,
    );

    expect(html).toBe('');
  });

  it('contributes no live-region semantics (the shell has exactly one)', () => {
    const html = renderToStaticMarkup(
      <ConnectionBanner status="exhausted" onRetry={() => {}} />,
    );

    expect(html).toContain('Connection lost');
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="status"');
  });
});
