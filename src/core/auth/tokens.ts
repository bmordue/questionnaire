/**
 * Token Utilities
 *
 * Secure random token generation for password resets and CSRF protection.
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token of the given byte length,
 * returned as a hex string (2× the byte length in characters).
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a CSRF token suitable for use in forms.
 */
export function generateCsrfToken(): string {
  return generateSecureToken(24);
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still perform a dummy comparison to keep timing consistent
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
