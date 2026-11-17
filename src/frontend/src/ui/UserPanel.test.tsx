/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MemberState } from '../multiplayer/protocol';
import { UserPanel } from './UserPanel';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/**
 * Users panel integration tests through React SSR (AC-5/AC-16/AC-18, T14; T9 adds the
 * crew chrome). The open panel is rendered through the documented `defaultOpen` SSR seam
 * because the workspace has no DOM environment; production always starts closed and
 * opens on the toggle's click.
 */

/** Exact `GroupIcon` markup: the badge's one decorative SVG (AC-5). */
const GROUP_ICON =
  '<svg aria-hidden="true" data-icon="group" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<circle cx="9" cy="8" r="3.1"></circle>' +
  '<path d="M3.4 20.2a5.6 5.6 0 0111.2 0"></path>' +
  '<circle cx="17.3" cy="9.2" r="2.3"></circle>' +
  '<path d="M14.9 14.9a4.3 4.3 0 015.7 4.1"></path>' +
  '</svg>';

/** The crew pill: group icon, `aria-hidden` live dot, exact label, count badge (AC-24). */
function toggle(open: boolean, count: number): string {
  return (
    `<button type="button" class="users-badge" aria-expanded="${open}">` +
    GROUP_ICON +
    '<span class="gf-live-dot" data-live-dot="true" aria-hidden="true"></span>' +
    'Users on Server' +
    `<span class="users-count" data-count="${count}" aria-hidden="true">${count}</span>` +
    '</button>'
  );
}

const CREW_HEADING = '<h2 class="users-list-title">Crew</h2>';

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

    expect(html).toBe('<div class="user-panel">' + toggle(false, 1) + '</div>');
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
        toggle(true, 1) +
        '<section class="users-list" aria-label="Users on server">' +
        CREW_HEADING +
        '<ul>' +
        '<li><button type="button" disabled="">Player 1 (You)</button></li>' +
        '</ul></section>' +
        '</div>',
    );
  });

  it('lists the other members in slot order with 1-based cube levels and data-level (AC-16, AC-24)', () => {
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
        toggle(true, 3) +
        '<section class="users-list" aria-label="Users on server">' +
        CREW_HEADING +
        '<ul>' +
        '<li><button type="button" disabled="">Player 1 (You)</button></li>' +
        '<li><button type="button" data-level="2">Player 2 · Cube 2</button></li>' +
        '<li><button type="button" data-level="1">Player 3 · Cube 1</button></li>' +
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
        toggle(false, 2) +
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

  it('renders the users-badge toggle with one decorative group icon, live dot and count (AC-5, AC-24)', () => {
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

    expect(html).toContain(
      '<button type="button" class="users-badge" aria-expanded="false">',
    );
    expect(html).toContain(
      '<svg aria-hidden="true" data-icon="group" fill="none" focusable="false" stroke="currentColor"' +
        ' stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">',
    );
    expect(html).toContain(
      '</svg><span class="gf-live-dot" data-live-dot="true" aria-hidden="true"></span>Users on Server',
    );
    expect(html.match(/<svg\b/g)).toHaveLength(1);
    expect(html.match(/data-icon="group"/g)).toHaveLength(1);
    expect(html.match(/data-live-dot="true"/g)).toHaveLength(1);
    expect(html.match(/data-count="1"/g)).toHaveLength(1);
  });

  it('counts the player plus the members in the aria-hidden badge', () => {
    const html = renderToStaticMarkup(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[
          member('p2', 'Player 2', 0),
          member('p3', 'Player 3', 1),
          member('p4', 'Player 4', 2),
        ]}
        spectating={false}
        onSpectate={() => {}}
        onReturn={() => {}}
      />,
    );

    expect(html).toContain(
      '<span class="users-count" data-count="4" aria-hidden="true">4</span>',
    );
    expect(html.match(/class="users-count"/g)).toHaveLength(1);
  });

  it('renders the Crew heading immediately before the roster list (AC-24, AC-29)', () => {
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

    expect(html).toContain(CREW_HEADING + '<ul><li>');
    expect(html.match(/<h2 class="users-list-title">Crew<\/h2>/g)).toHaveLength(1);
    expect(html.indexOf(CREW_HEADING)).toBeLessThan(html.indexOf('<ul>'));
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
    expect(html).toContain('<li><button type="button" data-level="1">Player 2 · Cube 1</button></li>');
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

describe('UserPanel interactions (AC-24)', () => {
  it('opens the Crew roster from the toggle without changing its accessible name', async () => {
    const user = userEvent.setup();
    render(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[member('p2', 'Player 2', 1)]}
        spectating={false}
        onSpectate={() => {}}
        onReturn={() => {}}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Users on Server' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Crew')).toBeNull();

    await user.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const heading = screen.getByRole('heading', { level: 2, name: 'Crew' });
    expect(heading.className).toBe('users-list-title');
    expect(screen.getByRole('button', { name: 'Player 2 · Cube 2' }).getAttribute('data-level')).toBe(
      '2',
    );
  });

  it('spectates the selected member exactly once and closes the roster', async () => {
    const user = userEvent.setup();
    const onSpectate = vi.fn();
    render(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[member('p2', 'Player 2', 1)]}
        spectating={false}
        onSpectate={onSpectate}
        onReturn={() => {}}
        defaultOpen
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Player 2 · Cube 2' }));

    expect(onSpectate).toHaveBeenCalledTimes(1);
    expect(onSpectate).toHaveBeenCalledWith('p2');
    expect(screen.queryByText('Crew')).toBeNull();
  });

  it('calls onReturn exactly once from Return to my cube', async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    render(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[]}
        spectating
        onSpectate={() => {}}
        onReturn={onReturn}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Return to my cube' }));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('replays the crew boot on every open without scheduling a timer (AC-13, AC-16)', () => {
    vi.useFakeTimers();
    render(
      <UserPanel
        welcomed
        selfName="Player 1"
        members={[member('p2', 'Player 2', 0)]}
        spectating={false}
        onSpectate={() => {}}
        onReturn={() => {}}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Users on Server' });
    expect(screen.queryByRole('heading', { level: 2, name: 'Crew' })).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    // Open: the list mounts (so the CSS boot replays), with no timer and no delayed teardown.
    fireEvent.click(toggle);
    const firstList = screen.getByRole('heading', { level: 2, name: 'Crew' }).parentElement;
    expect(firstList?.className).toBe('users-list');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(vi.getTimerCount()).toBe(0);

    // Close: the list unmounts in the same commit (open-only animation, no close state).
    fireEvent.click(toggle);
    expect(screen.queryByRole('heading', { level: 2, name: 'Crew' })).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(vi.getTimerCount()).toBe(0);

    // Re-open: a fresh element remounts, so the boot replays.
    fireEvent.click(toggle);
    const secondList = screen.getByRole('heading', { level: 2, name: 'Crew' }).parentElement;
    expect(secondList?.className).toBe('users-list');
    expect(secondList).not.toBe(firstList);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(vi.getTimerCount()).toBe(0);
  });
});
