import { buildApp } from './app.js';
import { loadAuthConfig } from './auth/config.js';
import { createPool, closePool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT ?? 8080);

// Run pending migrations against the configured database before serving traffic.
// A failure aborts startup so a half-migrated database is never served (AC-30).
const authConfig = loadAuthConfig(process.env);
const pool = createPool(authConfig.databaseUrl);

if (pool !== null) {
  try {
    await runMigrations(pool);
  } catch (error) {
    await closePool(pool).catch(() => undefined);
    console.error('Failed to apply database migrations; aborting startup.', error);
    process.exit(1);
  }
}

const app = buildApp(process.env, pool !== null ? { auth: { pool } } : {});

await app.listen({ host: HOST, port: PORT });

console.log(
  `CubeClicker backend listening on http://${HOST}:${PORT} (WebSocket ws://${HOST}:${PORT}/ws)`,
);