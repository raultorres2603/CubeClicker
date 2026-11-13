/**
 * Frontend runtime configuration (T1) — the single resolver for the API origin and the
 * WebSocket URL, shared by the browser modules and the Vite build bridge.
 *
 * The SPA runs in two modes:
 *
 * - **Local / same-origin** (the default, including the provider-neutral Docker image):
 *   the auth client calls relative `/auth/*` paths and the transport uses the pinned
 *   `ws://localhost:8080/ws` backend dev URL.
 * - **Cloud** (`options.cloud === true`, driven by the build-time `VITE_CLOUD_DEPLOY=true`
 *   flag set only by the Vercel build): both URLs are absolute. `VITE_API_URL` is required
 *   and must be `https://`; `VITE_WS_URL` is optional and derived as `wss://<api-host>/ws`
 *   when omitted. The **resolved** WebSocket URL must be `wss://`, so an explicit `ws://`
 *   URL throws — an `https://` page can never open a mixed-content socket.
 *
 * The resolver is pure: the environment is an explicit parameter and cloud mode is an
 * option, so every caller (auth client, transport, `vite.config.ts`) resolves the same way.
 */

export interface FrontendConfigEnv {
  VITE_API_URL?: string;
  VITE_WS_URL?: string;
  VITE_CLOUD_DEPLOY?: string;
  /** Lets callers pass Vite's index-signature `import.meta.env` object directly. */
  [key: string]: unknown;
}

export interface FrontendConfigOptions {
  /** `true` only for a cloud build (`VITE_CLOUD_DEPLOY=true`); enables validation. */
  cloud?: boolean;
}

export interface FrontendRuntimeConfig {
  /** `''` for same-origin local development; an absolute `https://` base in cloud mode. */
  apiBaseUrl: string;
  /** An absolute `ws://` (local) or `wss://` (cloud) URL. */
  wsUrl: string;
}

/** The pinned local WebSocket URL — the backend's published dev port. */
export const LOCAL_WS_URL = 'ws://localhost:8080/ws';

/** Build-time failure when a cloud build has no absolute `https://` API URL. */
export const CLOUD_API_URL_ERROR =
  'VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true';

/** Build-time failure when the resolved cloud WebSocket URL is not `wss://`. */
export const CLOUD_WS_URL_ERROR =
  'VITE_WS_URL must resolve to an absolute wss:// URL when VITE_CLOUD_DEPLOY=true';

const HTTPS_PREFIX = 'https://';
const HTTP_PREFIX = 'http://';
const WSS_PREFIX = 'wss://';

/** Trim then remove **all** trailing slashes (`https://api.example.test//` → `https://api.example.test`). */
function normalizeApiBaseUrl(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/\/+$/, '');
}

/** `wss://<api-host>/ws` from an https base, `ws://…` from an http base, else `null`. */
function deriveWsUrl(apiBaseUrl: string): string | null {
  if (apiBaseUrl.startsWith(HTTPS_PREFIX)) {
    return `${WSS_PREFIX}${apiBaseUrl.slice(HTTPS_PREFIX.length)}/ws`;
  }
  if (apiBaseUrl.startsWith(HTTP_PREFIX)) {
    return `ws://${apiBaseUrl.slice(HTTP_PREFIX.length)}/ws`;
  }
  return null;
}

function isAbsoluteUrlWithScheme(value: string, scheme: 'https:' | 'wss:'): boolean {
  const prefix = `${scheme}//`;
  if (!value.startsWith(prefix)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === scheme && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Resolves the frontend runtime config for one environment.
 *
 * @param env the bridged `VITE_*` values (`import.meta.env` in the browser, `process.env`
 *   in `vite.config.ts`).
 * @param options `{ cloud: true }` enables the cloud-build validation.
 * @throws `Error` naming `VITE_API_URL` when cloud mode has no absolute `https://` API URL.
 * @throws `Error` naming `VITE_WS_URL` and `wss://` when the resolved cloud socket is not `wss://`.
 */
export function resolveFrontendConfig(
  env: FrontendConfigEnv,
  options: FrontendConfigOptions = {},
): FrontendRuntimeConfig {
  const apiBaseUrl = normalizeApiBaseUrl(env.VITE_API_URL);
  const configuredWsUrl = (env.VITE_WS_URL ?? '').trim();
  const wsUrl =
    configuredWsUrl.length > 0
      ? configuredWsUrl
      : (deriveWsUrl(apiBaseUrl) ?? LOCAL_WS_URL);

  if (options.cloud === true) {
    if (!isAbsoluteUrlWithScheme(apiBaseUrl, 'https:')) {
      throw new Error(CLOUD_API_URL_ERROR);
    }
    if (!isAbsoluteUrlWithScheme(wsUrl, 'wss:')) {
      throw new Error(CLOUD_WS_URL_ERROR);
    }
  }

  return { apiBaseUrl, wsUrl };
}
