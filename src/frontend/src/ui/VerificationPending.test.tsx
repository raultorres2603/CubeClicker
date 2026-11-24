/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VerificationPending } from './VerificationPending';

afterEach(() => {
  cleanup();
});

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

describe('VerificationPending — resend outcomes (AC-7(e))', () => {
  it('renders the exact alert and no success when a resend rejects', async () => {
    const onResend = vi.fn(async () => {
      throw new Error('transport down');
    });
    render(<VerificationPending email="alice@example.com" onResend={onResend} />);
    const user = userEvent.setup();

    const button = screen.getByRole('button', { name: 'Resend verification email' });
    await user.click(button);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not resend the verification email. Try again.');
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(onResend).toHaveBeenCalledWith('alice@example.com');
    expect(screen.queryByText('Verification email sent.')).toBeNull();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders the success line for a resolved resend', async () => {
    const onResend = vi.fn(async () => undefined);
    render(<VerificationPending email="alice@example.com" onResend={onResend} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Resend verification email' }));

    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Verification email sent.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onResend).toHaveBeenCalledWith('alice@example.com');
  });

  it('shows success and clears the alert when a rejected resend is retried', async () => {
    const onResend = vi
      .fn()
      .mockRejectedValueOnce(new Error('transport down'))
      .mockResolvedValueOnce(undefined);
    render(<VerificationPending email="alice@example.com" onResend={onResend} />);
    const user = userEvent.setup();

    const button = screen.getByRole('button', { name: 'Resend verification email' });
    await user.click(button);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not resend the verification email. Try again.');

    await user.click(button);

    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Verification email sent.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onResend).toHaveBeenCalledTimes(2);
  });

  it('resends to the edited address', async () => {
    const onResend = vi.fn(async () => undefined);
    render(<VerificationPending email="alice@example.com" onResend={onResend} />);
    const user = userEvent.setup();

    const input = screen.getByLabelText('Email');
    await user.clear(input);
    await user.type(input, 'bob@example.com');
    await user.click(screen.getByRole('button', { name: 'Resend verification email' }));

    expect(onResend).toHaveBeenCalledTimes(1);
    expect(onResend).toHaveBeenCalledWith('bob@example.com');
  });
});
