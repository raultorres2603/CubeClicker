import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { createMetrics } from './metrics.js';
import {
  METRICS_CONTENT_TYPE,
  metricsRoutes,
  type MetricsRouteOptions,
} from './metrics-route.js';

async function buildRouteApp(options: MetricsRouteOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(metricsRoutes, options);
  await app.ready();
  return app;
}

describe('GET /metrics', () => {
  it('renders the seeded registry as Prometheus text with no-store', async () => {
    const metrics = createMetrics();
    metrics.inc('cubeclicker_ws_connections_total', undefined, 2);
    metrics.set('cubeclicker_ws_connections_open', 3);
    metrics.observe('cubeclicker_db_query_duration_seconds', 0.012);
    const app = await buildRouteApp({ metrics, enabled: true });

    try {
      const response = await app.inject({ method: 'GET', url: '/metrics' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe(METRICS_CONTENT_TYPE);
      expect(METRICS_CONTENT_TYPE).toBe('text/plain; version=0.0.4; charset=utf-8');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toBe(metrics.render());
      expect(response.body).toContain('# HELP cubeclicker_ws_connections_open Currently attached WebSocket connections.');
      expect(response.body).toContain('cubeclicker_ws_connections_total 2');
      expect(response.body).toContain('cubeclicker_ws_connections_open 3');
      expect(response.body).toContain('cubeclicker_db_query_duration_seconds_sum 0.012');
      expect(response.body.endsWith('\n')).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('runs the scrape-time collector before rendering', async () => {
    const metrics = createMetrics();
    const app = await buildRouteApp({
      metrics,
      enabled: true,
      collect: () => {
        // The live pool counters are read at scrape time, not at registration.
        metrics.set('cubeclicker_db_pool_total', 7);
        metrics.set('cubeclicker_db_pool_idle', 4);
        metrics.set('cubeclicker_db_pool_waiting', 3);
      },
    });

    try {
      const response = await app.inject({ method: 'GET', url: '/metrics' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('cubeclicker_db_pool_total 7');
      expect(response.body).toContain('cubeclicker_db_pool_idle 4');
      expect(response.body).toContain('cubeclicker_db_pool_waiting 3');
    } finally {
      await app.close();
    }
  });

  it('is not registered when disabled (plain 404)', async () => {
    const metrics = createMetrics();
    const app = await buildRouteApp({ metrics, enabled: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/metrics' });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        message: 'Route GET:/metrics not found',
        error: 'Not Found',
        statusCode: 404,
      });
    } finally {
      await app.close();
    }
  });
});
