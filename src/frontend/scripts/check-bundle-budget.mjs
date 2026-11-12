// Bundle-budget gate for the frontend production build.
//
// `vite build` emits `dist/.vite/manifest.json` with the real chunk graph; this
// script measures every JS chunk with Node's level-6 gzip (a deterministic proxy
// for nginx's `gzip_comp_level 6`), writes `dist/bundle-report.json`, and fails
// the build when the initial (auth/menu) closure, the lazy Three vendor chunk,
// or the total exceeds its pinned ceiling — or when Three.js leaks into the
// initial closure. `dist` is resolved from this file's URL, never from `cwd`.
//
// The pure helpers are exported for `src/build/bundle-budget.test.ts`; Node
// built-ins use the `node:` prefix so the frontend ESLint browser-globals block
// does not flag `process`.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** Pinned ceilings (user-approved Q-1). Never raised from this script. */
export const BUDGETS = Object.freeze({
  initialGzipBytes: 150000,
  threeGzipBytes: 165000,
  totalGzipBytes: 300000,
});

/**
 * Pick the HTML entry chunk from a Vite manifest: `index.html` when present,
 * otherwise the single chunk flagged `isEntry`.
 */
export function findEntryKey(manifest) {
  if (manifest['index.html']?.isEntry === true) return 'index.html';
  const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry === true);
  if (entries.length !== 1) {
    throw new Error(`expected exactly one entry chunk in the Vite manifest, found ${entries.length}`);
  }
  return entries[0];
}

/**
 * The initial closure: the entry chunk plus the recursive *static* `imports`
 * (which is what the browser downloads before the entry executes). Dynamic
 * imports are deliberately not followed — lazy chunks are not initial.
 */
export function initialClosure(manifest, entryKey) {
  const closure = [];
  const visited = new Set();
  const visit = (key) => {
    if (visited.has(key)) return;
    const chunk = manifest[key];
    if (chunk === undefined) {
      throw new Error(`Vite manifest has no chunk "${key}" referenced by a static import`);
    }
    visited.add(key);
    closure.push(key);
    for (const importedKey of chunk.imports ?? []) visit(importedKey);
  };
  visit(entryKey);
  return closure;
}

function chunkName(chunk, key) {
  if (typeof chunk.name === 'string' && chunk.name.length > 0) return chunk.name;
  if (Array.isArray(chunk.names) && chunk.names.length > 0) return chunk.names[0];
  return key;
}

function isThreeChunk(chunk) {
  if (chunk.name === 'three') return true;
  return Array.isArray(chunk.names) && chunk.names.includes('three');
}

function sizeOf(sizes, file) {
  const size = sizes[file];
  if (size === undefined) throw new Error(`no measured size for "${file}"`);
  return size;
}

function sumSizes(sizes, files) {
  return files.reduce(
    (totals, file) => {
      const size = sizeOf(sizes, file);
      return {
        rawBytes: totals.rawBytes + size.rawBytes,
        gzipBytes: totals.gzipBytes + size.gzipBytes,
      };
    },
    { rawBytes: 0, gzipBytes: 0 },
  );
}

/** Build the plan-schema report from a manifest and measured file sizes. */
export function buildReport(manifest, entryKey, sizes) {
  const closureKeys = initialClosure(manifest, entryKey);
  const entryChunk = manifest[entryKey];
  const entrySize = sizeOf(sizes, entryChunk.file);

  const initialFiles = [];
  for (const key of closureKeys) {
    const { file } = manifest[key];
    if (!initialFiles.includes(file)) initialFiles.push(file);
  }
  const initialSet = new Set(initialFiles);

  const seenFiles = new Set();
  const totalFiles = [];
  const chunks = [];
  let three = null;
  for (const key of Object.keys(manifest)) {
    const chunk = manifest[key];
    const { file } = chunk;
    if (seenFiles.has(file)) continue;
    seenFiles.add(file);
    totalFiles.push(file);

    const size = sizeOf(sizes, file);
    const name = chunkName(chunk, key);
    chunks.push({
      name,
      file,
      initial: initialSet.has(file),
      gzipBytes: size.gzipBytes,
      rawBytes: size.rawBytes,
    });
    if (three === null && isThreeChunk(chunk)) {
      three = {
        file,
        name: 'three',
        initial: initialSet.has(file),
        gzipBytes: size.gzipBytes,
        rawBytes: size.rawBytes,
      };
    }
  }
  chunks.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0));

  const initialSize = sumSizes(sizes, initialFiles);
  const totalSize = sumSizes(sizes, totalFiles);

  return {
    version: 1,
    budgets: { ...BUDGETS },
    entry: {
      name: chunkName(entryChunk, entryKey),
      file: entryChunk.file,
      gzipBytes: entrySize.gzipBytes,
      rawBytes: entrySize.rawBytes,
    },
    initial: { files: initialFiles, gzipBytes: initialSize.gzipBytes, rawBytes: initialSize.rawBytes },
    three,
    total: { files: totalFiles, gzipBytes: totalSize.gzipBytes, rawBytes: totalSize.rawBytes },
    chunks,
  };
}

/** List every budget/graph violation with its measured value. */
export function evaluateReport(report) {
  const violations = [];
  if (report.initial.gzipBytes > BUDGETS.initialGzipBytes) {
    violations.push(
      `initial bundle gzip ${report.initial.gzipBytes} B exceeds the ${BUDGETS.initialGzipBytes} B budget`,
    );
  }
  if (report.three === null) {
    violations.push('no chunk named "three" exists in the Vite manifest');
  } else {
    if (report.three.gzipBytes > BUDGETS.threeGzipBytes) {
      violations.push(
        `three chunk gzip ${report.three.gzipBytes} B exceeds the ${BUDGETS.threeGzipBytes} B budget`,
      );
    }
    if (report.initial.files.includes(report.three.file)) {
      violations.push(`three chunk ${report.three.file} is in the initial closure`);
    }
  }
  if (report.total.gzipBytes > BUDGETS.totalGzipBytes) {
    violations.push(
      `total bundle gzip ${report.total.gzipBytes} B exceeds the ${BUDGETS.totalGzipBytes} B budget`,
    );
  }
  return { ok: violations.length === 0, violations };
}

/** Human-readable chunk table printed to the build log. */
export function formatReport(report) {
  const lines = [
    `entry ${report.entry.name} ${report.entry.file} raw=${report.entry.rawBytes} gzip=${report.entry.gzipBytes}`,
    `initial files=${report.initial.files.length} raw=${report.initial.rawBytes} gzip=${report.initial.gzipBytes} budget=${BUDGETS.initialGzipBytes}`,
    report.three === null
      ? 'three missing'
      : `three ${report.three.file} raw=${report.three.rawBytes} gzip=${report.three.gzipBytes} budget=${BUDGETS.threeGzipBytes}`,
    `total files=${report.total.files.length} raw=${report.total.rawBytes} gzip=${report.total.gzipBytes} budget=${BUDGETS.totalGzipBytes}`,
    ...report.chunks.map(
      (chunk) =>
        `chunk ${chunk.name} ${chunk.file} raw=${chunk.rawBytes} gzip=${chunk.gzipBytes} initial=${chunk.initial}`,
    ),
  ];
  return lines.join('\n');
}

function measureFiles(distDir, files) {
  const sizes = {};
  for (const file of files) {
    const buffer = readFileSync(path.join(distDir, file));
    sizes[file] = {
      rawBytes: buffer.byteLength,
      gzipBytes: gzipSync(buffer, { level: 6 }).byteLength,
    };
  }
  return sizes;
}

function main() {
  const distDir = fileURLToPath(new URL('../dist', import.meta.url));
  const manifestPath = path.join(distDir, '.vite', 'manifest.json');
  const reportPath = path.join(distDir, 'bundle-report.json');

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.error(`bundle budget: cannot read ${manifestPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const entryKey = findEntryKey(manifest);
  const files = [...new Set(Object.values(manifest).map((chunk) => chunk.file))];
  const report = buildReport(manifest, entryKey, measureFiles(distDir, files));
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(formatReport(report));

  const { ok, violations } = evaluateReport(report);
  if (!ok) {
    console.error('\nBundle budget violations:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nBundle budget OK.');
}

const invokedPath = process.argv[1] === undefined ? '' : path.resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
