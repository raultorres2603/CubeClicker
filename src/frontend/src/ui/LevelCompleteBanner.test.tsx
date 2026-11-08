/** @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LevelCompleteBanner } from './LevelCompleteBanner';

afterEach(() => {
  cleanup();
});

describe('LevelCompleteBanner (AC-40)', () => {
  it('renders nothing while not visible', () => {
    const { container } = render(
      <LevelCompleteBanner visible={false} levelNumber={3} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders the exact 16 gold + 8 cyan rays, 3 rings, 12 stars and 20 coins', () => {
    const { container } = render(<LevelCompleteBanner visible levelNumber={3} />);

    expect(container.querySelectorAll('[data-ray="gold"]')).toHaveLength(16);
    expect(container.querySelectorAll('[data-ray="cyan"]')).toHaveLength(8);
    expect(container.querySelectorAll('[data-ray]')).toHaveLength(24);
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-star]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-coin]')).toHaveLength(20);
    expect(container.querySelector('[data-burst-core="true"]')).not.toBeNull();
    expect(container.querySelector('[data-banner-halo="true"]')).not.toBeNull();
  });

  it('renders the LEVEL COMPLETE copy, the 1-based level number and the data flags', () => {
    const { container } = render(<LevelCompleteBanner visible levelNumber={7} />);
    const root = container.querySelector<HTMLElement>('[data-level-complete="true"]');
    const burst = container.querySelector<HTMLElement>('[data-level-burst="true"]');

    expect(root?.getAttribute('data-reduced-motion')).toBe('false');
    expect(burst?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.level-banner-title')?.textContent).toBe('LEVEL COMPLETE');
    expect(container.querySelector('.level-banner-level')?.textContent).toBe('Cube 7');
  });

  it('keeps the shell single-live-region invariant (no extra status/aria-live)', () => {
    const { container } = render(<LevelCompleteBanner visible levelNumber={2} />);

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('marks the reduced-motion variant while keeping the full DOM structure', () => {
    const { container } = render(
      <LevelCompleteBanner visible reducedMotion levelNumber={2} />,
    );

    expect(
      container.querySelector('[data-level-complete="true"]')?.getAttribute('data-reduced-motion'),
    ).toBe('true');
    expect(container.querySelectorAll('[data-ray]')).toHaveLength(24);
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-star]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-coin]')).toHaveLength(20);
    expect(container.querySelector('.level-banner-title')?.textContent).toBe('LEVEL COMPLETE');
  });

  it('spreads the gold rays evenly over the circle with exact angles', () => {
    const { container } = render(<LevelCompleteBanner visible levelNumber={1} />);
    const rays = Array.from(
      container.querySelectorAll<HTMLElement>('[data-ray="gold"]'),
    );

    expect(rays[0]?.style.getPropertyValue('--ray-angle')).toBe('0deg');
    expect(rays[1]?.style.getPropertyValue('--ray-angle')).toBe('22.5deg');
    expect(rays[15]?.style.getPropertyValue('--ray-angle')).toBe('337.5deg');
  });
});
