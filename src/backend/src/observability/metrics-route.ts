/**
 * Internal `GET /metrics` route (T3, AC-6, AC-8).
 *
 * Prometheus text on the existing backend port. The route is registered only when
 * `METRICS_ENABLED` is true; otherwise the path is a plain 404. There is no
 * authentication by design: exposure relies on the network boundary (the ALB does
 * not route `/metrics`), and `METRICS_ENABLED=false` removes the surface entirely.
 */

import type { FastifyPluginAsync } from 'fastify';
import type { Metrics } from './metrics.js';

/** Exact Prometheus text-exposition content type (AC-6). */
export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

/** Options for {@link metricsRoutes}. */
export interface MetricsRouteOptions {
  /** The process registry rendered on every scrape. */
  metrics: Metrics;
  /** Registers the route only when true (`METRICS_ENABLED`). */
  enabled: boolean;
  /**
   * Scrape-time gauge sampler (the DB pool) invoked before `render()`, so pool
   * gauges reflect the scrape rather than the last query.
   */
  collect?: () => void;
}

/** Registers `GET /metrics` when enabled; a no-op otherwise. */
export const metricsRoutes: FastifyPluginAsync<MetricsRouteOptions> = async (
  fastify,
  options,
) => {
  if (!options.enabled) {
    return;
  }

  fastify.get('/metrics', async (_request, reply) => {
    options.collect?.();
    return reply
      .header('content-type', METRICS_CONTENT_TYPE)
      .header('cache-control', 'no-store')
      .send(options.metrics.render());
  });
};
