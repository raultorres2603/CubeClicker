import { describe, expect, it } from 'vitest';

import { createSpectateController } from './spectate';

/** A member cube at ring slot 2 of an X = 10 server. */
const P2_POSITION = { x: 30.902172888029035, y: 22.45174281092734 };

/** The own cube at ring slot 1 of an X = 10 server. */
const OWN_POSITION = { x: 38.197186342054884, y: 0 };

/** A third member cube, used to prove a second selection is ignored mid-flight. */
const P3_POSITION = { x: 11.803579717001593, y: 36.32768297475154 };

describe('createSpectateController', () => {
  it('starts at none', () => {
    expect(createSpectateController().get()).toEqual({ mode: 'none' });
  });
});

describe('requestTravel / arrive', () => {
  it('starts a member flight with the server-assigned destination', () => {
    const spectate = createSpectateController();

    expect(spectate.requestTravel('p2', P2_POSITION)).toBe(true);
    expect(spectate.get()).toEqual({
      mode: 'traveling',
      target: 'p2',
      destination: P2_POSITION,
    });
  });

  it('ignores a second selection while a travel is in flight (AC-17)', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    const traveling = spectate.get();

    expect(spectate.requestTravel('p3', P3_POSITION)).toBe(false);
    expect(spectate.get()).toBe(traveling);
  });

  it('enters viewing when the member flight lands', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);

    spectate.arrive();

    expect(spectate.get()).toEqual({ mode: 'viewing', target: 'p2' });
  });

  it('is a no-op when arrive is called at rest', () => {
    const spectate = createSpectateController();
    const resting = spectate.get();

    spectate.arrive();

    expect(spectate.get()).toBe(resting);
  });

  it('is a no-op when arrive is called while already viewing', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();
    const viewing = spectate.get();

    spectate.arrive();

    expect(spectate.get()).toBe(viewing);
  });

  it('allows switching to another member while viewing', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();

    expect(spectate.requestTravel('p3', P3_POSITION)).toBe(true);
    expect(spectate.get()).toEqual({
      mode: 'traveling',
      target: 'p3',
      destination: P3_POSITION,
    });
  });
});

describe('requestReturn / arrivedHome', () => {
  it('starts the flight home only while viewing', () => {
    const spectate = createSpectateController();

    expect(spectate.requestReturn(OWN_POSITION)).toBe(false);
    expect(spectate.get()).toEqual({ mode: 'none' });
  });

  it('refuses a return while the member flight is in flight (one travel at a time)', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    const traveling = spectate.get();

    expect(spectate.requestReturn(OWN_POSITION)).toBe(false);
    expect(spectate.get()).toBe(traveling);
  });

  it('flies home from viewing with the own position as the destination', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();

    expect(spectate.requestReturn(OWN_POSITION)).toBe(true);
    expect(spectate.get()).toEqual({ mode: 'returning', destination: OWN_POSITION });
  });

  it('refuses a member travel while flying home (one travel at a time)', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();
    spectate.requestReturn(OWN_POSITION);
    const returning = spectate.get();

    expect(spectate.requestTravel('p3', P3_POSITION)).toBe(false);
    expect(spectate.get()).toBe(returning);
  });

  it('refuses a second return while already flying home', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();
    spectate.requestReturn(OWN_POSITION);
    const returning = spectate.get();

    expect(spectate.requestReturn(OWN_POSITION)).toBe(false);
    expect(spectate.get()).toBe(returning);
  });

  it('ends at none when the return flight lands', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();
    spectate.requestReturn(OWN_POSITION);

    spectate.arrive();

    expect(spectate.get()).toEqual({ mode: 'none' });
  });

  it('arrivedHome forces none from any mode and is idempotent', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();

    spectate.arrivedHome();
    expect(spectate.get()).toEqual({ mode: 'none' });

    const resting = spectate.get();
    spectate.arrivedHome();
    expect(spectate.get()).toBe(resting);
  });
});

describe('onMemberLeft (AC-19 a/b)', () => {
  it('reports an auto-return and drops to none when the viewed member leaves', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();

    expect(spectate.onMemberLeft('p2')).toBe(true);
    expect(spectate.get()).toEqual({ mode: 'none' });
  });

  it('reports an auto-return when the travelled member leaves mid-flight', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);

    expect(spectate.onMemberLeft('p2')).toBe(true);
    expect(spectate.get()).toEqual({ mode: 'none' });
  });

  it('ignores the departure of any other member', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();
    const viewing = spectate.get();

    expect(spectate.onMemberLeft('p3')).toBe(false);
    expect(spectate.get()).toBe(viewing);
  });

  it('ignores a departure while at rest', () => {
    const spectate = createSpectateController();
    const resting = spectate.get();

    expect(spectate.onMemberLeft('p2')).toBe(false);
    expect(spectate.get()).toBe(resting);
  });

  it('ignores a departure while flying home', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();
    spectate.requestReturn(OWN_POSITION);
    const returning = spectate.get();

    expect(spectate.onMemberLeft('p2')).toBe(false);
    expect(spectate.get()).toBe(returning);
  });
});

describe('reset (AC-19 d)', () => {
  it('clears a member flight', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);

    spectate.reset();

    expect(spectate.get()).toEqual({ mode: 'none' });
  });

  it('clears a viewing state', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();

    spectate.reset();

    expect(spectate.get()).toEqual({ mode: 'none' });
  });

  it('clears a return flight', () => {
    const spectate = createSpectateController();
    spectate.requestTravel('p2', P2_POSITION);
    spectate.arrive();
    spectate.requestReturn(OWN_POSITION);

    spectate.reset();

    expect(spectate.get()).toEqual({ mode: 'none' });
  });

  it('is idempotent at rest', () => {
    const spectate = createSpectateController();
    const resting = spectate.get();

    spectate.reset();

    expect(spectate.get()).toBe(resting);
  });
});
