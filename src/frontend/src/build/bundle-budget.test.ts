import { describe, expect, it } from 'vitest';
import {
  BUDGETS,
  buildReport,
  evaluateReport,
  findEntryKey,
  formatReport,
  initialClosure,
} from '../../scripts/check-bundle-budget.mjs';
import type { ChunkSize, ViteManifest } from '../../scripts/check-bundle-budget.mjs';

// Synthetic post-split manifest: the entry statically imports the React vendor
// chunk and dynamically imports the game runtime, whose only static import is
// the shared Three vendor chunk. dynamicImports are never part of the initial
// closure, so `three` must stay out of the auth/menu download.
const manifest: ViteManifest = {
  'index.html': {
    file: 'assets/index-entry.js',
    name: 'index',
    src: 'index.html',
    isEntry: true,
    imports: ['_react-vendor.js'],
    dynamicImports: ['src/game/session.ts'],
  },
  '_react-vendor.js': {
    file: 'assets/react-vendor.js',
    name: 'react',
    imports: [],
  },
  'src/game/session.ts': {
    file: 'assets/game-runtime.js',
    name: 'session',
    src: 'src/game/session.ts',
    isDynamicEntry: true,
    imports: ['_three-vendor.js'],
  },
  '_three-vendor.js': {
    file: 'assets/three-vendor.js',
    name: 'three',
    imports: [],
  },
};

const sizes: Record<string, ChunkSize> = {
  'assets/index-entry.js': { rawBytes: 1200, gzipBytes: 400 },
  'assets/react-vendor.js': { rawBytes: 5000, gzipBytes: 1500 },
  'assets/game-runtime.js': { rawBytes: 900, gzipBytes: 300 },
  'assets/three-vendor.js': { rawBytes: 660000, gzipBytes: 131000 },
};

const BUDGET_VALUES = { initialGzipBytes: 150000, threeGzipBytes: 165000, totalGzipBytes: 300000 };

describe('bundle-budget helpers', () => {
  it('pins the approved gzip ceilings', () => {
    expect(BUDGETS).toEqual(BUDGET_VALUES);
  });

  it('finds the HTML entry, falls back to isEntry, and rejects a missing entry', () => {
    expect(findEntryKey(manifest)).toBe('index.html');
    expect(
      findEntryKey({ 'app.html': { file: 'assets/app.js', name: 'app', isEntry: true } }),
    ).toBe('app.html');
    expect(() => findEntryKey({ 'app.html': { file: 'assets/app.js', name: 'app' } })).toThrow(
      'expected exactly one entry chunk in the Vite manifest, found 0',
    );
  });

  it('builds the initial closure from static imports only', () => {
    expect(initialClosure(manifest, 'index.html')).toEqual(['index.html', '_react-vendor.js']);
  });

  it('classifies the entry, initial closure, three vendor, and total', () => {
    const report = buildReport(manifest, 'index.html', sizes);

    expect(report.version).toBe(1);
    expect(report.budgets).toEqual(BUDGET_VALUES);
    expect(report.entry).toEqual({
      name: 'index',
      file: 'assets/index-entry.js',
      gzipBytes: 400,
      rawBytes: 1200,
    });
    expect(report.initial).toEqual({
      files: ['assets/index-entry.js', 'assets/react-vendor.js'],
      gzipBytes: 1900,
      rawBytes: 6200,
    });
    expect(report.three).toEqual({
      file: 'assets/three-vendor.js',
      name: 'three',
      initial: false,
      gzipBytes: 131000,
      rawBytes: 660000,
    });
    expect(report.total).toEqual({
      files: [
        'assets/index-entry.js',
        'assets/react-vendor.js',
        'assets/game-runtime.js',
        'assets/three-vendor.js',
      ],
      gzipBytes: 133200,
      rawBytes: 667100,
    });
    expect(report.chunks).toEqual([
      {
        name: 'session',
        file: 'assets/game-runtime.js',
        initial: false,
        gzipBytes: 300,
        rawBytes: 900,
      },
      {
        name: 'index',
        file: 'assets/index-entry.js',
        initial: true,
        gzipBytes: 400,
        rawBytes: 1200,
      },
      {
        name: 'react',
        file: 'assets/react-vendor.js',
        initial: true,
        gzipBytes: 1500,
        rawBytes: 5000,
      },
      {
        name: 'three',
        file: 'assets/three-vendor.js',
        initial: false,
        gzipBytes: 131000,
        rawBytes: 660000,
      },
    ]);
  });

  it('passes when every ceiling holds and three is lazy', () => {
    expect(evaluateReport(buildReport(manifest, 'index.html', sizes))).toEqual({
      ok: true,
      violations: [],
    });
  });

  it('reports an initial-closure gzip overrun with the measured bytes', () => {
    const report = buildReport(manifest, 'index.html', {
      ...sizes,
      'assets/react-vendor.js': { rawBytes: 5000, gzipBytes: 149601 },
    });

    expect(report.initial.gzipBytes).toBe(150001);
    expect(evaluateReport(report)).toEqual({
      ok: false,
      violations: ['initial bundle gzip 150001 B exceeds the 150000 B budget'],
    });
  });

  it('reports a three-chunk gzip overrun', () => {
    const report = buildReport(manifest, 'index.html', {
      ...sizes,
      'assets/three-vendor.js': { rawBytes: 700000, gzipBytes: 165001 },
    });

    expect(report.three).toEqual({
      file: 'assets/three-vendor.js',
      name: 'three',
      initial: false,
      gzipBytes: 165001,
      rawBytes: 700000,
    });
    expect(evaluateReport(report)).toEqual({
      ok: false,
      violations: ['three chunk gzip 165001 B exceeds the 165000 B budget'],
    });
  });

  it('reports a total gzip overrun while both individual ceilings hold', () => {
    const report = buildReport(manifest, 'index.html', {
      ...sizes,
      'assets/react-vendor.js': { rawBytes: 5000, gzipBytes: 99600 },
      'assets/game-runtime.js': { rawBytes: 900, gzipBytes: 35001 },
      'assets/three-vendor.js': { rawBytes: 660000, gzipBytes: 165000 },
    });

    expect(report.initial.gzipBytes).toBe(100000);
    expect(report.three?.gzipBytes).toBe(165000);
    expect(report.total.gzipBytes).toBe(300001);
    expect(evaluateReport(report)).toEqual({
      ok: false,
      violations: ['total bundle gzip 300001 B exceeds the 300000 B budget'],
    });
  });

  it('reports a missing three chunk', () => {
    const withoutThree: ViteManifest = {
      'index.html': { ...manifest['index.html'], dynamicImports: [] },
      '_react-vendor.js': { file: 'assets/react-vendor.js', name: 'react', imports: [] },
      'src/game/session.ts': {
        file: 'assets/game-runtime.js',
        name: 'session',
        isDynamicEntry: true,
        imports: [],
      },
    };
    const report = buildReport(withoutThree, 'index.html', sizes);

    expect(report.three).toBeNull();
    expect(evaluateReport(report)).toEqual({
      ok: false,
      violations: ['no chunk named "three" exists in the Vite manifest'],
    });
    expect(formatReport(report)).toContain('three missing');
  });

  it('reports three in the initial closure even when every ceiling holds', () => {
    const leaked: ViteManifest = {
      ...manifest,
      'index.html': {
        ...manifest['index.html'],
        imports: ['_react-vendor.js', '_three-vendor.js'],
      },
    };
    const report = buildReport(leaked, 'index.html', sizes);

    expect(report.initial.files).toEqual([
      'assets/index-entry.js',
      'assets/react-vendor.js',
      'assets/three-vendor.js',
    ]);
    expect(report.initial.gzipBytes).toBe(132900);
    expect(report.three).toEqual({
      file: 'assets/three-vendor.js',
      name: 'three',
      initial: true,
      gzipBytes: 131000,
      rawBytes: 660000,
    });
    expect(evaluateReport(report)).toEqual({
      ok: false,
      violations: ['three chunk assets/three-vendor.js is in the initial closure'],
    });
  });

  it('formats every chunk and the totals for the build log', () => {
    expect(formatReport(buildReport(manifest, 'index.html', sizes))).toBe(
      [
        'entry index assets/index-entry.js raw=1200 gzip=400',
        'initial files=2 raw=6200 gzip=1900 budget=150000',
        'three assets/three-vendor.js raw=660000 gzip=131000 budget=165000',
        'total files=4 raw=667100 gzip=133200 budget=300000',
        'chunk session assets/game-runtime.js raw=900 gzip=300 initial=false',
        'chunk index assets/index-entry.js raw=1200 gzip=400 initial=true',
        'chunk react assets/react-vendor.js raw=5000 gzip=1500 initial=true',
        'chunk three assets/three-vendor.js raw=660000 gzip=131000 initial=false',
      ].join('\n'),
    );
  });
});
