import { useEffect, useState, type ReactElement } from 'react';

type VerifyStatus = 'loading' | 'verifying' | 'pending' | 'success' | 'verified' | 'done' | 'error' | 'failed';

function isLoading(s: VerifyStatus): boolean {
  return s === 'loading' || s === 'verifying' || s === 'pending';
}
function isSuccess(s: VerifyStatus): boolean {
  return s === 'success' || s === 'verified' || s === 'done';
}

/**
 * Consumes a verification token from the email link and calls `POST /auth/verify`
 * (AC-5). Renders a loading state, then success or error.
 *
 * In SSR (no effects) the status can be pinned via `status`/`state`/`phase`.
 */
type VerifyStore = {
  verify?: (t: string) => Promise<unknown>;
  me?: () => Promise<unknown>;
  bootstrap?: () => Promise<unknown>;
  refresh?: () => Promise<unknown>;
} | null;

export function VerifyEmail({
  token,
  api,
  store,
  status: controlledStatus,
  state,
  phase,
  message,
  error: controlledError,
  onVerified,
  onError,
}: {
  token?: string | null;
  api?: { verify?: (t: string) => Promise<unknown> } | null;
  store?: VerifyStore;
  status?: VerifyStatus;
  state?: VerifyStatus;
  phase?: VerifyStatus;
  message?: string;
  error?: string;
  onVerified?: () => void;
  onError?: (err: unknown) => void;
} = {}): ReactElement {
  const initialStatus: VerifyStatus =
    controlledStatus ?? state ?? phase ?? 'loading';
  const [status, setStatus] = useState<VerifyStatus>(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(controlledError ?? null);
  const [successMessage, setSuccessMessage] = useState<string | null>(message ?? null);

  useEffect(() => {
    if (controlledStatus || state || phase) return; // controlled: do not auto-run
    const t = token ?? '';
    if (!t) {
      setStatus('error');
      setErrorMessage('missing verification token');
      return;
    }
    const runner = async (): Promise<void> => {
      try {
        if (store && typeof store.verify === 'function') {
          await store.verify(t);
        } else if (api && typeof api.verify === 'function') {
          await api.verify(t);
        }
        // Hydrate the client store so a freshly-verified user is recognized
        // without a second login (F2). Prefer `bootstrap` when available, then
        // `me`, then `refresh`; any failure leaves the "Continue to login"
        // fallback intact instead of masking the successful verification.
        const bootstrapFn =
          store && typeof store.bootstrap === 'function'
            ? store.bootstrap.bind(store)
            : store && typeof store.me === 'function'
              ? store.me.bind(store)
              : store && typeof store.refresh === 'function'
                ? store.refresh.bind(store)
                : null;
        if (bootstrapFn) {
          try {
            await bootstrapFn();
          } catch {
            // Verification succeeded server-side; bootstrap is best-effort.
          }
        }
        setStatus('success');
        if (!successMessage) setSuccessMessage('Email verified.');
        onVerified?.();
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'invalid or expired token');
        onError?.(err);
      }
    };
    runner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (isLoading(status)) {
    return (
      <div className="verify-email">
        <p>Verifying your email…</p>
      </div>
    );
  }

  if (isSuccess(status)) {
    return (
      <div className="verify-email">
        <p>{successMessage ?? message ?? 'Email verified.'}</p>
      </div>
    );
  }

  return (
    <div className="verify-email">
      <p role="alert">{errorMessage ?? controlledError ?? 'Invalid or expired verification link.'}</p>
    </div>
  );
}

export const VerifyEmailScreen = VerifyEmail;
export const EmailVerification = VerifyEmail;
export default VerifyEmail;