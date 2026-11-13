import { buildApp } from './app.js';
import { loadAuthConfig } from './auth/config.js';
import { createPool, closePool } from './db/pool.js';
import { runStartupMigrations } from './db/migrate-runner.js';

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT ?? 8080);

// Apply pending migrations on a dedicated connection before serving traffic.
// No database configured (neither DIRECT_DATABASE_URL nor DATABASE_URL) returns
// null and keeps the in-memory repositories; a real failure aborts startup so a
// half-migrated database is never served (AC-10/AC-20).
const authConfig = loadAuthConfig(process.env);
const pool = createPool(authConfig.databaseUrl);

try {
  await runStartupMigrations(process.env);
} catch (error) {
  await closePool(pool).catch(() => undefined);
  console.error('Failed to apply database migrations; aborting startup.', error);
  process.exit(1);
}

const app = buildApp(process.env, pool !== null ? { auth: { pool } } : {});

await app.listen({ host: HOST, port: PORT });

console.log(
  `CubeClicker backend listening on http://${HOST}:${PORT} (WebSocket ws://${HOST}:${PORT}/ws)`,
);
