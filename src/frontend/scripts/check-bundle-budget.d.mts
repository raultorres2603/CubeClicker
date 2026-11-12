// Type declarations for `scripts/check-bundle-budget.mjs`, consumed by
// `src/build/bundle-budget.test.ts`. The script itself is plain ESM outside the
// `src` coverage include; this declaration gives the test the report contract.

export interface BundleBudgets {
  readonly initialGzipBytes: 150000;
  readonly threeGzipBytes: 165000;
  readonly totalGzipBytes: 300000;
}

export interface ManifestChunk {
  file: string;
  name?: string;
  names?: string[];
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
  assets?: string[];
}

export type ViteManifest = Record<string, ManifestChunk>;

export interface ChunkSize {
  rawBytes: number;
  gzipBytes: number;
}

export interface BundleReportEntry {
  name: string;
  file: string;
  gzipBytes: number;
  rawBytes: number;
}

export interface BundleReportTotals {
  files: string[];
  gzipBytes: number;
  rawBytes: number;
}

export interface BundleReportThree {
  file: string;
  name: 'three';
  /** False on a passing build (the AC-1/AC-9 pin); true only in a violating report. */
  initial: boolean;
  gzipBytes: number;
  rawBytes: number;
}

export interface BundleReportChunk {
  name: string;
  file: string;
  initial: boolean;
  gzipBytes: number;
  rawBytes: number;
}

export interface BundleReport {
  version: 1;
  budgets: BundleBudgets;
  entry: BundleReportEntry;
  initial: BundleReportTotals;
  three: BundleReportThree | null;
  total: BundleReportTotals;
  chunks: BundleReportChunk[];
}

export interface BundleEvaluation {
  ok: boolean;
  violations: string[];
}

export declare const BUDGETS: BundleBudgets;

export declare function findEntryKey(manifest: ViteManifest): string;

export declare function initialClosure(manifest: ViteManifest, entryKey: string): string[];

export declare function buildReport(
  manifest: ViteManifest,
  entryKey: string,
  sizes: Record<string, ChunkSize>,
): BundleReport;

export declare function evaluateReport(report: BundleReport): BundleEvaluation;

export declare function formatReport(report: BundleReport): string;
