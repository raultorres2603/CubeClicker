import { useEffect, useState, type ComponentType, type ReactElement } from 'react';

import type { SpaceshipCustomizationPanelProps } from './SpaceshipCustomizationPanel';

/**
 * The module shape the deferred loader resolves. The panel's props are imported as a
 * type only: a value import would pull `SpaceshipCustomizationPanel` (and with it
 * `SpaceshipPreview → render/preview → three`) back into the entry graph (AC-4).
 */
export interface SpaceshipCustomizationPanelModule {
  SpaceshipCustomizationPanel: ComponentType<SpaceshipCustomizationPanelProps>;
}

/** Test seam: production resolves the real panel chunk, tests resolve a fake one. */
export type LoadSpaceshipCustomizationPanel = () => Promise<SpaceshipCustomizationPanelModule>;

export interface DeferredSpaceshipCustomizationPanelProps
  extends SpaceshipCustomizationPanelProps {
  /**
   * The chunk loader. Defined as a module-scope default so the effect dependency is
   * stable across renders; tests inject their own deferred/rejected loader.
   */
  loadPanel?: LoadSpaceshipCustomizationPanel;
}

/** The production loader: the only static reference to the panel's dynamic chunk. */
const loadSpaceshipCustomizationPanel: LoadSpaceshipCustomizationPanel = () =>
  import('./SpaceshipCustomizationPanel');

/**
 * The customization panel behind a dynamic import (AC-4).
 *
 * `App` renders this wrapper only while customization is open, so a closed panel never
 * requests the chunk. The wrapper owns the whole asynchronous lifecycle: a pending import
 * renders the pinned `Loading customization…` status, a rejection renders the pinned
 * `Customization could not be loaded.` alert with a retry that re-runs the loader, and a
 * resolved import renders the existing panel with the forwarded props unchanged.
 *
 * The resolved component is stored through the updater form
 * (`setComponent(() => module.SpaceshipCustomizationPanel)`) so React never invokes the
 * component as an updater function.
 */
export function DeferredSpaceshipCustomizationPanel({
  loadPanel = loadSpaceshipCustomizationPanel,
  ...panelProps
}: DeferredSpaceshipCustomizationPanelProps): ReactElement {
  const [Component, setComponent] = useState<ComponentType<SpaceshipCustomizationPanelProps> | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // A retry re-enters the loading state before the second import settles.
    setFailed(false);
    void loadPanel().then(
      (module) => {
        if (cancelled) {
          return;
        }
        setComponent(() => module.SpaceshipCustomizationPanel);
      },
      () => {
        if (cancelled) {
          return;
        }
        setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loadPanel, attempt]);

  if (Component !== null) {
    return <Component {...panelProps} />;
  }

  if (failed) {
    return (
      <div className="customization-panel-error" role="alert">
        Customization could not be loaded.{' '}
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <p className="customization-panel-status" role="status">
      Loading customization…
    </p>
  );
}
