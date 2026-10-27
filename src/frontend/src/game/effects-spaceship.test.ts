import { describe, expect, it } from 'vitest';

import {
  SHOT_TRAVEL_MS,
  SPACESHIP_CURSOR_NDC_OFFSET_X,
  SPACESHIP_CURSOR_NDC_OFFSET_Y,
  SPACESHIP_FOLLOW_TAU_MS,
  SPACESHIP_PLANE_DISTANCE,
} from './effects';

describe('spaceship/shot pinned constants', () => {
  it('pins the shot travel time', () => {
    expect(SHOT_TRAVEL_MS).toBe(180);
  });

  it('pins the follow time constant', () => {
    expect(SPACESHIP_FOLLOW_TAU_MS).toBe(120);
  });

  it('pins the plane distance', () => {
    expect(SPACESHIP_PLANE_DISTANCE).toBe(6);
  });

  it('pins the cursor NDC offsets', () => {
    expect(SPACESHIP_CURSOR_NDC_OFFSET_X).toBe(-0.05);
    expect(SPACESHIP_CURSOR_NDC_OFFSET_Y).toBe(-0.08);
  });
});