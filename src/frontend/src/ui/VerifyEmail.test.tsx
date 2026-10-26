/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VerifyEmail } from './VerifyEmail';

afterEach(() => {
  cleanup();
});

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

  it('calls store bootstrap after a successful verification and reflects the user', async () => {
    const user = {
      id: 'u1',
      username: 'alice',
      email: 'alice@example.com',
      verified: true,
    };
    const verify = vi.fn(async () => ({ user }));
    const bootstrap = vi.fn(async () => undefined);
    const store = {
      verify,
      bootstrap,
      getSnapshot: () => ({ status: 'authenticated', user, verified: true }),
    };

    render(<VerifyEmail token="token-123" store={store} />);

    await waitFor(() => expect(verify).toHaveBeenCalledWith('token-123'));
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
    expect(store.getSnapshot().user).toEqual(user);
    expect(await screen.findByText('Email verified.')).toBeTruthy();
  });

  it('shows an error when verification fails', async () => {
    const verify = vi.fn(async () => {
      throw new Error('invalid or expired token');
    });
    const store = { verify };

    render(<VerifyEmail token="token-123" store={store} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('invalid or expired token');
    expect(verify).toHaveBeenCalledWith('token-123');
  });
});