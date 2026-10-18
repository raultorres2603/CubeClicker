import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// This is the only Node-side file of the frontend workspace; `types: ["vite/client"]`
// (tsconfig) keeps the browser bundle's global type surface free of Node globals, so the
// single Node global read here is declared narrowly instead of pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };

/** Pinned default: the backend's published dev port (README configuration table). */
const DEFAULT_WS_URL = 'ws://localhost:8080/ws';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Admits the smoke service's container-DNS hostname (`Host: frontend`); Vite's
    // default host check would reject it with 403. Published ports stay loopback-bound.
    allowedHosts: ['frontend'],
  },
  define: {
    'import.meta.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL ?? DEFAULT_WS_URL),
  },
});
