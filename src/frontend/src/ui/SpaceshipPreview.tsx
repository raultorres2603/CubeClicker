import type { ReactElement } from 'react';

import { useRef, useEffect } from 'react';

import { appearanceToSpaceshipParams } from '../game/parts';
import { createSpaceship } from '../render/spaceship';

export function SpaceshipPreview({
  appearance = {},
}: {
  appearance?: Record<string, string>;
}): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    appearanceToSpaceshipParams(appearance);
    const ship = createSpaceship(appearance);
    return () => {
      ship.dispose();
    };
  }, [appearance]);

  const params = appearanceToSpaceshipParams(appearance);
  return (
    <canvas
      ref={canvasRef}
      className="spaceship-preview"
      aria-label="Spaceship preview"
      data-nose-color={params.noseColor}
      data-body-color={params.bodyColor}
      data-wing-color={params.wingColor}
      data-cockpit-color={params.cockpitColor}
      data-engine-color={params.engineColor}
    />
  );
}
