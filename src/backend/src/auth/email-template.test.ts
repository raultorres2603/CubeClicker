import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  EMAIL_PALETTE,
  VERIFICATION_EMAIL_SUBJECT,
  emailAssetUrls,
  formatExpiryDuration,
  renderVerificationEmail,
} from './email-template.js';

const VERIFICATION_URL = 'http://localhost:5173/verify?token=abc123def456';

// Resolved from this test file, not the workspace cwd: Vitest runs with
// `src/backend` as cwd (AC-17(a)).
const HERO_BYTES = readFileSync(
  new URL('../../../frontend/public/email/cubeclicker-hero.png', import.meta.url),
);
const CUBE_BYTES = readFileSync(
  new URL('../../../frontend/public/email/cubeclicker-cube.png', import.meta.url),
);

const PNG_SIGNATURE_HEX = '89504e470d0a1a0a';

const PALETTE_LITERALS: readonly string[] = Object.values(EMAIL_PALETTE);

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('renderVerificationEmail — plain text and subject (AC-7, AC-18(a))', () => {
  it('keeps the pinned subject', () => {
    const rendered = renderVerificationEmail(VERIFICATION_URL);
    expect(rendered.subject).toBe(VERIFICATION_EMAIL_SUBJECT);
    expect(rendered.subject).toBe('Verify your CubeClicker email');
  });

  it('keeps the plain-text body byte-for-byte identical', () => {
    const rendered = renderVerificationEmail(VERIFICATION_URL);
    expect(rendered.text).toBe(
      'Welcome to CubeClicker!\n\n' +
        'Verify your email address by opening the link below:\n' +
        'http://localhost:5173/verify?token=abc123def456\n\n' +
        'If you did not create an account, you can ignore this email.',
    );
  });

  it('exposes the same token to the Mailpit extraction regex', () => {
    const tokenPattern = /token=([A-Za-z0-9]+)/;
    const rendered = renderVerificationEmail(VERIFICATION_URL);
    expect(rendered.html.match(tokenPattern)?.[1]).toBe('abc123def456');
    expect(rendered.text.match(tokenPattern)?.[1]).toBe('abc123def456');
    expect(occurrences(rendered.html, 'abc123def456')).toBe(3);
  });
});

describe('renderVerificationEmail — expiry note (AC-19(a))', () => {
  it('defaults to 24 hours', () => {
    expect(renderVerificationEmail(VERIFICATION_URL).html).toContain(
      'This link expires in 24 hours.',
    );
  });

  it('formats one hour', () => {
    expect(
      renderVerificationEmail(VERIFICATION_URL, { expiresInMs: 3_600_000 }).html,
    ).toContain('This link expires in 1 hour.');
  });

  it('formats seven days', () => {
    expect(
      renderVerificationEmail(VERIFICATION_URL, { expiresInMs: 604_800_000 }).html,
    ).toContain('This link expires in 7 days.');
  });

  it('formats whole hours and days without understating the lifetime', () => {
    expect(formatExpiryDuration(3_600_000)).toBe('1 hour');
    expect(formatExpiryDuration(24 * 3_600_000)).toBe('24 hours');
    expect(formatExpiryDuration(90 * 60 * 1000)).toBe('2 hours');
    expect(formatExpiryDuration(604_800_000)).toBe('7 days');
  });
});

describe('renderVerificationEmail — document shell (AC-15)', () => {
  it('renders a complete email-safe HTML document', () => {
    const { html } = renderVerificationEmail(VERIFICATION_URL);
    expect(html.startsWith('<!doctype html>\n<html lang="en">')).toBe(true);
    expect(html.endsWith('</html>\n')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
    );
    expect(html).toContain('<meta name="color-scheme" content="dark light">');
    expect(html).toContain('<meta name="supported-color-schemes" content="dark light">');
    expect(html).toContain('<title>Verify your CubeClicker email</title>');
    expect(html).toContain(
      '<body style="margin:0;padding:0;background-color:#04060d;color:#e8f6ff;">',
    );
  });

  it('uses four presentation tables with a 600px panel and no style blocks', () => {
    const { html } = renderVerificationEmail(VERIFICATION_URL);
    expect(occurrences(html, '<table')).toBe(4);
    expect(occurrences(html, '<table role="presentation"')).toBe(4);
    expect(html).toContain(
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1222" style="width:600px;max-width:600px;background-color:#0a1222;border:1px solid #2b4a63;">',
    );
    expect(html).not.toContain('<style');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('@import');
    expect(html).not.toContain('@font-face');
    expect(html).not.toContain('url(');
  });
});

describe('renderVerificationEmail — pinned palette (AC-15)', () => {
  it('uses exactly the nine pinned hex literals and no others', () => {
    const { html } = renderVerificationEmail(VERIFICATION_URL);
    const hashTokens = html.match(/#[0-9a-fA-F]+/g) ?? [];
    expect(hashTokens).toHaveLength(24);
    expect([...new Set(hashTokens)].sort()).toEqual([...PALETTE_LITERALS].sort());
    expect(hashTokens.every((token) => PALETTE_LITERALS.includes(token))).toBe(true);
    expect(hashTokens.every((token) => /^#[0-9a-f]{6}$/.test(token))).toBe(true);
  });

  it('pins the exact occurrence count of every palette literal', () => {
    const { html } = renderVerificationEmail(VERIFICATION_URL);
    expect(occurrences(html, EMAIL_PALETTE.void)).toBe(4);
    expect(occurrences(html, EMAIL_PALETTE.surface)).toBe(2);
    expect(occurrences(html, EMAIL_PALETTE.cyan)).toBe(4);
    expect(occurrences(html, EMAIL_PALETTE.emerald)).toBe(2);
    expect(occurrences(html, EMAIL_PALETTE.text)).toBe(4);
    expect(occurrences(html, EMAIL_PALETTE.muted)).toBe(4);
    expect(occurrences(html, EMAIL_PALETTE.metallic)).toBe(1);
    expect(occurrences(html, EMAIL_PALETTE.border)).toBe(2);
    expect(occurrences(html, EMAIL_PALETTE.ctaInk)).toBe(1);
  });
});

describe('renderVerificationEmail — structure and copy (AC-15)', () => {
  it('carries the hidden preheader, headline and one CTA', () => {
    const { html } = renderVerificationEmail(VERIFICATION_URL);
    expect(html).toContain(
      'Your CubeClicker verification link is inside — verify your email to start playing.',
    );
    expect(html).toContain('Verify your CubeClicker account');
    expect(occurrences(html, 'id="verify-cta"')).toBe(1);
    expect(html).toContain(
      '<a id="verify-cta" href="http://localhost:5173/verify?token=abc123def456" style="display:inline-block;padding:14px 28px;',
    );
    expect(html).toContain('>Verify email</a>');
    expect(html).toContain(
      '<td align="center" bgcolor="#34d399" style="border-radius:8px;background-color:#34d399;">',
    );
    expect(occurrences(html, '<a ')).toBe(2);
  });

  it('shows the visible fallback URL and the footer copy', () => {
    const { html } = renderVerificationEmail(VERIFICATION_URL);
    expect(html).toContain('Button not working? Copy this link into your browser:');
    expect(html).toContain(
      '<a href="http://localhost:5173/verify?token=abc123def456" style="color:#7cf6ff;text-decoration:underline;">http://localhost:5173/verify?token=abc123def456</a>',
    );
    expect(html).toContain('CubeClicker — an online cube-clicking game.');
    expect(html).toContain("If it wasn't you, you can safely ignore this email.");
  });

  it('references exactly the two brand images with alt text and dimensions', () => {
    const { html } = renderVerificationEmail(VERIFICATION_URL);
    expect(occurrences(html, '<img ')).toBe(2);
    expect(html).toContain(
      '<img src="http://localhost:5173/email/cubeclicker-hero.png" width="600" height="200" alt="CubeClicker"',
    );
    expect(html).toContain(
      '<img src="http://localhost:5173/email/cubeclicker-cube.png" width="72" height="72" alt="CubeClicker cube"',
    );
  });

  it('contains no URL other than the verification URL and the two assets', () => {
    const { html } = renderVerificationEmail(VERIFICATION_URL);
    const urls = html.match(/https?:\/\/[^"\s<]+/g) ?? [];
    expect(urls).toEqual([
      'http://localhost:5173/email/cubeclicker-hero.png',
      'http://localhost:5173/verify?token=abc123def456',
      'http://localhost:5173/verify?token=abc123def456',
      'http://localhost:5173/verify?token=abc123def456',
      'http://localhost:5173/email/cubeclicker-cube.png',
    ]);
  });
});

describe('renderVerificationEmail — URL escaping', () => {
  it('escapes the verification URL in every href and in the visible text', () => {
    const dangerous = 'http://localhost:5173/verify?token=a<b>&c="d"';
    const escaped = 'http://localhost:5173/verify?token=a&lt;b&gt;&amp;c=&quot;d&quot;';
    const { html } = renderVerificationEmail(dangerous);
    expect(html).toContain(`<a id="verify-cta" href="${escaped}" style=`);
    expect(html).toContain(
      `<a href="${escaped}" style="color:#7cf6ff;text-decoration:underline;">${escaped}</a>`,
    );
    expect(occurrences(html, escaped)).toBe(3);
    expect(html).not.toContain(dangerous);
    expect(html).not.toContain('<b>');
  });
});

describe('emailAssetUrls — absolute origin and relative fallback (AC-16(a), (e))', () => {
  it('derives absolute asset URLs from the verification URL origin', () => {
    expect(emailAssetUrls('http://localhost:5173/verify?token=x')).toEqual({
      hero: 'http://localhost:5173/email/cubeclicker-hero.png',
      cube: 'http://localhost:5173/email/cubeclicker-cube.png',
    });
    expect(emailAssetUrls('https://cubeclicker.example/verify?token=x')).toEqual({
      hero: 'https://cubeclicker.example/email/cubeclicker-hero.png',
      cube: 'https://cubeclicker.example/email/cubeclicker-cube.png',
    });
  });

  it('falls back to relative asset URLs for a relative verification URL', () => {
    expect(emailAssetUrls('/verify?token=x')).toEqual({
      hero: '/email/cubeclicker-hero.png',
      cube: '/email/cubeclicker-cube.png',
    });
  });

  it('falls back to relative asset URLs for a malformed or non-HTTP URL', () => {
    const fallback = {
      hero: '/email/cubeclicker-hero.png',
      cube: '/email/cubeclicker-cube.png',
    };
    expect(emailAssetUrls('not a url')).toEqual(fallback);
    expect(emailAssetUrls('mailto:user@example.com')).toEqual(fallback);
  });

  it('renders a relative verification URL without throwing', () => {
    const { html } = renderVerificationEmail('/verify?token=x');
    expect(html).toContain('src="/email/cubeclicker-hero.png"');
    expect(html).toContain('src="/email/cubeclicker-cube.png"');
    expect(html).toContain('<a id="verify-cta" href="/verify?token=x" style=');
    expect(html).toContain('>/verify?token=x</a>');
  });

  it('renders a malformed verification URL without throwing', () => {
    const { html } = renderVerificationEmail('not a url');
    expect(html).toContain('src="/email/cubeclicker-hero.png"');
    expect(html).toContain('src="/email/cubeclicker-cube.png"');
    expect(html).toContain('<a id="verify-cta" href="not a url" style=');
    expect(html).toContain('>not a url</a>');
  });
});

describe('renderVerificationEmail — byte budgets (AC-17(b), (c))', () => {
  it('stays within the 20 KiB HTML budget', () => {
    const { html } = renderVerificationEmail(VERIFICATION_URL);
    const htmlBytes = Buffer.byteLength(html, 'utf8');
    expect(htmlBytes).toBe(4_322);
    expect(htmlBytes).toBeLessThanOrEqual(20_480);
  });

  it('keeps text + HTML + referenced images under 100 KiB', () => {
    const { text, html } = renderVerificationEmail(VERIFICATION_URL);
    const combinedBytes =
      Buffer.byteLength(text, 'utf8') +
      Buffer.byteLength(html, 'utf8') +
      HERO_BYTES.length +
      CUBE_BYTES.length;
    expect(combinedBytes).toBe(9_448);
    expect(combinedBytes).toBeLessThan(102_400);
  });
});

describe('committed email assets (AC-17(a))', () => {
  it('ships a valid 600x200 hero PNG within 60 KiB', () => {
    expect(HERO_BYTES.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE_HEX);
    expect(HERO_BYTES.readUInt32BE(16)).toBe(600);
    expect(HERO_BYTES.readUInt32BE(20)).toBe(200);
    expect(HERO_BYTES.length).toBe(4_357);
    expect(HERO_BYTES.length).toBeLessThanOrEqual(61_440);
  });

  it('ships a valid 72x72 cube PNG within 15 KiB', () => {
    expect(CUBE_BYTES.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE_HEX);
    expect(CUBE_BYTES.readUInt32BE(16)).toBe(72);
    expect(CUBE_BYTES.readUInt32BE(20)).toBe(72);
    expect(CUBE_BYTES.length).toBe(582);
    expect(CUBE_BYTES.length).toBeLessThanOrEqual(15_360);
  });
});

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe('palette contrast (AC-17(c))', () => {
  const pairs: Array<{
    label: string;
    foreground: string;
    background: string;
    expectedRatio: string;
  }> = [
    {
      label: 'text on surface',
      foreground: EMAIL_PALETTE.text,
      background: EMAIL_PALETTE.surface,
      expectedRatio: '16.98',
    },
    {
      label: 'muted on surface',
      foreground: EMAIL_PALETTE.muted,
      background: EMAIL_PALETTE.surface,
      expectedRatio: '10.15',
    },
    {
      label: 'muted on void',
      foreground: EMAIL_PALETTE.muted,
      background: EMAIL_PALETTE.void,
      expectedRatio: '10.99',
    },
    {
      label: 'cyan on void',
      foreground: EMAIL_PALETTE.cyan,
      background: EMAIL_PALETTE.void,
      expectedRatio: '15.89',
    },
    {
      label: 'CTA ink on emerald',
      foreground: EMAIL_PALETTE.ctaInk,
      background: EMAIL_PALETTE.emerald,
      expectedRatio: '9.96',
    },
  ];

  for (const pair of pairs) {
    it(`${pair.label} meets WCAG AA`, () => {
      const ratio = contrastRatio(pair.foreground, pair.background);
      expect(ratio.toFixed(2)).toBe(pair.expectedRatio);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});
