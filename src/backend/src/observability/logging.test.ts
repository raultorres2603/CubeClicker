import Fastify from 'fastify';
import type { FastifyLoggerOptions, PinoLoggerOptions } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import {
  REDACT_CENSOR,
  REDACT_PATHS,
  buildLoggerOptions,
  createLogSink,
  serializeError,
  serializeRequest,
  serializeResponse,
} from './logging.js';

type BuiltOptions = FastifyLoggerOptions & PinoLoggerOptions;

interface CaptureStream {
  stream: { write(line: string): void };
  lines(): string[];
}

function createCaptureStream(): CaptureStream {
  const chunks: string[] = [];
  return {
    stream: {
      write: (line: string) => {
        chunks.push(line);
      },
    },
    lines: () => chunks.flatMap((chunk) => chunk.split('\n')).filter((line) => line !== ''),
  };
}

function expectOptions(
  env: Record<string, string | undefined>,
  stream?: { write(line: string): void },
): BuiltOptions {
  const options = buildLoggerOptions(env, stream);
  if (options === false || options === true) {
    throw new Error(`expected logger options, received ${String(options)}`);
  }
  return options;
}

describe('buildLoggerOptions log levels', () => {
  it('disables logging for an empty environment', () => {
    expect(buildLoggerOptions({})).toBe(false);
  });

  it('disables logging for NODE_ENV=test without LOG_LEVEL', () => {
    expect(buildLoggerOptions({ NODE_ENV: 'test' })).toBe(false);
  });

  it('uses info for NODE_ENV=production', () => {
    expect(expectOptions({ NODE_ENV: 'production' }).level).toBe('info');
  });

  it('uses debug for NODE_ENV=development', () => {
    expect(expectOptions({ NODE_ENV: 'development' }).level).toBe('debug');
  });

  it('honours LOG_LEVEL over NODE_ENV=production', () => {
    expect(
      expectOptions({ NODE_ENV: 'production', LOG_LEVEL: 'warn' }).level,
    ).toBe('warn');
  });

  it('honours LOG_LEVEL over NODE_ENV=test', () => {
    expect(expectOptions({ NODE_ENV: 'test', LOG_LEVEL: 'trace' }).level).toBe(
      'trace',
    );
  });

  it('honours LOG_LEVEL without NODE_ENV', () => {
    expect(expectOptions({ LOG_LEVEL: 'silent' }).level).toBe('silent');
  });

  it('rejects an invalid LOG_LEVEL naming the variable', () => {
    expect(() => buildLoggerOptions({ LOG_LEVEL: 'verbose' })).toThrowError(
      new Error(
        'LOG_LEVEL must be one of fatal|error|warn|info|debug|trace|silent; received "verbose"',
      ),
    );
  });
});

describe('buildLoggerOptions redaction and serializers', () => {
  it('pins every top-level, request/response and wildcard redaction path', () => {
    expect(REDACT_PATHS).toEqual([
      'email',
      'password',
      'pass',
      'token',
      'sessionToken',
      'verificationToken',
      'cookie',
      'authorization',
      'req.headers.cookie',
      'req.headers.authorization',
      "req.headers['x-api-key']",
      "res.headers['set-cookie']",
      'req.body.email',
      'req.body.password',
      'req.body.pass',
      'req.body.token',
      'req.body.sessionToken',
      'req.body.verificationToken',
      '*.email',
      '*.password',
      '*.pass',
      '*.token',
      '*.sessionToken',
      '*.verificationToken',
      '*.cookie',
      '*.authorization',
    ]);
  });

  it('wires the redaction censor and paths into the options', () => {
    const options = expectOptions({ LOG_LEVEL: 'info' });
    expect(options.redact).toEqual({
      paths: [...REDACT_PATHS],
      censor: '[REDACTED]',
    });
    expect(REDACT_CENSOR).toBe('[REDACTED]');
  });

  it('wires the safe req, res and err serializers', () => {
    const options = expectOptions({ LOG_LEVEL: 'info' });
    expect(options.serializers?.req).toBe(serializeRequest);
    expect(options.serializers?.res).toBe(serializeResponse);
    expect(options.serializers?.err).toBe(serializeError);
  });

  it('does not add a pretty transport', () => {
    expect(expectOptions({ LOG_LEVEL: 'info' })).not.toHaveProperty('transport');
  });

  it('passes the optional stream through to the logger options', () => {
    const capture = createCaptureStream();
    const options = expectOptions({ LOG_LEVEL: 'info' }, capture.stream);
    expect(options.stream).toBe(capture.stream);
  });
});

describe('captured JSON lines', () => {
  it('emits the event name and structured fields', async () => {
    const capture = createCaptureStream();
    const app = Fastify({
      logger: expectOptions({ LOG_LEVEL: 'info' }, capture.stream),
    });

    app.log.info({ connectionId: 'req-1' }, 'ws_connection_opened');
    await app.close();

    const lines = capture.lines();
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(line.msg).toBe('ws_connection_opened');
    expect(line.connectionId).toBe('req-1');
    expect(line.level).toBe(30);
  });

  it('redacts top-level and nested secrets in a real Pino line', async () => {
    const capture = createCaptureStream();
    const app = Fastify({
      logger: expectOptions({ LOG_LEVEL: 'info' }, capture.stream),
    });

    app.log.info(
      {
        connectionId: 'req-1',
        email: 'alice@example.test',
        password: 'hunter2',
        pass: 'hunter2-pass',
        token: 'tok-1',
        sessionToken: 'session-token-1',
        verificationToken: 'verify-token-1',
        cookie: 'session-secret',
        authorization: 'Bearer secret',
        body: {
          email: 'nested@example.test',
          password: 'nested-pass',
          pass: 'nested-pass-2',
          token: 'nested-token',
          sessionToken: 'nested-session-token',
          verificationToken: 'nested-verify-token',
        },
        headers: {
          cookie: 'nested-cookie',
          authorization: 'Bearer nested',
        },
      },
      'redaction_probe',
    );
    await app.close();

    const line = JSON.parse(capture.lines()[0]) as Record<string, unknown>;
    expect(line.email).toBe('[REDACTED]');
    expect(line.password).toBe('[REDACTED]');
    expect(line.pass).toBe('[REDACTED]');
    expect(line.token).toBe('[REDACTED]');
    expect(line.sessionToken).toBe('[REDACTED]');
    expect(line.verificationToken).toBe('[REDACTED]');
    expect(line.cookie).toBe('[REDACTED]');
    expect(line.authorization).toBe('[REDACTED]');
    expect(line.body).toEqual({
      email: '[REDACTED]',
      password: '[REDACTED]',
      pass: '[REDACTED]',
      token: '[REDACTED]',
      sessionToken: '[REDACTED]',
      verificationToken: '[REDACTED]',
    });
    expect(line.headers).toEqual({
      cookie: '[REDACTED]',
      authorization: '[REDACTED]',
    });

    const raw = capture.lines()[0];
    for (const secret of [
      'alice@example.test',
      'hunter2',
      'hunter2-pass',
      'tok-1',
      'session-token-1',
      'verify-token-1',
      'session-secret',
      'Bearer secret',
      'nested@example.test',
      'nested-pass',
      'nested-pass-2',
      'nested-token',
      'nested-session-token',
      'nested-verify-token',
      'nested-cookie',
      'Bearer nested',
    ]) {
      expect(raw).not.toContain(secret);
    }
  });

  it('serializes req and res without headers, bodies or query strings', async () => {
    const capture = createCaptureStream();
    const app = Fastify({
      logger: expectOptions({ LOG_LEVEL: 'info' }, capture.stream),
    });

    app.log.info(
      {
        req: {
          method: 'POST',
          url: '/auth/login?email=alice%40example.test',
          host: 'example.test',
          headers: {
            cookie: 'req-cookie',
            authorization: 'Bearer req',
            'x-api-key': 'api-key-1',
          },
          body: { password: 'body-password' },
        },
        res: {
          statusCode: 200,
          headers: {
            'set-cookie': 'set-cookie-1',
          },
        },
      },
      'request_probe',
    );
    await app.close();

    const raw = capture.lines()[0];
    const line = JSON.parse(raw) as {
      req: Record<string, unknown>;
      res: Record<string, unknown>;
    };
    expect(line.req).toEqual({
      method: 'POST',
      url: '/auth/login',
      host: 'example.test',
    });
    expect(line.res).toEqual({ statusCode: 200 });
    for (const secret of [
      'req-cookie',
      'Bearer req',
      'api-key-1',
      'body-password',
      'set-cookie-1',
      'alice@example.test',
    ]) {
      expect(raw).not.toContain(secret);
    }
  });

  it('serializes an err to type only and drops the message', async () => {
    const capture = createCaptureStream();
    const app = Fastify({
      logger: expectOptions({ LOG_LEVEL: 'info' }, capture.stream),
    });

    app.log.error({ err: new Error('alice@example.test') }, 'error_probe');
    await app.close();

    const raw = capture.lines()[0];
    const line = JSON.parse(raw) as { err: Record<string, unknown> };
    expect(line.err).toEqual({ type: 'Error' });
    expect(raw).not.toContain('alice@example.test');
    expect(Object.keys(line.err)).toEqual(['type']);
  });

  it('includes a string err code and drops a non-string code', async () => {
    const capture = createCaptureStream();
    const app = Fastify({
      logger: expectOptions({ LOG_LEVEL: 'info' }, capture.stream),
    });

    app.log.error(
      { err: Object.assign(new Error('socket closed'), { code: 'ECONNRESET' }) },
      'coded_error',
    );
    app.log.error(
      { err: Object.assign(new Error('socket closed'), { code: 42 }) },
      'numeric_error',
    );
    await app.close();

    const lines = capture.lines();
    expect(lines).toHaveLength(2);
    const coded = JSON.parse(lines[0]) as { err: Record<string, unknown> };
    const numeric = JSON.parse(lines[1]) as { err: Record<string, unknown> };
    expect(coded.err).toEqual({ type: 'Error', code: 'ECONNRESET' });
    expect(numeric.err).toEqual({ type: 'Error' });
  });
});

describe('serializers', () => {
  it('strips the query string from req.url', () => {
    expect(
      serializeRequest({
        method: 'POST',
        url: '/auth/login?email=alice%40example.test&token=tok-1',
        host: 'example.test',
      }),
    ).toEqual({
      method: 'POST',
      url: '/auth/login',
      host: 'example.test',
    });
  });

  it('keeps a URL without a query string unchanged', () => {
    expect(
      serializeRequest({ method: 'GET', url: '/metrics', host: 'localhost:8080' }),
    ).toEqual({
      method: 'GET',
      url: '/metrics',
      host: 'localhost:8080',
    });
  });

  it('returns only the response status code', () => {
    expect(serializeResponse({ statusCode: 204 })).toEqual({ statusCode: 204 });
  });

  it('returns only the error type for a plain Error', () => {
    expect(serializeError(new Error('alice@example.test'))).toEqual({
      type: 'Error',
    });
  });

  it('uses the error name as type', () => {
    class ValidationError extends Error {
      override name = 'ValidationError';
    }
    expect(serializeError(new ValidationError('bad input'))).toEqual({
      type: 'ValidationError',
    });
  });

  it('includes a string error code', () => {
    const error = Object.assign(new Error('socket closed'), {
      code: 'ECONNRESET',
    });
    expect(serializeError(error)).toEqual({ type: 'Error', code: 'ECONNRESET' });
  });

  it('drops a non-string error code', () => {
    const error = Object.assign(new Error('socket closed'), { code: 42 });
    expect(serializeError(error)).toEqual({ type: 'Error' });
  });

  it('never emits message or stack', () => {
    const error = Object.assign(new Error('alice@example.test'), {
      stack: 'Error: alice@example.test\n    at secret',
    });
    expect(serializeError(error)).toEqual({ type: 'Error' });
  });
});

describe('createLogSink', () => {
  it('emits the structured fields through a real Fastify/Pino logger', async () => {
    const capture = createCaptureStream();
    const app = Fastify({
      logger: expectOptions({ LOG_LEVEL: 'info' }, capture.stream),
    });
    const sink = createLogSink(app.log);

    sink.info('ws_connection_opened', { connectionId: 'req-1' });
    sink.warn('ws_heartbeat_timeout', {
      connectionId: 'req-1',
      wasJoined: true,
    });
    sink.error('shutdown_failed', {
      signal: 'SIGTERM',
      errorType: 'Error',
    });
    await app.close();

    const lines = capture.lines().map(
      (line) => JSON.parse(line) as Record<string, unknown>,
    );
    expect(lines).toHaveLength(3);
    expect(lines[0].level).toBe(30);
    expect(lines[0].msg).toBe('ws_connection_opened');
    expect(lines[0].connectionId).toBe('req-1');
    expect(lines[1].level).toBe(40);
    expect(lines[1].msg).toBe('ws_heartbeat_timeout');
    expect(lines[1].connectionId).toBe('req-1');
    expect(lines[1].wasJoined).toBe(true);
    expect(lines[2].level).toBe(50);
    expect(lines[2].msg).toBe('shutdown_failed');
    expect(lines[2].signal).toBe('SIGTERM');
    expect(lines[2].errorType).toBe('Error');
  });

  it('emits a debug event at level 20 through a real Fastify/Pino logger', async () => {
    const capture = createCaptureStream();
    const app = Fastify({
      logger: expectOptions({ LOG_LEVEL: 'debug' }, capture.stream),
    });
    const sink = createLogSink(app.log);

    sink.debug('db_schema_table_present', { table: 'users' });
    await app.close();

    const lines = capture.lines();
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(line.level).toBe(20);
    expect(line.msg).toBe('db_schema_table_present');
    expect(line.table).toBe('users');
  });

  it('calls Pino object-first with fields then the event name', () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const sink = createLogSink(logger);

    sink.debug('db_schema_table_present', { table: 'users' });
    sink.info('ws_connection_opened', { connectionId: 'req-1' });
    sink.warn('ws_heartbeat_timeout', {
      connectionId: 'req-1',
      wasJoined: true,
    });
    sink.error('shutdown_failed', {
      signal: 'SIGTERM',
      errorType: 'Error',
    });

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      { table: 'users' },
      'db_schema_table_present',
    );
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      { connectionId: 'req-1' },
      'ws_connection_opened',
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { connectionId: 'req-1', wasJoined: true },
      'ws_heartbeat_timeout',
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      { signal: 'SIGTERM', errorType: 'Error' },
      'shutdown_failed',
    );
  });
});
