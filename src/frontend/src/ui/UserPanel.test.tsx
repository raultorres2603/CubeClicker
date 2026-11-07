import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { MemberState } from '../multiplayer/protocol';
import { UserPanel } from './UserPanel';

/**
 * Users panel integration tests through React SSR (AC-5/AC-16/AC-18, T14). The open panel
 * is rendered through the documented `defaultOpen` SSR seam because the workspace has no
 * DOM environment; production always starts closed and opens on the toggle's click.
 */

/** Exact `GroupIcon` markup: the badge's one decorative SVG (AC-5). */
const GROUP_ICON =
  '<svg aria-hidden="true" data-icon="group" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<circle cx="9" cy="8" r="3.1"></circle>' +
  '<path d="M3.4 20.2a5.6 5.6 0 0111.2 0"></path>' +
  '<circle cx="17.3" cy="9.2" r="2.3"></circle>' +
  '<path d="M14.9 14.9a4.3 4.3 0 015.7 4.1"></path>' +
  '</svg>';

const TOGGLE_CLOSED =
  '<button type="button" class="users-badge" aria-expanded="false">' +
  GROUP_ICON +
  'Users on Server</button>';
const TOGGLE_OPEN =
  '<button type="button" class="users-badge" aria-expanded="true">' +
  GROUP_ICON +
  'Users on Server</button>';

function member(playerId: string, name: string, levelIndex: number): MemberState {
  return {
    playerId,
    name,
    position: { x: 24, y: 0 },
    levelIndex,
    gridSize: 3,
    styleId: 'obsidian-neon',
    removedIds: [],
    yawSteps: 0,
    pitchSteps: 0,
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

    expect(html).toBe('<div class="user-panel">' + TOGGLE_CLOSED + '</div>');
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
        TOGGLE_OPEN +
        '<section class="users-list" aria-label="Users on server"><ul>' +
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
        TOGGLE_OPEN +
        '<section class="users-list" aria-label="Users on server"><ul>' +
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
        TOGGLE_CLOSED +
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

  it('renders the users-badge toggle with one decorative group icon before the label (AC-5)', () => {
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

    expect(html).toContain('<button type="button" class="users-badge" aria-expanded="false">');
    expect(html).toContain(
      '<svg aria-hidden="true" data-icon="group" fill="none" focusable="false" stroke="currentColor"' +
        ' stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">',
    );
    expect(html).toContain('</svg>Users on Server</button>');
    expect(html.match(/<svg\b/g)).toHaveLength(1);
    expect(html.match(/data-icon="group"/g)).toHaveLength(1);
  });

  it('gives the open roster section the users-list class and pinned label (AC-5)', () => {
    const html = renderToStaticMarkup(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[member('p2', 'Player 2', 0)]}
        spectating={false}
        onSpectate={() => {}}
        onReturn={() => {}}
        defaultOpen
      />,
    );

    expect(html).toContain('<section class="users-list" aria-label="Users on server">');
    expect(html.match(/class="users-list"/g)).toHaveLength(1);
    expect(html).toContain('<li><button type="button" disabled="">Player 1 (You)</button></li>');
    expect(html).toContain('<li><button type="button">Player 2 · Cube 1</button></li>');
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
