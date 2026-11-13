/**
 * Structured logging configuration and the event-first `LogSink` adapter (T1).
 *
 * Fastify owns the Pino instance; this module supplies the level, redaction and
 * serializers. The custom serializers deliberately exclude bodies, headers, IPs,
 * query strings, messages and stacks: only the request method/path/host, the
 * response status and the error type/optional code can reach a log line.
 *
 * `LogSink` is event-first (`info(event, fields)`); `createLogSink` adapts it to
 * Pino's object-first API (`logger.info(fields, event)`) so the structured fields
 * are emitted rather than silently dropped.
 */

import type { FastifyServerOptions } from 'fastify';
import { loadObservabilityConfig } from './config.js';

/** Censor value used for every redacted log field. */
export const REDACT_CENSOR = '[REDACTED]';

/**
 * Pino redaction paths (AC-2). Top-level secrets, request/response header paths
 * and wildcard forms for nested objects are all covered.
 */
export const REDACT_PATHS: readonly string[] = [
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
];

/** Structured fields accepted by the event-first log sink. */
export type LogFields = Record<string, string | number | boolean>;

/** Event-first structured logging contract used by the hub and shutdown code. */
export interface LogSink {
  info(event: string, fields: LogFields): void;
  warn(event: string, fields: LogFields): void;
  error(event: string, fields: LogFields): void;
}

/** The subset of a Pino/Fastify logger the adapter needs. */
export interface LoggerLike {
  info(fields: object, event: string): void;
  warn(fields: object, event: string): void;
  error(fields: object, event: string): void;
}

/**
 * Adapts an object-first Pino logger to the event-first `LogSink` contract.
 *
 * The field object is passed first and the event name second, matching Pino's
 * `logger.info(obj, msg)` signature; this is what keeps the structured fields.
 */
export function createLogSink(logger: LoggerLike): LogSink {
  return {
    info: (event, fields) => logger.info(fields, event),
    warn: (event, fields) => logger.warn(fields, event),
    error: (event, fields) => logger.error(fields, event),
  };
}

/** Minimal request shape used by the safe request serializer. */
export interface RequestLike {
  method: string;
  url: string;
  host: string;
}

/** Minimal response shape used by the safe response serializer. */
export interface ResponseLike {
  statusCode: number;
}

/** Minimal error shape used by the safe error serializer. */
export interface ErrorLike {
  name: string;
  code?: unknown;
}

/**
 * Returns only the HTTP method, path (query string stripped) and host.
 * Bodies, headers, IPs and query parameters never reach the log.
 */
export function serializeRequest(request: RequestLike): {
  method: string;
  url: string;
  host: string;
} {
  const queryIndex = request.url.indexOf('?');
  return {
    method: request.method,
    url: queryIndex === -1 ? request.url : request.url.slice(0, queryIndex),
    host: request.host,
  };
}

/** Returns only the response status code. */
export function serializeResponse(response: ResponseLike): { statusCode: number } {
  return { statusCode: response.statusCode };
}

/**
 * Returns only the error type and, when it is a string, the error code.
 * The message and stack are intentionally dropped because both can contain
 * user input (emails, SQL fragments, tokens).
 */
export function serializeError(error: ErrorLike): { type: string; code?: string } {
  if (typeof error.code === 'string') {
    return { type: error.name, code: error.code };
  }
  return { type: error.name };
}

/** Destination used by the optional stream test seam. */
export interface LoggerStream {
  write(line: string): void;
}

/**
 * Builds Fastify/Pino logger options from the environment.
 *
 * Returns `false` when logging is disabled (`NODE_ENV=test` or unset with no
 * `LOG_LEVEL`). The optional `stream` is a test seam that lets tests capture the
 * JSON lines without a pretty transport.
 */
export function buildLoggerOptions(
  env: Record<string, string | undefined>,
  stream?: LoggerStream,
): FastifyServerOptions['logger'] | false {
  const config = loadObservabilityConfig(env);
  if (config.logLevel === false) {
    return false;
  }

  const options = {
    level: config.logLevel,
    redact: {
      paths: [...REDACT_PATHS],
      censor: REDACT_CENSOR,
    },
    serializers: {
      req: serializeRequest,
      res: serializeResponse,
      err: serializeError,
    },
    ...(stream === undefined ? {} : { stream }),
  };

  // Fastify's serializer type requires `message`/`stack` on errors even though
  // the runtime serializer intentionally omits both; the shape is valid Pino.
  return options as unknown as FastifyServerOptions['logger'];
}
