import { useState, type ReactElement } from 'react';

/**
 * "Check your email" screen shown after registration (AC-6, AC-20).
 *
 * Offers a resend action. The email is optional display-only context; resend
 * uses the supplied `email` (or the entered value) and never changes auth state
 * on its own — the caller owns the API call.
 */
export function VerificationPending({
  email: initialEmail = '',
  message = 'Check your email to verify your account.',
  title = 'Verify your email',
  onResend,
  resendLabel = 'Resend verification email',
}: {
  email?: string;
  message?: string;
  title?: string;
  onResend?: (email: string) => void | Promise<void>;
  resendLabel?: string;
  api?: unknown;
  store?: unknown;
} = {}): ReactElement {
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResend(): Promise<void> {
    setPending(true);
    try {
      await onResend?.(email);
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="verification-pending">
      <h2>{title}</h2>
      <p>{message}</p>
      <label>
        Email
        <input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button type="button" onClick={handleResend} disabled={pending}>
        {resendLabel}
      </button>
      {sent ? <p>Verification email sent.</p> : null}
    </div>
  );
}

export const VerificationScreen = VerificationPending;
export const CheckEmail = VerificationPending;
export default VerificationPending;