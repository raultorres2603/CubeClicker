import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { VerifyEmail } from './VerifyEmail';

describe('VerifyEmail', () => {
  it('renders a verifying state by default', () => {
    const html = renderToStaticMarkup(<VerifyEmail />);
    expect(html).toContain('Verifying your email…');
  });

  it('renders success state when status is success', () => {
    const html = renderToStaticMarkup(<VerifyEmail status="success" />);
    expect(html).toContain('Email verified.');
  });

  it('renders error state when status is error', () => {
    const html = renderToStaticMarkup(<VerifyEmail status="error" />);
    expect(html).toContain('Invalid or expired verification link.');
  });

  it('renders a custom success message', () => {
    const html = renderToStaticMarkup(<VerifyEmail status="success" message="Done" />);
    expect(html).toContain('Done');
  });
});