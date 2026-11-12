import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// This is the only Node-side file of the frontend workspace; `types: ["vite/client"]`
// (tsconfig) keeps the browser bundle's global type surface free of Node globals, so the
// single Node global read here is declared narrowly instead of pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };

/** Pinned default: the backend's published dev port (README configuration table). */
const DEFAULT_WS_URL = 'ws://localhost:8080/ws';

/**
 * Split the stable vendor set out of the app chunks: `three` is a single shared
 * lazy vendor chunk (game runtime + customization preview) and `react` keeps the
 * framework bits cacheable independently. The entry must stay Three-free; the
 * budget script (`scripts/check-bundle-budget.mjs`) enforces that boundary.
 *
 * `id` is an absolute module path; normalize Windows separators before matching
 * so the same rule works on every host. Trailing slashes keep `react` from
 * swallowing `react-dom` and `three` from swallowing `three-*` packages.
 */
function manualChunks(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/');
  if (normalized.includes('/node_modules/three/')) return 'three';
  if (
    normalized.includes('/node_modules/react/') ||
    normalized.includes('/node_modules/react-dom/') ||
    normalized.includes('/node_modules/scheduler/')
  ) {
    return 'react';
  }
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  build: {
    // Emits dist/.vite/manifest.json, the chunk graph the bundle-budget gate reads.
    manifest: true,
    // Single chunks above 900 kB are a regression; keep the warning meaningful
    // after the three/react vendor split.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Admits the smoke service's container-DNS hostname (`Host: frontend`); Vite's
    // default host check would reject it with 403. Published ports stay loopback-bound.
    allowedHosts: ['frontend'],
    // The auth client uses same-origin relative paths (`/auth/*`) so the HttpOnly
    // session cookie belongs to the page origin. In the compose dev stack the backend
    // is a sibling container; proxy those requests to it (same Origin header, so the
    // backend's CSRF check still sees http://localhost:5173). Override for host-only
    // runs with BACKEND_URL=http://localhost:8080.
    proxy: {
      '/auth': {
        target: process.env.BACKEND_URL ?? 'http://backend:8080',
        changeOrigin: false,
      },
    },
  },
  define: {
    'import.meta.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL ?? DEFAULT_WS_URL),
  },
});
