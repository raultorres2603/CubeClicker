import { describe, expect, it } from 'vitest';

import {
  SHOT_TRAVEL_MS,
  SPACESHIP_CURSOR_NDC_OFFSET_X,
  SPACESHIP_CURSOR_NDC_OFFSET_Y,
  SPACESHIP_FOLLOW_TAU_MS,
  SPACESHIP_IGNITION_COUNT,
  SPACESHIP_IGNITION_FLICKER_PERIOD_MS,
  SPACESHIP_IGNITION_MOVEMENT_THRESHOLD,
  SPACESHIP_PLANE_DISTANCE,
  SPACESHIP_SCALE,
} from './effects';

describe('spaceship/shot pinned constants', () => {
  it('pins the shot travel time', () => {
    expect(SHOT_TRAVEL_MS).toBe(180);
  });

  it('pins the follow time constant', () => {
    expect(SPACESHIP_FOLLOW_TAU_MS).toBe(240);
  });

  it('pins the plane distance', () => {
    expect(SPACESHIP_PLANE_DISTANCE).toBe(6);
  });

  it('pins the cursor NDC offsets', () => {
    expect(SPACESHIP_CURSOR_NDC_OFFSET_X).toBe(-0.16);
    expect(SPACESHIP_CURSOR_NDC_OFFSET_Y).toBe(-0.12);
  });

  it('pins the polished constants', () => {
    expect(SPACESHIP_SCALE).toBe(1.2);
    expect(SPACESHIP_IGNITION_COUNT).toBe(2);
    expect(SPACESHIP_IGNITION_MOVEMENT_THRESHOLD).toBe(0.01);
    expect(SPACESHIP_IGNITION_FLICKER_PERIOD_MS).toBe(100);
  });
});
