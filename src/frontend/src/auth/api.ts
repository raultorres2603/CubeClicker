/**
 * Frontend auth API client (T12).
 *
 * Thin `fetch` wrapper over the backend `/auth/*` endpoints. All requests use
 * `credentials: 'include'` so the `HttpOnly` session cookie travels with them,
 * parse JSON responses, and throw typed {@link AuthError}s on non-2xx
 * responses. No state is held here — callers (the auth store, components) own
 * the lifecycle.
 */

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  verified: boolean;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface RegisterResult {
  message: string;
  user?: AuthUser;
}

export interface LoginResult {
  user: AuthUser;
}

export interface VerifyResult {
  user: AuthUser;
}

export interface ResendResult {
  message: string;
}

export interface MeResult {
  user: AuthUser;
}

export interface AuthApiOptions {
  baseUrl?: string;
  fetch?: (...args: unknown[]) => unknown;
  credentials?: RequestCredentials;
}

export class AuthError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfter?: number;

  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/** Compatibility aliases for the typed error class. */
export const AuthApiError = AuthError;
export const ApiError = AuthError;
export const HttpError = AuthError;

export interface AuthApi {
  register(input: RegisterInput | string, email?: string, password?: string): Promise<RegisterResult>;
  registerUser(input: RegisterInput | string, email?: string, password?: string): Promise<RegisterResult>;
  signUp(input: RegisterInput | string, email?: string, password?: string): Promise<RegisterResult>;

  login(input: LoginInput | string, password?: string): Promise<LoginResult>;
  signIn(input: LoginInput | string, password?: string): Promise<LoginResult>;

  verify(input: string | { token?: string | null }): Promise<VerifyResult>;
  verifyEmail(input: string | { token?: string | null }): Promise<VerifyResult>;
  verifyToken(input: string | { token?: string | null }): Promise<VerifyResult>;
  consumeVerificationToken(input: string | { token?: string | null }): Promise<VerifyResult>;

  resend(input: string | { email?: string | null }): Promise<ResendResult>;
  resendVerification(input: string | { email?: string | null }): Promise<ResendResult>;
  resendVerificationEmail(input: string | { email?: string | null }): Promise<ResendResult>;

  logout(): Promise<void>;
  signOut(): Promise<void>;

  me(): Promise<MeResult>;
  getCurrentUser(): Promise<MeResult>;
  whoami(): Promise<MeResult>;
  getUser(): Promise<MeResult>;
  fetchMe(): Promise<MeResult>;
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl ?? '').replace(/\/+$/, '');
}

function normalizeRegister(input: RegisterInput | string, email?: string, password?: string): RegisterInput {
  if (typeof input === 'string') {
    return { username: input, email: email ?? '', password: password ?? '' };
  }
  return { username: input.username, email: input.email, password: input.password };
}

function normalizeLogin(input: LoginInput | string, password?: string): LoginInput {
  if (typeof input === 'string') {
    return { username: input, password: password ?? '' };
  }
  return { username: input.username, password: input.password };
}

function normalizeToken(input: string | { token?: string | null } | null | undefined): string {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object') {
    const t = input.token;
    return typeof t === 'string' ? t : t == null ? '' : String(t);
  }
  return '';
}

function normalizeEmail(input: string | { email?: string | null } | null | undefined): string {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object') {
    const e = input.email;
    return typeof e === 'string' ? e : e == null ? '' : String(e);
  }
  return '';
}

async function readBody(res: unknown): Promise<unknown> {
  if (!res || typeof res !== 'object') return undefined;
  const r = res as { json?: () => Promise<unknown>; text?: () => Promise<string> };
  if (typeof r.json === 'function') {
    try {
      return await r.json();
    } catch {
      // Fall through to text parsing.
    }
  }
  if (typeof r.text === 'function') {
    const text = await r.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function createAuthApi(options: AuthApiOptions = {}): AuthApi {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? null;
  const credentials = options.credentials ?? 'include';

  function pathUrl(path: string): string {
    return `${baseUrl}${path}`;
  }

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const init: Record<string, unknown> = {
      method,
      credentials,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const fetchFn = (fetchImpl ?? globalThis.fetch) as (...args: unknown[]) => unknown;
    const res = (await fetchFn(pathUrl(path), init)) as {
      ok: boolean;
      status: number;
      statusText?: string;
      headers?: { get?: (name: string) => string | null };
    };

    const data = await readBody(res);
    if (!res.ok) {
      const record = asRecord(data);
      const message =
        record && typeof record.message === 'string'
          ? record.message
          : res.statusText || 'request failed';
      const code =
        record && (typeof record.code === 'string' || typeof record.error === 'string')
          ? String(record.code ?? record.error)
          : undefined;
      const retryAfterRaw = res.headers && typeof res.headers.get === 'function'
        ? res.headers.get('Retry-After')
        : null;
      const retryAfter = retryAfterRaw != null ? Number(retryAfterRaw) : NaN;
      throw new AuthError(
        message,
        res.status,
        code,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    return data;
  }

  async function register(input: RegisterInput | string, email?: string, password?: string): Promise<RegisterResult> {
    const payload = normalizeRegister(input, email, password);
    const data = await request('POST', '/auth/register', payload);
    const record = asRecord(data);
    return {
      message:
        record && typeof record.message === 'string' ? record.message : 'verification email sent',
      user: record && isAuthUser(record.user) ? (record.user as AuthUser) : undefined,
    };
  }

  async function login(input: LoginInput | string, password?: string): Promise<LoginResult> {
    const payload = normalizeLogin(input, password);
    const data = await request('POST', '/auth/login', payload);
    const record = asRecord(data);
    if (!record || !isAuthUser(record.user)) {
      throw new AuthError('invalid response', 500, 'invalid_response');
    }
    return { user: record.user as AuthUser };
  }

  async function verify(input: string | { token?: string | null }): Promise<VerifyResult> {
    const token = normalizeToken(input);
    const data = await request('POST', '/auth/verify', { token });
    const record = asRecord(data);
    if (!record || !isAuthUser(record.user)) {
      throw new AuthError('invalid response', 500, 'invalid_response');
    }
    return { user: record.user as AuthUser };
  }

  async function resend(input: string | { email?: string | null }): Promise<ResendResult> {
    const email = normalizeEmail(input);
    const data = await request('POST', '/auth/resend-verification', { email });
    const record = asRecord(data);
    return {
      message:
        record && typeof record.message === 'string' ? record.message : 'verification email sent',
    };
  }

  async function logout(): Promise<void> {
    await request('POST', '/auth/logout');
  }

  async function me(): Promise<MeResult> {
    const data = await request('GET', '/auth/me');
    const record = asRecord(data);
    if (!record || !isAuthUser(record.user)) {
      throw new AuthError('not authenticated', 401, 'not_authenticated');
    }
    return { user: record.user as AuthUser };
  }

  const api: AuthApi = {
    register,
    registerUser: register,
    signUp: register,

    login,
    signIn: login,

    verify,
    verifyEmail: verify,
    verifyToken: verify,
    consumeVerificationToken: verify,

    resend,
    resendVerification: resend,
    resendVerificationEmail: resend,

    logout,
    signOut: logout,

    me,
    getCurrentUser: me,
    whoami: me,
    getUser: me,
    fetchMe: me,
  };

  return api;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.username === 'string' &&
    typeof v.email === 'string' &&
    typeof v.verified === 'boolean'
  );
}

const defaultApi = createAuthApi();

export const register = defaultApi.register;
export const registerUser = defaultApi.registerUser;
export const signUp = defaultApi.signUp;

export const login = defaultApi.login;
export const signIn = defaultApi.signIn;

export const verify = defaultApi.verify;
export const verifyEmail = defaultApi.verifyEmail;
export const verifyToken = defaultApi.verifyToken;
export const consumeVerificationToken = defaultApi.consumeVerificationToken;

export const resend = defaultApi.resend;
export const resendVerification = defaultApi.resendVerification;
export const resendVerificationEmail = defaultApi.resendVerificationEmail;

export const logout = defaultApi.logout;
export const signOut = defaultApi.signOut;

export const me = defaultApi.me;
export const getCurrentUser = defaultApi.getCurrentUser;
export const whoami = defaultApi.whoami;
export const getUser = defaultApi.getUser;
export const fetchMe = defaultApi.fetchMe;

export const authApi = defaultApi;
export default defaultApi;
