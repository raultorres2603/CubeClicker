# Build log — T20 — E2E smoke extension

Task: T20 (2026-10-25)
Files changed: tests/e2e/smoke.mjs
What changed & why: Extended the containerized smoke test with four auth checks (register → 202, verify via Mailpit + POST /auth/verify → 200 with session cookie, login → 200 with session cookie, guest WebSocket join with mode "guest" → guest welcome) while keeping all existing backend/frontend/WebSocket/multiplayer checks. Added Mailpit polling helper and auth constants; no existing checks removed.
Decisions: Mailpit URL defaults to http://mailpit:8025 (override via MAILPIT_URL); smoke auth checks assume the compose `mailpit` service is reachable on the compose network. Verification evidence extracted from the email body via /token=([A-Za-z0-9]+)/.
Evidence:
- `node --check tests/e2e/smoke.mjs` → syntax ok
- `npm run smoke` → SMOKE PASS (12/12 checks)
  - PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
  - PASS frontend http://frontend:5173/ responds 200 with text/html
  - PASS websocket client 1 received hello from ws://backend:8080/ws
  - PASS websocket client 2 received hello from ws://backend:8080/ws
  - PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
  - PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
  - PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
  - PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
  - PASS auth register: POST /auth/register returns 202
  - PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
  - PASS auth login: POST /auth/login returns 200 with a session cookie
  - PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
Acceptance audit: AC-27 → met (smoke passes against compose db; auth register/verify/login exercise the db-backed auth path).
Deviations from spec: none. Note: a clean run requires the db schema (T19 server startup migrations) and the mailpit service to be available; verified with the schema applied and mailpit running.
