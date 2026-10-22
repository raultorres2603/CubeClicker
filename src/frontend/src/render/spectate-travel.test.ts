import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';

import {
  travelCameraPose,
  type FlightEndpoint,
  type SpectateTravelPose,
} from './spectate-travel';

/** One pinned pose-table row: every component is an exact literal (no tolerance). */
interface PoseRow {
  readonly progress: number;
  readonly position: [number, number, number];
  readonly lookTarget: [number, number, number];
}

/** A flight and its pinned rows. */
interface FlightCase {
  readonly origin: FlightEndpoint;
  readonly destination: FlightEndpoint;
  readonly rows: readonly PoseRow[];
}

/**
 * Pinned table for the axis-aligned flight `(0, 0, 12)` → `(24, 0, 12)` (spec AC-17):
 * lateral `easeInOutQuad(p) · 24`, depth `12 + 78 · travelSwing(p)`, target the lateral
 * point at `z = 0`. `0.75` is added to the task's `{0, 0.25, 0.5, 1}` rows so the
 * descending half of `travelSwing` is pinned too (the accepted directional table has the
 * same row).
 */
const HORIZONTAL_FLIGHT: FlightCase = {
  origin: { x: 0, y: 0, z: 12 },
  destination: { x: 24, y: 0, z: 12 },
  rows: [
    { progress: 0, position: [0, 0, 12], lookTarget: [0, 0, 0] },
    { progress: 0.25, position: [3, 0, 51], lookTarget: [3, 0, 0] },
    { progress: 0.5, position: [12, 0, 90], lookTarget: [12, 0, 0] },
    { progress: 0.75, position: [21, 0, 51], lookTarget: [21, 0, 0] },
    { progress: 1, position: [24, 0, 12], lookTarget: [24, 0, 0] },
  ],
};

/**
 * Pinned table for the non-axis-aligned flight `(24, 0, 12)` → `(0, 24, 12)`: lateral
 * `(24 − 24·easeInOutQuad(p), 24·easeInOutQuad(p))`, depth `12 + 78 · travelSwing(p)`,
 * target at `z = 0`. Every value is dyadic-exact (ease `0, 0.125, 0.5, 0.875, 1`).
 */
const DIAGONAL_FLIGHT: FlightCase = {
  origin: { x: 24, y: 0, z: 12 },
  destination: { x: 0, y: 24, z: 12 },
  rows: [
    { progress: 0, position: [24, 0, 12], lookTarget: [24, 0, 0] },
    { progress: 0.25, position: [21, 3, 51], lookTarget: [21, 3, 0] },
    { progress: 0.5, position: [12, 12, 90], lookTarget: [12, 12, 0] },
    { progress: 0.75, position: [3, 21, 51], lookTarget: [3, 21, 0] },
    { progress: 1, position: [0, 24, 12], lookTarget: [0, 24, 0] },
  ],
};

const FLIGHTS: readonly FlightCase[] = [HORIZONTAL_FLIGHT, DIAGONAL_FLIGHT];

/** Projects a pose onto the exactly-comparable tuple shape used by the tables. */
function triple(pose: SpectateTravelPose): {
  position: [number, number, number];
  lookTarget: [number, number, number];
} {
  return {
    position: [pose.position.x, pose.position.y, pose.position.z],
    lookTarget: [pose.lookTarget.x, pose.lookTarget.y, pose.lookTarget.z],
  };
}

describe('travelCameraPose — pinned pose tables (AC-17)', () => {
  it('flies (0, 0, 12) → (24, 0, 12) through the pinned rows', () => {
    for (const row of HORIZONTAL_FLIGHT.rows) {
      const pose = travelCameraPose(
        HORIZONTAL_FLIGHT.origin,
        HORIZONTAL_FLIGHT.destination,
        row.progress,
      );

      expect(triple(pose)).toEqual({ position: row.position, lookTarget: row.lookTarget });
    }
  });

  it('flies the non-axis-aligned (24, 0, 12) → (0, 24, 12) through the pinned rows', () => {
    for (const row of DIAGONAL_FLIGHT.rows) {
      const pose = travelCameraPose(
        DIAGONAL_FLIGHT.origin,
        DIAGONAL_FLIGHT.destination,
        row.progress,
      );

      expect(triple(pose)).toEqual({ position: row.position, lookTarget: row.lookTarget });
    }
  });

  it('keeps the identity camera quaternion at every pinned row', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);

    for (const flight of FLIGHTS) {
      for (const row of flight.rows) {
        const pose = travelCameraPose(flight.origin, flight.destination, row.progress);

        camera.position.set(pose.position.x, pose.position.y, pose.position.z);
        camera.lookAt(pose.lookTarget.x, pose.lookTarget.y, pose.lookTarget.z);

        expect(camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
      }
    }
  });

  it('clamps progress to the table ends', () => {
    expect(
      triple(travelCameraPose(HORIZONTAL_FLIGHT.origin, HORIZONTAL_FLIGHT.destination, -1)),
    ).toEqual({ position: [0, 0, 12], lookTarget: [0, 0, 0] });
    expect(
      triple(travelCameraPose(HORIZONTAL_FLIGHT.origin, HORIZONTAL_FLIGHT.destination, 2)),
    ).toEqual({ position: [24, 0, 12], lookTarget: [24, 0, 0] });
  });
});

describe('travelCameraPose — degenerate and single-axis flights', () => {
  it('holds the rest pose at every progress when origin and destination coincide', () => {
    const resting = { x: 24, y: 0, z: 12 };
    const destinations = [resting, { x: 24, y: 0, z: 12 }];

    for (const destination of destinations) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        expect(triple(travelCameraPose(resting, destination, progress))).toEqual({
          position: [24, 0, 12],
          lookTarget: [24, 0, 0],
        });
      }
    }
  });

  it('matches the accepted +y table when the destination only moves in y', () => {
    const origin = { x: 0, y: 0, z: 12 };
    const destination = { x: 0, y: 24, z: 12 };

    expect(triple(travelCameraPose(origin, destination, 0.25))).toEqual({
      position: [0, 3, 51],
      lookTarget: [0, 3, 0],
    });
    expect(triple(travelCameraPose(origin, destination, 0.5))).toEqual({
      position: [0, 12, 90],
      lookTarget: [0, 12, 0],
    });
    expect(triple(travelCameraPose(origin, destination, 0.75))).toEqual({
      position: [0, 21, 51],
      lookTarget: [0, 21, 0],
    });
  });

  it('takes the rest depth from the pinned formula, not from the endpoint z', () => {
    expect(
      triple(travelCameraPose({ x: 0, y: 0, z: 30 }, { x: 24, y: 0, z: -5 }, 0)),
    ).toEqual({ position: [0, 0, 12], lookTarget: [0, 0, 0] });
    expect(
      triple(travelCameraPose({ x: 0, y: 0, z: 30 }, { x: 24, y: 0, z: -5 }, 1)),
    ).toEqual({ position: [24, 0, 12], lookTarget: [24, 0, 0] });
  });
});
