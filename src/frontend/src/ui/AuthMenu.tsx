import { useState, type ReactElement } from 'react';

import { AuthForms, type AuthFormData, type AuthFormStore } from './AuthForms';

type View = 'menu' | 'login' | 'register';

/**
 * Intro auth menu overlay (AC-18, AC-20).
 *
 * Renders the three pinned buttons `Login`, `Register` and `Play as guest` while
 * in the `menu` view. Selecting `Login`/`Register` switches to the corresponding
 * form view; `Cancel` returns to the three-button menu. The cinematic keeps
 * animating behind this overlay (no pause) — this component never blocks rendering.
 *
 * The overlay is a full-viewport backdrop that captures pointer events, so the
 * canvas cannot receive gameplay input before a choice. `store`/`api` are the
 * real auth client injected by the shell; they make the forms perform the actual
 * login/register requests.
 *
 * `defaultView`/`view` allow SSR tests to pin a particular view without clicking;
 * production always starts on `menu`.
 */
export function AuthMenu({
  defaultView = 'menu',
  view: controlledView,
  onLogin,
  onRegister,
  onGuest,
  onPlayAsGuest,
  onSelect,
  onChoose,
  onSubmit,
  onCancel,
  onLoginSuccess,
  onRegisterSuccess,
  onVerificationRequired,
  api,
  store,
}: {
  defaultView?: View;
  view?: View;
  onLogin?: () => void;
  onRegister?: () => void;
  onGuest?: () => void;
  onPlayAsGuest?: () => void;
  onSelect?: (mode: 'login' | 'register' | 'guest') => void;
  onChoose?: (mode: 'login' | 'register' | 'guest') => void;
  onSubmit?: (mode: 'login' | 'register', data: Record<string, string>) => void | Promise<void>;
  onCancel?: () => void;
  onLoginSuccess?: (data: AuthFormData) => void | Promise<void>;
  onRegisterSuccess?: (data: AuthFormData) => void | Promise<void>;
  onVerificationRequired?: (email: string) => void;
  api?: unknown;
  store?: AuthFormStore | null;
} = {}): ReactElement {
  const [internalView, setInternalView] = useState<View>(defaultView);
  const current = controlledView ?? internalView;

  const handleLogin = (): void => {
    setInternalView('login');
    onSelect?.('login');
    onChoose?.('login');
    onLogin?.();
  };
  const handleRegister = (): void => {
    setInternalView('register');
    onSelect?.('register');
    onChoose?.('register');
    onRegister?.();
  };
  const handleGuest = (): void => {
    onSelect?.('guest');
    onChoose?.('guest');
    onGuest?.();
    onPlayAsGuest?.();
  };
  const handleCancel = (): void => {
    setInternalView('menu');
    onCancel?.();
  };

  if (current === 'login') {
    return (
      <AuthForms
        mode="login"
        onSubmit={onSubmit}
        onCancel={handleCancel}
        onLogin={onLoginSuccess}
        onVerificationRequired={onVerificationRequired}
        api={api}
        store={store}
      />
    );
  }
  if (current === 'register') {
    return (
      <AuthForms
        mode="register"
        onSubmit={onSubmit}
        onCancel={handleCancel}
        onRegister={onRegisterSuccess}
        onVerificationRequired={onVerificationRequired}
        api={api}
        store={store}
      />
    );
  }

  return (
    <div
      className="auth-menu"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-menu-title"
    >
      <section className="auth-panel">
        <h1 className="auth-title" id="auth-menu-title">
          CubeClicker
        </h1>
        <p className="auth-subtitle">
          Sign in to keep your account, create one, or jump straight in as a guest.
        </p>
        <div className="auth-menu-actions">
          <button
            className="auth-button auth-button-primary"
            type="button"
            onClick={handleLogin}
          >
            Login
          </button>
          <button className="auth-button" type="button" onClick={handleRegister}>
            Register
          </button>
          <button className="auth-button" type="button" onClick={handleGuest}>
            Play as guest
          </button>
        </div>
      </section>
    </div>
  );
}

export const IntroMenu = AuthMenu;
export const AuthOverlay = AuthMenu;
export default AuthMenu;
