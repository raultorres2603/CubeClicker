/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConnectionBanner } from './ConnectionBanner';

afterEach(() => {
  cleanup();
});

/**
 * Connection banner integration tests through React SSR (AC-22, T14; T9 adds the
 * `data-status`/dot chrome). The workspace has no DOM environment, so the pinned evidence
 * is the exact markup each transport status produces; the `Retry` command's connection
 * behaviour is pinned by `multiplayer/transport.test.ts` + `game/session.test.ts`.
 */

/** The decorative status dot shared by every banner status (AC-25). */
const DOT = '<span class="connection-dot" data-connection-dot="true" aria-hidden="true"></span>';

describe('ConnectionBanner', () => {
  it('renders the pinned connecting copy with its data-status and dot', () => {
    const html = renderToStaticMarkup(
      <ConnectionBanner status="connecting" onRetry={() => {}} />,
    );

    expect(html).toBe(
      '<div class="connection-banner" data-status="connecting">' + DOT + 'Connecting…</div>',
    );
  });

  it('renders the pinned retrying copy while the bounded retry runs', () => {
    const html = renderToStaticMarkup(
      <ConnectionBanner status="disconnected" onRetry={() => {}} />,
    );

    expect(html).toBe(
      '<div class="connection-banner" data-status="disconnected">' +
        DOT +
        'Connection lost — retrying…</div>',
    );
  });

  it('renders the exhausted copy with the pinned Retry button', () => {
    const html = renderToStaticMarkup(
      <ConnectionBanner status="exhausted" onRetry={() => {}} />,
    );

    expect(html).toBe(
      '<div class="connection-banner" data-status="exhausted">' +
        DOT +
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

  it('puts exactly one aria-hidden dot before the banner text for every visible status', () => {
    for (const status of ['connecting', 'disconnected', 'exhausted'] as const) {
      const html = renderToStaticMarkup(<ConnectionBanner status={status} onRetry={() => {}} />);

      expect(html.match(/data-connection-dot="true"/g)).toHaveLength(1);
      expect(html.match(/aria-hidden="true"/g)).toHaveLength(1);
      expect(html.startsWith(`<div class="connection-banner" data-status="${status}">${DOT}`)).toBe(
        true,
      );
    }
  });

  it('calls onRetry exactly once from the Retry control', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ConnectionBanner status="exhausted" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
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
