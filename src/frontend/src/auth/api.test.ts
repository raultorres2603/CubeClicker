import { describe, expect, it, vi } from 'vitest';

import {
  AuthError,
  AuthApiError,
  ApiError,
  HttpError,
  createAuthApi,
  authApi,
  me,
  default as defaultApi,
} from './api';

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): {
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
    headers: {
      get: (name: string) => (headers ? headers[name] ?? headers[name.toLowerCase()] ?? null : null),
    },
    json: async () => body,
  };
}

function emptyResponse(status: number): {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get: (name: string) => string | null };
} {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'No Content',
    headers: { get: () => null },
  };
}

describe('auth api client', () => {
  it('register posts JSON with credentials and returns the message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(202, { message: 'verification email sent' }),
    );
    const api = createAuthApi({ fetch: fetchMock });

    const result = await api.register({ username: 'alice', email: 'Alice@Example.com', password: 'password1234' });

    expect(result).toEqual({ message: 'verification email sent', user: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', email: 'Alice@Example.com', password: 'password1234' }),
    });
  });

  it('register supports positional arguments', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { message: 'verification email sent' }));
    const api = createAuthApi({ fetch: fetchMock });

    await api.register('bob', 'bob@x.com', 'password1234');

    expect(fetchMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob', email: 'bob@x.com', password: 'password1234' }),
    });
  });

  it('register throws a typed error on 409', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(409, { message: 'account already exists', code: 'duplicate_account' }),
    );
    const api = createAuthApi({ fetch: fetchMock });

    let thrown: unknown;
    try {
      await api.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    const err = thrown as AuthError;
    expect(err.status).toBe(409);
    expect(err.code).toBe('duplicate_account');
    expect(err.message).toBe('account already exists');
  });

  it('login returns the user on success', async () => {
    const user = { id: 'u1', username: 'alice', email: 'a@x.com', verified: false };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user }));
    const api = createAuthApi({ fetch: fetchMock });

    const result = await api.login({ username: 'alice', password: 'password1234' });

    expect(result).toEqual({ user });
    expect(fetchMock).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'password1234' }),
    });
  });

  it('login supports positional arguments', async () => {
    const user = { id: 'u1', username: 'alice', email: 'a@x.com', verified: false };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user }));
    const api = createAuthApi({ fetch: fetchMock });

    await api.login('alice', 'password1234');

    expect(fetchMock).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'password1234' }),
    });
  });

  it('login throws a typed error with status 401 on bad credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(401, { message: 'invalid credentials', code: 'invalid_credentials' }),
    );
    const api = createAuthApi({ fetch: fetchMock });

    let thrown: unknown;
    try {
      await api.login({ username: 'alice', password: 'wrongpassword1' });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    const err = thrown as AuthError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('invalid_credentials');
    expect(err.message).toBe('invalid credentials');
  });

  it('login throws a typed error with retryAfter on 429', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(429, { message: 'account locked', code: 'account_locked' }, { 'Retry-After': '900' }),
    );
    const api = createAuthApi({ fetch: fetchMock });

    let thrown: unknown;
    try {
      await api.login({ username: 'alice', password: 'password1234' });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    const err = thrown as AuthError;
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(900);
  });

  it('verify posts the token and returns the user', async () => {
    const user = { id: 'u1', username: 'alice', email: 'a@x.com', verified: true };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user }));
    const api = createAuthApi({ fetch: fetchMock });

    const result = await api.verify({ token: 'raw-token' });

    expect(result).toEqual({ user });
    expect(fetchMock).toHaveBeenCalledWith('/auth/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'raw-token' }),
    });
  });

  it('verify supports a raw token string', async () => {
    const user = { id: 'u1', username: 'alice', email: 'a@x.com', verified: true };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user }));
    const api = createAuthApi({ fetch: fetchMock });

    await api.verify('raw-token');

    expect(fetchMock).toHaveBeenCalledWith('/auth/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'raw-token' }),
    });
  });

  it('verify throws a typed error on a reused token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, { message: 'invalid or expired token', code: 'invalid_token' }),
    );
    const api = createAuthApi({ fetch: fetchMock });

    let thrown: unknown;
    try {
      await api.verify('used-token');
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    const err = thrown as AuthError;
    expect(err.status).toBe(400);
    expect(err.code).toBe('invalid_token');
  });

  it('resend posts the email and returns the message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { message: 'verification email sent' }));
    const api = createAuthApi({ fetch: fetchMock });

    const result = await api.resend({ email: 'a@x.com' });

    expect(result).toEqual({ message: 'verification email sent' });
    expect(fetchMock).toHaveBeenCalledWith('/auth/resend-verification', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@x.com' }),
    });
  });

  it('resend supports a raw email string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { message: 'verification email sent' }));
    const api = createAuthApi({ fetch: fetchMock });

    await api.resend('a@x.com');

    expect(fetchMock).toHaveBeenCalledWith('/auth/resend-verification', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@x.com' }),
    });
  });

  it('logout posts to /auth/logout and resolves', async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse(204));
    const api = createAuthApi({ fetch: fetchMock });

    await expect(api.logout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });

  it('me returns the user on success', async () => {
    const user = { id: 'u1', username: 'alice', email: 'a@x.com', verified: true };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user }));
    const api = createAuthApi({ fetch: fetchMock });

    const result = await api.me();

    expect(result).toEqual({ user });
    expect(fetchMock).toHaveBeenCalledWith('/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });

  it('me throws a typed error on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(401, { message: 'not authenticated', code: 'not_authenticated' }),
    );
    const api = createAuthApi({ fetch: fetchMock });

    let thrown: unknown;
    try {
      await api.me();
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    const err = thrown as AuthError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('not_authenticated');
  });

  it('uses a custom baseUrl when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: { id: 'u1', username: 'a', email: 'a@x.com', verified: true } }));
    const api = createAuthApi({ baseUrl: 'http://localhost:8080/', fetch: fetchMock });

    await api.me();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });

  it('parses text bodies when no json method is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      text: async () => JSON.stringify({ user: { id: 'u1', username: 'a', email: 'a@x.com', verified: true } }),
    });
    const api = createAuthApi({ fetch: fetchMock });

    const result = await api.me();
    expect(result).toEqual({ user: { id: 'u1', username: 'a', email: 'a@x.com', verified: true } });
  });

  it('exposes the typed error under compatibility aliases', () => {
    expect(AuthApiError).toBe(AuthError);
    expect(ApiError).toBe(AuthError);
    expect(HttpError).toBe(AuthError);
  });

  it('default instance and named exports delegate to the same client', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: { id: 'u1', username: 'a', email: 'a@x.com', verified: true } }));
    // named exports use the global fetch; stub it for this test
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await me();
      expect(result.user.id).toBe('u1');
      expect(authApi).toBe(defaultApi);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('aliases invoke the same endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: { id: 'u1', username: 'a', email: 'a@x.com', verified: true } }));
    const api = createAuthApi({ fetch: fetchMock });
    await api.signIn({ username: 'a', password: 'password1234' });
    await api.verifyToken('t');
    await api.resendVerification('a@x.com');
    await api.signOut();
    await api.getCurrentUser();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('register returns the user when the response includes one', async () => {
    const user = { id: 'u1', username: 'alice', email: 'a@x.com', verified: false };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { message: 'verification email sent', user }));
    const api = createAuthApi({ fetch: fetchMock });

    const result = await api.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });

    expect(result).toEqual({ message: 'verification email sent', user });
  });

  it('login throws a typed error when the response has no user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: 'ok' }));
    const api = createAuthApi({ fetch: fetchMock });

    let thrown: unknown;
    try {
      await api.login({ username: 'alice', password: 'password1234' });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    const err = thrown as AuthError;
    expect(err.status).toBe(500);
    expect(err.code).toBe('invalid_response');
  });

  it('verify throws a typed error when the response has no user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: 'ok' }));
    const api = createAuthApi({ fetch: fetchMock });

    let thrown: unknown;
    try {
      await api.verify('raw-token');
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    const err = thrown as AuthError;
    expect(err.status).toBe(500);
    expect(err.code).toBe('invalid_response');
  });

  it('me throws a typed error when the response has no user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: 'ok' }));
    const api = createAuthApi({ fetch: fetchMock });

    let thrown: unknown;
    try {
      await api.me();
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    const err = thrown as AuthError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('not_authenticated');
  });

  it('uses statusText and undefined code when the error body has no message or code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      headers: { get: () => null },
      json: async () => ({}),
    });
    const api = createAuthApi({ fetch: fetchMock });

    let thrown: unknown;
    try {
      await api.me();
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    const err = thrown as AuthError;
    expect(err.status).toBe(500);
    expect(err.message).toBe('Server Error');
    expect(err.code).toBeUndefined();
    expect(err.retryAfter).toBeUndefined();
  });

  it('falls back to text parsing when json throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => {
        throw new Error('bad json');
      },
      text: async () => JSON.stringify({ user: { id: 'u1', username: 'a', email: 'a@x.com', verified: true } }),
    });
    const api = createAuthApi({ fetch: fetchMock });

    const result = await api.me();
    expect(result).toEqual({ user: { id: 'u1', username: 'a', email: 'a@x.com', verified: true } });
  });

  it('uses custom credentials when provided', async () => {
    const user = { id: 'u1', username: 'a', email: 'a@x.com', verified: true };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user }));
    const api = createAuthApi({ fetch: fetchMock, credentials: 'omit' });

    await api.me();

    expect(fetchMock).toHaveBeenCalledWith('/auth/me', {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });

  it('normalizes token objects with null token to empty string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { message: 'invalid or expired token', code: 'invalid_token' }));
    const api = createAuthApi({ fetch: fetchMock });

    await expect(api.verify({ token: null })).rejects.toBeInstanceOf(AuthError);
    expect(fetchMock).toHaveBeenCalledWith('/auth/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '' }),
    });
  });
});
