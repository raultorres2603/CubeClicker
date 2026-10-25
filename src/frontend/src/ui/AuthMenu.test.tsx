import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AuthMenu } from './AuthMenu';

describe('AuthMenu', () => {
  it('renders the three pinned buttons', () => {
    const html = renderToStaticMarkup(<AuthMenu />);
    expect(html).toBe(
      '<div class="auth-menu">' +
        '<button type="button">Login</button>' +
        '<button type="button">Register</button>' +
        '<button type="button">Play as guest</button>' +
        '</div>',
    );
  });

  it('renders the login form when defaultView is login', () => {
    const html = renderToStaticMarkup(<AuthMenu defaultView="login" />);
    expect(html).toContain('Login');
    expect(html).toContain('Cancel');
  });

  it('renders the register form when defaultView is register', () => {
    const html = renderToStaticMarkup(<AuthMenu defaultView="register" />);
    expect(html).toContain('Register');
    expect(html).toContain('Cancel');
  });

  it('contributes no live-region semantics', () => {
    const html = renderToStaticMarkup(<AuthMenu />);
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="status"');
  });
});