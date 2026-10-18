import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';

/**
 * Integration test for the app shell: `App` composed with the real `createConnection`
 * module through its public surface. `react-dom/server` needs no DOM environment and no
 * extra dependency, so this runs in the workspace's node test environment.
 *
 * Honest scope: SSR executes the render path only — `useEffect` never runs, so the effect
 * callback and its cleanup (`App.tsx:17-23`) stay uncovered here (accepted residual, spec
 * § Testing strategy / plan contract 4.A), not papered over.
 */
describe('App', () => {
  it('renders the CubeClicker shell in the initial `connecting` state', () => {
    const html = renderToStaticMarkup(<App />);

    // Full static markup pinned: heading text, status hook and its exact label.
    expect(html).toBe(
      '<main><h1>CubeClicker</h1><p>Backend connection: <span data-status="connecting">Connecting…</span></p></main>',
    );
  });
});
