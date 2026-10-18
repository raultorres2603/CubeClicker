# Build log — T3 — Scaffold foundations: manifests, configs, compose, README

Task: T3 (dispatched 2026-10-17; executed 2026-10-18 on the fixed environment)
Files changed (executed pass, § Run 4): `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`, `.dockerignore`, `compose.yaml`, `compose.smoke.yaml`, `README.md`, `src/backend/package.json`, `src/frontend/package.json` — the eleven T3 scaffold paths, all net-new — plus `docs/features/stack-selection/build-log-T3.md` (this log).

> History note: the three blocked attempts (Run 1, Run 2) and the read-only post-install environment re-check (Run 3) below are retained verbatim as frozen evidence, including their pre-amendment `docker compose` tokens. The executed pass is § Run 4 at the end of this file; its "Files changed" line above supersedes the header wording of the blocked runs.

## Run 2 (re-dispatch, 2026-10-17) — Status: **BLOCKED** (environment preconditions still absent)

The re-dispatch brief says: re-run the environment precondition checks (Node.js ≥24 + npm; Docker CLI + Compose v2 with a reachable daemon); if anything is still missing, report `blocked` immediately with the raw errors, no workarounds.

**Result: nothing changed.** Node.js, npm, Docker CLI, and the Compose v2 plugin are all still absent; there is no Docker daemon socket. T3's whole `verify` list is npm- and `docker compose`-only, and its pinned deliverable `package-lock.json` can only be produced by `npm install`. No file was authored; per the brief ("never substitute") no lockfile, manifest, compose file, or README was hand-written and no tool was substituted.

Working tree: `/var/home/raultorraco/Documents/Projects/CubeClicker`, branch `feat/stack-selection`, HEAD `7ec718f1c6d69c980bae75d7b193fe29e94b1f4e` (T2 committed; no other task in flight).

### 1. Precondition probes (raw)

```
$ node --version
/bin/bash: line 4: node: command not found
exit=127
$ npm --version
/bin/bash: line 4: npm: command not found
exit=127
$ docker --version
/bin/bash: line 4: docker: command not found
exit=127
$ docker compose version
/bin/bash: line 4: docker: command not found
exit=127
$ docker info --format {{.ServerVersion}}
/bin/bash: line 4: docker: command not found
exit=127

$ command -v node npm docker docker-compose podman
/usr/bin/podman
exit=0

$ bash -lc 'command -v node npm docker; echo "exit=$?"'
exit=1                      # nothing in a login shell either (PATH: ~/.opencode/bin, ~/.local/bin, ~/bin, /usr/local/bin, /usr/bin, /bin, /usr/local/sbin, linuxbrew)

$ ls -la /run/docker.sock /var/run/docker.sock
ls: cannot access '/run/docker.sock': No such file or directory
ls: cannot access '/var/run/docker.sock': No such file or directory
exit=2

$ find / -maxdepth 4 -name node -type f -perm -u+x 2>/dev/null      → (no Node binary)
$ find / -maxdepth 4 -name docker 2>/dev/null                       → /usr/share/distribution-gpg-keys/docker (keyring dir only, no CLI)
$ ls -d ~/.nvm ~/.volta                                             → No such file or directory
```

### 2. Podman is present but is NOT the decided tooling (not usable as a workaround)

```
$ podman --version
podman version 5.8.7
exit=0
$ podman compose version
Error: looking up compose provider failed
7 errors occurred:
	* exec: "/home/raultorraco/.docker/cli-plugins/docker-compose": stat /home/raultorraco/.docker/cli-plugins/docker-compose: no such file or directory
```

`AGENTS.md` § Stack and `docs/architecture/containerization.md` name **Docker + Docker Compose**; AC-13/AC-14/AC-26 name `docker compose` token-for-token. Substituting Podman (with no Compose provider installed) would be an unapproved tooling change, not a fix — so it was not attempted.

### 3. What is NOT missing (the block is tooling-only)

```
$ python3 --version
Python 3.14.8

$ python3 - (socket probes)
registry.npmjs.org:443    REACHABLE
registry-1.docker.io:443  REACHABLE
localhost:8080            UNREACHABLE -> ConnectionRefusedError [Errno 111] (expected: nothing running)
localhost:5173            UNREACHABLE -> ConnectionRefusedError [Errno 111] (expected: nothing running)
port 8080 free
port 5173 free

$ dnf list --available nodejs24 docker-cli docker-compose
nodejs24.x86_64        1:24.18.0-1.fc44   updates
docker-cli.x86_64      29.8.2-2.fc44      updates
docker-compose.x86_64  5.6.0-1.fc44       updates
```

Network to the npm registry and the container registry works, both pinned host loopback ports are free, and all three missing capabilities are installable from the Fedora 44 repos (`nodejs24` 24.18.0 ≥ 24, `docker-cli` 29.8.2, `docker-compose` 5.6.0). Installing host packages is an environment/user action (needs sudo, mutates the host) and is outside builder scope — and the brief forbids working around the precondition.

### 4. Build-start baseline (unchanged; nothing authored, nothing staged)

```
$ git status --short
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/build-log-T3.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md

$ ls -A
AGENTS.md  docs  .git  .gitattributes  LICENSE  .opencode  opencode.jsonc
```

All eleven T3 scaffold paths (`package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`, `.dockerignore`, `compose.yaml`, `compose.smoke.yaml`, `README.md`, `src/backend/package.json`, `src/frontend/package.json`) are still absent — every one is a net-new file, so there are no pre-existing baselines to capture. T2's framework edits are now committed (`7ec718f`), so the only dirty entries are the pre-existing foreign files (`docs/features/README.md`, `docs/features/project-glossary/status.md`) plus the untracked stack-selection artifacts — all left untouched and unstaged. No `.env*` file exists (`find . -maxdepth 3 -name '.env*'` → no output). Nothing was committed in this run (`git log -- build-log-T3.md` → no output).

### 5. Acceptance audit (T3 scope: AC-12, AC-13, AC-14, AC-18, AC-29)

- AC-12 (README with prerequisites/quickstart/commands/env/prod-image/stack sections) → **unmet** — blocked; `README.md` not authored. The README is authored together with the verified lockfile so the two cannot drift.
- AC-13 (`compose.yaml` shape; `docker compose config -q` exits 0) → **unmet** — blocked; authoring without the AC's exit-0 evidence is not permitted, and `docker compose` does not exist on this host.
- AC-14 (`compose.smoke.yaml` + merged `docker compose -f compose.yaml -f compose.smoke.yaml config -q` exit 0; three services) → **unmet** — blocked; same reason.
- AC-18 (`.gitignore`/`.dockerignore` coverage; no `.env*`; no secrets) → **unmet** — blocked; neither ignore file authored. Partial positive: no `.env*` file exists and no scaffold file, image, or secret was produced (see § 4).
- AC-29 (root `package.json` pinned keys/scripts; workspace manifests' pinned dependency sets) → **unmet** — blocked; manifests not authored. Writing them without `npm install` would omit the pinned `package-lock.json` and break `npm ci` for T4/T5 — worse than blocked.

Deviation recorded honestly: the pinned commit `chore: scaffold workspace, compose stack, and commands (T3)` was **not** made. Committing a scaffold whose pinned lockfile and pinned verify evidence cannot be produced would report success without command output, which the builder rules forbid.

## Run 1 (original dispatch) — Status: **BLOCKED** (same cause; evidence retained)

Run 1 reached the identical conclusion with the same raw errors (node/npm/docker all `exit=127`; no `~/.nvm`/`~/.volta`; `podman version 5.8.7` present but not the decided tooling and without a Compose provider; registry reachable; ports 8080/5173 free and unbound). Additionally it verified there is no alternate toolchain location:

```
$ command -v npx corepack tsc tsx vitest eslint docker-compose
(no output — none present)
$ rpm -qa | grep -i -E 'node|docker|npm|compose'
composefs-libs-1.0.8-5.fc44.x86_64        # unrelated filesystem lib
composefs-1.0.8-5.fc44.x86_64             # unrelated filesystem lib
$ ls -la /run/podman/podman.sock
ls: cannot access '/run/podman/podman.sock': Permission denied
```

Run 1 also recorded the same all-eleven-paths-absent baseline (then with T2's six framework edits still dirty; those are now committed as `7ec718f`).

## Exact question for the orchestrator / user

The build host still has no Node.js/npm and no Docker CLI + Compose v2 (raw errors above), so T3 cannot be executed and cannot be honestly marked complete. Which path is authorized?

1. **(recommended, unchanged)** Environment fix, then re-dispatch T3 as written: install `nodejs24` (24.18.0), `docker-cli` (29.8.2), `docker-compose` (5.6.0) with a reachable daemon on the build host, then re-run T3 with zero spec/plan changes (every pinned value stays as planned).
2. Spec revision to run T3 (and T4–T7) in an environment that provides Node ≥24 + npm + Docker Compose v2 (e.g. a dev container / CI runner) and record the evidence there — requires a spec revision because AC-13/AC-14/AC-26 name `docker compose` explicitly.
3. (not recommended; needs an explicit user-owned amendment) Replace the decided Docker/Compose tooling with the host's Podman — `podman compose` currently fails with "looking up compose provider failed", and the pinned docs/ACs name `docker compose` token-for-token.

No workaround was attempted and no file outside T3's `files_owned` was touched (this log is the only write).

## Environment re-check — post-install (2026-10-17)

Read-only precondition re-check after the user reported: "I have installed podman desktop and Node 24 with npm aswell." No installs, no `sudo`, no service start/stop, no git commands, no builds, no `compose up`. Only this section was appended; Runs 1–2 above are untouched.

Raw outputs follow. Exit codes are as printed by the shell; commands that could be slow were run under `timeout 30`/`45`/`60` and returned promptly (no hang, no timeout kill).

### 1. Binary/path presence

```
$ command -v node npm docker podman podman-compose docker-compose nerdctl
/home/linuxbrew/.linuxbrew/bin/node
/home/linuxbrew/.linuxbrew/bin/npm
/usr/bin/podman
/usr/local/bin/docker-compose
exit=0

$ bash -lc 'command -v node npm docker podman'
/home/linuxbrew/.linuxbrew/bin/node
/home/linuxbrew/.linuxbrew/bin/npm
/usr/bin/podman
exit=0

$ bash -lc 'echo "$PATH"'
/home/raultorraco/.opencode/bin:/home/raultorraco/.opencode/bin:/home/raultorraco/.local/bin:/home/raultorraco/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin
```

`node`/`npm` now resolve in both plain and login shells (Homebrew is on PATH in both). `docker`, `podman-compose`, `nerdctl` still absent.

### 2. Versions

```
$ node --version
v24.22.0
exit=0
$ npm --version
11.19.1
exit=0
$ docker --version
timeout: failed to run command 'docker': No such file or directory
exit=127
$ docker compose version
timeout: failed to run command 'docker': No such file or directory
exit=127
$ podman --version
podman version 5.8.7
exit=0
```

### 3. Docker functionality

```
$ docker info
timeout: failed to run command 'docker': No such file or directory
exit=127

$ ls -la /var/run/docker.sock /run/docker.sock /run/user/$(id -u)/podman/podman.sock /run/podman/podman.sock
ls: cannot access '/var/run/docker.sock': No such file or directory
ls: cannot access '/run/docker.sock': No such file or directory
ls: cannot access '/run/podman/podman.sock': Permission denied
srw-------. 1 raultorraco raultorraco 0 Oct 17 23:21 /run/user/1000/podman/podman.sock
exit=2
```

No Docker CLI, no Docker daemon socket. The only socket is the rootless Podman user socket, owned by the current user.

### 4. Podman functionality

```
$ podman info | head -40
host:
  arch: amd64
  buildahVersion: 1.43.4
  cgroupControllers:
  - cpu
  - io
  - memory
  - pids
  - dmem
  cgroupManager: systemd
  cgroupVersion: v2
  conmon:
    package: conmon-2.2.1-2.fc44.x86_64
    path: /usr/bin/conmon
    version: 'conmon version 2.2.1, commit: '
  cpuUtilization:
    idlePercent: 96.2
    systemPercent: 0.98
    userPercent: 2.82
  cpus: 32
  databaseBackend: sqlite
  distribution:
    codename: Kinoite
    distribution: bazzite
    variant: bazzite-nvidia-open
    version: "44"
  emulatedArchitectures:
  - linux/arm64
  - linux/arm64be
  eventLogger: journald
  freeLocks: 2041
  hostname: HackerPC
  idMappings:
    gidmap:
    - container_id: 0
      host_id: 1000
      size: 1
    - container_id: 1
      host_id: 524288
      size: 65536
exit=0

$ podman info --format 'rootless={{.Host.Security.Rootless}} version={{.Version.Version}} socketRemote={{.Host.RemoteSocket.Path}} exists={{.Host.RemoteSocket.Exists}} graphDriver={{.Store.GraphDriverName}}'
rootless=true version=5.8.7 socketRemote=/run/user/1000/podman/podman.sock exists=true graphDriver=overlay
exit=0

$ podman ps
CONTAINER ID  IMAGE       COMMAND     CREATED     STATUS      PORTS       NAMES
exit=0

$ podman compose version
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

Docker Compose version v5.6.0
exit=0

$ systemctl --user is-active podman.socket
active
exit=0
$ systemctl is-active podman.socket
inactive
exit=3
```

Rootless Podman works as the current user; `podman compose` now resolves a compose provider (see § 5).

### 5. Docker-compat shims and the compose binary

```
$ rpm -q podman-docker moby-engine docker-ce
package podman-docker is not installed
package moby-engine is not installed
package docker-ce is not installed
exit=3

$ ls -la /usr/bin/docker
ls: cannot access '/usr/bin/docker': No such file or directory
exit=2

$ ls -la /usr/local/bin/docker-compose
-rwxr-xr-x. 1 root root 32663526 Oct 17 23:20 /usr/local/bin/docker-compose
exit=0
$ /usr/local/bin/docker-compose version
Docker Compose version v5.6.0
exit=0

$ rpm -q docker-compose docker-cli
package docker-compose is not installed
package docker-cli is not installed
exit=2

$ ls -la /usr/local/bin
total 92340
drwxr-xr-x. 1 root root       42 Oct 17 23:20 .
drwxr-xr-x. 1 root root       66 Sep 15 16:07 ..
-rwxr-xr-x. 1 root root 32663526 Oct 17 23:20 docker-compose
-rwxr-xr-x. 1 root root 61886626 Oct 17 23:20 kubectl
exit=0
```

The Compose v2 binary **is** present, but it is a standalone `/usr/local/bin/docker-compose` (dropped in by hand, root-owned, not from rpm: `rpm -q docker-compose` → not installed); there is no `docker` CLI that would provide the `docker compose` subcommand form, and no `podman-docker` shim.

### 6. Installed packages (nodejs/npm/podman/docker/moby/containerd)

```
$ rpm -qa | grep -Ei '^(nodejs|npm|podman|docker|moby|containerd)' | sort
podman-5.8.7-1.fc44.x86_64
podman-sequoia-0.3.2-2.fc44.x86_64
exit=0
```

No `nodejs`, `npm`, `docker-cli`, `docker-compose`, `moby-engine`, `containerd` rpm packages — Node/npm and the compose binary are not rpm-managed.

### 7. Podman Desktop presence

```
$ flatpak list | grep -i podman
Podman Desktop	io.podman_desktop.PodmanDesktop	1.30.5	stable	system
exit=0

$ rpm -qa | grep -i podman-desktop
exit=1

$ command -v podman-desktop
exit=1
```

Podman Desktop is installed as a **system Flatpak** (io.podman_desktop.PodmanDesktop 1.30.5); it provides no `docker`/`podman` binary on PATH (its only export is the desktop app entry). `/var/lib/flatpak/exports/bin/io.podman_desktop.PodmanDesktop` is the app launcher only.

### 8. Identity/groups

```
$ id
uid=1000(raultorraco) gid=1000(raultorraco) groups=1000(raultorraco),10(wheel),104(input) context=unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023
exit=0
```

### 9. Supplementary read-only probes (node provenance, provider→daemon connectivity)

```
$ which -a node npm
/home/linuxbrew/.linuxbrew/bin/node
/home/linuxbrew/.linuxbrew/bin/npm
exit=0
$ ls -la /home/linuxbrew/.linuxbrew/bin/node /home/linuxbrew/.linuxbrew/bin/npm
lrwxrwxrwx. 1 raultorraco raultorraco 34 Oct 17 23:24 /home/linuxbrew/.linuxbrew/bin/node -> ../Cellar/node@24/24.22.0/bin/node
lrwxrwxrwx. 1 raultorraco raultorraco 33 Oct 17 23:24 /home/linuxbrew/.linuxbrew/bin/npm -> ../Cellar/node@24/24.22.0/bin/npm
$ readlink -f /home/linuxbrew/.linuxbrew/bin/node
/var/home/linuxbrew/.linuxbrew/Cellar/node@24/24.22.0/bin/node

$ node -e 'console.log(process.version, process.execPath)'
v24.22.0 /var/home/linuxbrew/.linuxbrew/Cellar/node@24/24.22.0/bin/node
exit=0

$ podman compose ls
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

NAME                STATUS              CONFIG FILES
exit=0

$ env | grep -Ei 'docker|compose|podman'
(no output)
exit=1

$ ls -la /home/raultorraco/.docker/cli-plugins
ls: cannot access '/home/raultorraco/.docker/cli-plugins': No such file or directory
exit=2
$ ls -la /home/raultorraco/.config/containers/compose/providers /etc/containers/compose/providers.d
ls: cannot access '/home/raultorraco/.config/containers/compose/providers': No such file or directory
ls: cannot access '/etc/containers/compose/providers.d': No such file or directory
exit=2

$ for d in /usr/bin /usr/local/bin /usr/sbin ~/.local/bin ~/bin /opt; do ls -la "$d"/docker 2>/dev/null; done; echo done
done
```

Node/npm come from the Homebrew formula `node@24` (24.22.0), installed today (symlinks dated Oct 17 23:24). `podman compose ls` completes with an empty project list — i.e. the external provider starts and reaches the live Podman daemon. No `DOCKER_HOST`/compose/podman env vars are set in this shell. No `docker` binary in any of the common binary directories.

### 10. Verdict of this re-check (facts only; no workaround attempted)

**(a) Pinned preconditions — split result, not met:**
- Node.js ≥24 + npm → **MET**: `node v24.22.0`, `npm 11.19.1` (both plain and login shell).
- Docker CLI + Compose v2 with a reachable daemon → **NOT MET**: no `docker` binary on PATH or in `/usr/bin`, `/usr/local/bin`, `/usr/sbin`, `~/.local/bin`, `~/bin`, `/opt`; no `/var/run/docker.sock` or `/run/docker.sock`; `docker --version`/`docker compose version`/`docker info` all `exit=127`. A Compose v2 binary exists (`/usr/local/bin/docker-compose` → `Docker Compose version v5.6.0`), but the pinned commands in T3/T4–T7 and AC-13/AC-14/AC-26 are written `docker compose …` token-for-token, which needs the absent `docker` CLI.

**(b) Podman-based compose path → functionally present:** `podman compose version` resolves the external provider `/usr/local/bin/docker-compose` (`Docker Compose version v5.6.0`, exit 0), and `podman compose ls` exits 0 against the live rootless daemon (socket `/run/user/1000/podman/podman.sock`, `systemctl --user is-active podman.socket` → `active`; `podman ps` exit 0; `rootless=true`, graphDriver `overlay`). Note this was only probed read-only; no compose file exists yet, so `podman compose config -q` on the pinned `compose.yaml` is untested. Using it would still be a tooling substitution relative to the decided/pinned `docker compose`.

**(c) Notable:** no `podman-docker` shim and no `docker` rpm (`podman-docker`/`moby-engine`/`docker-ce` all "not installed"), so `docker` does not alias Podman; the compose binary is a hand-installed root-owned file in `/usr/local/bin` (not rpm-managed) and there is no `~/.docker/cli-plugins` directory; Podman Desktop is a system Flatpak only (no CLI on PATH); Node/npm are Homebrew-managed, not distro packages. Only change since Run 2: Node 24 + npm, the standalone `docker-compose` v5.6.0, and Podman's compose-provider resolution now work. Docker CLI + Docker daemon remain absent, so T3's pinned `npm install` can run but its `docker compose config -q` / `docker compose … config -q` verify steps still cannot.

---

## Run 4 (executed pass, 2026-10-18) — Status: **COMPLETED**

Sketch (≤5 lines): author the eleven T3 scaffold paths exactly per `plan.md` contracts 4–7 + the contract 8/9 manifest rows (no source, no Dockerfile — T4/T5 own those); run `npm install` so it resolves the pinned ranges into the committed `package-lock.json`; verify with `npm ci`, both `podman compose config -q` forms, a `node -e` merged-model check and the pinned `grep`; then stage only T3 paths + this log and commit the pinned message.

### R4.1 Build-start baseline

```
$ node --version   → v24.22.0
$ npm --version    → 11.19.1
$ podman --version → podman version 5.8.7
$ podman compose version
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

Docker Compose version v5.6.0
exit=0

$ git log --oneline -1
5afe0fb docs: align remaining framework Docker references with Podman (T2c)
$ git branch --show-current
feat/stack-selection

$ git status --short
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/build-log-T3.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md
```

All eleven T3 scaffold paths are absent at build start (none appears in the status above; Run 3 §4's `ls -A` listing confirms the same absence), so every file this task authors is net-new and there is no pre-existing content to diff against — AC-32 holds for this task by construction (no in-place modification). Node 24 + npm are the Homebrew install verified in Run 3; the pre-existing uncommitted files (`docs/features/README.md`, `docs/features/project-glossary/status.md`) and the untracked stack-selection artifacts were left untouched and unstaged.

### R4.2 Files authored (pins applied)

| Path | Contract | Key pinned content applied |
| --- | --- | --- |
| `package.json` | 7 | `private: true`; `workspaces: ["src/backend","src/frontend"]`; `engines.node: ">=24"`; exactly six scripts (`dev` = `podman compose up`; `lint` = `eslint .`; `typecheck`/`test`/`build` = `npm run <name> --workspaces --if-present`; `smoke` = `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`); the six pinned root devDeps, no others |
| `package-lock.json` | § Dependency manifest | produced by `npm install` (lockfileVersion 3, 4659 lines); exact resolved versions in R4.9 |
| `tsconfig.json` | 7 | shared base for `extends`: `strict`, `skipLibCheck`, `forceConsistentCasingInFileNames`; no `include`; no `noEmit` key (noEmit-neutral — T4's `build` = `tsc` must emit); never compiled directly |
| `eslint.config.mjs` | 7 | flat config: `js.configs.recommended` + `typescript-eslint` recommended (scoped to `**/*.{ts,tsx,mts,cts}`); ignores `dist/`, `node_modules/`, `coverage/`, `tests/e2e/**`; `globals.node` for root configs + `src/backend/**` + `tests/**`; `globals.browser` + `react-hooks` recommended-latest for `src/frontend/**` |
| `.gitignore` | 7 | `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.env*` |
| `.dockerignore` | 7 | `.git*`, `node_modules`(+`**/`), `dist`(+`**/`), `coverage`(+`**/`), `*.tsbuildinfo`, `.env*`, `docs`, `tests`, `.opencode`, `opencode.jsonc`, `README.md`; `src/**` manifests, `tsconfig.json`, `package*.json` deliberately not excluded |
| `compose.yaml` | 5 | `name: cubeclicker`; services `backend`/`frontend`; `build.context: .` + pinned `dockerfile:` paths + `target: dev`; images `cubeclicker-backend:dev`/`cubeclicker-frontend:dev`; loopback-interpolated ports `127.0.0.1:${BACKEND_PORT:-8080}:8080` / `127.0.0.1:${FRONTEND_PORT:-5173}:5173`; `frontend` env `VITE_WS_URL` pinned default; workspace source bind mounts only; no `version:` key; no duplicated healthcheck |
| `compose.smoke.yaml` | 6 | service `smoke` only: `image: node:24-alpine`, `working_dir: /smoke`, `./tests/e2e:/smoke:ro`, `command: ["node","smoke.mjs"]`, `depends_on: [backend, frontend]` |
| `README.md` | 4 | title + one-liner; Prerequisites (Podman + compose provider; Node.js 24 LTS + npm for tooling commands); Quickstart (`podman compose up`, `-d`, `--build`, `down`) + URLs 5173/8080/`ws://localhost:8080/ws`; Commands table (7 pinned commands); Configuration table (`BACKEND_PORT`, `FRONTEND_PORT`, `VITE_WS_URL` + defaults; `.env` files user-owned); Production images (`podman build --target prod -f src/<w>/Dockerfile .`); Stack summary + links to `docs/architecture/stack.md` and `docs/architecture/containerization.md` |
| `src/backend/package.json` | 8 | `@cubeclicker/backend`, `private`, `type: module`; scripts `dev`/`build`/`start`/`typecheck`/`test`; deps `fastify`, `@fastify/websocket`; devDeps `tsx`, `vitest`, `@types/node` |
| `src/frontend/package.json` | 9 | `@cubeclicker/frontend`, `private`, `type: module`; scripts `dev`/`build`/`typecheck`/`test`; deps `react`, `react-dom`; devDeps `vite`, `@vitejs/plugin-react`, `vitest`, `@types/react`, `@types/react-dom` |

No source file, Dockerfile, `tests/e2e/**` file, CI or deployment file was created (T4/T5/T6 own those).

### R4.3 Evidence — `npm install` then `npm ci` (pinned ranges resolve; lockfile in sync)

`npm install` (first run, full output):

```
$ npm install
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 277 packages, and audited 280 packages in 17s

78 packages are looking for funding
  run `npm fund` for details

3 vulnerabilities (1 moderate, 2 critical)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
npm notice
npm notice New major version of npm available! 11.19.1 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
exit=0
```

No unavailable range and no peer conflict — every pinned range resolved (R4.9). Re-run of `npm install` (idempotency) and `npm ci`:

```
$ npm install
up to date, audited 280 packages in 562ms
…
install-exit=0

$ npm ci
npm warn deprecated eslint@9.39.5: This version is no longer supported. …
added 277 packages, and audited 280 packages in 1s
…
ci-exit=0
```

`npm ci` exiting 0 proves the committed `package-lock.json` is in sync with the three manifests (`npm ci` hard-fails on drift).

### R4.4 Evidence — `podman compose config -q` (first live use of this command form)

```
$ podman compose config -q
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

exit=0

$ podman compose -f compose.yaml -f compose.smoke.yaml config -q
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

exit=0
```

Provider-verification note (`plan.md` § Risks, first live use): the provider (`/usr/local/bin/docker-compose`, Docker Compose v5.6.0) **supports** `config -q` in both forms — no divergence, no substitute command needed. (The `>>>> Executing external compose provider …` banner is printed by Podman on stderr; it does not affect the exit status.)

### R4.5 Evidence — `node -e` merged-model check (three services + pinned ports)

```
$ podman compose -f compose.yaml -f compose.smoke.yaml config --format json | node -e "…"
services: ["backend","frontend","smoke"]
name: cubeclicker
port   backend: 8080:8080/tcp
port   frontend: 5173:5173/tcp
smoke.image: node:24-alpine | command: ["node","smoke.mjs"] | volumes: [{"type":"bind","source":"/var/home/raultorraco/Documents/Projects/CubeClicker/tests/e2e","target":"/smoke","read_only":true,"bind":{}}]
smoke.depends_on: {"backend":{"condition":"service_started","required":true},"frontend":{"condition":"service_started","required":true}}
frontend VITE_WS_URL: ws://localhost:8080/ws
host_ip loopback-only: false
CHECK-PASS: three services + pinned ports present
```

Annotation (honesty): the `host_ip loopback-only: false` line of that first check variant was a defect **in the check script**, not in `compose.yaml` — the script formatted ports as `published:target/protocol` and therefore never inspected `host_ip` (the substring `127.0.0.1` could not appear). The corrected check reads the resolved `host_ip` field directly:

```
$ podman compose -f compose.yaml -f compose.smoke.yaml config --format json | node -e "… host_ip …"
backend host_ip=127.0.0.1 published=8080 target=8080 tcp
frontend host_ip=127.0.0.1 published=5173 target=5173 tcp
loopback-only: true

$ podman compose config --format json | node -e "… keys …"        # plain compose.yaml
services: ["backend","frontend"]
smoke present: false

$ BACKEND_PORT=9090 FRONTEND_PORT=6199 podman compose config --format json | node -e "… ports …"
backend 127.0.0.1:9090:8080
frontend 127.0.0.1:6199:5173
```

So: the merged model contains exactly the three services; both published ports are loopback-bound; the `smoke` service exists **only** in the override file (a plain `podman compose up` cannot start it); the `${BACKEND_PORT:-8080}`/`${FRONTEND_PORT:-5173}`/`${VITE_WS_URL:-ws://localhost:8080/ws}` interpolation resolves to the pinned defaults and honours overrides.

### R4.6 Evidence — pinned token grep and working-tree hygiene

```
$ grep -n "BACKEND_PORT\|FRONTEND_PORT\|VITE_WS_URL\|5173\|8080" compose.yaml README.md
compose.yaml:13:      - "127.0.0.1:${BACKEND_PORT:-8080}:8080"
compose.yaml:26:      - "127.0.0.1:${FRONTEND_PORT:-5173}:5173"
compose.yaml:29:      VITE_WS_URL: "${VITE_WS_URL:-ws://localhost:8080/ws}"
README.md:20:| Frontend | http://localhost:5173 |
README.md:21:| Backend | http://localhost:8080 |
README.md:22:| WebSocket | ws://localhost:8080/ws |
README.md:46:| `BACKEND_PORT` | `8080` | host port published for the backend container (`127.0.0.1:${BACKEND_PORT}:8080`) |
README.md:47:| `FRONTEND_PORT` | `5173` | host port published for the frontend container (`127.0.0.1:${FRONTEND_PORT}:5173`) |
README.md:48:| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL the frontend connects to |
README.md:50:The defaults work out of the box. `.env` files are user-owned and are not used by this scaffold …
exit=0

$ git status --short -uall
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? .dockerignore
?? .gitignore
?? README.md
?? compose.smoke.yaml
?? compose.yaml
?? docs/features/stack-selection/build-log-T3.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/spec-r1.md
?? docs/features/stack-selection/reviews/spec-r2.md
?? docs/features/stack-selection/reviews/spec-r3.md
?? docs/features/stack-selection/reviews/t2c-check.md
?? eslint.config.mjs
?? package-lock.json
?? package.json
?? src/backend/package.json
?? src/frontend/package.json
?? tsconfig.json

$ find . -maxdepth 3 -name '.env*' -not -path './node_modules/*'
(no output)   # find-exit=0 — no .env* file exists
```

The only new entries are the eleven T3 scaffold files + this log (plus the already-existing untracked feature artifacts, which are not staged). `node_modules/` is correctly invisible (`.gitignore`); no stray file, no build output, no `.env*`.

### R4.7 Evidence — supplementary checks (not in T3's verify list; recorded for honesty)

```
$ npm run lint
> lint
> eslint .

lint-exit=0
```

`eslint .` exits 0 with zero source files — this proves the flat config of contract 7 actually loads (plugin imports, `recommended-latest` in the resolved `eslint-plugin-react-hooks@5.2.0`, scoped globals, ignores). `npm run typecheck`/`npm test`/`npm run build` were **not** run and are not expected to pass at T3: no workspace source or config exists yet (T4/T5 add `src/*/tsconfig.json`, sources and tests; `vitest run` with zero test files exits non-zero by design). They are T4/T5/T7 verify steps.

```
$ node -e "import('eslint-plugin-react-hooks').then(m=>console.log(Object.keys(m.default.configs)))"
react-hooks configs: [ 'recommended-legacy', 'recommended', 'recommended-latest' ]
$ npx esbuild --version
0.28.2
esbuild-exit=0

$ grep -rniE "todo|fixme|password|secret|api[_-]?key|token=" package.json package-lock.json tsconfig.json eslint.config.mjs .gitignore .dockerignore compose.yaml compose.smoke.yaml README.md src/backend/package.json src/frontend/package.json
.gitignore:9:# Local configuration and secrets (.env files are user-owned and never committed)
.dockerignore:15:# Local configuration and secrets (.env files are user-owned; never baked into images)
```

The only "secret" hits are the two comment lines explaining that `.env*` is user-owned and never committed/baked — no credential, no key, no value in any authored file (AC-18). `esbuild`'s blocked `postinstall` (npm 11.19's new install-scripts gate) is harmless here: the platform binary resolves through the optional dependency `@esbuild/linux-x64@0.28.2` (`npx esbuild --version` → 0.28.2) and lint runs; this is recorded because T5 builds with Vite inside containers, where `npm ci` runs the same install path.

### R4.8 Evidence — pins → exact resolved versions (`package-lock.json`)

| Package | Pin | Resolved |
| --- | --- | --- |
| `typescript` | `~5.9` | 5.9.3 |
| `eslint` | `^9` | 9.39.5 |
| `@eslint/js` | `^9` | 9.39.5 |
| `typescript-eslint` | `^8` | 8.71.2 |
| `globals` | `^16` | 16.5.0 |
| `eslint-plugin-react-hooks` | `^5` | 5.2.0 |
| `fastify` | `^5` | 5.12.7 |
| `@fastify/websocket` | `^11` | 11.3.4 |
| `tsx` | `^4` | 4.23.15 |
| `vitest` | `^3` | 3.2.7 |
| `@types/node` | `^24` | 24.19.2 |
| `react` / `react-dom` | `^19` | 19.3.1 / 19.3.1 |
| `vite` | `^7` | 7.3.7 |
| `@vitejs/plugin-react` | peer-compatible major with resolved Vite (expected `^5`) | 5.2.0 (peer `vite` satisfied by 7.3.7 — no peer conflict) |
| `@types/react` / `@types/react-dom` | `^19` | 19.3.0 / 19.3.0 |

Lockfile: `lockfileVersion 3`, 4659 lines, root entry `{"name":"cubeclicker","workspaces":["src/backend","src/frontend"],"devDependencies":{…pinned ranges…},"engines":{"node":">=24"}}`; workspace entries `src/backend` and `src/frontend` carry exactly the pinned dependency sets. No package outside `plan.md` § Dependency manifest is declared (the install tree contains only their transitive dependencies).

### R4.9 Acceptance audit (T3 scope: AC-12, AC-13, AC-14, AC-18, AC-29)

- **AC-12 — met.** `README.md` exists at the repository root with prerequisites for running (Podman with a working compose provider — `podman compose`; "no other host prerequisites") and for tooling commands (Node.js 24 LTS + npm); single-command start `podman compose up` with URLs 5173/8080/`ws://localhost:8080/ws`; a 7-row commands table (`npm ci`, lint, typecheck, test, build, dev, smoke); an env-var table (`BACKEND_PORT`=8080, `FRONTEND_PORT`=5173, `VITE_WS_URL`=`ws://localhost:8080/ws`); first-run/rebuild note (`podman compose up --build`); prod image note (`podman build --target prod`); stack summary linking `docs/architecture/stack.md` and `docs/architecture/containerization.md` (evidence: R4.6 grep; the per-token presence check below).
  ```
  podman compose up / up -d / up --build / down      → 5 / 1 / 1 / 1 hits
  podman build --target prod -f src/{backend,frontend}/Dockerfile .  → 1 / 1 hits
  docs/architecture/stack.md, …/containerization.md  → 1 / 1 hits
  npm ci, npm run lint, npm run typecheck, npm test, npm run build, npm run dev, npm run smoke → 1/1/1/1/1/1/2 hits
  Node.js 24 LTS                                     → 2 hits
  ```
- **AC-13 — met.** `compose.yaml` at the root: project `name: cubeclicker`; services `backend` + `frontend`; each `build.context: .` with the pinned `dockerfile:` path and `target: dev`; host ports in the pinned interpolated loopback form (`host_ip=127.0.0.1`, published 8080/5173 → container 8080/5173, R4.5); `frontend` receives `VITE_WS_URL` with the pinned default; both bind-mount only their workspace source (`./src/backend` / `./src/frontend`); **`podman compose config -q` exits 0** (R4.4). No `version:` key; health comes from the image `HEALTHCHECK` (contract 5).
- **AC-14 — met.** `compose.smoke.yaml` adds service `smoke` (`image: node:24-alpine`, `tests/e2e` mounted read-only at `/smoke`, `command: ["node","smoke.mjs"]`, `depends_on: [backend, frontend]`); the merged model `podman compose -f compose.yaml -f compose.smoke.yaml config -q` **exits 0** (R4.4) and the merged set includes all three services `backend`, `frontend`, `smoke` (R4.5: `services: ["backend","frontend","smoke"]`), while a plain `podman compose config` shows `smoke present: false`.
- **AC-18 — met.** `.gitignore` covers `node_modules/`, `dist/`, `coverage/`, `.env*` (plus `*.tsbuildinfo`); `.dockerignore` excludes the build-context bloat `node_modules`, `.git`, `docs`, `.opencode`, `dist`, `coverage`, `.env*` (plus `tests`, `opencode.jsonc`, `README.md`) while explicitly **not** excluding `src/**` manifests/`tsconfig.json`/`package*.json`; no `.env*` file is created, edited or committed (R4.6 `find` → no output; R4.3 `git status` shows no `.env*` entry) and no secret appears in any scaffold file (R4.7 scan: only the two explanatory comments).
- **AC-29 — met.** Root `package.json` declares `private: true`, `workspaces: ["src/backend","src/frontend"]`, `engines.node: ">=24"` and exactly the six pinned scripts (`dev`, `lint`, `typecheck`, `test`, `build`, `smoke` — no others; recorded verbatim in R4.2 and in the `node -e` root-keys assertion: `root keys: name,private,workspaces,engines,scripts,devDependencies`). Workspace manifests declare exactly the pinned dependency sets of `plan.md` § Dependency manifest and nothing else:
  ```
  backend deps: @fastify/websocket,@types/node,fastify,tsx,vitest
  frontend deps: @types/react,@types/react-dom,@vitejs/plugin-react,react,react-dom,vite,vitest
  ```

### R4.10 Deviations, notes and open items

- **No deviations from the pinned contracts.** Every pinned value (ports, env names, image names, script bodies, dependency ranges, file shapes) is applied verbatim; the eleven paths are net-new, so the amendment rule and AC-32 are untouched by this task.
- Notes (not deviations):
  - Root `package.json` also carries `"name": "cubeclicker"` (not named by contract 7 but required by no AC; it names the npm root project in the lockfile). No `version` field is set anywhere — release tagging is deferred (`containerization.md`), so no version is invented.
  - `npm audit` reports 3 transitive vulnerabilities (1 moderate, 2 critical) in the tree resolved by the pinned ranges. Fixing them means changing pinned ranges (`npm audit fix --force` would move majors) — that is a user-owned dependency change, so it is recorded, not substituted.
  - npm 11.19.1 gates `esbuild@0.28.2`'s `postinstall` behind `npm install-scripts approve`; verified harmless (R4.7). T4/T5 run `npm ci` inside containers, where the same gate may print the same warning.
  - `podman compose` prints the external-provider banner on stderr for every invocation; recorded so later runs are not mistaken for a failure.
- Not run at T3 (by design, not a deviation): `npm run typecheck` / `npm test` / `npm run build` (no workspace config or sources yet — T4/T5 own them), `podman compose up` / `podman build` (T4–T6 own those; the pinned verify list for T3 stops at `config`).

### R4.11 Staging and commit

```
$ git add package.json package-lock.json tsconfig.json eslint.config.mjs .gitignore .dockerignore \
          compose.yaml compose.smoke.yaml README.md src/backend/package.json src/frontend/package.json \
          docs/features/stack-selection/build-log-T3.md
$ git diff --cached --name-only
.dockerignore
.gitignore
README.md
compose.smoke.yaml
compose.yaml
docs/features/stack-selection/build-log-T3.md
eslint.config.mjs
package-lock.json
package.json
src/backend/package.json
src/frontend/package.json
tsconfig.json

$ git diff --cached --stat -- package.json package-lock.json tsconfig.json eslint.config.mjs .gitignore .dockerignore compose.yaml compose.smoke.yaml README.md src/backend/package.json src/frontend/package.json
 .dockerignore             |   24 +
 .gitignore                |   10 +
 README.md                 |   66 +
 compose.smoke.yaml        |   12 +
 compose.yaml              |   31 +
 eslint.config.mjs         |   30 +
 package-lock.json         | 4659 +++++++++++++++++++++++++++++++++++++++++++++
 package.json              |   27 +
 src/backend/package.json  |   21 +
 src/frontend/package.json |   22 +
 tsconfig.json             |    7 +
 11 files changed, 4909 insertions(+)

$ git status --short
A  .dockerignore
A  .gitignore
A  README.md
A  compose.smoke.yaml
A  compose.yaml
 M docs/features/README.md
 M docs/features/project-glossary/status.md
A  docs/features/stack-selection/build-log-T3.md
A  eslint.config.mjs
A  package-lock.json
A  package.json
A  src/backend/package.json
A  src/frontend/package.json
A  tsconfig.json
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md

$ git commit -m "chore: scaffold workspace, compose stack, and commands (T3)"
```

Explicit pathspecs only — never `git add .`/`-A`; the two pre-existing modified files (`docs/features/README.md`, `docs/features/project-glossary/status.md`) and the other `docs/features/stack-selection/**` artifacts remain unstaged/untracked; no push. The staged path set is exactly the eleven T3 `files_owned` scaffold paths + this build log; the `--stat` above covers the eleven scaffold files (the row for this log itself is omitted because the log is finalized in the same commit — the commit's own `git show --stat HEAD` adds that single row). The resulting commit lands on `feat/stack-selection` and is verifiable with `git log -1 --oneline` / `git show --stat HEAD`.
