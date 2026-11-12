import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../nginx.conf', import.meta.url), 'utf8');

/**
 * Comments and indentation are not part of the delivery contract; collapse them so the
 * exact directive/location text can be pinned without depending on formatting.
 */
const config = source
  .split('\n')
  .map((line) => line.replace(/#.*$/, '').trim())
  .filter((line) => line.length > 0)
  .join(' ')
  .replace(/\s+/g, ' ');

function locationBodies(): Map<string, string> {
  const bodies = new Map<string, string>();
  for (const match of config.matchAll(/location ([^{]+?) \{ ([^}]*)\}/g)) {
    bodies.set(match[1].trim(), match[2].trim());
  }
  return bodies;
}

const locations = locationBodies();

describe('production nginx delivery configuration', () => {
  it('enables gzip at level 6 with the pinned minimum length and Vary', () => {
    expect(config).toContain('gzip on;');
    expect(config).toContain('gzip_comp_level 6;');
    expect(config).toContain('gzip_min_length 128;');
    expect(config).toContain('gzip_vary on;');
  });

  it('compresses exactly the pinned static asset types', () => {
    expect(config).toContain(
      'gzip_types application/javascript text/javascript text/css application/json application/manifest+json image/svg+xml;',
    );
  });

  it('declares exactly the three delivery locations', () => {
    expect([...locations.keys()]).toEqual(['/assets/', '= /index.html', '/']);
  });

  it('serves hashed assets immutably and 404s missing asset paths', () => {
    expect(locations.get('/assets/')).toBe(
      'try_files $uri =404; add_header Cache-Control "public, max-age=31536000, immutable";',
    );
  });

  it('revalidates the app shell and keeps the SPA fallback', () => {
    expect(locations.get('= /index.html')).toBe('add_header Cache-Control "no-cache";');
    expect(locations.get('/')).toBe('try_files $uri /index.html; add_header Cache-Control "no-cache";');
  });

  it('does not enable brotli', () => {
    expect(config).not.toContain('brotli on');
    expect(config).not.toContain('brotli_types');
  });
});
