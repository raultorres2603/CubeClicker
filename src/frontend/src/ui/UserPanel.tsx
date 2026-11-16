import { useState, type ReactElement } from 'react';

import type { MemberState } from '../multiplayer/protocol';
import { GroupIcon } from './icons';

/**
 * The `Users on Server` panel and the spectate return command (T14, AC-16/AC-18).
 *
 * Pinned markup/copy (plan § UI):
 * - toggle button `class="users-badge"`, exact label `Users on Server`, a decorative
 *   group icon, an `aria-hidden` live dot and an `aria-hidden` `.users-count` badge
 *   (`data-count` = members + self), and `aria-expanded`;
 * - open panel: `class="users-list"`, `aria-label="Users on server"`,
 *   `<h2 class="users-list-title">Crew</h2>` immediately before the `<ul>`, the disabled
 *   own row first (`{name} (You)`), then one `<button>` per other member in slot order
 *   showing `{name} · Cube {levelIndex + 1}` with `data-level="{levelIndex + 1}"` for the
 *   CSS level chip;
 * - `Return to my cube` rendered exactly while the session is spectating (mode
 *   `viewing`), independent of whether the panel is open.
 *
 * Selecting a member closes the panel and hands the player id to the session; the
 * session owns the travel and its authority rules (a second selection mid-flight is
 * refused there). `defaultOpen` is an SSR seam: this workspace has no DOM test
 * environment, so the open panel is asserted by rendering it open instead of clicking.
 * It is never passed in production.
 *
 * **Pre-welcome gating (AC-16/F7).** The panel only exists once a server identity has been
 * assigned (`welcomed`): before the first `welcome` the own name is blank and there is no
 * server to list, so rendering the toggle, the own row or the return command would show
 * placeholders.
 *
 * The panel contributes no live-region semantics: the shell's single phase
 * announcement stays the only `role="status"` region.
 *
 * **Responsive overlay (AC-4, AC-5, AC-13; Q-3).** The root keeps the `user-panel`
 * class so `app.css` can position it absolutely, add the safe-area offsets and clamp it
 * with `max-width: min(20rem, calc(100vw - 2rem - safe-area))`. The toggle and the
 * return command stay **direct** `<button>` children because the 44 px rule is
 * `.user-panel > button`; the component adds no inline size or orientation switch, so
 * the same markup serves portrait and landscape.
 */
export function UserPanel({
  welcomed,
  selfName,
  members,
  spectating,
  onSpectate,
  onReturn,
  defaultOpen = false,
}: {
  welcomed: boolean;
  selfName: string;
  members: readonly MemberState[];
  spectating: boolean;
  onSpectate: (playerId: string) => void;
  onReturn: () => void;
  defaultOpen?: boolean;
}): ReactElement | null {
  const [open, setOpen] = useState(defaultOpen);

  if (!welcomed) {
    return null;
  }

  return (
    <div className="user-panel">
      <button
        type="button"
        className="users-badge"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <GroupIcon />
        <span className="gf-live-dot" data-live-dot="true" aria-hidden="true" />
        Users on Server
        <span className="users-count" data-count={members.length + 1} aria-hidden="true">
          {members.length + 1}
        </span>
      </button>
      {spectating ? (
        <button type="button" onClick={onReturn}>
          Return to my cube
        </button>
      ) : null}
      {open ? (
        <section className="users-list" aria-label="Users on server">
          <h2 className="users-list-title">Crew</h2>
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
                  data-level={member.levelIndex + 1}
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
