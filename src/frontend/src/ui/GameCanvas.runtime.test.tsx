/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CanvasLike, GameSession, RuntimeStatus } from '../game/session';
import { GameCanvas } from './GameCanvas';

/**
 * Integration test for the gate-close runtime status (AC-2): the real `GameCanvas` against
 * a session fake that owns the runtime-status store. The canvas effect itself stays the
 * accepted `attach(canvas)` / `dispose()` contract; these tests pin the observable UI the
 * status drives and that the canvas element is never conditionally rendered.
 */

const ARIA_LABEL =
  'Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube';

interface RuntimeSessionProbe {
  session: GameSession;
  attach: ReturnType<typeof vi.fn>;
  setStatus: (status: RuntimeStatus) => void;
}

/** A status-store session fake: `attach` starts a load, the test resolves it explicitly. */
function createRuntimeSession(initial: RuntimeStatus = 'idle'): RuntimeSessionProbe {
  let current = initial;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };
  const attach = vi.fn<(canvas: CanvasLike) => void>(() => {
    current = 'loading';
    notify();
  });

  const session: GameSession = {
    attach,
    dispose: () => {
      current = 'idle';
      notify();
    },
    getSnapshot: () => {
      throw new Error('GameCanvas must not read the engine snapshot during render');
    },
    subscribe: () => () => {},
    setPointerTarget: () => {},
    getRuntimeStatus: () => current,
    subscribeRuntime: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    session,
    attach,
    setStatus: (status) => {
      current = status;
      notify();
    },
  };
}

/** The rendered canvas, or a concrete failure when the component dropped it. */
function requireCanvas(): HTMLCanvasElement {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas');
  if (canvas === null) {
    throw new Error('GameCanvas did not render a canvas element');
  }
  return canvas;
}

afterEach(() => {
  cleanup();
});

describe('GameCanvas runtime status (AC-2)', () => {
  it('renders the pinned loading status while the environment loads, then removes it on ready', () => {
    const probe = createRuntimeSession();
    render(<GameCanvas session={probe.session} active />);
    const canvas = requireCanvas();

    expect(probe.attach).toHaveBeenCalledTimes(1);
    expect(probe.attach).toHaveBeenCalledWith(canvas);
    const status = screen.getByRole('status');
    expect(status.tagName).toBe('P');
    expect(status.className).toBe('game-runtime-status');
    expect(status.textContent).toBe('Loading the game…');

    act(() => {
      probe.setStatus('ready');
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('canvas')).toBe(canvas);
  });

  it('renders the pinned error alert and re-attaches the session on Try again', () => {
    const probe = createRuntimeSession();
    render(<GameCanvas session={probe.session} active />);
    const canvas = requireCanvas();

    act(() => {
      probe.setStatus('error');
    });

    expect(screen.queryByRole('status')).toBeNull();
    const alert = screen.getByRole('alert');
    expect(alert.tagName).toBe('DIV');
    expect(alert.className).toBe('game-runtime-error');
    expect(alert.textContent).toBe('The game could not be loaded. Try again');
    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry.getAttribute('type')).toBe('button');

    fireEvent.click(retry);

    expect(probe.attach).toHaveBeenCalledTimes(2);
    expect(probe.attach).toHaveBeenNthCalledWith(2, canvas);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Loading the game…');
  });

  it('renders no runtime status while the gate is still open', () => {
    const probe = createRuntimeSession('loading');
    render(<GameCanvas session={probe.session} active={false} />);

    expect(probe.attach).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelectorAll('canvas')).toHaveLength(1);

    act(() => {
      probe.setStatus('error');
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('keeps the same canvas element mounted in every runtime state', () => {
    const probe = createRuntimeSession();
    render(<GameCanvas session={probe.session} active />);
    const canvas = requireCanvas();

    expect(canvas.getAttribute('aria-label')).toBe(ARIA_LABEL);
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.style.touchAction).toBe('none');

    for (const status of ['loading', 'ready', 'error', 'loading'] as const) {
      act(() => {
        probe.setStatus(status);
      });
      expect(document.querySelector('canvas')).toBe(canvas);
      expect(document.querySelectorAll('canvas')).toHaveLength(1);
    }
  });

  it('treats a session without the optional runtime store as ready', () => {
    const attach = vi.fn<(canvas: CanvasLike) => void>();
    const session: GameSession = {
      attach,
      dispose: () => {},
      getSnapshot: () => {
        throw new Error('GameCanvas must not read the engine snapshot during render');
      },
      subscribe: () => () => {},
      setPointerTarget: () => {},
    };

    render(<GameCanvas session={session} active />);

    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith(requireCanvas());
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
