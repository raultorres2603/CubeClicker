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
    expect((await screen.findByText('Email verified.')).textContent).toBe('Email verified.');
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

describe('VerifyEmail — states and branches', () => {
  it('renders loading UI for loading/verifying/pending controlled statuses', () => {
    for (const status of ['loading', 'verifying', 'pending'] as const) {
      const { unmount } = render(<VerifyEmail status={status} />);
      expect(screen.getByText('Verifying your email…').textContent).toBe('Verifying your email…');
      unmount();
    }
  });

  it('renders success UI for success/verified/done controlled statuses', () => {
    for (const status of ['success', 'verified', 'done'] as const) {
      const { unmount } = render(<VerifyEmail status={status} />);
      expect(screen.getByText('Email verified.').textContent).toBe('Email verified.');
      unmount();
    }
  });

  it('renders error UI for error/failed controlled statuses', () => {
    for (const status of ['error', 'failed'] as const) {
      const { unmount } = render(<VerifyEmail status={status} />);
      expect(screen.getByRole('alert').textContent).toBe('Invalid or expired verification link.');
      unmount();
    }
  });

  it('renders a custom controlled error message', () => {
    render(<VerifyEmail status="error" error="boom" />);
    expect(screen.getByRole('alert').textContent).toBe('boom');
  });

  it('shows missing verification token when token is absent', async () => {
    render(<VerifyEmail token="" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('missing verification token');
  });

  it('shows missing verification token when token is undefined', async () => {
    render(<VerifyEmail />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('missing verification token');
  });

  it('does not auto-run when a controlled status is provided', async () => {
    const verify = vi.fn(async () => undefined);
    const store = { verify };
    render(<VerifyEmail token="token-123" status="success" store={store} />);
    // give effects a chance
    await new Promise((r) => setTimeout(r, 10));
    expect(verify).toHaveBeenCalledTimes(0);
  });

  it('verifies through the api when no store is provided', async () => {
    const verify = vi.fn(async () => undefined);
    const api = { verify };
    render(<VerifyEmail token="token-123" api={api} />);
    await waitFor(() => expect(verify).toHaveBeenCalledWith('token-123'));
    expect((await screen.findByText('Email verified.')).textContent).toBe('Email verified.');
    // concrete text
    expect((await screen.findByText('Email verified.')).textContent).toBe('Email verified.');
  });

  it('calls onError when verification fails', async () => {
    const onError = vi.fn();
    const verify = vi.fn(async () => {
      throw new Error('bad token');
    });
    const store = { verify };
    render(<VerifyEmail token="token-123" store={store} onError={onError} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('bad token');
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it('calls onVerified when verification succeeds', async () => {
    const onVerified = vi.fn();
    const verify = vi.fn(async () => undefined);
    const store = { verify };
    render(<VerifyEmail token="token-123" store={store} onVerified={onVerified} />);
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect((await screen.findByText('Email verified.')).textContent).toBe('Email verified.');
  });

  it('still shows success when bootstrap throws', async () => {
    const onVerified = vi.fn();
    const verify = vi.fn(async () => undefined);
    const bootstrap = vi.fn(async () => {
      throw new Error('bootstrap failed');
    });
    const store = { verify, bootstrap };
    render(<VerifyEmail token="token-123" store={store} onVerified={onVerified} />);
    await waitFor(() => expect(verify).toHaveBeenCalledWith('token-123'));
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect((await screen.findByText('Email verified.')).textContent).toBe('Email verified.');
  });

  it('uses me for bootstrap when bootstrap is unavailable', async () => {
    const verify = vi.fn(async () => undefined);
    const me = vi.fn(async () => undefined);
    const store = { verify, me };
    render(<VerifyEmail token="token-123" store={store} />);
    await waitFor(() => expect(verify).toHaveBeenCalledWith('token-123'));
    await waitFor(() => expect(me).toHaveBeenCalledTimes(1));
    expect((await screen.findByText('Email verified.')).textContent).toBe('Email verified.');
  });

  it('uses refresh for bootstrap when bootstrap and me are unavailable', async () => {
    const verify = vi.fn(async () => undefined);
    const refresh = vi.fn(async () => undefined);
    const store = { verify, refresh };
    render(<VerifyEmail token="token-123" store={store} />);
    await waitFor(() => expect(verify).toHaveBeenCalledWith('token-123'));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect((await screen.findByText('Email verified.')).textContent).toBe('Email verified.');
  });

  it('shows the fallback error message when verification throws a non-Error', async () => {
    const verify = vi.fn(async () => {
      throw 'nope';
    });
    const store = { verify };
    render(<VerifyEmail token="token-123" store={store} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('invalid or expired token');
  });

  it('re-runs verification when the token changes', async () => {
    const verify = vi.fn(async () => undefined);
    const store = { verify };
    const { rerender } = render(<VerifyEmail token="token-1" store={store} />);
    await waitFor(() => expect(verify).toHaveBeenCalledWith('token-1'));
    rerender(<VerifyEmail token="token-2" store={store} />);
    await waitFor(() => expect(verify).toHaveBeenCalledWith('token-2'));
  });

  it('renders a custom success message prop', () => {
    const html = renderToStaticMarkup(<VerifyEmail status="success" message="Done" />);
    expect(html).toContain('Done');
  });
});