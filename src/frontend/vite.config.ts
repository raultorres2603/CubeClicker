import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { resolveFrontendConfig } from './src/config';

// This is the only Node-side file of the frontend workspace; `types: ["vite/client"]`
// (tsconfig) keeps the browser bundle's global type surface free of Node globals, so the
// single Node global read here is declared narrowly instead of pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };

/**
 * The per-environment runtime config bridged into the bundle by `define`. The values are
 * baked at build time (Vite's model): local/Docker builds leave the API base empty and the
 * WS URL unset, so the app resolves its same-origin defaults; the Vercel build sets
 * `VITE_CLOUD_DEPLOY=true` plus the absolute `VITE_API_URL` (and optionally `VITE_WS_URL`).
 */
const runtimeEnv = {
  VITE_API_URL: process.env.VITE_API_URL ?? '',
  VITE_WS_URL: process.env.VITE_WS_URL ?? '',
  VITE_CLOUD_DEPLOY: process.env.VITE_CLOUD_DEPLOY ?? 'false',
};

// Cloud builds must fail before `vite build` when the resolved config would produce a
// mixed-content API or WebSocket URL (missing/relative API, explicit ws:// socket). The
// check runs on the *resolved* config, so an API-only cloud build is valid.
if (runtimeEnv.VITE_CLOUD_DEPLOY === 'true') {
  resolveFrontendConfig(runtimeEnv, { cloud: true });
}

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
    'import.meta.env.VITE_API_URL': JSON.stringify(runtimeEnv.VITE_API_URL),
    'import.meta.env.VITE_WS_URL': JSON.stringify(runtimeEnv.VITE_WS_URL),
    'import.meta.env.VITE_CLOUD_DEPLOY': JSON.stringify(runtimeEnv.VITE_CLOUD_DEPLOY),
  },
});
