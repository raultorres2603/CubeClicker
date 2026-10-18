// Flat ESLint config for the CubeClicker workspace (ESLint 9 + typescript-eslint).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['**/dist/', '**/node_modules/', '**/coverage/', 'tests/e2e/**'],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    // Workspace code and root configs run on Node.
    files: ['*.{js,mjs,cjs}', 'src/backend/**/*.{ts,tsx}', 'tests/**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // The frontend is a browser SPA; React hooks rules apply here only.
    files: ['src/frontend/**/*.{ts,tsx,js,mjs,cjs}'],
    extends: [reactHooks.configs['recommended-latest']],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
);
