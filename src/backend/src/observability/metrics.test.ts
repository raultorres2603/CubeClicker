import { describe, expect, it } from 'vitest';

import {
  METRIC_DEFINITIONS,
  Metrics,
  createMetrics,
  escapeLabelValue,
  type MetricName,
} from './metrics.js';

const EXPECTED_METRICS = [
  'cubeclicker_db_pool_idle',
  'cubeclicker_db_pool_total',
  'cubeclicker_db_pool_waiting',
  'cubeclicker_db_queries_total',
  'cubeclicker_db_query_duration_seconds',
  'cubeclicker_economy_flushes_total',
  'cubeclicker_economy_pending_accounts',
  'cubeclicker_economy_revision_rejections_total',
  'cubeclicker_members_active',
  'cubeclicker_rate_limit_drops_total',
  'cubeclicker_removal_batch_pending_groups',
  'cubeclicker_removal_batch_size',
  'cubeclicker_removal_flushes_total',
  'cubeclicker_removal_ids_total',
  'cubeclicker_server_capacity',
  'cubeclicker_servers_active',
  'cubeclicker_shutdown_total',
  'cubeclicker_upgrade_revision_rejections_total',
  'cubeclicker_ws_broadcast_fanout',
  'cubeclicker_ws_broadcasts_total',
  'cubeclicker_ws_connection_duration_seconds',
  'cubeclicker_ws_connections_capacity',
  'cubeclicker_ws_connections_closed_total',
  'cubeclicker_ws_connections_open',
  'cubeclicker_ws_connections_rejected_total',
  'cubeclicker_ws_connections_total',
  'cubeclicker_ws_frames_sent_total',
  'cubeclicker_ws_heartbeat_timeouts_total',
  'cubeclicker_ws_messages_encoded_total',
  'cubeclicker_ws_messages_received_total',
];

function metricBlock(rendered: string, name: string): string {
  const start = rendered.indexOf(`# HELP ${name} `);
  if (start === -1) {
    throw new Error(`metric block not found: ${name}`);
  }
  const next = rendered.indexOf('\n# HELP ', start);
  const end = next === -1 ? rendered.length : next + 1;
  return rendered.slice(start, end);
}

describe('metrics catalog', () => {
  it('pins exactly the 30 catalog metric names', () => {
    const names = Object.keys(METRIC_DEFINITIONS).sort();
    expect(names).toEqual(EXPECTED_METRICS);
    expect(names).toHaveLength(30);
  });

  it('only declares the bounded catalog label names', () => {
    const labelNames = new Set<string>();
    for (const definition of Object.values(METRIC_DEFINITIONS)) {
      for (const labelName of Object.keys(definition.labels ?? {})) {
        labelNames.add(labelName);
      }
    }
    expect([...labelNames].sort()).toEqual([
      'reason',
      'result',
      'scope',
      'signal',
      'type',
    ]);
    expect(labelNames.has('le')).toBe(false);
  });

  it('pins every label allow-list', () => {
    expect(METRIC_DEFINITIONS.cubeclicker_ws_connections_closed_total.labels).toEqual({
      reason: ['client', 'heartbeat', 'error', 'server'],
    });
    expect(METRIC_DEFINITIONS.cubeclicker_ws_connections_rejected_total.labels).toEqual({
      reason: ['capacity'],
    });
    expect(METRIC_DEFINITIONS.cubeclicker_ws_messages_received_total.labels).toEqual({
      type: [
        'join',
        'rejoin',
        'explode',
        'cubeCompleted',
        'rotate',
        'purchaseUpgrade',
        'openLootbox',
        'equipPart',
        'unequipPart',
        'ping',
        'leave',
        'invalid',
        'oversized',
      ],
    });
    expect(METRIC_DEFINITIONS.cubeclicker_ws_messages_encoded_total.labels).toEqual({
      type: [
        'hello',
        'welcome',
        'worldEntered',
        'memberJoined',
        'memberLeft',
        'cubeRotated',
        'miniCubeRemoved',
        'miniCubesRemoved',
        'levelAdvanced',
        'stateSync',
        'economyUpdate',
        'upgradesUpdate',
        'customizationUpdate',
        'lootboxOpened',
        'activityEvent',
        'leaderboardUpdate',
        'error',
        'pong',
      ],
    });
    expect(METRIC_DEFINITIONS.cubeclicker_ws_frames_sent_total.labels).toEqual({
      type: [
        'hello',
        'welcome',
        'worldEntered',
        'memberJoined',
        'memberLeft',
        'cubeRotated',
        'miniCubeRemoved',
        'miniCubesRemoved',
        'levelAdvanced',
        'stateSync',
        'economyUpdate',
        'upgradesUpdate',
        'customizationUpdate',
        'lootboxOpened',
        'activityEvent',
        'leaderboardUpdate',
        'error',
        'pong',
      ],
    });
    expect(METRIC_DEFINITIONS.cubeclicker_rate_limit_drops_total.labels).toEqual({
      scope: ['explode', 'rotate', 'ping', 'http'],
    });
    expect(METRIC_DEFINITIONS.cubeclicker_db_queries_total.labels).toEqual({
      result: ['ok', 'error'],
    });
    expect(METRIC_DEFINITIONS.cubeclicker_shutdown_total.labels).toEqual({
      signal: ['SIGTERM', 'SIGINT'],
    });
  });

  it('pins the histogram bucket boundaries', () => {
    expect(METRIC_DEFINITIONS.cubeclicker_ws_broadcast_fanout.buckets).toEqual([
      1, 2, 5, 10, 25, 50, 100, 200,
    ]);
    expect(METRIC_DEFINITIONS.cubeclicker_ws_connection_duration_seconds.buckets).toEqual([
      1, 5, 15, 30, 60, 120, 300, 600, 1800, 3600,
    ]);
    expect(METRIC_DEFINITIONS.cubeclicker_removal_batch_size.buckets).toEqual([
      1, 2, 5, 10, 20, 30,
    ]);
    expect(METRIC_DEFINITIONS.cubeclicker_db_query_duration_seconds.buckets).toEqual([
      0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
    ]);
  });
});

describe('escapeLabelValue', () => {
  it('escapes a backslash before a double quote', () => {
    expect(escapeLabelValue('a"b\\c')).toBe('a\\"b\\\\c');
  });

  it('escapes a newline', () => {
    expect(escapeLabelValue('line\nbreak')).toBe('line\\nbreak');
  });

  it('escapes a trailing backslash', () => {
    expect(escapeLabelValue('back\\slash')).toBe('back\\\\slash');
  });

  it('leaves a plain value unchanged', () => {
    expect(escapeLabelValue('client')).toBe('client');
  });
});

describe('metrics registry', () => {
  it('renders a fresh registry with zero-valued samples', () => {
    expect(createMetrics().render()).toBe(
      `# HELP cubeclicker_db_pool_idle Postgres pool idle connections at scrape.
# TYPE cubeclicker_db_pool_idle gauge
cubeclicker_db_pool_idle 0
# HELP cubeclicker_db_pool_total Postgres pool total connections at scrape.
# TYPE cubeclicker_db_pool_total gauge
cubeclicker_db_pool_total 0
# HELP cubeclicker_db_pool_waiting Postgres pool waiting requests at scrape.
# TYPE cubeclicker_db_pool_waiting gauge
cubeclicker_db_pool_waiting 0
# HELP cubeclicker_db_queries_total Runtime pool queries, by outcome.
# TYPE cubeclicker_db_queries_total counter
# HELP cubeclicker_db_query_duration_seconds Runtime pool query duration in seconds.
# TYPE cubeclicker_db_query_duration_seconds histogram
cubeclicker_db_query_duration_seconds_bucket{le="0.001"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.005"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.01"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.025"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.05"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.1"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.25"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.5"} 0
cubeclicker_db_query_duration_seconds_bucket{le="1"} 0
cubeclicker_db_query_duration_seconds_bucket{le="2.5"} 0
cubeclicker_db_query_duration_seconds_bucket{le="5"} 0
cubeclicker_db_query_duration_seconds_bucket{le="+Inf"} 0
cubeclicker_db_query_duration_seconds_sum 0
cubeclicker_db_query_duration_seconds_count 0
# HELP cubeclicker_economy_flushes_total Economy coalescer flushes.
# TYPE cubeclicker_economy_flushes_total counter
cubeclicker_economy_flushes_total 0
# HELP cubeclicker_economy_pending_accounts Accounts with a pending coalesced economy snapshot.
# TYPE cubeclicker_economy_pending_accounts gauge
cubeclicker_economy_pending_accounts 0
# HELP cubeclicker_economy_revision_rejections_total Economy snapshots rejected as stale.
# TYPE cubeclicker_economy_revision_rejections_total counter
cubeclicker_economy_revision_rejections_total 0
# HELP cubeclicker_members_active Joined members (including grace-window members).
# TYPE cubeclicker_members_active gauge
cubeclicker_members_active 0
# HELP cubeclicker_rate_limit_drops_total Dropped frames or requests, by limiter.
# TYPE cubeclicker_rate_limit_drops_total counter
# HELP cubeclicker_removal_batch_pending_groups Removal batcher groups waiting for the 40 ms window.
# TYPE cubeclicker_removal_batch_pending_groups gauge
cubeclicker_removal_batch_pending_groups 0
# HELP cubeclicker_removal_batch_size Ids per flushed player group.
# TYPE cubeclicker_removal_batch_size histogram
cubeclicker_removal_batch_size_bucket{le="1"} 0
cubeclicker_removal_batch_size_bucket{le="2"} 0
cubeclicker_removal_batch_size_bucket{le="5"} 0
cubeclicker_removal_batch_size_bucket{le="10"} 0
cubeclicker_removal_batch_size_bucket{le="20"} 0
cubeclicker_removal_batch_size_bucket{le="30"} 0
cubeclicker_removal_batch_size_bucket{le="+Inf"} 0
cubeclicker_removal_batch_size_sum 0
cubeclicker_removal_batch_size_count 0
# HELP cubeclicker_removal_flushes_total Removal flushes (timer or boundary).
# TYPE cubeclicker_removal_flushes_total counter
cubeclicker_removal_flushes_total 0
# HELP cubeclicker_removal_ids_total Mini-cube ids flushed.
# TYPE cubeclicker_removal_ids_total counter
cubeclicker_removal_ids_total 0
# HELP cubeclicker_server_capacity Configured members per server.
# TYPE cubeclicker_server_capacity gauge
cubeclicker_server_capacity 0
# HELP cubeclicker_servers_active Live servers.
# TYPE cubeclicker_servers_active gauge
cubeclicker_servers_active 0
# HELP cubeclicker_shutdown_total Graceful shutdowns initiated, by signal.
# TYPE cubeclicker_shutdown_total counter
# HELP cubeclicker_upgrade_revision_rejections_total Purchase/upgrade snapshots rejected as stale.
# TYPE cubeclicker_upgrade_revision_rejections_total counter
cubeclicker_upgrade_revision_rejections_total 0
# HELP cubeclicker_ws_broadcast_fanout Recipients per server broadcast.
# TYPE cubeclicker_ws_broadcast_fanout histogram
cubeclicker_ws_broadcast_fanout_bucket{le="1"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="2"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="5"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="10"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="25"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="50"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="100"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="200"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="+Inf"} 0
cubeclicker_ws_broadcast_fanout_sum 0
cubeclicker_ws_broadcast_fanout_count 0
# HELP cubeclicker_ws_broadcasts_total Server broadcasts (one encode per broadcast).
# TYPE cubeclicker_ws_broadcasts_total counter
cubeclicker_ws_broadcasts_total 0
# HELP cubeclicker_ws_connection_duration_seconds Connection lifetime in seconds.
# TYPE cubeclicker_ws_connection_duration_seconds histogram
cubeclicker_ws_connection_duration_seconds_bucket{le="1"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="5"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="15"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="30"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="60"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="120"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="300"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="600"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="1800"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="3600"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="+Inf"} 0
cubeclicker_ws_connection_duration_seconds_sum 0
cubeclicker_ws_connection_duration_seconds_count 0
# HELP cubeclicker_ws_connections_capacity Configured maximum concurrent connections.
# TYPE cubeclicker_ws_connections_capacity gauge
cubeclicker_ws_connections_capacity 0
# HELP cubeclicker_ws_connections_closed_total Connections closed, by reason.
# TYPE cubeclicker_ws_connections_closed_total counter
# HELP cubeclicker_ws_connections_open Currently attached WebSocket connections.
# TYPE cubeclicker_ws_connections_open gauge
cubeclicker_ws_connections_open 0
# HELP cubeclicker_ws_connections_rejected_total Upgrade attempts rejected before a connection was created.
# TYPE cubeclicker_ws_connections_rejected_total counter
# HELP cubeclicker_ws_connections_total WebSocket connections attached since process start.
# TYPE cubeclicker_ws_connections_total counter
cubeclicker_ws_connections_total 0
# HELP cubeclicker_ws_frames_sent_total Successful per-recipient frame deliveries, by type.
# TYPE cubeclicker_ws_frames_sent_total counter
# HELP cubeclicker_ws_heartbeat_timeouts_total Connections terminated for missing pongs.
# TYPE cubeclicker_ws_heartbeat_timeouts_total counter
cubeclicker_ws_heartbeat_timeouts_total 0
# HELP cubeclicker_ws_messages_encoded_total Server messages encoded once, by type.
# TYPE cubeclicker_ws_messages_encoded_total counter
# HELP cubeclicker_ws_messages_received_total Client frames received, by decoded type.
# TYPE cubeclicker_ws_messages_received_total counter
`,
    );
  });

  it('renders metric names in sorted order', () => {
    const rendered = createMetrics().render();
    const helpOrder = rendered
      .split('\n')
      .filter((line) => line.startsWith('# HELP '))
      .map((line) => line.slice('# HELP '.length).split(' ')[0]);
    expect(helpOrder).toEqual(EXPECTED_METRICS);
  });

  it('increments counters and sets gauges', () => {
    const metrics = createMetrics();
    metrics.inc('cubeclicker_ws_connections_total');
    metrics.inc('cubeclicker_ws_connections_total');
    metrics.set('cubeclicker_ws_connections_open', 2);
    metrics.inc('cubeclicker_ws_connections_closed_total', { reason: 'heartbeat' });
    metrics.inc('cubeclicker_ws_connections_closed_total', { reason: 'client' });
    metrics.inc('cubeclicker_ws_messages_received_total', { type: 'explode' });

    const rendered = metrics.render();
    expect(metricBlock(rendered, 'cubeclicker_ws_connections_total')).toBe(
      '# HELP cubeclicker_ws_connections_total WebSocket connections attached since process start.\n' +
        '# TYPE cubeclicker_ws_connections_total counter\n' +
        'cubeclicker_ws_connections_total 2\n',
    );
    expect(metricBlock(rendered, 'cubeclicker_ws_connections_open')).toBe(
      '# HELP cubeclicker_ws_connections_open Currently attached WebSocket connections.\n' +
        '# TYPE cubeclicker_ws_connections_open gauge\n' +
        'cubeclicker_ws_connections_open 2\n',
    );
    expect(metricBlock(rendered, 'cubeclicker_ws_connections_closed_total')).toBe(
      '# HELP cubeclicker_ws_connections_closed_total Connections closed, by reason.\n' +
        '# TYPE cubeclicker_ws_connections_closed_total counter\n' +
        'cubeclicker_ws_connections_closed_total{reason="client"} 1\n' +
        'cubeclicker_ws_connections_closed_total{reason="heartbeat"} 1\n',
    );
    expect(metricBlock(rendered, 'cubeclicker_ws_messages_received_total')).toBe(
      '# HELP cubeclicker_ws_messages_received_total Client frames received, by decoded type.\n' +
        '# TYPE cubeclicker_ws_messages_received_total counter\n' +
        'cubeclicker_ws_messages_received_total{type="explode"} 1\n',
    );
  });

  it('adds an explicit delta and accumulates repeated series', () => {
    const metrics = createMetrics();
    metrics.inc('cubeclicker_removal_ids_total', undefined, 3);
    metrics.inc('cubeclicker_removal_ids_total', undefined, 4);
    metrics.inc('cubeclicker_ws_connections_closed_total', { reason: 'server' });
    metrics.inc('cubeclicker_ws_connections_closed_total', { reason: 'server' });

    const rendered = metrics.render();
    expect(metricBlock(rendered, 'cubeclicker_removal_ids_total')).toBe(
      '# HELP cubeclicker_removal_ids_total Mini-cube ids flushed.\n' +
        '# TYPE cubeclicker_removal_ids_total counter\n' +
        'cubeclicker_removal_ids_total 7\n',
    );
    expect(metricBlock(rendered, 'cubeclicker_ws_connections_closed_total')).toBe(
      '# HELP cubeclicker_ws_connections_closed_total Connections closed, by reason.\n' +
        '# TYPE cubeclicker_ws_connections_closed_total counter\n' +
        'cubeclicker_ws_connections_closed_total{reason="server"} 2\n',
    );
  });

  it('decrements a gauge with a negative inc delta', () => {
    const metrics = createMetrics();
    metrics.set('cubeclicker_ws_connections_open', 2);
    metrics.inc('cubeclicker_ws_connections_open', undefined, -1);
    expect(metricBlock(metrics.render(), 'cubeclicker_ws_connections_open')).toBe(
      '# HELP cubeclicker_ws_connections_open Currently attached WebSocket connections.\n' +
        '# TYPE cubeclicker_ws_connections_open gauge\n' +
        'cubeclicker_ws_connections_open 1\n',
    );
  });

  it('renders cumulative histogram buckets, sum and count', () => {
    const metrics = createMetrics();
    metrics.observe('cubeclicker_ws_broadcast_fanout', 1);
    metrics.observe('cubeclicker_ws_broadcast_fanout', 2);
    metrics.observe('cubeclicker_ws_broadcast_fanout', 5);

    expect(metricBlock(metrics.render(), 'cubeclicker_ws_broadcast_fanout')).toBe(
      '# HELP cubeclicker_ws_broadcast_fanout Recipients per server broadcast.\n' +
        '# TYPE cubeclicker_ws_broadcast_fanout histogram\n' +
        'cubeclicker_ws_broadcast_fanout_bucket{le="1"} 1\n' +
        'cubeclicker_ws_broadcast_fanout_bucket{le="2"} 2\n' +
        'cubeclicker_ws_broadcast_fanout_bucket{le="5"} 3\n' +
        'cubeclicker_ws_broadcast_fanout_bucket{le="10"} 3\n' +
        'cubeclicker_ws_broadcast_fanout_bucket{le="25"} 3\n' +
        'cubeclicker_ws_broadcast_fanout_bucket{le="50"} 3\n' +
        'cubeclicker_ws_broadcast_fanout_bucket{le="100"} 3\n' +
        'cubeclicker_ws_broadcast_fanout_bucket{le="200"} 3\n' +
        'cubeclicker_ws_broadcast_fanout_bucket{le="+Inf"} 3\n' +
        'cubeclicker_ws_broadcast_fanout_sum 8\n' +
        'cubeclicker_ws_broadcast_fanout_count 3\n',
    );
  });

  it('renders fractional bucket bounds and sums exactly', () => {
    const metrics = createMetrics();
    metrics.observe('cubeclicker_db_query_duration_seconds', 0.012);

    expect(metricBlock(metrics.render(), 'cubeclicker_db_query_duration_seconds')).toBe(
      '# HELP cubeclicker_db_query_duration_seconds Runtime pool query duration in seconds.\n' +
        '# TYPE cubeclicker_db_query_duration_seconds histogram\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="0.001"} 0\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="0.005"} 0\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="0.01"} 0\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="0.025"} 1\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="0.05"} 1\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="0.1"} 1\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="0.25"} 1\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="0.5"} 1\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="1"} 1\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="2.5"} 1\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="5"} 1\n' +
        'cubeclicker_db_query_duration_seconds_bucket{le="+Inf"} 1\n' +
        'cubeclicker_db_query_duration_seconds_sum 0.012\n' +
        'cubeclicker_db_query_duration_seconds_count 1\n',
    );
  });

  it('ends the rendered body with exactly one newline', () => {
    const rendered = createMetrics().render();
    expect(rendered.at(-1)).toBe('\n');
    expect(rendered.at(-2)).not.toBe('\n');
  });
});

describe('metrics validation', () => {
  it.each([
    [
      'inc',
      (metrics: Metrics) =>
        metrics.inc('cubeclicker_not_a_metric' as MetricName),
    ],
    [
      'set',
      (metrics: Metrics) =>
        metrics.set('cubeclicker_not_a_metric' as MetricName, 1),
    ],
    [
      'observe',
      (metrics: Metrics) =>
        metrics.observe('cubeclicker_not_a_metric' as MetricName, 1),
    ],
  ])('%s rejects an unknown metric name', (_method, call) => {
    const metrics = createMetrics();
    expect(() => call(metrics)).toThrowError(
      new Error('Unknown metric "cubeclicker_not_a_metric"'),
    );
  });

  it('rejects an undeclared label name', () => {
    const metrics = createMetrics();
    expect(() =>
      metrics.inc('cubeclicker_ws_connections_total', { reason: 'client' }),
    ).toThrowError(
      new Error('Metric "cubeclicker_ws_connections_total" has no label "reason"'),
    );
  });

  it('rejects the renderer-reserved le label on a catalog metric', () => {
    const metrics = createMetrics();
    expect(() =>
      metrics.inc('cubeclicker_ws_connections_closed_total', {
        reason: 'client',
        le: '1',
      }),
    ).toThrowError(
      new Error('Metric "cubeclicker_ws_connections_closed_total" has no label "le"'),
    );
  });

  it('rejects a missing declared label', () => {
    const metrics = createMetrics();
    expect(() =>
      metrics.inc('cubeclicker_ws_connections_closed_total'),
    ).toThrowError(
      new Error(
        'Metric "cubeclicker_ws_connections_closed_total" is missing label "reason"',
      ),
    );
  });

  it('rejects an out-of-allow-list label value and creates no series', () => {
    const metrics = createMetrics();
    expect(() =>
      metrics.inc('cubeclicker_ws_messages_received_total', {
        type: 'attacker-controlled',
      }),
    ).toThrowError(
      new Error(
        'Metric "cubeclicker_ws_messages_received_total" label "type" has invalid value "attacker-controlled"',
      ),
    );

    expect(metricBlock(metrics.render(), 'cubeclicker_ws_messages_received_total')).toBe(
      '# HELP cubeclicker_ws_messages_received_total Client frames received, by decoded type.\n' +
        '# TYPE cubeclicker_ws_messages_received_total counter\n',
    );
  });

  it('rejects an out-of-allow-list scope value', () => {
    const metrics = createMetrics();
    expect(() =>
      metrics.inc('cubeclicker_rate_limit_drops_total', { scope: 'account' }),
    ).toThrowError(
      new Error(
        'Metric "cubeclicker_rate_limit_drops_total" label "scope" has invalid value "account"',
      ),
    );
  });

  it('accepts the activityEvent type on both outbound counters and creates their series', () => {
    const metrics = createMetrics();
    metrics.inc('cubeclicker_ws_messages_encoded_total', { type: 'activityEvent' });
    metrics.inc('cubeclicker_ws_frames_sent_total', { type: 'activityEvent' }, 3);

    const rendered = metrics.render();
    expect(
      metricBlock(rendered, 'cubeclicker_ws_messages_encoded_total'),
    ).toContain('cubeclicker_ws_messages_encoded_total{type="activityEvent"} 1');
    expect(metricBlock(rendered, 'cubeclicker_ws_frames_sent_total')).toContain(
      'cubeclicker_ws_frames_sent_total{type="activityEvent"} 3',
    );
    expect(Object.keys(METRIC_DEFINITIONS)).toHaveLength(30);
  });

  it('accepts the leaderboardUpdate type on both outbound counters and creates their series', () => {
    const metrics = createMetrics();
    metrics.inc('cubeclicker_ws_messages_encoded_total', { type: 'leaderboardUpdate' });
    metrics.inc('cubeclicker_ws_frames_sent_total', { type: 'leaderboardUpdate' }, 3);

    const rendered = metrics.render();
    expect(metricBlock(rendered, 'cubeclicker_ws_messages_encoded_total')).toContain(
      'cubeclicker_ws_messages_encoded_total{type="leaderboardUpdate"} 1',
    );
    expect(metricBlock(rendered, 'cubeclicker_ws_frames_sent_total')).toContain(
      'cubeclicker_ws_frames_sent_total{type="leaderboardUpdate"} 3',
    );
    expect(Object.keys(METRIC_DEFINITIONS)).toHaveLength(30);
  });

  it('accepts the leave type on the received counter and creates its series', () => {
    const metrics = createMetrics();
    metrics.inc('cubeclicker_ws_messages_received_total', { type: 'leave' });

    expect(metricBlock(metrics.render(), 'cubeclicker_ws_messages_received_total')).toBe(
      '# HELP cubeclicker_ws_messages_received_total Client frames received, by decoded type.\n' +
        '# TYPE cubeclicker_ws_messages_received_total counter\n' +
        'cubeclicker_ws_messages_received_total{type="leave"} 1\n',
    );
    // The additive client frame adds no server message, so the outbound allow-lists are
    // untouched and the catalog stays at exactly 30 metrics (AC-9).
    expect(METRIC_DEFINITIONS.cubeclicker_ws_messages_encoded_total.labels?.type).not.toContain(
      'leave',
    );
    expect(METRIC_DEFINITIONS.cubeclicker_ws_frames_sent_total.labels?.type).not.toContain(
      'leave',
    );
    expect(Object.keys(METRIC_DEFINITIONS)).toHaveLength(30);
  });

  it('rejects a non-finite inc value', () => {
    const metrics = createMetrics();
    expect(() =>
      metrics.inc('cubeclicker_ws_connections_total', undefined, Number.NaN),
    ).toThrowError(
      new Error(
        'Metric "cubeclicker_ws_connections_total" value must be a finite number; received "NaN"',
      ),
    );
  });

  it('rejects a non-finite set value', () => {
    const metrics = createMetrics();
    expect(() =>
      metrics.set('cubeclicker_ws_connections_open', Number.POSITIVE_INFINITY),
    ).toThrowError(
      new Error(
        'Metric "cubeclicker_ws_connections_open" value must be a finite number; received "Infinity"',
      ),
    );
  });

  it('rejects a non-finite histogram observation', () => {
    const metrics = createMetrics();
    expect(() =>
      metrics.observe('cubeclicker_ws_broadcast_fanout', Number.NaN),
    ).toThrowError(
      new Error(
        'Metric "cubeclicker_ws_broadcast_fanout" value must be a finite number; received "NaN"',
      ),
    );
  });

  it('rejects inc on a histogram', () => {
    const metrics = createMetrics();
    expect(() => metrics.inc('cubeclicker_ws_broadcast_fanout')).toThrowError(
      new Error('Metric "cubeclicker_ws_broadcast_fanout" is a histogram; use observe'),
    );
  });

  it('rejects set on a counter', () => {
    const metrics = createMetrics();
    expect(() => metrics.set('cubeclicker_ws_connections_total', 1)).toThrowError(
      new Error(
        'Metric "cubeclicker_ws_connections_total" is not a gauge; use inc or observe',
      ),
    );
  });

  it('rejects observe on a counter', () => {
    const metrics = createMetrics();
    expect(() => metrics.observe('cubeclicker_ws_connections_total', 1)).toThrowError(
      new Error(
        'Metric "cubeclicker_ws_connections_total" is not a histogram; use inc or set',
      ),
    );
  });
});
