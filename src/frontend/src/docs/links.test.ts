import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Lightweight automated check for relative links in `docs/architecture/documentation.md`.
 *
 * This is the backlog item Q-3 (docs-on-feature-acceptance): keep every relative link
 * in the documentation reference resolvable to an existing file. External (http/https),
 * mailto, and anchor-only targets are skipped. The check is intentionally scoped to
 * `documentation.md` only — it is not a full documentation crawler.
 */
const DOC_RELATIVE_PATH = 'docs/architecture/documentation.md';

function resolveDocumentationPath(): string {
  const candidates = [
    resolve(process.cwd(), DOC_RELATIVE_PATH),
    resolve(process.cwd(), '..', DOC_RELATIVE_PATH),
    resolve(process.cwd(), '../..', DOC_RELATIVE_PATH),
    resolve(process.cwd(), '../../..', DOC_RELATIVE_PATH),
    resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../docs/architecture/documentation.md'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

describe('documentation.md relative links', () => {
  it('resolves every relative markdown link to an existing file', () => {
    const docPath = resolveDocumentationPath();
    expect(existsSync(docPath)).toBe(true);

    const content = readFileSync(docPath, 'utf8');
    const docDir = dirname(docPath);

    const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
    const relativeTargets: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(content)) !== null) {
      const rawTarget = match[1].trim();
      // Strip an optional title: [text](target "title").
      const target = rawTarget.split(/\s+/)[0].replace(/^<|>$/g, '');

      if (target === '') continue;
      if (/^https?:/i.test(target)) continue;
      if (/^mailto:/i.test(target)) continue;
      if (target.startsWith('#')) continue;

      // Strip any trailing anchor/query fragment.
      const cleaned = target.split('#')[0].split('?')[0];
      if (cleaned === '') continue;

      relativeTargets.push(cleaned);
    }

    expect(relativeTargets.length).toBeGreaterThan(0);

    for (const relativeTarget of relativeTargets) {
      const resolved = resolve(docDir, relativeTarget);
      expect(existsSync(resolved)).toBe(true);
    }
  });
});