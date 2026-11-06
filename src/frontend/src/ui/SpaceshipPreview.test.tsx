import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

import { SpaceshipPreview } from './SpaceshipPreview';

describe('SpaceshipPreview (SSR contract)', () => {
  it('renders a canvas element', () => {
    const html = renderToString(<SpaceshipPreview appearance={{}} />);
    expect(html).toContain('<canvas');
  });

  it('applies the spaceship-preview class', () => {
    const html = renderToString(<SpaceshipPreview appearance={{}} />);
    expect(html).toContain('spaceship-preview');
  });

  it('renders aria-label "Spaceship preview"', () => {
    const html = renderToString(<SpaceshipPreview appearance={{}} />);
    expect(html).toContain('aria-label="Spaceship preview"');
  });

  it('derives default color data attributes', () => {
    const html = renderToString(<SpaceshipPreview appearance={{}} />);
    expect(html).toContain('data-nose-color="#88aaff"');
    expect(html).toContain('data-body-color="#4466cc"');
    expect(html).toContain('data-engine-color="#ff6600"');
  });

  it('reflects an equipped part color', () => {
    const html = renderToString(<SpaceshipPreview appearance={{ nose: 'nose-crimson' }} />);
    expect(html).toContain('data-nose-color="#cc4444"');
  });
});
