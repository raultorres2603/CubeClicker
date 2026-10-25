import { useState, type ReactElement } from 'react';

import { AuthForms } from './AuthForms';

type View = 'menu' | 'login' | 'register';

/**
 * Intro auth menu overlay (AC-18, AC-20).
 *
 * Renders the three pinned buttons `Login`, `Register` and `Play as guest` while
 * in the `menu` view. Selecting `Login`/`Register` switches to the corresponding
 * form view; `Cancel` returns to the three-button menu. The cinematic keeps
 * animating behind this overlay (no pause) — this component never blocks rendering.
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
  onSubmit?: (mode: 'login' | 'register', data: Record<string, string>) => void;
  onCancel?: () => void;
  api?: unknown;
  store?: unknown;
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
        api={api}
        store={store}
      />
    );
  }

  return (
    <div className="auth-menu">
      <button type="button" onClick={handleLogin}>
        Login
      </button>
      <button type="button" onClick={handleRegister}>
        Register
      </button>
      <button type="button" onClick={handleGuest}>
        Play as guest
      </button>
    </div>
  );
}

export const IntroMenu = AuthMenu;
export const AuthOverlay = AuthMenu;
export default AuthMenu;