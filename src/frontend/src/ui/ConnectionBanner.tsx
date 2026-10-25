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
 *
 * **Responsive overlay (AC-4, AC-5, AC-13).** `app.css` positions `.connection-banner`
 * absolutely at the top centre, offsets it by `env(safe-area-inset-top)`, keeps the
 * container `pointer-events: none` and re-enables pointer events only on the `Retry`
 * button. `Retry` is therefore a direct `<button>` child (the `.connection-banner button`
 * rule owns its 44 px tap target), and the component adds no inline layout or
 * orientation switch, so portrait and landscape share one markup path.
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
