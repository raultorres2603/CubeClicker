import { describe, expect, it, vi } from 'vitest';

import { AuthError, createAuthApi } from './api';
import { createAuthStore, createAuthStateStore, createAuthState, createStore, authStore, default as defaultStore } from './store';

function jsonResponse(status: number, body: unknown): {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
} {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 202 ? 'Accepted' : status === 204 ? 'No Content' : 'Error',
    headers: { get: () => null },
    json: async () => body,
  };
}

const USER = { id: 'u1', username: 'alice', email: 'a@x.com', verified: false };
const VERIFIED_USER = { id: 'u1', username: 'alice', email: 'a@x.com', verified: true };

describe('auth store', () => {
  it('starts anonymous with no user', () => {
    const store = createAuthStore();
    const snap = store.getSnapshot();
    expect(snap).toEqual({ status: 'anonymous', user: null, verified: false });
    expect(store.status).toBe('anonymous');
    expect(store.user).toBeNull();
    expect(store.verified).toBe(false);
    expect(store.token).toBeNull();
  });

  it('getSnapshot is referentially stable until state changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: USER }));
    const api = createAuthApi({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    const store = createAuthStore({ api });

    const before = store.getSnapshot();
    const same = store.getSnapshot();
    expect(same).toBe(before);

    await store.login({ username: 'alice', password: 'password1234' });
    const after = store.getSnapshot();
    expect(after).not.toBe(before);
    expect(after).toEqual({ status: 'authenticated', user: USER, verified: false });
  });

  it('subscribe notifies listeners and unsubscribe stops notifications', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: USER }));
    const api = createAuthApi({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    const store = createAuthStore({ api });

    const seen: string[] = [];
    const unsub = store.subscribe((snap) => {
      seen.push(snap!.status);
    });
    expect(seen).toEqual([]);

    await store.login({ username: 'alice', password: 'password1234' });
    expect(seen).toEqual(['loading', 'authenticated']);

    unsub();
    const logoutFetch = vi.fn().mockResolvedValue({ ok: true, status: 204, statusText: 'No Content', headers: { get: () => null } });
    const api2 = createAuthApi({ fetch: logoutFetch as unknown as (...args: unknown[]) => unknown });
    const store2 = createAuthStore({ api: api2 });
    const seen2: string[] = [];
    const unsub2 = store2.subscribe((s) => seen2.push(s!.status));
    await store2.logout();
    expect(seen2).toEqual(['loading', 'anonymous']);
    unsub2();
  });

  it('login success sets authenticated user and verified flag', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: VERIFIED_USER }));
    const api = createAuthApi({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    const store = createAuthStore({ api });

    await store.login({ username: 'alice', password: 'password1234' });

    expect(store.getSnapshot()).toEqual({ status: 'authenticated', user: VERIFIED_USER, verified: true });
    expect(fetchMock).toHaveBeenCalledWith('/auth/login', expect.any(Object));
  });

  it('login failure throws and reverts to previous state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'invalid credentials', code: 'invalid_credentials' }));
    const api = createAuthApi({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    const store = createAuthStore({ api });

    let thrown: unknown;
    try {
      await store.login({ username: 'alice', password: 'wrongpassword1' });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AuthError);
    expect(store.getSnapshot()).toEqual({ status: 'anonymous', user: null, verified: false });
  });

  it('login aliases work', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: USER }));
    const api = createAuthApi({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    const store = createAuthStore({ api });
    await store.signIn({ username: 'alice', password: 'password1234' });
    expect(store.status).toBe('authenticated');
    await store.logout();
    await store.authenticate('alice', 'password1234');
    expect(store.status).toBe('authenticated');
  });

  it('register calls the API and leaves the store anonymous', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { message: 'verification email sent' }));
    const api = createAuthApi({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    const store = createAuthStore({ api });

    await store.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });

    expect(store.getSnapshot()).toEqual({ status: 'anonymous', user: null, verified: false });
    expect(fetchMock).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ method: 'POST' }));
  });

  it('register supports positional args and aliases', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { message: 'verification email sent' }));
    const api = createAuthApi({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    const store = createAuthStore({ api });

    await store.signUp('bob', 'bob@x.com', 'password1234');
    await store.createAccount({ username: 'carol', email: 'c@x.com', password: 'password1234' });
    await store.registerUser({ username: 'dave', email: 'd@x.com', password: 'password1234' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('register failure throws and reverts state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, { message: 'account already exists', code: 'duplicate_account' }));
    const api = createAuthApi({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    const store = createAuthStore({ api });

    let thrown: unknown;
    try {
      await store.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AuthError);
    expect(store.status).toBe('anonymous');
  });

  it('logout clears the user', async () => {
    const loginFetch = vi.fn().mockResolvedValue(jsonResponse(200, { user: USER }));
    const api = createAuthApi({ fetch: loginFetch as unknown as (...args: unknown[]) => unknown });
    const store = createAuthStore({ api });
    await store.login({ username: 'alice', password: 'password1234' });

    // Re-create store with a fetch that handles both endpoints.
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/login')) return jsonResponse(200, { user: USER });
      if (String(url).endsWith('/auth/logout')) return { ok: true, status: 204, statusText: 'No Content', headers: { get: () => null } };
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });
    await s.login({ username: 'alice', password: 'password1234' });
    expect(s.status).toBe('authenticated');
    await s.logout();
    expect(s.getSnapshot()).toEqual({ status: 'anonymous', user: null, verified: false });
    expect(s.signOut).toBeTypeOf('function');
  });

  it('logout failure throws and reverts state', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/login')) return jsonResponse(200, { user: USER });
      if (String(url).endsWith('/auth/logout')) return jsonResponse(500, { message: 'boom' });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });
    await s.login({ username: 'alice', password: 'password1234' });

    let thrown: unknown;
    try {
      await s.logout();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AuthError);
    expect(s.status).toBe('authenticated');
  });

  it('verify with a token string authenticates and clears the token', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/verify')) return jsonResponse(200, { user: VERIFIED_USER });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi, token: 'raw-token' });
    expect(s.token).toBe('raw-token');

    await s.verify('raw-token');

    expect(s.getSnapshot()).toEqual({ status: 'authenticated', user: VERIFIED_USER, verified: true });
    expect(s.token).toBeNull();
  });

  it('verify uses the stored token when no argument is given', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/verify')) return jsonResponse(200, { user: VERIFIED_USER });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });
    s.setToken('stored-token');

    await s.verify();

    expect(s.token).toBeNull();
    expect(bothFetch).toHaveBeenCalledWith('/auth/verify', expect.objectContaining({
      body: JSON.stringify({ token: 'stored-token' }),
    }));
  });

  it('verify failure throws and reverts state', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/verify')) return jsonResponse(400, { message: 'invalid or expired token', code: 'invalid_token' });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });

    let thrown: unknown;
    try {
      await s.verify('bad-token');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AuthError);
    expect(s.status).toBe('anonymous');
  });

  it('verify aliases work', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/verify')) return jsonResponse(200, { user: VERIFIED_USER });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });
    await s.verifyEmail({ token: 't' });
    expect(s.status).toBe('authenticated');
    await s.logout().catch(() => {});
  });

  it('token handling methods', () => {
    const s = createAuthStore();
    expect(s.getToken()).toBeNull();
    s.setToken('abc');
    expect(s.token).toBe('abc');
    expect(s.getToken()).toBe('abc');
    s.setVerificationToken('def');
    expect(s.token).toBe('def');
    s.clearToken();
    expect(s.token).toBeNull();
  });

  it('me success authenticates', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/me')) return jsonResponse(200, { user: VERIFIED_USER });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });

    await s.me();

    expect(s.getSnapshot()).toEqual({ status: 'authenticated', user: VERIFIED_USER, verified: true });
  });

  it('me failure sets anonymous and throws', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/me')) return jsonResponse(401, { message: 'not authenticated', code: 'not_authenticated' });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });

    let thrown: unknown;
    try {
      await s.me();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AuthError);
    expect(s.getSnapshot()).toEqual({ status: 'anonymous', user: null, verified: false });
  });

  it('me aliases invoke the same flow', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/me')) return jsonResponse(200, { user: USER });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });
    await s.getCurrentUser();
    await s.whoami();
    await s.getUser();
    await s.fetchMe();
    await s.refresh();
    await s.refreshUser();
    await s.loadUser();
    await s.fetchCurrentUser();
    await s.checkSession();
    await s.bootstrap();
    await s.init();
    await s.restore();
    await s.hydrate();
    expect(s.status).toBe('authenticated');
  });

  it('resend does not change auth state', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/resend-verification')) return jsonResponse(202, { message: 'verification email sent' });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });

    await s.resend({ email: 'a@x.com' });
    await s.resendVerification('a@x.com');
    await s.resendVerificationEmail('a@x.com');

    expect(s.getSnapshot()).toEqual({ status: 'anonymous', user: null, verified: false });
    expect(bothFetch).toHaveBeenCalledTimes(3);
  });

  it('setUser/clear/clearUser/reset/resetState update state', () => {
    const s = createAuthStore();
    s.setUser(VERIFIED_USER);
    expect(s.getSnapshot()).toEqual({ status: 'authenticated', user: VERIFIED_USER, verified: true });
    s.clearUser();
    expect(s.getSnapshot()).toEqual({ status: 'anonymous', user: null, verified: false });
    s.setUser(USER);
    s.clear();
    expect(s.getSnapshot()).toEqual({ status: 'anonymous', user: null, verified: false });
    s.setUser(USER);
    s.reset();
    expect(s.getSnapshot()).toEqual({ status: 'anonymous', user: null, verified: false });
    s.setUser(USER);
    s.resetState();
    expect(s.getSnapshot()).toEqual({ status: 'anonymous', user: null, verified: false });
  });

  it('destroy clears listeners', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/login')) return jsonResponse(200, { user: USER });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });
    const seen: string[] = [];
    const unsub = s.subscribe((snap) => seen.push(snap!.status));
    s.destroy();
    await s.login({ username: 'alice', password: 'password1234' });
    expect(seen).toEqual([]);
    unsub();
  });

  it('factory aliases and default instance exist', () => {
    expect(typeof createAuthStore).toBe('function');
    expect(typeof createAuthStateStore).toBe('function');
    expect(typeof createAuthState).toBe('function');
    expect(typeof createStore).toBe('function');
    expect(defaultStore).toBeDefined();
    expect(authStore).toBeDefined();
  });

  it('accepts a positional api argument', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/me')) return jsonResponse(200, { user: USER });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore(bothApi);
    await s.me();
    expect(s.status).toBe('authenticated');
  });

  it('accepts fetch via options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: USER }));
    const s = createAuthStore({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    await s.me();
    expect(s.status).toBe('authenticated');
    expect(fetchMock).toHaveBeenCalled();
  });
  it('initializes as authenticated when initialUser is provided', () => {
    const s = createAuthStore({ initialUser: VERIFIED_USER });
    expect(s.getSnapshot()).toEqual({ status: 'authenticated', user: VERIFIED_USER, verified: true });
  });

  it('initializes with a provided initialStatus and token', () => {
    const s = createAuthStore({ initialStatus: 'loading', token: 'tok' });
    expect(s.status).toBe('loading');
    expect(s.token).toBe('tok');
  });

  it('creates an api from baseUrl/credentials options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: USER }));
    const s = createAuthStore({ baseUrl: 'http://localhost:8080/', credentials: 'omit', fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    await s.me();
    expect(s.status).toBe('authenticated');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('ignores a non-api first argument and treats it as options', () => {
    const s = createAuthStore({ notAnApi: true } as unknown as Record<string, unknown>);
    expect(s.status).toBe('anonymous');
  });

  it('supports a second options argument after an api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: USER }));
    const api = createAuthApi({ fetch: fetchMock as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore(api, { token: 't2' });
    expect(s.token).toBe('t2');
    await s.me();
    expect(s.status).toBe('authenticated');
  });

  it('does not let a throwing subscriber break notification', async () => {
    const bothFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/login')) return jsonResponse(200, { user: USER });
      return jsonResponse(404, { message: 'not found' });
    });
    const bothApi = createAuthApi({ fetch: bothFetch as unknown as (...args: unknown[]) => unknown });
    const s = createAuthStore({ api: bothApi });
    const seen: string[] = [];
    s.subscribe(() => {
      throw new Error('boom');
    });
    s.subscribe((snap) => seen.push(snap!.status));
    await s.login({ username: 'alice', password: 'password1234' });
    expect(seen).toContain('authenticated');
  });

});
