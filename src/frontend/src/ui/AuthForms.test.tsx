/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthError } from '../auth/api';
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

function conflictError(fields: ('username' | 'email')[]): AuthError {
  return new AuthError('account already exists', 409, 'duplicate_account', undefined, fields);
}

function deliveryError(): AuthError {
  return new AuthError('verification email could not be sent', 502, 'verification_email_failed');
}

async function fillRegisterForm(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText('Username'), 'alice');
  await user.type(screen.getByLabelText('Email'), 'alice@example.com');
  await user.type(screen.getByLabelText('Password'), 'correct horse battery');
  await user.click(screen.getByRole('button', { name: 'Register' }));
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

describe('AuthForms — login identifier hint (AC-7(b))', () => {
  it('keeps the Username label and adds the username-or-email placeholder and subtitle', () => {
    const html = renderToStaticMarkup(<AuthForms mode="login" />);

    expect(html).toContain(
      '<p class="auth-subtitle">Sign in with your username or email.</p>',
    );
    expect(html).toContain('placeholder="Username or email"');
  });

  it('resolves the Username label to the same input that carries the hint', () => {
    render(<AuthForms mode="login" />);

    const input = screen.getByLabelText('Username');
    expect(input.getAttribute('name')).toBe('username');
    expect(input.getAttribute('placeholder')).toBe('Username or email');
  });

  it('keeps the username placeholder off the register form', () => {
    const html = renderToStaticMarkup(<AuthForms mode="register" />);

    expect(html).not.toContain('placeholder="Username or email"');
  });
});

describe('AuthForms — field-scoped conflicts (AC-7(c))', () => {
  it('pins the username conflict to exactly one alert and the username input', async () => {
    const register = vi.fn(async () => {
      throw conflictError(['username']);
    });
    render(<AuthForms mode="register" api={{ register }} />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('auth-error-username');
    expect(alerts[0].textContent).toBe('That username is already taken.');
    const usernameInput = screen.getByLabelText('Username');
    expect(usernameInput.getAttribute('aria-invalid')).toBe('true');
    expect(usernameInput.getAttribute('aria-describedby')).toBe('auth-error-username');
    const emailInput = screen.getByLabelText('Email');
    expect(emailInput.getAttribute('aria-invalid')).toBeNull();
    expect(emailInput.getAttribute('aria-describedby')).toBeNull();
  });

  it('pins the email conflict to exactly one alert and the email input', async () => {
    const register = vi.fn(async () => {
      throw conflictError(['email']);
    });
    render(<AuthForms mode="register" api={{ register }} />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('auth-error-email');
    expect(alerts[0].textContent).toBe('That email is already registered.');
    const emailInput = screen.getByLabelText('Email');
    expect(emailInput.getAttribute('aria-invalid')).toBe('true');
    expect(emailInput.getAttribute('aria-describedby')).toBe('auth-error-email');
    const usernameInput = screen.getByLabelText('Username');
    expect(usernameInput.getAttribute('aria-invalid')).toBeNull();
    expect(usernameInput.getAttribute('aria-describedby')).toBeNull();
  });

  it('pins the account-wide conflict to one alert shared by both inputs', async () => {
    const register = vi.fn(async () => {
      throw conflictError(['username', 'email']);
    });
    render(<AuthForms mode="register" api={{ register }} />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('auth-error-account');
    expect(alerts[0].textContent).toBe('That username and email are already registered.');
    const usernameInput = screen.getByLabelText('Username');
    expect(usernameInput.getAttribute('aria-invalid')).toBe('true');
    expect(usernameInput.getAttribute('aria-describedby')).toBe('auth-error-account');
    const emailInput = screen.getByLabelText('Email');
    expect(emailInput.getAttribute('aria-invalid')).toBe('true');
    expect(emailInput.getAttribute('aria-describedby')).toBe('auth-error-account');
  });

  it('renders the email conflict through the store registration path', async () => {
    const register = vi.fn(async () => {
      throw conflictError(['email']);
    });
    const store = storeFor(null, { register });
    render(<AuthForms mode="register" store={store} />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    const alert = await screen.findByRole('alert');
    expect(alert.id).toBe('auth-error-email');
    expect(alert.textContent).toBe('That email is already registered.');
  });

  it('keeps the generic duplicate message when the response carries no fields', async () => {
    const register = vi.fn(async () => {
      throw new AuthError('account already exists', 409, 'duplicate_account');
    });
    render(<AuthForms mode="register" api={{ register }} />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe('account already exists');
    expect(alerts[0].getAttribute('id')).toBeNull();
    expect(screen.getByLabelText('Username').getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBeNull();
  });
});

describe('AuthForms — 502 delivery block (AC-7(d))', () => {
  it('renders the delivery block and resends to the submitted email', async () => {
    const register = vi.fn(async () => {
      throw deliveryError();
    });
    const resend = vi.fn(async () => ({ message: 'verification email sent' }));
    render(<AuthForms mode="register" api={{ register, resend }} />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe(
      'Account created, but the verification email could not be sent.',
    );
    const resendButton = screen.getByRole('button', { name: 'Resend verification email' });
    expect((resendButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();

    await user.click(resendButton);

    expect(resend).toHaveBeenCalledTimes(1);
    expect(resend).toHaveBeenCalledWith({ email: 'alice@example.com' });
    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Verification email sent.');
  });

  it('keeps the button enabled and shows the exact alert when resend rejects', async () => {
    const register = vi.fn(async () => {
      throw deliveryError();
    });
    const resend = vi.fn(async () => {
      throw deliveryError();
    });
    render(<AuthForms mode="register" api={{ register, resend }} />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    const resendButton = screen.getByRole('button', { name: 'Resend verification email' });
    await user.click(resendButton);

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    const alerts = screen.getAllByRole('alert');
    expect(alerts[0].textContent).toBe(
      'Account created, but the verification email could not be sent.',
    );
    expect(alerts[1].textContent).toBe('Could not resend the verification email. Try again.');
    expect(screen.queryByText('Verification email sent.')).toBeNull();
    expect((resendButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('reports the failure instead of a false success when no resend client exists', async () => {
    const register = vi.fn(async () => {
      throw deliveryError();
    });
    render(<AuthForms mode="register" api={{ register }} />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    await user.click(screen.getByRole('button', { name: 'Resend verification email' }));

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(screen.getAllByRole('alert')[1].textContent).toBe(
      'Could not resend the verification email. Try again.',
    );
    expect(screen.queryByText('Verification email sent.')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Resend verification email' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('shows success after a rejected resend is retried', async () => {
    const register = vi.fn(async () => {
      throw deliveryError();
    });
    const resend = vi
      .fn()
      .mockRejectedValueOnce(new Error('transport down'))
      .mockResolvedValueOnce({ message: 'verification email sent' });
    render(<AuthForms mode="register" api={{ register, resend }} />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    const resendButton = screen.getByRole('button', { name: 'Resend verification email' });
    await user.click(resendButton);
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));

    await user.click(resendButton);

    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Verification email sent.');
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe(
      'Account created, but the verification email could not be sent.',
    );
    expect(resend).toHaveBeenCalledTimes(2);
  });
});

describe('submitAuthForm — conflict and delivery outcomes (AC-7)', () => {
  it('returns the delivery outcome for a verification_email_failed rejection', async () => {
    const register = vi.fn(async () => {
      throw deliveryError();
    });

    const result = await submitAuthForm({
      mode: 'register',
      data: REGISTER_DATA,
      api: { register },
    });

    expect(result).toEqual({ outcome: 'email_delivery_failed', email: 'alice@example.com' });
  });

  it('returns the parsed fields with a duplicate rejection', async () => {
    const register = vi.fn(async () => {
      throw conflictError(['username', 'email']);
    });

    const result = await submitAuthForm({
      mode: 'register',
      data: REGISTER_DATA,
      api: { register },
    });

    expect(result).toEqual({
      outcome: 'error',
      message: 'account already exists',
      fields: ['username', 'email'],
    });
  });

  it('does not treat a login rejection as a delivery failure', async () => {
    const login = vi.fn(async () => {
      throw deliveryError();
    });

    const result = await submitAuthForm({
      mode: 'login',
      data: LOGIN_DATA,
      api: { login },
    });

    expect(result).toEqual({ outcome: 'error', message: 'verification email could not be sent' });
  });

  it('falls back to the plain message when register throws a non-object', async () => {
    const register = vi.fn(async () => {
      throw 'boom';
    });

    const result = await submitAuthForm({
      mode: 'register',
      data: REGISTER_DATA,
      api: { register },
    });

    expect(result).toEqual({ outcome: 'error', message: 'boom' });
  });
});
