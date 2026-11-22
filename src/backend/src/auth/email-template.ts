/**
 * Branded verification email template (T3).
 *
 * Pure rendering only: no I/O, clock or randomness. The HTML is a table-based,
 * inline-CSS-only document that still works when images are blocked (the CTA
 * is a text/background button and the raw verification URL is visible). The
 * plain-text body and subject stay byte-for-byte identical to the previous
 * template so Mailpit token extraction keeps working.
 */

import { DEFAULT_VERIFICATION_TOKEN_TTL_MS } from './config.js';

/** Subject pinned by the spec; the plain-text body and subject never change. */
export const VERIFICATION_EMAIL_SUBJECT = 'Verify your CubeClicker email';

/**
 * Pinned palette (AC-15): four game literals plus five email-safe solid
 * derivations. No other `#rrggbb` literal may appear in the HTML.
 */
export const EMAIL_PALETTE = {
  void: '#04060d',
  surface: '#0a1222',
  cyan: '#7cf6ff',
  emerald: '#34d399',
  text: '#e8f6ff',
  muted: '#a9c2d8',
  metallic: '#2b4a63',
  border: '#1d3b52',
  ctaInk: '#04120c',
} as const;

/** Hidden preheader shown by clients next to the subject in the inbox list. */
const PREHEADER =
  'Your CubeClicker verification link is inside — verify your email to start playing.';

/** System font stack only: no web fonts, no external stylesheets. */
const FONT_STACK =
  "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";

const MS_PER_HOUR = 60 * 60 * 1000;

const HERO_PATH = '/email/cubeclicker-hero.png';
const CUBE_PATH = '/email/cubeclicker-cube.png';

export interface VerificationEmailOptions {
  /** Verification-token lifetime used by the expiry sentence (default: 24 hours). */
  expiresInMs?: number;
}

export interface EmailAssetUrls {
  hero: string;
  cube: string;
}

/**
 * Formats a token lifetime as whole hours or days: `1 hour`, `24 hours`,
 * `7 days`. Values below an hour round up so the note never understates the
 * remaining lifetime.
 */
export function formatExpiryDuration(expiresInMs: number): string {
  const hours = Math.max(1, Math.ceil(expiresInMs / MS_PER_HOUR));
  if (hours >= 48 && hours % 24 === 0) {
    return `${hours / 24} days`;
  }
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * Derives the public image URLs from the verification URL (whose origin is
 * `APP_BASE_URL`). A relative, malformed or non-HTTP URL degrades to relative
 * `/email/...` paths instead of throwing, so a bad base can never break the
 * verification link.
 */
export function emailAssetUrls(verificationUrl: string): EmailAssetUrls {
  try {
    const url = new URL(verificationUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { hero: HERO_PATH, cube: CUBE_PATH };
    }
    return {
      hero: `${url.origin}${HERO_PATH}`,
      cube: `${url.origin}${CUBE_PATH}`,
    };
  } catch {
    return { hero: HERO_PATH, cube: CUBE_PATH };
  }
}

/** HTML-escapes the verification URL for `href` attributes and visible text. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderVerificationEmail(
  verificationUrl: string,
  options?: VerificationEmailOptions,
): { subject: string; text: string; html: string } {
  const subject = VERIFICATION_EMAIL_SUBJECT;
  const text =
    'Welcome to CubeClicker!\n\n' +
    'Verify your email address by opening the link below:\n' +
    `${verificationUrl}\n\n` +
    'If you did not create an account, you can ignore this email.';

  const escapedUrl = escapeHtml(verificationUrl);
  const assets = emailAssetUrls(verificationUrl);
  const expiry = formatExpiryDuration(
    options?.expiresInMs ?? DEFAULT_VERIFICATION_TOKEN_TTL_MS,
  );

  // Email-safe shell: every layout table carries role="presentation", every
  // colour is inline plus a bgcolor attribute, and no style blocks, media
  // queries, SVG, scripts or CSS url() are used.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#04060d;color:#e8f6ff;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;opacity:0;color:#04060d;">${PREHEADER}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#04060d" style="width:100%;background-color:#04060d;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1222" style="width:600px;max-width:600px;background-color:#0a1222;border:1px solid #2b4a63;">
<tr>
<td height="3" bgcolor="#7cf6ff" style="height:3px;line-height:3px;font-size:0;background-color:#7cf6ff;">&nbsp;</td>
</tr>
<tr>
<td align="center">
<img src="${assets.hero}" width="600" height="200" alt="CubeClicker" style="display:block;width:600px;height:200px;border:0;outline:none;text-decoration:none;">
</td>
</tr>
<tr>
<td style="padding:32px 40px 0 40px;">
<h1 style="margin:0;font-family:${FONT_STACK};font-size:26px;line-height:34px;font-weight:700;color:#e8f6ff;">Verify your CubeClicker account</h1>
</td>
</tr>
<tr>
<td style="padding:12px 40px 0 40px;font-family:${FONT_STACK};font-size:16px;line-height:24px;color:#e8f6ff;">
<p style="margin:0;">Welcome to CubeClicker! Confirm your email address to activate your account and start clicking.</p>
</td>
</tr>
<tr>
<td style="padding:24px 40px 0 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" bgcolor="#34d399" style="border-radius:8px;background-color:#34d399;">
<a id="verify-cta" href="${escapedUrl}" style="display:inline-block;padding:14px 28px;font-family:${FONT_STACK};font-size:16px;line-height:20px;font-weight:700;color:#04120c;text-decoration:none;border-radius:8px;">Verify email</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:24px 40px 0 40px;font-family:${FONT_STACK};font-size:14px;line-height:22px;color:#a9c2d8;">
<p style="margin:0 0 6px 0;">Button not working? Copy this link into your browser:</p>
<p style="margin:0;word-break:break-all;color:#7cf6ff;"><a href="${escapedUrl}" style="color:#7cf6ff;text-decoration:underline;">${escapedUrl}</a></p>
</td>
</tr>
<tr>
<td style="padding:16px 40px 0 40px;font-family:${FONT_STACK};font-size:14px;line-height:22px;color:#a9c2d8;">
<p style="margin:0;">This link expires in ${expiry}.</p>
</td>
</tr>
<tr>
<td style="padding:28px 40px 32px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="72" valign="middle" style="width:72px;padding:0 16px 0 0;">
<img src="${assets.cube}" width="72" height="72" alt="CubeClicker cube" style="display:block;width:72px;height:72px;border:0;outline:none;text-decoration:none;">
</td>
<td valign="middle" style="font-family:${FONT_STACK};font-size:14px;line-height:22px;color:#a9c2d8;">
<p style="margin:0 0 4px 0;font-size:14px;line-height:22px;font-weight:700;color:#e8f6ff;">CubeClicker — an online cube-clicking game.</p>
<p style="margin:0;font-size:12px;line-height:20px;color:#a9c2d8;">If it wasn't you, you can safely ignore this email.</p>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td height="3" bgcolor="#1d3b52" style="height:3px;line-height:3px;font-size:0;background-color:#1d3b52;">&nbsp;</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
`;

  return { subject, text, html };
}
