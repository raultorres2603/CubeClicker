/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthMenu } from './AuthMenu';

afterEach(() => {
  cleanup();
});

function occurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe('AuthMenu', () => {
  it('renders the three pinned buttons in a centered vertical action column', () => {
    const html = renderToStaticMarkup(<AuthMenu />);

    expect(html).toContain(
      '<div class="auth-menu" role="dialog" aria-modal="true" aria-labelledby="auth-menu-title">',
    );
    expect(html).toContain('<section class="auth-panel">');
    expect(html).toContain('<h1 class="auth-title" id="auth-menu-title">CubeClicker</h1>');
    expect(html).toContain(
      '<p class="auth-subtitle">Sign in to keep your account, create one, or jump straight in as a guest.</p>',
    );
    expect(html).toContain('<div class="auth-menu-actions">');
    expect(html).toContain('>Login</button>');
    expect(html).toContain('>Register</button>');
    expect(html).toContain('>Play as guest</button>');
    expect(html).toContain('class="auth-button auth-button-primary"');
    expect(occurrences(html, '<button ')).toBe(3);
  });

  it('renders the login form when defaultView is login', () => {
    const html = renderToStaticMarkup(<AuthMenu defaultView="login" />);

    expect(html).toContain('<div class="auth-forms">');
    expect(html).toContain('<h2 class="auth-title" id="auth-form-title">Welcome back</h2>');
    expect(html).toContain('name="username"');
    expect(html).toContain('name="password"');
    expect(html).toContain('>Cancel</button>');
    expect(html).not.toContain('Play as guest');
  });

  it('renders the register form when defaultView is register', () => {
    const html = renderToStaticMarkup(<AuthMenu defaultView="register" />);

    expect(html).toContain('<div class="auth-forms">');
    expect(html).toContain('<h2 class="auth-title" id="auth-form-title">Create an account</h2>');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('>Cancel</button>');
  });

  it('contributes no live-region semantics', () => {
    const html = renderToStaticMarkup(<AuthMenu />);
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="status"');
  });
});

describe('AuthMenu — interaction', () => {
  it('calls onPlayAsGuest exactly once when the rendered Play as guest button is clicked', async () => {
    const onPlayAsGuest = vi.fn();
    render(<AuthMenu onPlayAsGuest={onPlayAsGuest} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Play as guest' }));
    expect(onPlayAsGuest).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect and onChoose with "login" when the rendered Login button is clicked', async () => {
    const onSelect = vi.fn();
    const onChoose = vi.fn();
    render(<AuthMenu onSelect={onSelect} onChoose={onChoose} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('login');
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith('login');
  });

  it('calls onSelect and onChoose with "register" when the rendered Register button is clicked', async () => {
    const onSelect = vi.fn();
    const onChoose = vi.fn();
    render(<AuthMenu onSelect={onSelect} onChoose={onChoose} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('register');
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith('register');
  });

  it('returns to the menu (buttons reappear) when Cancel is clicked in a form view', async () => {
    render(<AuthMenu defaultView="login" />);
    expect(screen.queryByRole('button', { name: 'Play as guest' })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Login' }).textContent).toBe('Login');
    expect(screen.getByRole('button', { name: 'Register' }).textContent).toBe('Register');
    expect(screen.getByRole('button', { name: 'Play as guest' }).textContent).toBe('Play as guest');
  });

  it('focuses the first input after mount where applicable', async () => {
    render(<AuthMenu defaultView="login" />);
    const input = screen.getByLabelText('Username');
    expect(document.activeElement).toBe(input);
  });
});

describe('AuthMenu — view switching and controlled view', () => {
  it('switches menu → login → menu when Login then Cancel are clicked', async () => {
    render(<AuthMenu />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' }).textContent).toBe('Welcome back');
    expect(screen.queryByRole('button', { name: 'Play as guest' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Login' }).textContent).toBe('Login');
    expect(screen.getByRole('button', { name: 'Register' }).textContent).toBe('Register');
    expect(screen.getByRole('button', { name: 'Play as guest' }).textContent).toBe('Play as guest');
  });

  it('switches menu → register → menu when Register then Cancel are clicked', async () => {
    render(<AuthMenu />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'Create an account' }).textContent).toBe('Create an account');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Play as guest' }).textContent).toBe('Play as guest');
  });

  it('stays on the login form after Cancel when view is controlled', async () => {
    render(<AuthMenu view="login" />);
    expect(screen.getByRole('heading', { name: 'Welcome back' }).textContent).toBe('Welcome back');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' }).textContent).toBe('Welcome back');
    expect(screen.queryByRole('button', { name: 'Play as guest' })).toBeNull();
  });

  it('renders the register form when defaultView is register', () => {
    render(<AuthMenu defaultView="register" />);
    expect(screen.getByRole('heading', { name: 'Create an account' }).textContent).toBe('Create an account');
  });

  it('calls onLogin when the Login button is clicked', async () => {
    const onLogin = vi.fn();
    render(<AuthMenu onLogin={onLogin} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('calls onRegister when the Register button is clicked', async () => {
    const onRegister = vi.fn();
    render(<AuthMenu onRegister={onRegister} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it('calls onGuest when the Play as guest button is clicked', async () => {
    const onGuest = vi.fn();
    render(<AuthMenu onGuest={onGuest} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Play as guest' }));
    expect(onGuest).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect and onChoose with guest when Play as guest is clicked', async () => {
    const onSelect = vi.fn();
    const onChoose = vi.fn();
    render(<AuthMenu onSelect={onSelect} onChoose={onChoose} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Play as guest' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('guest');
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith('guest');
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    render(<AuthMenu defaultView="login" onCancel={onCancel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders the intro skip hint', () => {
    const html = renderToStaticMarkup(<AuthMenu />);
    expect(html).toContain('Press any key to skip the intro');
  });
});
