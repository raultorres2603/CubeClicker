import { describe, expect, it } from 'vitest';

import {
  createShipTrail,
  shipBankRad,
  shipEquipPulseScale,
  shipFollowFactor,
  shipIdleOffsetY,
  shipPitchRad,
  shipRollRad,
  shipVelocityPerMs,
} from './ship-motion';

describe('shipFollowFactor (AC-42)', () => {
  it('is exactly 0 at dt = 0 and uses the accepted 240 ms tau', () => {
    expect(shipFollowFactor(0)).toBe(0);
    expect(shipFollowFactor(120)).toBe(1 - Math.exp(-0.5));
    expect(shipFollowFactor(240)).toBe(1 - Math.exp(-1));
  });

  it('treats a non-positive delta as rest and reduced motion as a snap', () => {
    expect(shipFollowFactor(-40)).toBe(0);
    expect(shipFollowFactor(0, true)).toBe(1);
    expect(shipFollowFactor(240, true)).toBe(1);
  });
});

describe('shipVelocityPerMs (AC-42)', () => {
  it('divides the pointer delta by the frame delta', () => {
    expect(shipVelocityPerMs(10, 100)).toBe(0.1);
    expect(shipVelocityPerMs(-10, 50)).toBe(-0.2);
  });

  it('returns exactly 0 for a zero, negative or non-numeric frame delta', () => {
    expect(shipVelocityPerMs(10, 0)).toBe(0);
    expect(shipVelocityPerMs(10, -5)).toBe(0);
    expect(shipVelocityPerMs(10, Number.NaN)).toBe(0);
  });
});

describe('shipBankRad (AC-42)', () => {
  it('applies rotation.z = -vx * 2.4 with the 0.28 rad clamp', () => {
    expect(shipBankRad(0)).toBe(0);
    expect(shipBankRad(0.0625)).toBe(-0.15);
    expect(shipBankRad(-0.0625)).toBe(0.15);
    expect(shipBankRad(1)).toBe(-0.28);
    expect(shipBankRad(-1)).toBe(0.28);
  });

  it('is exactly 0 under reduced motion', () => {
    expect(shipBankRad(1, true)).toBe(0);
  });
});

describe('shipPitchRad (AC-42)', () => {
  it('applies rotation.x = -vy * 1.6 with the 0.18 rad clamp', () => {
    expect(shipPitchRad(0)).toBe(0);
    expect(shipPitchRad(0.0625)).toBe(-0.1);
    expect(shipPitchRad(-0.0625)).toBe(0.1);
    expect(shipPitchRad(1)).toBe(-0.18);
    expect(shipPitchRad(-1)).toBe(0.18);
  });

  it('is exactly 0 under reduced motion', () => {
    expect(shipPitchRad(1, true)).toBe(0);
  });
});

describe('rest and zero-delta poses (AC-42)', () => {
  it('yields exact zero bank/pitch when the frame delta is 0', () => {
    expect(shipBankRad(shipVelocityPerMs(5, 0))).toBe(0);
    expect(shipPitchRad(shipVelocityPerMs(5, 0))).toBe(0);
  });

  it('yields exact zero bank/pitch for a rest pointer', () => {
    expect(shipBankRad(shipVelocityPerMs(0, 16))).toBe(0);
    expect(shipPitchRad(shipVelocityPerMs(0, 16))).toBe(0);
  });
});

describe('shipIdleOffsetY (AC-42)', () => {
  it('bobs 0.015 world units on the 2600 ms period', () => {
    expect(shipIdleOffsetY(0)).toBe(0);
    expect(shipIdleOffsetY(650)).toBe(0.015);
    expect(shipIdleOffsetY(1950)).toBe(-0.015);
    expect(shipIdleOffsetY(3250)).toBe(0.015);
  });

  it('is exactly 0 under reduced motion', () => {
    expect(shipIdleOffsetY(650, true)).toBe(0);
  });
});

describe('shipEquipPulseScale (AC-42)', () => {
  it('pulses 1 -> 1.04 -> 1 over 260 ms', () => {
    expect(shipEquipPulseScale(0)).toBe(1);
    expect(shipEquipPulseScale(130)).toBe(1.04);
    expect(shipEquipPulseScale(260)).toBe(1);
    expect(shipEquipPulseScale(900)).toBe(1);
    expect(shipEquipPulseScale(-10)).toBe(1);
  });

  it('stays at scale 1 under reduced motion', () => {
    expect(shipEquipPulseScale(130, true)).toBe(1);
  });
});

describe('shipRollRad (AC-42, AC-40)', () => {
  it('turns a full 360 degrees over 700 ms with easeInOutCubic', () => {
    expect(shipRollRad(0)).toBe(0);
    expect(shipRollRad(175)).toBe(Math.PI / 8);
    expect(shipRollRad(350)).toBe(Math.PI);
    expect(shipRollRad(700)).toBe(2 * Math.PI);
  });

  it('clamps before the start and after the end of the roll', () => {
    expect(shipRollRad(-10)).toBe(0);
    expect(shipRollRad(900)).toBe(2 * Math.PI);
  });

  it('is exactly 0 under reduced motion', () => {
    expect(shipRollRad(350, true)).toBe(0);
  });
});

describe('createShipTrail (AC-42)', () => {
  it('starts empty with the pinned 8-point capacity', () => {
    const trail = createShipTrail();
    expect(trail.capacity).toBe(8);
    expect(trail.length).toBe(0);
    expect(trail.points).toEqual([]);
  });

  it('stores points oldest-first with their timestamps', () => {
    const trail = createShipTrail();
    trail.push(1, 2, 3, 0);
    trail.push(4, 5, 6, 50);
    trail.push(7, 8, 9, 100);
    expect(trail.length).toBe(3);
    expect(trail.points).toEqual([
      { x: 1, y: 2, z: 3, atMs: 0 },
      { x: 4, y: 5, z: 6, atMs: 50 },
      { x: 7, y: 8, z: 9, atMs: 100 },
    ]);
  });

  it('recycles the oldest point once the ring is full', () => {
    const trail = createShipTrail();
    for (let index = 0; index < 10; index += 1) {
      trail.push(index, 0, 0, 0);
    }
    expect(trail.length).toBe(8);
    expect(trail.points.map((point) => point.x)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    trail.push(10, 1, 2, 100);
    expect(trail.points.map((point) => point.x)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(trail.points[7]).toEqual({ x: 10, y: 1, z: 2, atMs: 100 });
  });

  it('expires points at exactly the 220 ms lifetime', () => {
    const trail = createShipTrail();
    trail.push(1, 0, 0, 0);
    trail.prune(219);
    expect(trail.length).toBe(1);
    trail.prune(220);
    expect(trail.length).toBe(0);
    expect(trail.points).toEqual([]);
  });

  it('drops expired points when the next point is pushed', () => {
    const trail = createShipTrail();
    trail.push(1, 0, 0, 0);
    trail.push(2, 0, 0, 220);
    expect(trail.points).toEqual([{ x: 2, y: 0, z: 0, atMs: 220 }]);
  });

  it('stores no points under reduced motion', () => {
    const trail = createShipTrail();
    trail.push(1, 2, 3, 0, true);
    expect(trail.length).toBe(0);
    expect(trail.points).toEqual([]);
  });

  it('clears every stored point', () => {
    const trail = createShipTrail();
    trail.push(1, 0, 0, 0);
    trail.push(2, 0, 0, 10);
    trail.clear();
    expect(trail.length).toBe(0);
    expect(trail.points).toEqual([]);
  });
});
