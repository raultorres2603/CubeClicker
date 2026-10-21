import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { GameSession } from '../game/session';
import { GameCanvas } from './GameCanvas';

/**
 * Canvas integration test through React SSR (AC-1, AC-13). The workspace has no DOM
 * environment, so the attach/dispose effect is the documented residual; what SSR can
 * pin — and what AC-1/AC-13 name — is the element contract itself.
 */

const ARIA_LABEL =
  'Game canvas: click a mini-cube to explode it; drag or press the arrow keys to rotate the cube';

/** A session fake that records attach calls; SSR must not trigger any. */
function createSessionSpy(): { session: GameSession; attachCalls: () => number } {
  let attaches = 0;
  return {
    attachCalls: () => attaches,
    session: {
      attach: () => {
        attaches += 1;
      },
      dispose: () => {},
      getSnapshot: () => {
        throw new Error('GameCanvas must not read the snapshot during render');
      },
      subscribe: () => () => {},
    },
  };
}

describe('GameCanvas', () => {
  it('renders a focusable, labelled canvas with pointer gestures left to the game', () => {
    const { session } = createSessionSpy();

    const html = renderToStaticMarkup(<GameCanvas session={session} />);

    expect(html).toBe(
      `<canvas tabindex="0" aria-label="${ARIA_LABEL}" style="touch-action:none"></canvas>`,
    );
  });

  it('does not attach the session during server rendering (the effect is client-only)', () => {
    const { session, attachCalls } = createSessionSpy();

    renderToStaticMarkup(<GameCanvas session={session} />);

    expect(attachCalls()).toBe(0);
  });
});
