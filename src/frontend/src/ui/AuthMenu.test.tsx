import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AuthMenu } from './AuthMenu';

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
