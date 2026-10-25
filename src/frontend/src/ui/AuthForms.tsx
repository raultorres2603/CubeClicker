import { useState, type FormEvent, type ReactElement } from 'react';

type Mode = 'login' | 'register';

/**
 * Login + Register forms (AC-7, AC-20).
 *
 * `mode` selects which form is rendered. When omitted it defaults to `login`.
 * Validation is client-side and length-based for passwords (12..128), mirroring
 * the server policy; the server remains authoritative.
 */
export function AuthForms({
  mode = 'login',
  defaultMode,
  initialMode,
  type,
  variant,
  onSubmit,
  onCancel,
  onLogin,
  onRegister,
}: {
  mode?: Mode;
  defaultMode?: Mode;
  initialMode?: Mode;
  type?: Mode;
  variant?: Mode;
  onSubmit?: (mode: Mode, data: Record<string, string>) => void | Promise<void>;
  onCancel?: () => void;
  onLogin?: (data: Record<string, string>) => void | Promise<void>;
  onRegister?: (data: Record<string, string>) => void | Promise<void>;
  onSwitch?: (mode: Mode) => void;
  api?: unknown;
  store?: unknown;
} = {}): ReactElement {
  const resolvedMode: Mode = type ?? variant ?? initialMode ?? defaultMode ?? mode ?? 'login';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('username is required');
      return;
    }
    if (resolvedMode === 'register') {
      if (!email.trim()) {
        setError('email is required');
        return;
      }
      if (password.length < 12 || password.length > 128) {
        setError('password must be 12 to 128 characters');
        return;
      }
    } else if (password.length === 0) {
      setError('password is required');
      return;
    }
    const data = { username, email, password };
    setPending(true);
    try {
      await onSubmit?.(resolvedMode, data);
      if (resolvedMode === 'login') await onLogin?.(data);
      else await onRegister?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'request failed');
    } finally {
      setPending(false);
    }
  }

  if (resolvedMode === 'register') {
    return (
      <div className="auth-forms">
        <form className="auth-form auth-form-register" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={pending}>
            Register
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-forms">
      <form className="auth-form auth-form-login" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>
          Login
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </form>
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