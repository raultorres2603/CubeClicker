import { useState, type ReactElement } from 'react';

import type { MemberState } from '../multiplayer/protocol';

/**
 * The `Users on Server` panel and the spectate return command (T14, AC-16/AC-18).
 *
 * Pinned markup/copy (plan § UI):
 * - toggle button, exact label `Users on Server`, with `aria-expanded`;
 * - open panel: `aria-label="Users on server"`, the disabled own row first
 *   (`{name} (You)`), then one `<button>` per other member in slot order showing
 *   `{name} · Cube {levelIndex + 1}`;
 * - `Return to my cube` rendered exactly while the session is spectating (mode
 *   `viewing`), independent of whether the panel is open.
 *
 * Selecting a member closes the panel and hands the player id to the session; the
 * session owns the travel and its authority rules (a second selection mid-flight is
 * refused there). `defaultOpen` is an SSR seam: this workspace has no DOM test
 * environment, so the open panel is asserted by rendering it open instead of clicking.
 * It is never passed in production.
 *
 * The panel contributes no live-region semantics: the shell's single phase
 * announcement stays the only `role="status"` region.
 */
export function UserPanel({
  selfName,
  members,
  spectating,
  onSpectate,
  onReturn,
  defaultOpen = false,
}: {
  selfName: string;
  members: readonly MemberState[];
  spectating: boolean;
  onSpectate: (playerId: string) => void;
  onReturn: () => void;
  defaultOpen?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="user-panel">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        Users on Server
      </button>
      {spectating ? (
        <button type="button" onClick={onReturn}>
          Return to my cube
        </button>
      ) : null}
      {open ? (
        <section aria-label="Users on server">
          <ul>
            <li>
              <button type="button" disabled>
                {selfName} (You)
              </button>
            </li>
            {members.map((member) => (
              <li key={member.playerId}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSpectate(member.playerId);
                  }}
                >
                  {member.name} · Cube {member.levelIndex + 1}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
