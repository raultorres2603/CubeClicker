import { useState, type FormEvent, type ReactElement } from 'react';

import { parseAccountFields, type AccountField } from '../auth/api';

type Mode = 'login' | 'register';

/** The authoritative user fields the forms need after a login (server-provided). */
export interface AuthFormUser {
  email?: string;
  verified?: boolean;
}

/** The narrow store surface the forms drive (the real `AuthStore` fits it). */
export interface AuthFormStore {
  login?(input: { username: string; password: string }): Promise<unknown>;
  register?(input: { username: string; email: string; password: string }): Promise<unknown>;
  getSnapshot?(): unknown;
  readonly user?: AuthFormUser | null;
}

/** The narrow API surface the forms can drive when no store is injected. */
export interface AuthFormApi {
  login?(input: { username: string; password: string }): Promise<unknown>;
  register?(input: { username: string; email: string; password: string }): Promise<unknown>;
  resend?(input: { email: string }): Promise<unknown>;
}

export interface AuthFormData {
  username: string;
  email: string;
  password: string;
}

export type AuthSubmitResult =
  | { outcome: 'success'; mode: 'login'; user: AuthFormUser | null }
  | { outcome: 'success'; mode: 'register' }
  | { outcome: 'verification'; email: string }
  | { outcome: 'email_delivery_failed'; email: string }
  | { outcome: 'error'; message: string; fields?: AccountField[] };

/** The inline error states the rendered form distinguishes. */
type FormError =
  | { kind: 'message'; message: string }
  | { kind: 'fields'; fields: AccountField[] };

export interface SubmitAuthFormOptions {
  mode: Mode;
  data: AuthFormData;
  store?: AuthFormStore | null;
  api?: AuthFormApi | null;
  onSubmit?: (mode: Mode, data: Record<string, string>) => void | Promise<void>;
  onLoginSuccess?: (data: AuthFormData, user: AuthFormUser | null) => void | Promise<void>;
  onRegisterSuccess?: (data: AuthFormData) => void | Promise<void>;
  onVerificationRequired?: (email: string) => void;
}

/** Password policy mirrors the server: length only, 12..128 on registration. */
export function authValidationError(mode: Mode, data: AuthFormData): string | null {
  if (!data.username.trim()) {
    return 'Username is required.';
  }
  if (mode === 'register') {
    if (!data.email.trim()) {
      return 'Email is required.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return 'Enter a valid email address.';
    }
    if (data.password.length < 12 || data.password.length > 128) {
      return 'Password must be 12 to 128 characters.';
    }
    return null;
  }
  if (data.password.length === 0) {
    return 'Password is required.';
  }
  return null;
}

function asUser(value: unknown): AuthFormUser | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const email = typeof record.email === 'string' ? record.email : undefined;
  const verified = typeof record.verified === 'boolean' ? record.verified : undefined;
  if (email === undefined && verified === undefined) {
    return null;
  }
  return { email, verified };
}

/** Reads the server-authoritative user the store learned from the login response. */
export function readAuthStoreUser(store: AuthFormStore | null | undefined): AuthFormUser | null {
  if (store === null || store === undefined) {
    return null;
  }
  const direct = asUser(store.user);
  if (direct !== null) {
    return direct;
  }
  if (typeof store.getSnapshot === 'function') {
    const snapshot = store.getSnapshot();
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      const record = snapshot as { user?: unknown };
      if ('user' in record) {
        return asUser(record.user);
      }
    }
    return asUser(snapshot);
  }
  return null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message.length > 0) {
    return err.message;
  }
  if (typeof err === 'string' && err.length > 0) {
    return err;
  }
  return 'request failed';
}

function errorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object' || Array.isArray(err)) {
    return undefined;
  }
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function errorFields(err: unknown): AccountField[] | undefined {
  const fields = parseAccountFields(err);
  return fields !== undefined && fields.length > 0 ? fields : undefined;
}

/**
 * The form's submit pipeline, exported so the real login/register → store →
 * session-join wiring can be exercised without a DOM.
 *
 * Ordering is deliberate: the store call is awaited first, then a verified login
 * notifies the caller (which reconnects the socket and joins as an account). An
 * unverified login never joins — it surfaces the verification-pending path.
 */
export async function submitAuthForm(options: SubmitAuthFormOptions): Promise<AuthSubmitResult> {
  const { mode, data } = options;
  const invalid = authValidationError(mode, data);
  if (invalid !== null) {
    return { outcome: 'error', message: invalid };
  }

  try {
    if (mode === 'login') {
      if (options.store && typeof options.store.login === 'function') {
        await options.store.login({ username: data.username, password: data.password });
      } else if (options.api && typeof options.api.login === 'function') {
        await options.api.login({ username: data.username, password: data.password });
      } else {
        await options.onSubmit?.('login', {
          username: data.username,
          email: data.email,
          password: data.password,
        });
      }
      const user = readAuthStoreUser(options.store);
      if (user !== null && user.verified === false) {
        const email = user.email ?? data.email;
        options.onVerificationRequired?.(email);
        return { outcome: 'verification', email };
      }
      await options.onLoginSuccess?.(data, user);
      return { outcome: 'success', mode: 'login', user };
    }

    if (options.store && typeof options.store.register === 'function') {
      await options.store.register({
        username: data.username,
        email: data.email,
        password: data.password,
      });
    } else if (options.api && typeof options.api.register === 'function') {
      await options.api.register({
        username: data.username,
        email: data.email,
        password: data.password,
      });
    } else {
      await options.onSubmit?.('register', {
        username: data.username,
        email: data.email,
        password: data.password,
      });
    }
    await options.onRegisterSuccess?.(data);
    return { outcome: 'success', mode: 'register' };
  } catch (err) {
    if (mode === 'register' && errorCode(err) === 'verification_email_failed') {
      return { outcome: 'email_delivery_failed', email: data.email };
    }
    const fields = errorFields(err);
    return fields !== undefined
      ? { outcome: 'error', message: errorMessage(err), fields }
      : { outcome: 'error', message: errorMessage(err) };
  }
}

/**
 * Login + Register forms (AC-7, AC-20).
 *
 * `mode` selects which form is rendered. When omitted it defaults to `login`.
 * Validation is client-side and length-based for passwords (12..128), mirroring
 * the server policy; the server remains authoritative. The real store/API is
 * injected by `AuthMenu`; a rejected call is rendered as an inline error and a
 * successful login only notifies the caller after the server has answered.
 */
export function AuthForms({
  mode = 'login',
  defaultMode,
  initialMode,
  type,
  variant,
  initialError,
  onSubmit,
  onCancel,
  onLogin,
  onRegister,
  onVerificationRequired,
  api,
  store,
}: {
  mode?: Mode;
  defaultMode?: Mode;
  initialMode?: Mode;
  type?: Mode;
  variant?: Mode;
  initialError?: string;
  onSubmit?: (mode: Mode, data: Record<string, string>) => void | Promise<void>;
  onCancel?: () => void;
  onLogin?: (data: AuthFormData, user: AuthFormUser | null) => void | Promise<void>;
  onRegister?: (data: AuthFormData) => void | Promise<void>;
  onSwitch?: (mode: Mode) => void;
  onVerificationRequired?: (email: string) => void;
  api?: unknown;
  store?: AuthFormStore | null;
} = {}): ReactElement {
  const resolvedMode: Mode = type ?? variant ?? initialMode ?? defaultMode ?? mode ?? 'login';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // `initialError` is captured at mount only; a later change to the prop does not
  // resync. AuthForms is remounted via `key` on view transitions (see App.tsx), so
  // a fresh mount re-reads the prop. Documented as mount-only (review F5).
  const [error, setError] = useState<FormError | null>(
    initialError ? { kind: 'message', message: initialError } : null,
  );
  const [deliveryEmail, setDeliveryEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'pending' | 'sent' | 'failed'>('idle');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setDeliveryEmail(null);
    setResendState('idle');
    setPending(true);
    try {
      const result = await submitAuthForm({
        mode: resolvedMode,
        data: { username, email, password },
        store,
        api: (api ?? null) as AuthFormApi | null,
        onSubmit,
        onLoginSuccess: onLogin,
        onRegisterSuccess: onRegister,
        onVerificationRequired,
      });
      if (result.outcome === 'error') {
        setError(
          result.fields !== undefined && result.fields.length > 0
            ? { kind: 'fields', fields: result.fields }
            : { kind: 'message', message: result.message },
        );
      } else if (result.outcome === 'email_delivery_failed') {
        setDeliveryEmail(result.email);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleResend(): Promise<void> {
    if (deliveryEmail === null || resendState === 'pending') {
      return;
    }
    setResendState('pending');
    try {
      const target = (api ?? null) as AuthFormApi | null;
      if (!target || typeof target.resend !== 'function') {
        throw new Error('resend unavailable');
      }
      await target.resend({ email: deliveryEmail });
      setResendState('sent');
    } catch {
      setResendState('failed');
    }
  }

  const isRegister = resolvedMode === 'register';
  const title = isRegister ? 'Create an account' : 'Welcome back';
  const subtitle = isRegister
    ? 'Register to keep a stable identity. We will email you a verification link.'
    : 'Sign in with your username or email.';
  const submitLabel = isRegister ? 'Register' : 'Login';
  const pendingLabel = isRegister ? 'Registering…' : 'Logging in…';

  const fieldErrors = error !== null && error.kind === 'fields' ? error.fields : null;
  const usernameHasError = fieldErrors?.includes('username') ?? false;
  const emailHasError = fieldErrors?.includes('email') ?? false;
  const accountHasError = usernameHasError && emailHasError;
  const usernameErrorId = accountHasError ? 'auth-error-account' : 'auth-error-username';
  const emailErrorId = accountHasError ? 'auth-error-account' : 'auth-error-email';
  const fieldErrorMessage = accountHasError
    ? 'That username and email are already registered.'
    : usernameHasError
      ? 'That username is already taken.'
      : emailHasError
        ? 'That email is already registered.'
        : null;
  const fieldErrorId = accountHasError
    ? 'auth-error-account'
    : usernameHasError
      ? 'auth-error-username'
      : 'auth-error-email';

  return (
    <div className="auth-forms">
      <section className="auth-panel" aria-labelledby="auth-form-title">
        <h2 className="auth-title" id="auth-form-title">
          {title}
        </h2>
        <p className="auth-subtitle">{subtitle}</p>
        <form
          className={`auth-form ${isRegister ? 'auth-form-register' : 'auth-form-login'}`}
          onSubmit={handleSubmit}
        >
          <label className="auth-field">
            <span>Username</span>
            <input
              className="auth-input"
              name="username"
              type="text"
              autoComplete="username"
              placeholder={isRegister ? undefined : 'Username or email'}
              aria-invalid={usernameHasError ? 'true' : undefined}
              aria-describedby={usernameHasError ? usernameErrorId : undefined}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </label>
          {isRegister ? (
            <label className="auth-field">
              <span>Email</span>
              <input
                className="auth-input"
                name="email"
                type="email"
                autoComplete="email"
                aria-invalid={emailHasError ? 'true' : undefined}
                aria-describedby={emailHasError ? emailErrorId : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          ) : null}
          <label className="auth-field">
            <span>Password</span>
            <input
              className="auth-input"
              name="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {fieldErrorMessage !== null ? (
            <p className="auth-error" role="alert" id={fieldErrorId}>
              {fieldErrorMessage}
            </p>
          ) : error !== null && error.kind === 'message' ? (
            <p className="auth-error" role="alert">
              {error.message}
            </p>
          ) : null}
          {deliveryEmail !== null ? (
            <div className="auth-delivery-error">
              <p className="auth-error" role="alert">
                Account created, but the verification email could not be sent.
              </p>
              <button
                className="auth-button auth-button-secondary"
                type="button"
                onClick={handleResend}
                disabled={resendState === 'pending'}
              >
                Resend verification email
              </button>
              {resendState === 'sent' ? (
                <p className="auth-status" role="status">
                  Verification email sent.
                </p>
              ) : null}
              {resendState === 'failed' ? (
                <p className="auth-error" role="alert">
                  Could not resend the verification email. Try again.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="auth-actions">
            <button className="auth-button auth-button-primary" type="submit" disabled={pending}>
              {pending ? pendingLabel : submitLabel}
            </button>
            <button className="auth-button auth-button-secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export const LoginForm = (props: Omit<Parameters<typeof AuthForms>[0], 'mode' | 'type' | 'variant' | 'defaultMode' | 'initialMode'> & { mode?: Mode } = {}) =>
  AuthForms({ ...props, mode: 'login' });
export const RegisterForm = (props: Omit<Parameters<typeof AuthForms>[0], 'mode' | 'type' | 'variant' | 'defaultMode' | 'initialMode'> & { mode?: Mode } = {}) =>
  AuthForms({ ...props, mode: 'register' });

export const Login = LoginForm;
export const Register = RegisterForm;
export const AuthForm = AuthForms;
export default AuthForms;
