import type { ReactElement } from 'react';

import type { TransportStatus } from '../multiplayer/transport';

/**
 * The connection banner (T14, AC-22).
 *
 * Pinned copy per transport status (plan § UI):
 * - `connecting` → `Connecting…`
 * - `disconnected` → `Connection lost — retrying…`
 * - `exhausted` → `Connection lost` plus a `Retry` button that restarts the connection
 * - `connected` → no banner at all (there is nothing to say)
 *
 * **Accessibility.** The banner is plain text, deliberately **not** a live region: the
 * shell keeps exactly one `role="status"` region (the phase announcement) so connection
 * and gameplay announcements never compete. The `Retry` button is a real focusable
 * `<button>` (the CSS gives it a visible focus ring); the text itself needs no role.
 */
export function ConnectionBanner({
  status,
  onRetry,
}: {
  status: TransportStatus;
  onRetry: () => void;
}): ReactElement | null {
  if (status === 'connected') {
    return null;
  }

  if (status === 'exhausted') {
    return (
      <div className="connection-banner">
        <span>Connection lost</span>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="connection-banner">
      {status === 'connecting' ? 'Connecting…' : 'Connection lost — retrying…'}
    </div>
  );
}
