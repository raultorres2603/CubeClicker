import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { VerificationPending } from './VerificationPending';

describe('VerificationPending', () => {
  it('renders the check-your-email message and resend button', () => {
    const html = renderToStaticMarkup(<VerificationPending />);
    expect(html).toContain('Check your email to verify your account.');
    expect(html).toContain('Resend verification email');
  });

  it('renders a custom email value', () => {
    const html = renderToStaticMarkup(<VerificationPending email="a@x.com" />);
    expect(html).toContain('a@x.com');
  });
});