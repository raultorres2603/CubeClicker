# Real-Time Feature Backlog

> Provisional direction — **not commitments**. Nothing here is promised, scheduled, or approved.

This file exists so that online and real-time feature ideas raised in conversation are captured in one visible place as direction, instead of being lost or silently treated as planned work.

## Candidates from the request

- **Live statistics** — shared stats that update live and are visible to connected players.
- **Other users' clicks** — seeing other connected players' click activity as it happens.
- **Connected users** — seeing which players are currently connected to the game.

The request's "etc." stays open: further candidates are added here at the user's discretion.

## Proposed additions (unconfirmed — not requested, not committed)

- **Global live counter** — one shared counter incremented by every player's clicks.
- **Live leaderboard** — a running ranking of players by score or activity.
- **Community milestones** — shared goals that unlock once the community reaches a collective total.

## Open tensions

- **Identity vs. accounts.** Resolved by the user-authentication feature: accounts are an optional identity layer on top of ephemeral guest identity; guest play remains first-class and no account is ever required to play. Presence and attribution features may build on either identity. (Other backlog items remain provisional.)
- **Server authority.** Anything shared across clients has one authoritative source, and values reported by a client are never treated as truth. How that is structured is a design question for whichever feature needs it.

Items become real only through the normal feature-request workflow (spec → plan → build). Until then this list is direction only. The user owns this list and may add, reword, or remove entries at will.
