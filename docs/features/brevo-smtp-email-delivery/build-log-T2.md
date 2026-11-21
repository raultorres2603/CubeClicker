# Build log — T2 — Author the asset generator and commit the two brand PNGs

Task: T2 (2026-11-22)
Files changed: `src/frontend/scripts/generate-email-assets.mjs`, `src/frontend/public/email/cubeclicker-hero.png`, `src/frontend/public/email/cubeclicker-cube.png`, `docs/features/brevo-smtp-email-delivery/build-log-T2.md`

## What changed & why
- Added `src/frontend/scripts/generate-email-assets.mjs`, a Node built-ins-only authoring tool that writes both email PNGs pixel by pixel: a pinned-seed starfield, a flat-shaded isometric emerald cube with a cyan neon rim, a 5×7 bitmap `CUBECLICKER` wordmark, a tagline, and a 72px cube mark.
- Committed the generated artifacts `src/frontend/public/email/cubeclicker-hero.png` (600×200, 4,357 bytes) and `src/frontend/public/email/cubeclicker-cube.png` (72×72, 582 bytes); both are far below their 60 KiB / 15 KiB budgets.
- `--check` regenerates in memory, compares SHA-256 with the committed files and exits non-zero on drift; the default mode writes the files and prints dimensions, byte counts and hashes.
- The eight pinned asset-palette colours are the only colours the drawing API accepts; a post-render assertion scans every pixel and fails on any off-palette RGB value. Soft glow and rim fringe are ordered-dithered between palette colours, so no alpha or antialias colour can leak into the PNG.
- No runtime or build wiring: the script is not imported by the app and is not part of `npm run build`; the PNGs are the committed artifacts.

## Decisions
- **Composition.** The hero places the cube (regular-hexagon isometric projection, circumradius 80, centred at 140,100) in the left third and a left-aligned brand lockup at x=248: `CUBECLICKER` in cyan at 5×5 scale (325×35) with a 3px metallic drop shadow, a 2px rule with a 72px cyan accent, and `AN ONLINE CUBE-CLICKING GAME` in `#e8f6ff` at scale 2, centred under the wordmark. The lockup band is excluded from the starfield so no star can land in a glyph counter.
- **Face shading.** Top face `#34d399`, left face `#2a9e78`, right face `#1f7a5c`; the whole hexagon is filled with the darkest emerald first so the three rhombi cannot leave a seam, then the cyan rim (2px) and cyan Y edges (1px) are drawn over the joins. A 1px metallic fringe sits under the rim as a dark outline.
- **Glow.** An 8×8 Bayer matrix dithers a radial ramp (`void → surface → metallic` on the hero, `surface → metallic` on the 72px mark). This produces a soft halo using only palette colours; an 8×8 matrix reads less patterned at 1x than 4×4.
- **Footer mark background.** The 72×72 mark uses `#0a1222` (the email template's surface colour) rather than transparency or the hero void, so it blends into the footer panel without introducing alpha.
- **Determinism.** Pinned mulberry32 seed `0x5eed1a2b` (the mark derives a second pinned seed), pinned geometry/scale constants, a pinned 5×7 font, zlib level 9, filter 0 on every scanline, and CRC-32 chunks written explicitly. Two write-mode runs produced identical hashes.
- **Testing exception (skill § Testing bar).** This task adds no application runtime code and `files_owned` contains no test file; its behaviour is an authoring CLI. The pinned asset-tier verification is the task's test: byte-identical regeneration, `--check` PASS/mismatch exit codes, the dimensions/byte-budget PNG command, and the in-script font/palette/budget assertions. Adding a Vitest file would require an unowned file and would re-assert the same generator output. No integration boundary exists for a standalone offline generator; no test/coverage exclusion was added.
- **Whitespace note.** `git diff --check` cannot see a new untracked file, so the same check was also run as `git diff --cached --check` after staging the script (both exit 0).

## Evidence

### `npm run lint`
```
$ npm run lint
> lint
> eslint .
lint exit=0
```

### Generator write mode and determinism
```
$ node src/frontend/scripts/generate-email-assets.mjs
WROTE src/frontend/public/email/cubeclicker-hero.png 600x200 4357 B 3295b14d0583df835cfe000788636475321d78408b6f2f21edd95901e49d9c24
WROTE src/frontend/public/email/cubeclicker-cube.png 72x72 582 B e6b346a8977eb63bd193a7f80da4fe4a413c17314ec14b46c83564c79988bb80
email assets: wrote 2 files
```
A second write run, then `sha256sum` on both runs:
```
e6b346a8977eb63bd193a7f80da4fe4a413c17314ec14b46c83564c79988bb80  src/frontend/public/email/cubeclicker-cube.png
3295b14d0583df835cfe000788636475321d78408b6f2f21edd95901e49d9c24  src/frontend/public/email/cubeclicker-hero.png
e6b346a8977eb63bd193a7f80da4fe4a413c17314ec14b46c83564c79988bb80  src/frontend/public/email/cubeclicker-cube.png
3295b14d0583df835cfe000788636475321d78408b6f2f21edd95901e49d9c24  src/frontend/public/email/cubeclicker-hero.png
DETERMINISTIC: second run produced identical bytes
```

### `node src/frontend/scripts/generate-email-assets.mjs --check`
```
$ node src/frontend/scripts/generate-email-assets.mjs --check
PASS src/frontend/public/email/cubeclicker-hero.png 4357 B 3295b14d0583df835cfe000788636475321d78408b6f2f21edd95901e49d9c24
PASS src/frontend/public/email/cubeclicker-cube.png 582 B e6b346a8977eb63bd193a7f80da4fe4a413c17314ec14b46c83564c79988bb80
email assets: 2/2 OK
check exit=0
```

### `--check` mismatch drill (failure path)
A copy of the hero was byte-flipped in place, `--check` was run, and the original was restored from the backup:
```
MISMATCH src/frontend/public/email/cubeclicker-hero.png: generated 3295b14d0583df835cfe000788636475321d78408b6f2f21edd95901e49d9c24 (4357 B) != committed e0e7e49ab9d9425a9a961bf3be443d0709cd18aa59a0d1bb34aa0c8b40361b3a (4357 B)
PASS src/frontend/public/email/cubeclicker-cube.png 582 B e6b346a8977eb63bd193a7f80da4fe4a413c17314ec14b46c83564c79988bb80
email assets: 1 failure(s)
mismatch exit=1
...
PASS src/frontend/public/email/cubeclicker-hero.png 4357 B 3295b14d0583df835cfe000788636475321d78408b6f2f21edd95901e49d9c24
PASS src/frontend/public/email/cubeclicker-cube.png 582 B e6b346a8977eb63bd193a7f80da4fe4a413c17314ec14b46c83564c79988bb80
email assets: 2/2 OK
restored exit=0
```

### PNG signature / dimensions / byte budget (tasks.md T2, verbatim)
```
$ node -e "const fs=require('node:fs');const spec=[['src/frontend/public/email/cubeclicker-hero.png',600,200,61440],['src/frontend/public/email/cubeclicker-cube.png',72,72,15360]];for(const [p,w,h,max] of spec){const b=fs.readFileSync(p);if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(p+' is not a PNG');const W=b.readUInt32BE(16),H=b.readUInt32BE(20);if(W!==w||H!==h)throw new Error(p+' is '+W+'x'+H+', expected '+w+'x'+h);if(b.length>max)throw new Error(p+' is '+b.length+' bytes, max '+max);console.log(p+' '+W+'x'+H+' '+b.length+' bytes')}"
src/frontend/public/email/cubeclicker-hero.png 600x200 4357 bytes
src/frontend/public/email/cubeclicker-cube.png 72x72 582 bytes
spec exit=0
```

### Emitted-colour audit (palette-only proof)
Decoding every scanline (`filter 0`) and collecting unique RGB triples:
```
src/frontend/public/email/cubeclicker-hero.png unique colours: 04060d 0a1222 1f7a5c 2a9e78 2b4a63 34d399 7cf6ff e8f6ff
src/frontend/public/email/cubeclicker-cube.png unique colours: 0a1222 1f7a5c 2a9e78 2b4a63 34d399 7cf6ff
```
Every triplet belongs to the pinned eight-colour palette; the mark simply does not use `void` or `text`.

### `git diff --check -- src/frontend/scripts/generate-email-assets.mjs`
```
$ git diff --check -- src/frontend/scripts/generate-email-assets.mjs
diff-check exit=0 (untracked file -> no diff hunks)
```
After `git add`, the content-bearing form:
```
$ git diff --cached --check -- src/frontend/scripts/generate-email-assets.mjs
cached diff-check exit=0 (no whitespace errors)
```

### `test -f docs/features/brevo-smtp-email-delivery/build-log-T2.md`
```
$ test -f docs/features/brevo-smtp-email-delivery/build-log-T2.md
exit 0
```

### Build-log credential guard (tasks.md T2, verbatim)
```
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T2.md
exit 0 (no match, no output)
```

### Extra: full coverage gate (no application code changed; regression check)
```
$ npm run coverage
> coverage
> npm run coverage --workspaces --if-present

backend:  Test Files 38 passed (38) / Tests 1708 passed (1708)
frontend: Test Files 83 passed (83) / Tests 2844 passed (2844)
backend  All files | 96.48 | 90.51 | 99.59 | 96.48 |
frontend All files | 97.15 | 96.75 | 98.36 | 97.15 |
coverage exit=0 (thresholds 80/80/80/80 met in both workspaces)
```

### Visual self-check
Inspected the committed PNGs at 1x with the image viewer and at 3x/8x with nearest-neighbour crops:

- **Hero (600×200).** Void `#04060d` field with a faint ordered-dither halo behind the cube; 170 deterministic stars (metallic/cyan/white singles plus six 4-point sparkles) scattered outside the text band. The cube is symmetric: a regular isometric hexagon centred at (140,100), 138.6 px wide and 160 px tall, with the top face bright emerald, left face mid emerald and right face dark emerald, a continuous 2px cyan silhouette and a clean cyan Y on the internal edges. At 3x the wordmark crop reads exactly `CUBECLICKER` — all eleven glyphs are intact, no merged or missing pixels, and the 3px metallic shadow keeps the cyan crisp. The tagline `AN ONLINE CUBE-CLICKING GAME` is fully legible beneath the cyan-accented rule. No stars intrude into the glyphs.
- **Cube mark (72×72).** Symmetric cube centred at (36,36) on the `#0a1222` surface colour, same three-face emerald shading and cyan rim; the halo is tight enough to leave clean margins, and the cube is readable at 1x (verified again at 8x). Six tiny stars add life without noise.
- **On-brand verdict.** Emerald cube + cyan neon rim + near-black void + metallic/cyan starfield + cyan bitmap wordmark; the composition reads as an intentional game-brand hero, not random noise.

## Acceptance audit
- **AC-16(b) → met.** Both assets are committed at `src/frontend/public/email/cubeclicker-hero.png` and `src/frontend/public/email/cubeclicker-cube.png`; no build step is required (the script is not wired into `npm run build`). Evidence: PNG spec command and write-mode output.
- **AC-17(a) → met.** Valid PNG signature, exact 600×200 and 72×72 dimensions, 4,357 B ≤ 61,440 B and 582 B ≤ 15,360 B; `--check` exits 0 only on byte-identical regeneration and prints `PASS <file> <bytes> B <sha256>`; emitted pixels are exactly the pinned palette. Evidence: `--check` output, mismatch drill, PNG spec command, unique-colour audit.
- **AC-21 → met.** `src/frontend/scripts/generate-email-assets.mjs` is committed and is the only authoring source; it uses Node built-ins only (`node:fs`, `node:zlib`, `node:crypto`, plus `node:buffer`/`node:process` for I/O plumbing), pins the PRNG seed, geometry, 5×7 `CUBECLICKER` font and the eight palette literals, and `--check` compares SHA-256 in memory. No npm dependency, no network, no `npm run build` coupling.
- **Not claimed here (owned by other tasks).** AC-16(a)/(c)/(d)/(e) are T3/T8/T9 (template URLs, serving proof, deployed recipe, fallback); AC-17(b)/(c) are T3 (HTML size, combined budget, contrast); AC-15/AC-18/AC-19 are T3–T5. This task only authors and commits the two PNGs.

## Deviations from spec
None. Scope stayed inside `files_owned`; no game code, backend, compose, template or other docs were touched. The wordmark rendered cleanly, so the cube-only hero fallback in spec § Asset source and authoring was not needed.
