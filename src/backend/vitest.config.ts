import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Justified exclusion: the only excluded production file is the composition-root
      // entrypoint, which only wires modules together and is exercised end-to-end by the
      // containerized smoke test (`npm run smoke`). Test files are excluded too; the
      // spread keeps every built-in Vitest default exclusion in place.
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/server.ts',
        ...coverageConfigDefaults.exclude,
      ],
      // All-files semantics: every non-excluded source file counts, imported or not.
      all: true,
      reporter: ['text'],
      // Pinned bar: 80 on all four metrics — statements, branches, functions, and lines.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
