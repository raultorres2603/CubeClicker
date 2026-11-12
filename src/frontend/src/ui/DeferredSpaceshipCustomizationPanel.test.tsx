/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DeferredSpaceshipCustomizationPanel,
  type LoadSpaceshipCustomizationPanel,
  type SpaceshipCustomizationPanelModule,
} from './DeferredSpaceshipCustomizationPanel';
import type { SpaceshipCustomizationPanelProps } from './SpaceshipCustomizationPanel';

/**
 * Integration test for the deferred customization preview (AC-4): a fake panel module
 * behind the injected loader proves the whole async lifecycle (loading, resolved,
 * rejected, retry) and that the chunk is only requested when the wrapper mounts — the
 * shape `App` uses while the customization toggle is closed.
 */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function FakePanel(props: SpaceshipCustomizationPanelProps): ReactElement {
  return (
    <section className="customization-panel" data-mode={props.mode ?? 'guest'}>
      <p>Fake customization panel</p>
      <button type="button" onClick={props.onOpenLootbox}>
        Open lootbox
      </button>
    </section>
  );
}

/** The App-shaped mount gate: the wrapper exists only while customization is open. */
function ClosedByDefault({
  loadPanel,
}: {
  loadPanel: LoadSpaceshipCustomizationPanel;
}): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open customization
      </button>
      {open ? <DeferredSpaceshipCustomizationPanel loadPanel={loadPanel} /> : null}
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe('DeferredSpaceshipCustomizationPanel (AC-4)', () => {
  it('renders the resolved panel and forwards the existing props', async () => {
    const onOpenLootbox = vi.fn();
    const loadPanel = vi.fn<LoadSpaceshipCustomizationPanel>().mockResolvedValue({
      SpaceshipCustomizationPanel: FakePanel,
    });

    render(
      <DeferredSpaceshipCustomizationPanel
        loadPanel={loadPanel}
        mode="account"
        onOpenLootbox={onOpenLootbox}
      />,
    );

    expect(loadPanel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toBe('Loading customization…');

    const text = await screen.findByText('Fake customization panel');
    const panel = text.closest('section');
    expect(panel?.className).toBe('customization-panel');
    expect(panel?.getAttribute('data-mode')).toBe('account');
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open lootbox' }));
    expect(onOpenLootbox).toHaveBeenCalledTimes(1);
  });

  it('shows the pinned loading status until the panel import resolves', async () => {
    const pending = deferred<SpaceshipCustomizationPanelModule>();
    const loadPanel = vi.fn<LoadSpaceshipCustomizationPanel>().mockReturnValue(pending.promise);

    render(<DeferredSpaceshipCustomizationPanel loadPanel={loadPanel} />);

    const status = screen.getByRole('status');
    expect(status.tagName).toBe('P');
    expect(status.className).toBe('customization-panel-status');
    expect(status.textContent).toBe('Loading customization…');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(0);

    await act(async () => {
      pending.resolve({ SpaceshipCustomizationPanel: FakePanel });
      await pending.promise;
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Fake customization panel').tagName).toBe('P');
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(1);
  });

  it('shows the pinned alert when the import rejects', async () => {
    const loadPanel = vi
      .fn<LoadSpaceshipCustomizationPanel>()
      .mockRejectedValue(new Error('chunk load failed'));

    render(<DeferredSpaceshipCustomizationPanel loadPanel={loadPanel} />);

    const alert = await screen.findByRole('alert');
    expect(alert.tagName).toBe('DIV');
    expect(alert.className).toBe('customization-panel-error');
    expect(alert.textContent).toBe('Customization could not be loaded. Try again');
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(0);
    expect(loadPanel).toHaveBeenCalledTimes(1);
  });

  it('re-runs the loader on Try again and renders the panel when the retry resolves', async () => {
    const retry = deferred<SpaceshipCustomizationPanelModule>();
    const loadPanel = vi
      .fn<LoadSpaceshipCustomizationPanel>()
      .mockRejectedValueOnce(new Error('chunk load failed'))
      .mockReturnValueOnce(retry.promise);

    render(<DeferredSpaceshipCustomizationPanel loadPanel={loadPanel} />);

    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(loadPanel).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Loading customization…');

    await act(async () => {
      retry.resolve({ SpaceshipCustomizationPanel: FakePanel });
      await retry.promise;
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Fake customization panel').tagName).toBe('P');
    expect(loadPanel).toHaveBeenCalledTimes(2);
  });

  it('never calls loadPanel while the customization toggle is closed', async () => {
    const loadPanel = vi.fn<LoadSpaceshipCustomizationPanel>().mockResolvedValue({
      SpaceshipCustomizationPanel: FakePanel,
    });

    render(<ClosedByDefault loadPanel={loadPanel} />);

    expect(loadPanel).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelectorAll('.customization-panel')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Open customization' }));

    expect(loadPanel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toBe('Loading customization…');

    const text = await screen.findByText('Fake customization panel');
    expect(text.closest('section')?.className).toBe('customization-panel');
  });
});
