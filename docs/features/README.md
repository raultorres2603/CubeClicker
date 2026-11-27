# Features

Feature work runs through the agent workflow (see `AGENTS.md`). Every feature lives in `docs/features/<slug>/` with `spec.md`, `plan.md`, `tasks.md`, `status.md`, build logs, and `reviews/`.

| Slug | Title | State | Last updated |
| --- | --- | --- | --- |
| online-realtime-workflow | Online & Real-Time Workflow Alignment | accepted | 2026-10-17 |
| project-glossary | Project Glossary | accepted | 2026-10-17 |
| containerized-workflow | Containerized Workflow Alignment | accepted | 2026-10-17 |
| stack-selection | Application Stack Selection | accepted | 2026-10-18 |
| testing-criteria | Testing Acceptance Criteria | accepted | 2026-10-18 |
| agent-model-tuning | Agent Model & Effort Tuning (OpenCode Go) | accepted | 2026-10-19 |
| cube-game-frontend | Cube Game Frontend (first playable 3D experience) | accepted | 2026-10-19 |
| cube-visual-polish | Cube Visual Polish (follow-up: travel expansion, intro cinematic, burst fronting, pop animation, cursor removal) | accepted | 2026-10-21 |
| cube-visual-polish-followup | Cube Visual Polish Follow-up (backdrop coverage, framed intro dolly, travel arrival) | accepted | 2026-10-21 |
| cube-world-transition | Cube World Transition (random mini-cube counts, mini-cube-built surface, directional travel) | accepted | 2026-10-21 |
| cube-tile-lines-and-controls | Cube Tile Lines & Controls (seamed surface, no pointer rotation, WASD/arrows) | accepted | 2026-10-21 |
| multiplayer-servers | Multiplayer Servers & Spectating (online backend, X=10 server rooms, per-user cubes, spectate travel, rebalancing) | accepted | 2026-10-22 |
| multiplayer-cube-sync | Multiplayer Cube Actions & Full Spectating (remote rotation and action sync) | accepted | 2026-10-23 |
| fullscreen-responsive-layout | Fullscreen Responsive Layout (full viewport, mobile-friendly) | accepted | 2026-10-25 |
| user-authentication | User Authentication (login, registration with email activation, password hashing, guest play, dockerized DB) | accepted | 2026-10-26 |
| db-admin-browser | DB Admin Browser (local Adminer for Postgres) | accepted | 2026-10-26 |
| docs-on-feature-acceptance | Docs Update on Feature Acceptance (builder docs pass on acceptance) | accepted | 2026-10-26 |
| cube-centering | Cube Centering (background and cube position) | accepted | 2026-10-26 |
| spaceship-cursor | Spaceship Cursor (3D spaceship follows cursor, shoots mini-cubes on explosion) | accepted | 2026-10-27 |
| spaceship-cursor-polish | Spaceship Cursor Polish (farther diagonal, larger bullet ship, more delay, ignition fire) | accepted | 2026-10-27 |
| spaceship-cursor-refinement | Spaceship Cursor Refinement (smaller ship, shifted left) | accepted | 2026-10-27 |
| coin-economy | Coin Economy (coins from destroyed cubes, speed bonus, persistent per-user stats) | accepted | 2026-11-18 |
| modern-visual-overhaul | Modern Visual Overhaul (bright starfield, shadows, fighter ship, animated HUD) | accepted | 2026-10-28 |
| modern-ui-background-life | Modern UI & Background Life (border light, HUD blink, shooting stars, spaceships) | accepted | 2026-10-28 |
| futuristic-hud-blue | Futuristic HUD Blue (blue technologic HUD styling) | accepted | 2026-10-28 |
| metallic-hud-frames | Metallic HUD Frames (beveled metal frames, cyan glow) | accepted | 2026-10-28 |
| metallic-hud-frames-polish | Metallic HUD Frames Polish (trailing newline, mask guard) | accepted | 2026-10-28 |
| spending-upgrades | Spending & Upgrades (spend coins on upgrades to earn faster) | accepted | 2026-10-30 |
| idle-accrual | Idle Accrual (coins accrue while away for accounts) | accepted | 2026-10-30 |
| aws-deploy-pipeline | AWS Deploy Pipeline (Terraform infrastructure + GitHub Actions CI/CD + framework proof-of-working) | accepted | 2026-10-31 |
| manual-deploy-trigger | Manual Deploy Trigger (manual `workflow_dispatch` deploy; automatic deploy deferred while only `production` exists) | accepted | 2026-11-01 |
| workflow-hygiene | Workflow Hygiene (trailing newline in CI/CD workflows + scoped credential-audit command) | accepted | 2026-11-01 |
| smoke-mailpit-ordering | Smoke Test Mailpit Ordering Fix (one-shot smoke green 12/12 without manual Mailpit pre-start) | accepted | 2026-11-01 |
| smoke-test-hygiene | Smoke Test Hygiene (trailing newline in compose.smoke.yaml + MAILPIT_TIMEOUT_MS for readiness poll) | accepted | 2026-11-01 |
| spaceship-customization | Spaceship Customization (lootboxes from cubes, keys, appearance editor menu, live preview) | accepted | 2026-11-06 |
| spaceship-customization-minor-fixes | Spaceship Customization Minor Fixes (protocol customization type, defensive copy) | accepted | 2026-11-06 |
| spaceship-customization-layout-fix | Spaceship Customization Layout Fix (move customization menu to bottom-left) | accepted | 2026-11-06 |
| upgrades-panel-bottom-right | Upgrades Panel Bottom Right (position upgrades panel bottom-right) | accepted | 2026-11-06 |
| upgrades-buy-icon | Upgrades Buy Icon (replace Buy text with icon) | accepted | 2026-11-06 |
| realistic-lighting-materials | Realistic Lighting & Materials (ACES tone mapping, soft PCF shadows, PBR materials with clearcoat, SSAO + bloom post-processing) | accepted | 2026-11-06 |
| reference-image-game-view | Reference-Image Game View (procedural nebula/comet/ship, emerald beveled cube, rounded cyan HUD) | accepted | 2026-11-07 |
| detailed-hero-spaceship | Detailed Hero Spaceship (layered blue/orange procedural hero craft) | accepted | 2026-11-08 |
| spaceship-cursor-loot-animations | Spaceship Cursor, Granular Loot Parts & Motion (realistic pointer ship, 30-part slots, video-matched animations, adaptive quality) | accepted | 2026-11-09 |
| particle-only-click-effects | Particle-Only Click Effects (remove gold click explosion; keep green shard debris and spark particles) | accepted | 2026-11-11 |
| small-destruction-shot-fx | Small Destruction & Shot FX (little impact explosions, 140 ms mini-cube destroy, realistic tracer shot) | accepted | 2026-11-12 |
| agent-skill-migration | Agent Skill Migration & Repository-State Repair (restore pipeline skills, track imported packs, curate allow-lists, reconcile feature index) | accepted | 2026-11-12 |
| adaptive-render-budget-v2 | Adaptive Render Budget v2 (gate-deferred renderer, GPU-scaled tiers, sorted p95) | accepted | 2026-11-12 |
| frontend-delivery-hardening | Frontend Delivery Hardening (gate-deferred three.js chunk, bundle budget, nginx gzip/immutable assets, prod smoke) | accepted | 2026-11-13 |
| realtime-broadcast-batching | Real-Time Broadcast Batching (encode-once fan-out, registry index, 40 ms removal batches, 4 Hz economy coalescing) | accepted | 2026-11-13 |
| project-only-skills | Project-Only Skills (removed 33 imported packs; kept six pipeline skills; Context7 for library docs) | accepted | 2026-11-15 |
| runtime-observability | Runtime Observability (structured logs, internal Prometheus metrics, DB latency, dev-only perf overlay) | accepted | 2026-11-15 |
| live-activity-feed | Live Activity Feed (per-server events, 1/s cadence, 20-event ring, top-center ticker) | accepted | 2026-11-16 |
| server-live-leaderboard | Server Live Leaderboard (session counters, top-5 + totals, 1 Hz coalescing, left-rail panel) | accepted | 2026-11-16 |
| render-backend-migration | Render Backend Migration (Fly free-tier gate → Render free Docker backend, CI-once deploy, Vercel/Neon retained) | accepted | 2026-11-16 |
| presence-and-activity-liveness | Presence & Activity Liveness (explicit leave on pagehide; five-second activity lifetime) | accepted | 2026-11-16 |
| game-feel-overhaul | Game-Feel Overhaul (3D lootbox reveal, Neon Forge game shell) | accepted | 2026-11-17 |
| hangar-tabs-and-menu-motion | Hangar Tabs & Menu Motion (tabbed spaceship hangar, glitch menu boot, screenshot polish) | accepted | 2026-11-17 |
| remote-spaceship-customization | Remote Spaceship Customization (other players' ships + 1,351 chassis/form/shot options) | accepted | 2026-11-19 |
| brevo-smtp-email-delivery | Brevo SMTP Email Delivery & Branded Verification Email (Brevo SMTP for development/production with TLS/timeout config and SMTP-key vs REST-API-key guidance, branded table email with public PNG assets and image-blocked fallback, user-owned delivery CLI, Mailpit-pinned smoke) | accepted | 2026-11-22 |
| deploy-brevo-env-placeholders | Deployment Brevo Environment Placeholders (GitHub development/production env vars+secrets, strict placeholder guard, GitHub→Render SMTP sync, Mailpit kept local) | accepted | 2026-11-23 |
| db-schema-bootstrap-and-expiry-cleanup | DB Schema Bootstrap & Expired Verification Cleanup (in-process required-table check/create with advisory lock, structured traces, hourly expired verification-token cleanup) | accepted | 2026-11-24 |
| registration-account-exists | Registration Account Exists: Working Verification Delivery, Honest Conflicts & Resumable Registration | code_review | 2026-11-24 |
| deploy-development-manual-trigger | Manual Development Deploy Trigger | accepted | 2026-11-25 |
| brevo-api-email-transport | Brevo HTTPS Email Transport (deployed environments) | code_review | 2026-11-27 |
| production-provisioning | Production Environment Provisioning (Neon/Vercel/Render + GitHub production environment, live deploy proof) | accepted | 2026-11-27 |
| production-build-selection | Production Build Selection (optional `build_sha`: empty = latest successful `main` build, set = exact SHA) | accepted | 2026-11-27 |

States: `planning` · `spec_review` · `awaiting_approval` · `building` · `code_review` · `accepted` · `blocked` · `escalated`
