# Build log — T1 — Add three.js dependencies (chore)

Task: T1 (2026-10-18)
Files changed: `src/frontend/package.json`, `package-lock.json`, `docs/features/cube-game-frontend/build-log-T1.md`
What changed & why: Added `three@^0.186.1` to the frontend workspace `dependencies` and `@types/three@^0.186.0` to its `devDependencies` (npm workspaces hoist both to the root `node_modules`; the lockfile records only these two plus `@types/three`'s transitive entries). No source, config, container, or smoke-test file was touched. Chore — no test files (per tasks.md Rules).
Decisions:
- Both installs were scoped with `--workspace @cubeclicker/frontend`, so npm never had a chance to touch the backend workspace; `npm ls three --workspace @cubeclicker/backend` → empty confirms it.
- No version drift: npm resolved the requested ranges exactly (`three@0.186.1`, `@types/three@0.186.0`), both inside the 0.186 line the task pinned, so no "align within 0.186" fallback was needed.
- Build-log-only documents nothing more than the chore; the feature `status.md`/`tasks.md` bookkeeping stays with the orchestrator (not in `files_owned`).

## What was run (raw evidence)

### 0. Pre-change baseline (for the AC-20 baseline numbers)
```
$ npm run build --workspace @cubeclicker/frontend
> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 29 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.32 kB │ gzip:  0.23 kB
dist/assets/index-C70WgBoq.js  223.76 kB │ gzip: 69.91 kB
✓ built in 642ms
exit=0
```
Baseline initial-JS gzip total = **69.91 kB** (`dist/assets/index-C70WgBoq.js`), HTML = 0.32 kB (gzip 0.23 kB). Budget (`BUNDLE_BUDGET_GZ_KB` = 350): 69.91 kB ≤ 350 kB.

Lockfile/package.json hashes before any change:
```
2be92573e9983c2ac557491d71b773ae1010a65c68a6477eb0072e6779b7e0a1  package-lock.json
90a30948bba98981598049d18ba6e58a2d5fe88ec435a4b2a273fe7c1419e4ad  src/frontend/package.json
```

Registry pre-check that the requested versions exist:
```
$ npm view three@0.186.1 version
0.186.1
$ npm view @types/three@0.186.0 version
0.186.0
```

### 1. Install (frontend workspace only)
```
$ npm install three@^0.186.1 --workspace @cubeclicker/frontend
added 1 package, and audited 329 packages in 1s
... (audit/install-scripts warnings only)
exit=0

$ npm install -D @types/three@^0.186.0 --workspace @cubeclicker/frontend
added 7 packages, and audited 336 packages in 1s
... (audit/install-scripts warnings only)
exit=0
```
The two `npm warn install-scripts` lines concern the pre-existing `esbuild@0.28.2` postinstall (a vite transitive dep) — they are unrelated to this task's additions and were present behaviour before it.

`package.json` after install:
```json
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "three": "^0.186.1"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/three": "^0.186.0",
    "@vitejs/plugin-react": "^5",
    "@vitest/coverage-v8": "^3.2.7",
    "vite": "^7",
    "vitest": "^3"
  }
```

`npm install` idempotence (verify line): a subsequent bare `npm install` reported `up to date, audited 336 packages`, exit 0, and the lockfile was byte-identical (`diff -q` → no output, "lockfile stable after npm install").

### 2. Resolved versions (`npm ls three @types/three`)
```
$ npm ls three @types/three
cubeclicker@ /var/home/raultorraco/Documents/Projects/CubeClicker
└─┬ @cubeclicker/frontend@ -> ./src/frontend
  ├── @types/three@0.186.0
  └── three@0.186.1

exit=0

$ npm ls three --workspace @cubeclicker/backend
cubeclicker@ /var/home/raultorraco/Documents/Projects/CubeClicker
└── (empty)
```
Exact resolved versions: **`three@0.186.1`**, **`@types/three@0.186.0`** — both requested/expected, no drift, nothing installed in the backend workspace.

### 3. Typecheck
```
$ npm run typecheck --workspace @cubeclicker/frontend
> typecheck
> tsc --noEmit
exit=0
```

### 4. Lint
```
$ npm run lint
> lint
> eslint .
exit=0
```

### 5. Build (post-install, sizes recorded for the AC-20 baseline)
```
$ npm run build --workspace @cubeclicker/frontend
> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 29 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.32 kB │ gzip:  0.23 kB
dist/assets/index-C70WgBoq.js  223.76 kB │ gzip: 69.91 kB
✓ built in 641ms
exit=0
```
Identical to the pre-change baseline (69.91 kB gzip, same chunk hash): T1 adds no imported code, so tree-shaking drops `three` entirely from the bundle, as `package.json` dependencies are still unused. This is the AC-20 baseline other tasks build against.

### 6. Lockfile diff inspection (`git diff package-lock.json`)
```
$ git diff --stat package-lock.json src/frontend/package.json
 package-lock.json         | 67 ++++++++++++++++++++++++++++++++++++++++++++++-
 src/frontend/package.json |  4 ++-
 2 files changed, 69 insertions(+), 2 deletions(-)

$ git diff -U0 package-lock.json | grep -E '^[+-]\s+"(node_modules|src/)' | sort
+    "node_modules/@dimforge/rapier3d-compat": {
+    "node_modules/@tweenjs/tween.js": {
+    "node_modules/@types/stats.js": {
+    "node_modules/@types/three": {
+    "node_modules/@types/webxr": {
+    "node_modules/fflate": {
+    "node_modules/meshoptimizer": {
+    "node_modules/three": {
```
Additions only — no removed or rewired entries anywhere in the diff. Package entries added:
- `three@0.186.1` (runtime, no `dev` flag — correct for a production dependency),
- `@types/three@0.186.0` (`dev: true`),
- its declared transitive deps only: `@dimforge/rapier3d-compat@0.12.0`, `@tweenjs/tween.js@23.1.3`, `@types/stats.js@0.17.4`, `@types/webxr@0.5.24`, `fflate@0.8.3`, `meshoptimizer@1.1.1` (all `dev: true`).
The only other lockfile changes are the two additions to the `src/frontend` workspace block (`"three": "^0.186.1"` under `dependencies`, `"@types/three": "^0.186.0"` under `devDependencies`) mirroring `package.json`.

### 7. Cross-check: `three` imports cleanly in node (risk note for T7–T13)
The plan lists "three.js DOM-bound import at module load" as a risk. A node probe (frontend workspace, ESM) built real three.js objects to confirm the core entrypoint is DOM-free at import time:
```
$ node --input-type=module -e "const THREE = await import('three'); const g = new THREE.BoxGeometry(1,1,1); console.log('three REVISION:', THREE.REVISION, '| BoxGeometry attrs:', g.attributes.position.count, '| InstancedMesh:', typeof THREE.InstancedMesh, '| Raycaster:', typeof THREE.Raycaster, '| Points:', typeof THREE.Points);"
three REVISION: 186 | BoxGeometry attrs: 24 | InstancedMesh: function | Raycaster: function | Points: function
exit=0
```
Not part of T1's verify lines — recorded because it de-risks the node-only test strategy of the downstream render tasks.

## Acceptance audit
- AC-19 (scope discipline) → **partially supported**: the whole workspace diff is exactly two dependency declarations plus lockfile entries (`git diff --stat` above; additions-only lockfile inspection; `npm ls` shows nothing in the backend; no source/config/container file touched). The remaining AC-19 evidence (greps for `connection`/`localStorage`/`fetch`, empty diff on container paths) belongs to T15 per tasks.md.
- AC-20 (build within budget, named `three` imports only) → **partially supported**: build exits 0 with initial JS gzip 69.91 kB ≤ 350 kB (`BUNDLE_BUDGET_GZ_KB`), and no source file imports `three` yet, so no import-form to check this task; the import-form grep and the real post-feature bundle measurement are T15's.
- Acceptance claimed: "supports AC-19, AC-20 (chore)" — no new tests required (chore; tasks.md Rules: "T1 is a chore (dependency install; no test files)").

## Deviations from spec
None. Both resolved versions landed exactly on the pinned ranges (`^0.186.1` / `^0.186.0`), so the "align within the 0.186 line" fallback was not exercised. No other dependency was introduced.
