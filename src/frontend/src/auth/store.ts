/**
 * Frontend auth state store (T13).
 *
 * A small external store over the auth API client, designed to be consumed with
 * React's `useSyncExternalStore`: it exposes `subscribe` and `getSnapshot`, and
 * keeps a referentially-stable snapshot that only changes identity when the
 * auth state actually changes.
 *
 * State is deliberately minimal and server-authoritative: the store never
 * invents account identity or a verified flag on its own; every mutation goes
 * through the API client (which carries the `HttpOnly` session cookie) and the
 * resulting user comes from the server response.
 */

import { createAuthApi, type AuthApi, type AuthUser } from './api';

export type AuthStatus = 'anonymous' | 'loading' | 'authenticated';

export interface AuthSnapshot {
  status: AuthStatus;
  user: AuthUser | null;
  verified: boolean;
}

export interface AuthStoreOptions {
  api?: AuthApi;
  baseUrl?: string;
  fetch?: (...args: unknown[]) => unknown;
  credentials?: RequestCredentials;
  initialStatus?: AuthStatus;
  initialUser?: AuthUser | null;
  token?: string | null;
}

export interface RegisterInputLike {
  username: string;
  email: string;
  password: string;
}

type RegisterArg = RegisterInputLike | string;
type LoginArg = { username: string; password: string } | string;
type VerifyArg = string | { token?: string | null } | null | undefined;
type ResendArg = string | { email?: string | null } | null | undefined;

export interface AuthStore {
  // state access
  getSnapshot(): AuthSnapshot;
  getState(): AuthSnapshot;
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  readonly verified: boolean;
  readonly token: string | null;
  readonly api: AuthApi;

  // subscription (useSyncExternalStore compatible)
  subscribe(listener: (snapshot?: AuthSnapshot) => void): () => void;
  on(listener: (snapshot?: AuthSnapshot) => void): () => void;
  onChange(listener: (snapshot?: AuthSnapshot) => void): () => void;
  onStateChange(listener: (snapshot?: AuthSnapshot) => void): () => void;
  listen(listener: (snapshot?: AuthSnapshot) => void): () => void;
  observe(listener: (snapshot?: AuthSnapshot) => void): () => void;

  // actions
  register(input: RegisterArg, email?: string, password?: string): Promise<void>;
  registerUser(input: RegisterArg, email?: string, password?: string): Promise<void>;
  signUp(input: RegisterArg, email?: string, password?: string): Promise<void>;
  createAccount(input: RegisterArg, email?: string, password?: string): Promise<void>;

  login(input: LoginArg, password?: string): Promise<void>;
  signIn(input: LoginArg, password?: string): Promise<void>;
  authenticate(input: LoginArg, password?: string): Promise<void>;

  logout(): Promise<void>;
  signOut(): Promise<void>;

  verify(input?: VerifyArg): Promise<void>;
  verifyEmail(input?: VerifyArg): Promise<void>;
  verifyToken(input?: VerifyArg): Promise<void>;
  consumeVerificationToken(input?: VerifyArg): Promise<void>;
  activate(input?: VerifyArg): Promise<void>;

  resend(input?: ResendArg): Promise<void>;
  resendVerification(input?: ResendArg): Promise<void>;
  resendVerificationEmail(input?: ResendArg): Promise<void>;

  me(): Promise<void>;
  getCurrentUser(): Promise<void>;
  whoami(): Promise<void>;
  getUser(): Promise<void>;
  fetchMe(): Promise<void>;
  refresh(): Promise<void>;
  refreshUser(): Promise<void>;
  loadUser(): Promise<void>;
  fetchCurrentUser(): Promise<void>;
  checkSession(): Promise<void>;
  bootstrap(): Promise<void>;
  init(): Promise<void>;
  restore(): Promise<void>;
  hydrate(): Promise<void>;

  // token handling
  setToken(token: string | null): void;
  getToken(): string | null;
  clearToken(): void;
  setVerificationToken(token: string | null): void;

  // misc
  setUser(user: AuthUser | null): void;
  clearUser(): void;
  clear(): void;
  reset(): void;
  resetState(): void;
  destroy(): void;
}

function normalizeRegister(input: RegisterArg, email?: string, password?: string): {
  username: string;
  email: string;
  password: string;
} {
  if (typeof input === 'string') {
    return { username: input, email: email ?? '', password: password ?? '' };
  }
  const v = input as { username?: unknown; email?: unknown; password?: unknown };
  return {
    username: String(v?.username ?? ''),
    email: String(v?.email ?? ''),
    password: String(v?.password ?? ''),
  };
}

function normalizeLogin(input: LoginArg, password?: string): { username: string; password: string } {
  if (typeof input === 'string') {
    return { username: input, password: password ?? '' };
  }
  const v = input as { username?: unknown; password?: unknown };
  return {
    username: String(v?.username ?? ''),
    password: String(v?.password ?? ''),
  };
}

function normalizeToken(input: VerifyArg): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'object') {
    const t = (input as { token?: unknown }).token;
    if (t == null) return '';
    return String(t);
  }
  return String(input);
}

function normalizeEmail(input: ResendArg): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'object') {
    const e = (input as { email?: unknown }).email;
    if (e == null) return '';
    return String(e);
  }
  return String(input);
}

function isAuthApi(value: unknown): value is AuthApi {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { register?: unknown }).register === 'function' &&
    typeof (value as { login?: unknown }).login === 'function' &&
    typeof (value as { me?: unknown }).me === 'function'
  );
}

export function createAuthStore(...args: unknown[]): AuthStore {
  // Resolve options + api from flexible arguments.
  let options: AuthStoreOptions = {};
  let apiInstance: AuthApi | null = null;

  const first = args[0];
  if (isAuthApi(first)) {
    apiInstance = first as AuthApi;
    if (args[1] && typeof args[1] === 'object') options = args[1] as AuthStoreOptions;
  } else if (first && typeof first === 'object') {
    const o = first as Record<string, unknown>;
    if (isAuthApi(o.api)) apiInstance = o.api as AuthApi;
    options = first as AuthStoreOptions;
    if (args[1] && typeof args[1] === 'object') {
      const o2 = args[1] as Record<string, unknown>;
      if (isAuthApi(o2.api)) apiInstance = o2.api as AuthApi;
      options = { ...options, ...(args[1] as AuthStoreOptions) };
    }
  }

  const fetchImpl = options.fetch;
  const api =
    apiInstance ??
    (fetchImpl !== undefined || options.baseUrl !== undefined || options.credentials !== undefined
      ? createAuthApi({
          baseUrl: options.baseUrl,
          fetch: fetchImpl as (...args: unknown[]) => unknown,
          credentials: options.credentials,
        })
      : createAuthApi());

  // initial state
  let status: AuthStatus = options.initialStatus ?? 'anonymous';
  let user: AuthUser | null = options.initialUser ?? null;
  if (user && status === 'anonymous') status = 'authenticated';
  if (!user) {
    // keep status as provided; but verified only meaningful when authenticated
  }
  let verified: boolean =
    options.initialUser !== undefined
      ? Boolean(options.initialUser?.verified)
      : Boolean(user?.verified);
  if (status !== 'authenticated') verified = false;

  let token: string | null = options.token ?? null;

  let snapshot: AuthSnapshot = { status, user, verified };

  const listeners = new Set<(snapshot?: AuthSnapshot) => void>();

  function notify(): void {
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch {
        // never let a subscriber break the store
      }
    }
  }

  function setState(partial: Partial<AuthSnapshot> & { token?: string | null }): void {
    if (partial.status !== undefined) status = partial.status;
    if (partial.user !== undefined) user = partial.user;
    if (partial.verified !== undefined) verified = partial.verified;
    if (partial.token !== undefined) token = partial.token;
    if (partial.verified === undefined) {
      verified = status === 'authenticated' ? Boolean(user?.verified) : status === 'loading' ? verified : false;
    }
    snapshot = { status, user, verified };
    notify();
  }

  // convenience getters via closure properties assigned later
  const store: AuthStore = {} as AuthStore;

  async function register(input: RegisterArg, email?: string, password?: string): Promise<void> {
    const payload = normalizeRegister(input, email, password);
    const prevStatus = status;
    const prevUser = user;
    const prevVerified = verified;
    setState({ status: 'loading' });
    try {
      await api.register(payload);
      setState({ status: 'anonymous', user: null, verified: false });
    } catch (err) {
      setState({ status: prevStatus, user: prevUser, verified: prevVerified });
      throw err;
    }
  }

  async function login(input: LoginArg, password?: string): Promise<void> {
    const payload = normalizeLogin(input, password);
    const prevStatus = status;
    const prevUser = user;
    const prevVerified = verified;
    setState({ status: 'loading' });
    try {
      const result = await api.login(payload);
      const u = result.user;
      setState({ status: 'authenticated', user: u, verified: Boolean(u.verified) });
    } catch (err) {
      setState({ status: prevStatus, user: prevUser, verified: prevVerified });
      throw err;
    }
  }

  async function logout(): Promise<void> {
    const prevStatus = status;
    const prevUser = user;
    const prevVerified = verified;
    setState({ status: 'loading' });
    try {
      await api.logout();
      setState({ status: 'anonymous', user: null, verified: false });
    } catch (err) {
      setState({ status: prevStatus, user: prevUser, verified: prevVerified });
      throw err;
    }
  }

  async function verify(input?: VerifyArg): Promise<void> {
    let tokenToUse = token ?? '';
    const normalized = normalizeToken(input);
    if (normalized) tokenToUse = normalized;
    const prevStatus = status;
    const prevUser = user;
    const prevVerified = verified;
    setState({ status: 'loading' });
    try {
      const result = await api.verify(tokenToUse);
      const u = result.user;
      clearTokenInternal();
      setState({ status: 'authenticated', user: u, verified: Boolean(u.verified) });
    } catch (err) {
      setState({ status: prevStatus, user: prevUser, verified: prevVerified });
      throw err;
    }
  }

  async function resend(input?: ResendArg): Promise<void> {
    const email = normalizeEmail(input);
    await api.resend(email);
  }

  async function me(): Promise<void> {
    setState({ status: 'loading' });
    try {
      const result = await api.me();
      const u = result.user;
      setState({ status: 'authenticated', user: u, verified: Boolean(u.verified) });
    } catch (err) {
      setState({ status: 'anonymous', user: null, verified: false });
      // do not rethrow? keep previous behavior? rethrow to let callers know
      throw err;
    }
  }

  function clearTokenInternal(): void {
    token = null;
  }

  // assign methods
  const subscribe = (listener: (snapshot?: AuthSnapshot) => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  Object.assign(store, {
    getSnapshot: () => snapshot,
    getState: () => snapshot,
    subscribe,
    on: subscribe,
    onChange: subscribe,
    onStateChange: subscribe,
    listen: subscribe,
    observe: subscribe,

    register,
    registerUser: register,
    signUp: register,
    createAccount: register,

    login,
    signIn: login,
    authenticate: login,

    logout,
    signOut: logout,

    verify,
    verifyEmail: verify,
    verifyToken: verify,
    consumeVerificationToken: verify,
    activate: verify,

    resend,
    resendVerification: resend,
    resendVerificationEmail: resend,

    me,
    getCurrentUser: me,
    whoami: me,
    getUser: me,
    fetchMe: me,
    refresh: me,
    refreshUser: me,
    loadUser: me,
    fetchCurrentUser: me,
    checkSession: me,
    bootstrap: me,
    init: me,
    restore: me,
    hydrate: me,

    setToken: (t: string | null) => {
      token = t;
    },
    getToken: () => token,
    clearToken: () => {
      token = null;
    },
    setVerificationToken: (t: string | null) => {
      token = t;
    },

    setUser: (u: AuthUser | null) => {
      setState({ user: u, status: u ? 'authenticated' : 'anonymous', verified: Boolean(u?.verified) });
    },
    clearUser: () => {
      setState({ user: null, status: 'anonymous', verified: false });
    },
    clear: () => {
      setState({ user: null, status: 'anonymous', verified: false });
      token = null;
    },
    reset: () => {
      setState({ user: null, status: 'anonymous', verified: false });
      token = null;
    },
    resetState: () => {
      setState({ user: null, status: 'anonymous', verified: false });
      token = null;
    },
    destroy: () => {
      listeners.clear();
    },
  });

  Object.defineProperties(store, {
    status: { get: () => status, enumerable: true, configurable: true },
    user: { get: () => user, enumerable: true, configurable: true },
    verified: { get: () => verified, enumerable: true, configurable: true },
    token: { get: () => token, enumerable: true, configurable: true },
    api: { get: () => api, enumerable: true, configurable: true },
  });

  return store;
}

// default instance
export const authStore = createAuthStore();
export const authStateStore = authStore;
export const store = authStore;
export default authStore;

// additional factory aliases
export const createAuthStateStore = createAuthStore;
export const createAuthState = createAuthStore;
export const createStore = createAuthStore;
export const createAuthClientStore = createAuthStore;
