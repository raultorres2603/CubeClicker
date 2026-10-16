# Security checklist — web clicker lens

Adapted from the OWASP web-top-10 mindset for a client-side game. Mark each item ✅ / ❌ / n/a with notes; failures become findings with severity.

## Injection & DOM safety
- [ ] User-controlled strings (player name, imports, URLs, feature flags) never reach `innerHTML`/`insertAdjacentHTML`; `textContent` used instead
- [ ] No `eval`, `new Function`, dynamic `<script>` injection, or remote code loading
- [ ] URL/hash parameters parsed safely and validated before use

## Secrets & data exposure
- [ ] No API keys, tokens, or private identifiers in the client bundle
- [ ] No secrets committed (`git log -p` spot-check for key patterns if in doubt)
- [ ] Error messages don't leak internal details to the UI

## Persistence integrity
- [ ] Saves validated on load; malformed/corrupted saves degrade gracefully (fresh state + non-crashing notice)
- [ ] Save schema versioned with a migration path for old versions
- [ ] Import/share features (if any) sanitize and validate before trusting
- [ ] `localStorage`/`IndexedDB` failures (quota, private mode) handled without crashing

## Dependencies & supply chain
- [ ] Every new dependency is justified, maintained, and widely used; flagged per project rules (Ask first)
- [ ] No typosquat-looking package names
- [ ] Lockfile updated only via the package manager

## Transport & embedding (if applicable)
- [ ] No mixed-content requests (https only)
- [ ] CSP considerations noted if the app adds remote content
- [ ] External embeds sandboxed with minimal permissions

## Game-specific abuse (document, don't over-engineer)
- [ ] Client-side save tampering is acknowledged; any future economy validation is server-side by design — flag if the task implies competitive/paid value stored client-side

## Real-time & untrusted messages (if applicable)
- [ ] Inbound WebSocket messages are treated as untrusted: shape/type-validated before use, unknown or malformed types ignored (no crash, no state change)
- [ ] Untrusted text from messages is rendered via `textContent` — never `innerHTML`/`insertAdjacentHTML`
- [ ] No API keys, tokens, or secrets in client code or in messages sent to or from the client
- [ ] Transport is secure in production (`wss://` on https pages; no mixed content)
- [ ] Shared state is never derived from unvalidated client-reported values (server-authoritative)
