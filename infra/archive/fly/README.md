# Fly.io configuration — SUPERSEDED

> **SUPERSEDED — archive in place.**
> The Fly.io backend is abandoned: creating the development app hit Fly's credit-card gate, so no
> machine was ever deployed. The backend runs on a Render **free** Docker web service instead
> ([`render.yaml`](../../../render.yaml), service `cubeclicker-development`,
> `srv-dbtcvv9srm7s73au5bag`, Frankfurt), and the current cloud target is **Vercel + Render + Neon**
> — see [`docs/architecture/vercel-render-neon.md`](../../../docs/architecture/vercel-render-neon.md).
> These files are kept for history and are **not deployed** by any workflow or pipeline step. The
> Fly apps that exist have zero machines and are superseded; deleting them is a user-owned decision.

| File | What it was |
| --- | --- |
| `fly.config.toml` | Fly app configuration for the backend: `src/backend/Dockerfile`, one always-on 512 MB machine, `/healthz` checks, `METRICS_ENABLED=false` |
| `mailpit.toml` | Development-only Mailpit SMTP sink on Fly private networking (`<app>.internal`); Render's free plan has no equivalent private service, so deployed development runs guest-only |

Nothing in this directory is referenced by `.github/workflows/`, `compose.yaml`, `render.yaml` or
the running system. The superseded-era deployment reference is
[`docs/architecture/vercel-fly-neon.md`](../../../docs/architecture/vercel-fly-neon.md).
