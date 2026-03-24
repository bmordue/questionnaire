/**
 * Auth Middleware
 *
 * Express middleware for session-cookie based authentication.
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from '../../core/auth/auth-service.js';
import type { PublicUser } from '../../core/schemas/user.js';

export const AUTH_COOKIE_NAME = 'qsession';

/**
 * Attach the auth service to res.locals so downstream middleware and routes can use it.
 */
export function injectAuthService(authService: AuthService) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.locals['authService'] = authService;
    next();
  };
}

/**
 * Populate res.locals.user if a valid session cookie is present.
 * This is non-blocking – requests without a valid cookie are allowed to continue.
 */
export function loadUser(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractToken(req);
      if (token) {
        const user = await authService.validateSession(token);
        if (user) {
          res.locals['user'] = user;
        }
      }
    } catch {
      // Non-fatal: proceed unauthenticated
    }
    next();
  };
}

/**
 * Require a valid session. Returns 401 if unauthenticated.
 */
export function requireAuth(_req: Request, res: Response, next: NextFunction): void {
  if (!res.locals['user']) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Require an admin role. Returns 403 if not admin.
 */
export function requireAdmin(_req: Request, res: Response, next: NextFunction): void {
  const user = res.locals['user'] as PublicUser | undefined;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Set the auth cookie on the response.
 */
export function setAuthCookie(res: Response, token: string, maxAgeMs = 24 * 60 * 60 * 1000): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: maxAgeMs,
    path: '/',
  });
}

/**
 * Clear the auth cookie.
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
}

/**
 * Extract the session token from the cookie header.
 */
export function extractToken(req: Request): string | null {
  // Express cookie-parser populates req.cookies; fall back to manual parsing
  const cookies: Record<string, string> = (req as any).cookies ?? parseCookieHeader(req.headers.cookie ?? '');
  return cookies[AUTH_COOKIE_NAME] ?? null;
}

function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key) result[key.trim()] = decodeURIComponent(valueParts.join('='));
  }
  return result;
}
