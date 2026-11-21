# Build log — T0 — Move the Brevo MCP credential to global config and sanitize `opencode.jsonc`

Task: T0 (2026-11-22)
Files changed: `opencode.jsonc`; `docs/features/brevo-smtp-email-delivery/build-log-T0.md`
Out-of-repo local action (explicitly authorized, never committed): `/home/raultorraco/.config/opencode/opencode.json`

## What changed & why
- Repo `opencode.jsonc` `mcp.servers.brevo`: removed `headers` (the `Authorization` credential) so the entry is reference-only with exactly the `vercel`/`Neon` key set (`type`, `url`). The file stays tracked.
- Global `/home/raultorraco/.config/opencode/opencode.json` `mcp.brevo`: added with the credential carried over in `headers.Authorization` (moved in process, not retyped) and the `context7` sibling shape (`type`, `url`, `enabled`, `headers`); file rewritten owner-only (mode 600).
- No `.gitignore`, `git rm --cached` or `skip-worktree` mechanism was used; no other file was touched.

## Inspection (entry names / key paths only, no values)
Repo `opencode.jsonc` (working copy before the move):
- top-level keys: `$schema`, `default_agent`, `permissions`, `mcp`
- `mcp.servers` entry names: `vercel`, `Neon`, `brevo`
- `vercel` keys: `type`, `url`; `Neon` keys: `type`, `url`
- `brevo` keys: `type`, `url`, `headers`; `headers` keys: `Authorization`

`git show HEAD:opencode.jsonc` entry names: `vercel`, `Neon` (the committed revision carries no `brevo` entry).

Global config candidates under `~/.config/opencode/` (`opencode.json`, `opencode.jsonc`): exactly one —
`/home/raultorraco/.config/opencode/opencode.json`
- top-level keys: `mcp`; `mcp` entry names: `context7`, `github`, `render`
- no `brevo` entry before the move; `context7` keys `type`, `url`, `enabled`, `headers` (shape copied for `brevo`)

After the move:
- repo `mcp.servers` entry names: `vercel`, `Neon`, `brevo`; `brevo` keys: `type`, `url` — no `headers`, no key pattern
- global `mcp` entry names: `context7`, `github`, `render`, `brevo`; `brevo` carries `headers.Authorization` (value not printed)

## Decisions
- Both files were read with the TypeScript JSONC parser and verified in memory (entry map, key sets, deep-equality of untouched entries) before any write; the writes are AST-located surgical text edits, so formatting, comments and unrelated settings are preserved (no `JSON.stringify` round-trip of either config).
- The credential was read from the repo working copy and written into the global entry inside the same process — never printed, never copied to a temp file, never committed.
- The global entry mirrors the global `context7` shape (`type`, `url`, `enabled`, `headers`), not the leaner repo shape.
- Global config mode set to `600` (owner-only) after the write, per spec § Pre-build repository configuration checkpoint step 3.
- Committed on the current branch (`main`) following the repository's established per-task commit convention; no branch was created and nothing was pushed.

## Evidence

### HEAD count-only checks (numbers only)
```
$ git show HEAD:opencode.jsonc | grep -cE 'xkeysib-[A-Za-z0-9]{20,}'
0
$ git show HEAD:opencode.jsonc | grep -cE 'xsmtpsib-[A-Za-z0-9]{15,}'
0
```
Both are `0`; a count above `0` would have stopped the build for user-owned key rotation.

### Tracked-tree / untracked / branch-history guards
- Tracked tree: `! git grep -qE <pinned key/assignment pattern>` → exit `0`, no output. (Before the sanitize this matched the working-copy `opencode.jsonc`, which is exactly the leak T0 removes; after the move it is clean.)
- Untracked: `! git grep --untracked -qE <pinned key/assignment pattern>` → exit `0`, no output.
- Branch history: `! git log -p origin/main..HEAD | grep -qE <pinned key/assignment pattern>` → exit `0`, no output (HEAD equals `origin/main` before the T0 commit).
- Guard self-test → `credential guard self-test: key formats matched, documented placeholders allowed`

### Diff evidence (no values)
```
$ git diff origin/main --numstat -- opencode.jsonc
4	0	opencode.jsonc
$ node -e <pinned key-path-only diff>   # HEAD vs working copy
changed key paths (names only): ["mcp.servers.brevo"]
$ git diff --check -- opencode.jsonc
(clean)
```
`origin/main` carries no `brevo` entry, so T0 adds the reference-only entry (`type`/`url`, 4 added lines); the credential-bearing `headers` line does not appear in the committed diff. The changed-key-path list names keys only, never values.

### Verify commands (tasks.md T0, verbatim; runner splits the `; `-separated list)
```
commands: 14

[$1] test "$(git show HEAD:opencode.jsonc | grep -cE 'xkeysib-[A-Za-z0-9]{20,}')" -eq 0
exit 0

[$2] test "$(git show HEAD:opencode.jsonc | grep -cE 'xsmtpsib-[A-Za-z0-9]{15,}')" -eq 0
exit 0

[$3] node -e "const ts=require('typescript');const fs=require('node:fs');const path='opencode.jsonc';const parsed=ts.parseConfigFileTextToJson(path,fs.readFileSync(path,'utf8'));if(parsed.error)throw new Error('invalid JSONC: '+ts.flattenDiagnosticMessageText(parsed.error.messageText,' '));const entries=parsed.config.mcp?.servers??parsed.config.mcp??parsed.config.mcpServers;if(entries===null||typeof entries!=='object'||Array.isArray(entries))throw new Error('opencode.jsonc must define an MCP entry map (mcp.servers, mcp, or mcpServers)');const names=Object.keys(entries);const brevo=names.filter((n)=>n.toLowerCase()==='brevo');if(brevo.length!==1)throw new Error('expected exactly one brevo entry, got '+JSON.stringify(names));const entry=entries[brevo[0]];const got=Object.keys(entry).sort();for(const refName of ['vercel','Neon']){const ref=entries[refName];if(ref===null||typeof ref!=='object')throw new Error('reference entry '+refName+' missing');const want=Object.keys(ref).sort();if(JSON.stringify(got)!==JSON.stringify(want))throw new Error('brevo entry keys '+JSON.stringify(got)+' must match '+refName+' keys '+JSON.stringify(want))}if(Object.hasOwn(entry,'headers'))throw new Error('brevo entry must not carry headers in the repo copy');if(typeof entry.type!=='string'||typeof entry.url!=='string')throw new Error('brevo entry must reference the server with type/url');if(/xkeysib-[A-Za-z0-9]{20,}|xsmtpsib-[A-Za-z0-9]{15,}/.test(JSON.stringify(entry)))throw new Error('brevo entry still carries a credential');console.log('opencode.jsonc: valid JSONC; entries '+JSON.stringify(names)+'; exactly one brevo with the vercel/Neon reference shape (keys '+JSON.stringify(got)+', no headers, no credential)')"
exit 0
opencode.jsonc: valid JSONC; entries ["vercel","Neon","brevo"]; exactly one brevo with the vercel/Neon reference shape (keys ["type","url"], no headers, no credential)

[$4] node -e "const ts=require('typescript');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const dir=path.join(os.homedir(),'.config','opencode');const candidates=['opencode.json','opencode.jsonc'].map((f)=>path.join(dir,f)).filter((f)=>fs.existsSync(f));if(candidates.length!==1)throw new Error('expected exactly one global OpenCode config (opencode.json or opencode.jsonc), found '+JSON.stringify(candidates));const file=candidates[0];const parsed=ts.parseConfigFileTextToJson(file,fs.readFileSync(file,'utf8'));if(parsed.error)throw new Error('global config is not valid JSONC: '+ts.flattenDiagnosticMessageText(parsed.error.messageText,' '));const entries=parsed.config.mcp?.servers??parsed.config.mcp??parsed.config.mcpServers;if(entries===null||typeof entries!=='object'||Array.isArray(entries))throw new Error('global config has no MCP entry map');const names=Object.keys(entries);const brevo=names.filter((n)=>n.toLowerCase()==='brevo');if(brevo.length!==1)throw new Error('global config must carry exactly one brevo entry, got '+JSON.stringify(names));const headers=entries[brevo[0]].headers??{};const auth=Array.isArray(headers.Authorization)?headers.Authorization.join(' '):String(headers.Authorization??'');if(!/xkeysib-[A-Za-z0-9]{20,}|xsmtpsib-[A-Za-z0-9]{15,}/.test(auth))throw new Error('global brevo entry does not carry headers.Authorization with a key');console.log('global '+file+': entries '+JSON.stringify(names)+'; brevo present with headers.Authorization (value not printed)')"
exit 0
global /home/raultorraco/.config/opencode/opencode.json: entries ["context7","github","render","brevo"]; brevo present with headers.Authorization (value not printed)

[$5] git diff origin/main --numstat -- opencode.jsonc
exit 0
4	0	opencode.jsonc

[$6] node -e "const ts=require('typescript');const fs=require('node:fs');const {execSync}=require('node:child_process');const parse=(s)=>{const r=ts.parseConfigFileTextToJson('config',s);if(r.error)throw new Error(ts.flattenDiagnosticMessageText(r.error.messageText,' '));return r.config};const before=parse(execSync('git show HEAD:opencode.jsonc',{encoding:'utf8'}));const after=parse(fs.readFileSync('opencode.jsonc','utf8'));const paths=[];const walk=(a,b,p)=>{if(a===b)return;const oa=a!==null&&typeof a==='object'&&!Array.isArray(a);const ob=b!==null&&typeof b==='object'&&!Array.isArray(b);if(oa&&ob){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[k],b[k],p?p+'.'+k:k)}else if(JSON.stringify(a)!==JSON.stringify(b)){paths.push(p)}};walk(before,after,'');console.log('changed key paths (names only): '+JSON.stringify(paths))"
exit 0
changed key paths (names only): ["mcp.servers.brevo"]

[$7] ! git diff origin/main -- opencode.jsonc | grep -qE 'xkeysib-|xsmtpsib-'
exit 0

[$8] ! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
exit 0

[$9] ! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
exit 0

[$10] ! git log -p origin/main..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
exit 0

[$11] node -e "const cases=[['xsmtpsib-15','xsmtpsib-'+ 'a'.repeat(15),/xsmtpsib-[A-Za-z0-9]{15,}/],['xkeysib-24','xkeysib-'+'b'.repeat(24),/xkeysib-[A-Za-z0-9]{20,}/],['assigned-15','SMTP_PASS='+'c'.repeat(15),/SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/]];for(const [label,value,re] of cases){if(!re.test(value))throw new Error('guard pattern misses '+label)}const allowed=['SMTP_USER=<your-smtp-login>','SMTP_PASS=<SMTP key>','SMTP_USER=hostile'];for(const value of allowed){if(/SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/.test(value))throw new Error('guard rejects a documented placeholder')}console.log('credential guard self-test: key formats matched, documented placeholders allowed')"
exit 0
credential guard self-test: key formats matched, documented placeholders allowed

[$12] git diff --check -- opencode.jsonc
exit 0

[$13] test -f docs/features/brevo-smtp-email-delivery/build-log-T0.md
exit 0

[$14] ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T0.md
exit 0

SUMMARY: 14 commands, 0 failure(s)
```

### Post-commit confirmation (same 14 commands, HEAD now carries the reference entry)
All 14 commands were re-executed after the T0 commit: 14/14 exit `0`. The only expected difference is command 6, which now compares HEAD (already sanitized, with the reference entry) against the unchanged working copy and therefore reports `changed key paths (names only): []`. All other numbers are unchanged: numstat `4	0	opencode.jsonc`, HEAD key-pattern counts `0` / `0`, tracked/untracked/history guards silent, guard self-test pass.

### Tree state at commit time
Committed by T0: `opencode.jsonc` (modified) and `docs/features/brevo-smtp-email-delivery/build-log-T0.md` (added). No other tracked file is modified. Pre-existing untracked items not owned by T0 remain untouched: `.agents/`, `skills-lock.json`, and the orchestrator-owned feature artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`).
