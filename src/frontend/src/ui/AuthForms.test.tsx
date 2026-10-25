import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AuthForms, LoginForm, RegisterForm } from './AuthForms';

describe('AuthForms', () => {
  it('renders the login form by default', () => {
    const html = renderToStaticMarkup(<AuthForms />);
    expect(html).toContain('Login');
    expect(html).toContain('name="username"');
    expect(html).toContain('name="password"');
    expect(html).toContain('Cancel');
  });

  it('renders the register form when mode is register', () => {
    const html = renderToStaticMarkup(<AuthForms mode="register" />);
    expect(html).toContain('Register');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });

  it('LoginForm alias renders login form', () => {
    const html = renderToStaticMarkup(<LoginForm />);
    expect(html).toContain('Login');
  });

  it('RegisterForm alias renders register form', () => {
    const html = renderToStaticMarkup(<RegisterForm />);
    expect(html).toContain('Register');
  });
});