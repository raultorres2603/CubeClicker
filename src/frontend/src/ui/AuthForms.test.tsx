/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AuthForms,
  LoginForm,
  RegisterForm,
  authValidationError,
  readAuthStoreUser,
  submitAuthForm,
  type AuthFormStore,
} from './AuthForms';

afterEach(() => {
  cleanup();
});

const LOGIN_DATA = {
  username: 'alice',
  email: '',
  password: 'correct horse battery',
};

const REGISTER_DATA = {
  username: 'alice',
  email: 'alice@example.com',
  password: 'correct horse battery',
};

const VERIFIED_USER = { email: 'alice@example.com', verified: true };
const UNVERIFIED_USER = { email: 'alice@example.com', verified: false };

function storeFor(
  user: { email?: string; verified?: boolean } | null,
  calls: {
    login?: AuthFormStore['login'];
    register?: AuthFormStore['register'];
  } = {},
): AuthFormStore {
  return { user, login: calls.login, register: calls.register };
}

describe('AuthForms', () => {
  it('renders the login form by default with labeled fields and a primary submit', () => {
    const html = renderToStaticMarkup(<AuthForms />);

    expect(html).toContain('<div class="auth-forms">');
    expect(html).toContain('<form class="auth-form auth-form-login">');
    expect(html).toContain('<h2 class="auth-title" id="auth-form-title">Welcome back</h2>');
    expect(html).toContain('name="username"');
    expect(html).toContain('name="password"');
    expect(html).not.toContain('name="email"');
    expect(html).toContain('class="auth-button auth-button-primary"');
    expect(html).toContain('>Login</button>');
    expect(html).toContain('>Cancel</button>');
  });

  it('renders the register form when mode is register', () => {
    const html = renderToStaticMarkup(<AuthForms mode="register" />);

    expect(html).toContain('<form class="auth-form auth-form-register">');
    expect(html).toContain('<h2 class="auth-title" id="auth-form-title">Create an account</h2>');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('>Register</button>');
    expect(html).toContain('>Cancel</button>');
  });

  it('renders a rejected login as an inline alert', () => {
    const html = renderToStaticMarkup(<AuthForms initialError="invalid credentials" />);

    expect(html).toContain(
      '<p class="auth-error" role="alert">invalid credentials</p>',
    );
  });

  it('LoginForm and RegisterForm aliases render their mode', () => {
    expect(renderToStaticMarkup(<LoginForm />)).toContain('Welcome back');
    expect(renderToStaticMarkup(<RegisterForm />)).toContain('Create an account');
  });

  it('logs in through the store and hands the authoritative user to the success callback', async () => {
    const login = vi.fn(async () => undefined);
    const onLoginSuccess = vi.fn();
    const store = storeFor(VERIFIED_USER, { login });

    const result = await submitAuthForm({
      mode: 'login',
      data: LOGIN_DATA,
      store,
      onLoginSuccess,
    });

    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({
      username: 'alice',
      password: 'correct horse battery',
    });
    expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    expect(onLoginSuccess).toHaveBeenCalledWith(LOGIN_DATA, VERIFIED_USER);
    expect(result).toEqual({
      outcome: 'success',
      mode: 'login',
      user: VERIFIED_USER,
    });
  });

  it('returns an exact error and skips the success callback when login rejects', async () => {
    const login = vi.fn(async () => {
      throw new Error('invalid credentials');
    });
    const onLoginSuccess = vi.fn();
    const store = storeFor(null, { login });

    const result = await submitAuthForm({
      mode: 'login',
      data: LOGIN_DATA,
      store,
      onLoginSuccess,
    });

    expect(result).toEqual({ outcome: 'error', message: 'invalid credentials' });
    expect(login).toHaveBeenCalledTimes(1);
    expect(onLoginSuccess).toHaveBeenCalledTimes(0);
  });

  it('registers through the store and reports success without a login callback', async () => {
    const register = vi.fn(async () => ({ message: 'verification email sent' }));
    const onRegisterSuccess = vi.fn();
    const onLoginSuccess = vi.fn();
    const store = storeFor(null, { register });

    const result = await submitAuthForm({
      mode: 'register',
      data: REGISTER_DATA,
      store,
      onRegisterSuccess,
      onLoginSuccess,
    });

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'correct horse battery',
    });
    expect(onRegisterSuccess).toHaveBeenCalledWith(REGISTER_DATA);
    expect(onLoginSuccess).toHaveBeenCalledTimes(0);
    expect(result).toEqual({ outcome: 'success', mode: 'register' });
  });

  it('routes an unverified login to verification instead of success', async () => {
    const login = vi.fn(async () => undefined);
    const onLoginSuccess = vi.fn();
    const onVerificationRequired = vi.fn();
    const store = storeFor(UNVERIFIED_USER, { login });

    const result = await submitAuthForm({
      mode: 'login',
      data: LOGIN_DATA,
      store,
      onLoginSuccess,
      onVerificationRequired,
    });

    expect(result).toEqual({ outcome: 'verification', email: 'alice@example.com' });
    expect(onVerificationRequired).toHaveBeenCalledWith('alice@example.com');
    expect(onLoginSuccess).toHaveBeenCalledTimes(0);
  });

  it('rejects a short registration password before calling the store', async () => {
    const register = vi.fn(async () => ({ message: 'verification email sent' }));
    const store = storeFor(null, { register });

    const result = await submitAuthForm({
      mode: 'register',
      data: { username: 'alice', email: 'alice@example.com', password: 'too-short' },
      store,
    });

    expect(result).toEqual({
      outcome: 'error',
      message: 'Password must be 12 to 128 characters.',
    });
    expect(register).toHaveBeenCalledTimes(0);
  });

  it('falls back to the supplied API client when no store is supplied', async () => {
    const login = vi.fn(async () => ({ user: VERIFIED_USER }));
    const onLoginSuccess = vi.fn();

    const result = await submitAuthForm({
      mode: 'login',
      data: LOGIN_DATA,
      api: { login },
      onLoginSuccess,
    });

    expect(login).toHaveBeenCalledWith({
      username: 'alice',
      password: 'correct horse battery',
    });
    expect(onLoginSuccess).toHaveBeenCalledWith(LOGIN_DATA, null);
    expect(result).toEqual({ outcome: 'success', mode: 'login', user: null });
  });

  it('falls back to the legacy onSubmit callback when no store is supplied', async () => {
    const onSubmit = vi.fn();
    const onLoginSuccess = vi.fn();

    const result = await submitAuthForm({
      mode: 'login',
      data: LOGIN_DATA,
      onSubmit,
      onLoginSuccess,
    });

    expect(onSubmit).toHaveBeenCalledWith('login', {
      username: 'alice',
      email: '',
      password: 'correct horse battery',
    });
    expect(onLoginSuccess).toHaveBeenCalledWith(LOGIN_DATA, null);
    expect(result).toEqual({ outcome: 'success', mode: 'login', user: null });
  });
});

describe('AuthForms — interaction', () => {
  const VERIFIED_USER = { email: 'alice@example.com', verified: true };

  it('submits the rendered login form and calls onLogin with the entered values', async () => {
    const onLogin = vi.fn();
    const login = vi.fn(async () => undefined);
    const store = storeFor(VERIFIED_USER, { login });
    render(<AuthForms mode="login" store={store} onLogin={onLogin} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
    expect(onLogin).toHaveBeenCalledWith(
      { username: 'alice', email: '', password: 'correct horse battery' },
      VERIFIED_USER,
    );
    expect(login).toHaveBeenCalledWith({ username: 'alice', password: 'correct horse battery' });
  });

  it('submits the rendered login form via the legacy onSubmit binding', async () => {
    const onSubmit = vi.fn();
    render(<AuthForms mode="login" onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith('login', {
      username: 'alice',
      email: '',
      password: 'correct horse battery',
    });
  });

  it('submits the rendered register form and calls onRegister with the entered values', async () => {
    const onRegister = vi.fn();
    const register = vi.fn(async () => ({ message: 'verification email sent' }));
    const store = storeFor(null, { register });
    render(<AuthForms mode="register" store={store} onRegister={onRegister} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(onRegister).toHaveBeenCalledTimes(1));
    expect(onRegister).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'correct horse battery',
    });
    expect(register).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'correct horse battery',
    });
  });

  it('renders the exact error text in the DOM when the login handler throws', async () => {
    const onLogin = vi.fn();
    const login = vi.fn(async () => {
      throw new Error('invalid credentials');
    });
    const store = storeFor(null, { login });
    render(<AuthForms mode="login" store={store} onLogin={onLogin} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('invalid credentials');
    expect(onLogin).toHaveBeenCalledTimes(0);
  });

  it('focuses the first input after mount', () => {
    render(<AuthForms mode="login" />);
    const input = screen.getByLabelText('Username');
    expect(document.activeElement).toBe(input);
  });

  it('focuses the first input after mount in register mode', () => {
    render(<AuthForms mode="register" />);
    const input = screen.getByLabelText('Username');
    expect(document.activeElement).toBe(input);
  });
});

describe('authValidationError', () => {
  it('requires a username for login', () => {
    expect(authValidationError('login', { username: '', email: '', password: 'correct horse battery' })).toBe(
      'Username is required.',
    );
  });

  it('requires a password for login', () => {
    expect(authValidationError('login', { username: 'alice', email: '', password: '' })).toBe(
      'Password is required.',
    );
  });

  it('requires an email for register', () => {
    expect(
      authValidationError('register', { username: 'alice', email: '', password: 'correct horse battery' }),
    ).toBe('Email is required.');
  });

  it('rejects a malformed email for register', () => {
    expect(
      authValidationError('register', {
        username: 'alice',
        email: 'not-an-email',
        password: 'correct horse battery',
      }),
    ).toBe('Enter a valid email address.');
  });

  it('rejects a short password for register', () => {
    expect(
      authValidationError('register', {
        username: 'alice',
        email: 'alice@example.com',
        password: 'short',
      }),
    ).toBe('Password must be 12 to 128 characters.');
  });

  it('rejects a long password for register', () => {
    const long = 'a'.repeat(129);
    expect(
      authValidationError('register', {
        username: 'alice',
        email: 'alice@example.com',
        password: long,
      }),
    ).toBe('Password must be 12 to 128 characters.');
  });

  it('accepts valid login data', () => {
    expect(authValidationError('login', LOGIN_DATA)).toBeNull();
  });

  it('accepts valid register data', () => {
    expect(authValidationError('register', REGISTER_DATA)).toBeNull();
  });
});

describe('readAuthStoreUser', () => {
  it('reads the user directly from the store', () => {
    const store = storeFor(VERIFIED_USER);
    expect(readAuthStoreUser(store)).toEqual(VERIFIED_USER);
  });

  it('reads the user from getSnapshot when direct user is missing', () => {
    const store: AuthFormStore = {
      getSnapshot: () => ({ user: VERIFIED_USER }),
    };
    expect(readAuthStoreUser(store)).toEqual(VERIFIED_USER);
  });

  it('falls back to asUser on the snapshot when no user key exists', () => {
    const store: AuthFormStore = {
      getSnapshot: () => ({ email: 'alice@example.com', verified: true }),
    };
    expect(readAuthStoreUser(store)).toEqual(VERIFIED_USER);
  });

  it('returns null when the store is null', () => {
    expect(readAuthStoreUser(null)).toBeNull();
  });

  it('returns null when the store user has no email or verified field', () => {
    const store: AuthFormStore = { user: {} };
    expect(readAuthStoreUser(store)).toBeNull();
  });

  it('returns null when getSnapshot returns a non-object', () => {
    const store: AuthFormStore = {
      getSnapshot: () => null,
    };
    expect(readAuthStoreUser(store)).toBeNull();
  });
});

describe('AuthForms — mode resolution', () => {
  it('resolves mode from defaultMode', () => {
    render(<AuthForms defaultMode="register" />);
    expect(screen.getByRole('heading', { name: 'Create an account' }).textContent).toBe('Create an account');
  });

  it('resolves mode from initialMode', () => {
    render(<AuthForms initialMode="register" />);
    expect(screen.getByRole('heading', { name: 'Create an account' }).textContent).toBe('Create an account');
  });

  it('resolves mode from type', () => {
    render(<AuthForms type="register" />);
    expect(screen.getByRole('heading', { name: 'Create an account' }).textContent).toBe('Create an account');
  });

  it('resolves mode from variant', () => {
    render(<AuthForms variant="register" />);
    expect(screen.getByRole('heading', { name: 'Create an account' }).textContent).toBe('Create an account');
  });
});

describe('AuthForms — submitAuthForm extra branches', () => {
  it('falls back to the supplied API client on register', async () => {
    const register = vi.fn(async () => ({ message: 'ok' }));
    const onRegisterSuccess = vi.fn();

    const result = await submitAuthForm({
      mode: 'register',
      data: REGISTER_DATA,
      api: { register },
      onRegisterSuccess,
    });

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'correct horse battery',
    });
    expect(onRegisterSuccess).toHaveBeenCalledTimes(1);
    expect(onRegisterSuccess).toHaveBeenCalledWith(REGISTER_DATA);
    expect(result).toEqual({ outcome: 'success', mode: 'register' });
  });

  it('falls back to the legacy onSubmit callback on register', async () => {
    const onSubmit = vi.fn();
    const onRegisterSuccess = vi.fn();

    const result = await submitAuthForm({
      mode: 'register',
      data: REGISTER_DATA,
      onSubmit,
      onRegisterSuccess,
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('register', {
      username: 'alice',
      email: 'alice@example.com',
      password: 'correct horse battery',
    });
    expect(onRegisterSuccess).toHaveBeenCalledTimes(1);
    expect(onRegisterSuccess).toHaveBeenCalledWith(REGISTER_DATA);
    expect(result).toEqual({ outcome: 'success', mode: 'register' });
  });

  it('returns the thrown string as the error message', async () => {
    const login = vi.fn(async () => {
      throw 'boom';
    });
    const store = storeFor(null, { login });

    const result = await submitAuthForm({
      mode: 'login',
      data: LOGIN_DATA,
      store,
    });

    expect(result).toEqual({ outcome: 'error', message: 'boom' });
  });

  it('returns request failed when a non-Error value is thrown', async () => {
    const login = vi.fn(async () => {
      throw { code: 5 };
    });
    const store = storeFor(null, { login });

    const result = await submitAuthForm({
      mode: 'login',
      data: LOGIN_DATA,
      store,
    });

    expect(result).toEqual({ outcome: 'error', message: 'request failed' });
  });

  it('falls back to data.email when an unverified user has no email', async () => {
    const login = vi.fn(async () => undefined);
    const onVerificationRequired = vi.fn();
    const store = storeFor({ verified: false }, { login });

    const result = await submitAuthForm({
      mode: 'login',
      data: LOGIN_DATA,
      store,
      onVerificationRequired,
    });

    expect(result).toEqual({ outcome: 'verification', email: '' });
    expect(onVerificationRequired).toHaveBeenCalledWith('');
  });
});

describe('AuthForms — interaction extra', () => {
  it('shows a validation error when submitting an empty login form', async () => {
    const login = vi.fn(async () => undefined);
    const store = storeFor(VERIFIED_USER, { login });
    render(<AuthForms mode="login" store={store} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Username is required.');
    expect(login).toHaveBeenCalledTimes(0);
  });

  it('shows a validation error when registering with a short password', async () => {
    const register = vi.fn(async () => ({ message: 'verification email sent' }));
    const store = storeFor(null, { register });
    render(<AuthForms mode="register" store={store} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Password must be 12 to 128 characters.');
    expect(register).toHaveBeenCalledTimes(0);
  });

  it('calls onVerificationRequired instead of onLogin for an unverified login', async () => {
    const onLogin = vi.fn();
    const onVerificationRequired = vi.fn();
    const login = vi.fn(async () => undefined);
    const store = storeFor(UNVERIFIED_USER, { login });
    render(
      <AuthForms
        mode="login"
        store={store}
        onLogin={onLogin}
        onVerificationRequired={onVerificationRequired}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(onVerificationRequired).toHaveBeenCalledTimes(1));
    expect(onVerificationRequired).toHaveBeenCalledWith('alice@example.com');
    expect(onLogin).toHaveBeenCalledTimes(0);
  });

  it('renders the error from initialError and keeps it until submit', async () => {
    render(<AuthForms mode="login" initialError="initial problem" />);
    expect(screen.getByRole('alert').textContent).toBe('initial problem');
  });
});
