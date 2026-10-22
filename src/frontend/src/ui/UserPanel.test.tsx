import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { MemberState } from '../multiplayer/protocol';
import { UserPanel } from './UserPanel';

/**
 * Users panel integration tests through React SSR (AC-16/AC-18, T14). The open panel is
 * rendered through the documented `defaultOpen` SSR seam because the workspace has no DOM
 * environment; production always starts closed and opens on the toggle's click.
 */

function member(playerId: string, name: string, levelIndex: number): MemberState {
  return {
    playerId,
    name,
    position: { x: 24, y: 0 },
    levelIndex,
    gridSize: 3,
    styleId: 'obsidian-neon',
    removedIds: [],
  };
}

describe('UserPanel', () => {
  it('renders nothing before the first welcome assigns a server identity (F7)', () => {
    const html = renderToStaticMarkup(
      <UserPanel
        welcomed={false}
        selfName=""
        members={[]}
        spectating={false}
        onSpectate={() => {}}
        onReturn={() => {}}
        defaultOpen
      />,
    );

    // No toggle, no blank own row and no return command: the server is unknown yet.
    expect(html).toBe('');
  });

  it('renders only the pinned toggle while closed', () => {
    const html = renderToStaticMarkup(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[]}
        spectating={false}
        onSpectate={() => {}}
        onReturn={() => {}}
      />,
    );

    expect(html).toBe(
      '<div class="user-panel">' +
        '<button type="button" aria-expanded="false">Users on Server</button>' +
        '</div>',
    );
  });

  it('renders only the disabled own row when alone on the server (AC-16)', () => {
    const html = renderToStaticMarkup(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[]}
        spectating={false}
        onSpectate={() => {}}
        onReturn={() => {}}
        defaultOpen
      />,
    );

    expect(html).toBe(
      '<div class="user-panel">' +
        '<button type="button" aria-expanded="true">Users on Server</button>' +
        '<section aria-label="Users on server"><ul>' +
        '<li><button type="button" disabled="">Player 1 (You)</button></li>' +
        '</ul></section>' +
        '</div>',
    );
  });

  it('lists the other members in slot order with 1-based cube levels (AC-16)', () => {
    const html = renderToStaticMarkup(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[member('p2', 'Player 2', 1), member('p3', 'Player 3', 0)]}
        spectating={false}
        onSpectate={() => {}}
        onReturn={() => {}}
        defaultOpen
      />,
    );

    expect(html).toBe(
      '<div class="user-panel">' +
        '<button type="button" aria-expanded="true">Users on Server</button>' +
        '<section aria-label="Users on server"><ul>' +
        '<li><button type="button" disabled="">Player 1 (You)</button></li>' +
        '<li><button type="button">Player 2 · Cube 2</button></li>' +
        '<li><button type="button">Player 3 · Cube 1</button></li>' +
        '</ul></section>' +
        '</div>',
    );
  });

  it('renders Return to my cube exactly while spectating (AC-18)', () => {
    const spectating = renderToStaticMarkup(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[member('p2', 'Player 2', 0)]}
        spectating
        onSpectate={() => {}}
        onReturn={() => {}}
      />,
    );

    expect(spectating).toBe(
      '<div class="user-panel">' +
        '<button type="button" aria-expanded="false">Users on Server</button>' +
        '<button type="button">Return to my cube</button>' +
        '</div>',
    );

    const notSpectating = renderToStaticMarkup(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[member('p2', 'Player 2', 0)]}
        spectating={false}
        onSpectate={() => {}}
        onReturn={() => {}}
      />,
    );

    expect(notSpectating).not.toContain('Return to my cube');
  });

  it('contributes no live-region semantics (the shell has exactly one)', () => {
    const html = renderToStaticMarkup(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[member('p2', 'Player 2', 0)]}
        spectating
        onSpectate={() => {}}
        onReturn={() => {}}
        defaultOpen
      />,
    );

    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="status"');
  });
});
